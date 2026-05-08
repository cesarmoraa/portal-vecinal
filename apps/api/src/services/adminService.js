import fs from "node:fs/promises";
import path from "node:path";
import { query, withTransaction } from "../db/pool.js";
import { AppError } from "../lib/appError.js";
import { buildExportWorkbook, buildInitialNeighborUser, groupPaymentsByVecino, parseExcelWorkbook } from "../lib/excel.js";
import { last4Digits, normalizeConcept, normalizePasaje } from "../lib/normalizers.js";
import { hashSecret } from "../lib/security.js";
import { logAudit } from "./auditService.js";
import {
  buildVecinoFinancialSummary,
  fetchConfigs,
  fetchPaymentTotals,
  fetchVecinos,
} from "./dashboardService.js";

export async function updateBillingConfig({ actor, req, concept, payload }) {
  const normalizedConcept = normalizeConcept(concept);

  if (!["PORTONES", "MANTENCION"].includes(normalizedConcept)) {
    throw new AppError(400, "Concepto inválido.");
  }

  return withTransaction(async (client) => {
    const previous = await client.query(
      "select * from configuracion_cobros where concepto = $1",
      [normalizedConcept],
    );

    const result = await client.query(
      `
        insert into configuracion_cobros (
          concepto,
          cuotas_totales,
          valor_cuota,
          anio,
          mes_inicio,
          activo
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (concepto) do update
        set
          cuotas_totales = excluded.cuotas_totales,
          valor_cuota = excluded.valor_cuota,
          anio = excluded.anio,
          mes_inicio = excluded.mes_inicio,
          activo = excluded.activo
        returning *
      `,
      [
        normalizedConcept,
        Number(payload.cuotasTotales),
        Number(payload.valorCuota),
        Number(payload.anio),
        Number(payload.mesInicio ?? 1),
        Boolean(payload.activo),
      ],
    );

    await logAudit({
      userId: actor.id,
      userIdentifier: actor.username,
      role: actor.role,
      ip: req.ip,
      action: "admin.update_billing_config",
      entity: "configuracion_cobros",
      entityId: normalizedConcept,
      previousValue: previous.rows[0] ?? null,
      newValue: result.rows[0],
      db: client,
    });

    return result.rows[0];
  });
}

export async function listAudit({ limit = 100 }) {
  const result = await query(
    `
      select
        id,
        usuario_identificador,
        rol,
        ip,
        accion,
        entidad,
        entidad_id,
        valor_anterior,
        valor_nuevo,
        metadata,
        created_at
      from auditoria
      order by created_at desc
      limit $1
    `,
    [Math.min(Number(limit), 500)],
  );

  return result.rows;
}

export async function importWorkbookToDatabase({
  actor,
  req,
  source,
  year,
  sosMode = false,
}) {
  if (!source) {
    throw new AppError(400, "Debes adjuntar un archivo Excel válido.");
  }

  const parsed = await parseExcelWorkbook(source, year);

  return withTransaction(async (client) => {
    if (sosMode) {
      await client.query(
        "delete from pagos where source = 'excel' and period_year = $1",
        [year],
      );
    }

    const vecinoIdByKey = new Map();

    for (const vecino of parsed.vecinos) {
      const result = await client.query(
        `
          insert into vecinos (
            pasaje,
            numeracion,
            comuna,
            pais,
            direccion,
            coordenadas,
            latitud,
            longitud,
            representante_nombre,
            telefono,
            firma_vobo
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          on conflict (pasaje, numeracion) do update
          set
            comuna = excluded.comuna,
            pais = excluded.pais,
            direccion = excluded.direccion,
            coordenadas = excluded.coordenadas,
            latitud = excluded.latitud,
            longitud = excluded.longitud,
            representante_nombre = excluded.representante_nombre,
            telefono = excluded.telefono,
            firma_vobo = excluded.firma_vobo
          returning id
        `,
        [
          vecino.pasaje,
          vecino.numeracion,
          vecino.comuna,
          vecino.pais,
          vecino.direccion,
          vecino.coordenadas,
          vecino.latitud,
          vecino.longitud,
          vecino.representanteNombre,
          vecino.telefono,
          vecino.firmaVobo,
        ],
      );

      const vecinoId = result.rows[0].id;
      vecinoIdByKey.set(`${vecino.pasaje}::${vecino.numeracion}`, vecinoId);

      const userExists = await client.query(
        `
          select id
          from users
          where role = 'vecino'
            and pasaje = $1
            and numeracion = $2
        `,
        [vecino.pasaje, vecino.numeracion],
      );

      if (userExists.rowCount === 0) {
        const initialPin = buildInitialNeighborUser(
          vecino,
          await hashSecret(last4Digits(vecino.telefono)),
        );

        await client.query(
          `
            insert into users (
              role,
              vecino_id,
              pasaje,
              numeracion,
              full_name,
              phone,
              pin_hash,
              must_change_password,
              active
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, true)
          `,
          [
            initialPin.role,
            vecinoId,
            initialPin.pasaje,
            initialPin.numeracion,
            initialPin.fullName,
            initialPin.phone,
            initialPin.pinHash,
            initialPin.mustChangePassword,
          ],
        );
      } else {
        await client.query(
          `
            update users
            set
              vecino_id = $1,
              full_name = $2,
              phone = $3,
              active = true
            where role = 'vecino'
              and pasaje = $4
              and numeracion = $5
          `,
          [
            vecinoId,
            vecino.representanteNombre,
            vecino.telefono,
            vecino.pasaje,
            vecino.numeracion,
          ],
        );
      }
    }

    for (const payment of parsed.payments) {
      const vecinoId = vecinoIdByKey.get(payment.vecinoKey);

      if (!vecinoId) {
        continue;
      }

      await client.query(
        `
          insert into pagos (
            vecino_id,
            concepto,
            monto,
            fecha_pago,
            period_year,
            period_month,
            observacion,
            source,
            source_ref
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (vecino_id, concepto, source, source_ref)
          where source_ref is not null and deleted_at is null
          do update
          set
            monto = excluded.monto,
            fecha_pago = excluded.fecha_pago,
            period_year = excluded.period_year,
            period_month = excluded.period_month,
            observacion = excluded.observacion
        `,
        [
          vecinoId,
          payment.concepto,
          payment.monto,
          payment.fechaPago,
          payment.periodYear,
          payment.periodMonth,
          payment.observacion,
          payment.source,
          payment.sourceRef,
        ],
      );
    }

    await logAudit({
      userId: actor?.id ?? null,
      userIdentifier: actor?.username ?? "cli-import",
      role: actor?.role ?? "admin",
      ip: req?.ip ?? null,
      action: "admin.import_excel",
      entity: "excel",
      entityId: `${year}`,
      newValue: {
        vecinos: parsed.vecinos.length,
        pagos: parsed.payments.length,
        sosMode,
      },
      db: client,
    });

    return {
      importedVecinos: parsed.vecinos.length,
      importedPayments: parsed.payments.length,
      sosMode,
    };
  });
}

export async function exportDatabaseToWorkbook({ actor, req, year, outputPath = null }) {
  const [vecinos, configs, totalsMap, paymentsResult] = await Promise.all([
    fetchVecinos(),
    fetchConfigs(),
    fetchPaymentTotals(),
    query(
      `
        select vecino_id, concepto, monto, period_year, period_month, fecha_pago
        from pagos
        where deleted_at is null
        order by fecha_pago asc
      `,
    ),
  ]);

  const financials = vecinos.map((vecino) =>
    buildVecinoFinancialSummary(vecino, totalsMap, configs),
  );
  const paymentsByVecino = groupPaymentsByVecino(paymentsResult.rows);
  const buffer = await buildExportWorkbook({ financials, paymentsByVecino, year });

  if (outputPath) {
    const absolutePath = path.resolve(outputPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
  }

  if (actor) {
    await logAudit({
      userId: actor.id,
      userIdentifier: actor.username,
      role: actor.role,
      ip: req?.ip ?? null,
      action: "admin.export_excel",
      entity: "excel",
      entityId: `${year}`,
      metadata: { outputPath },
    });
  }

  return buffer;
}

export async function searchVecinosForAdmin(searchText = "") {
  const normalized = `%${normalizePasaje(searchText)}%`;
  const raw = `%${`${searchText ?? ""}`.trim()}%`;
  const result = await query(
    `
      select
        v.id,
        v.direccion,
        v.representante_nombre,
        v.telefono,
        v.firma_vobo
      from vecinos v
      where upper(v.direccion) like $1 or cast(v.numeracion as text) like $2
      order by v.pasaje, v.numeracion
      limit 30
    `,
    [normalized, raw],
  );

  return result.rows;
}
