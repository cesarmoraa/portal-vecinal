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

function buildParsedPaymentsMap(payments) {
  return payments.reduce((acc, payment) => {
    const key = `${payment.vecinoKey}:${payment.concepto}`;
    acc[key] = (acc[key] ?? 0) + Number(payment.monto);
    return acc;
  }, {});
}

async function upsertImportedPayment(client, payment) {
  const existing = await client.query(
    `
      select id
      from pagos
      where vecino_id = $1
        and concepto = $2
        and source = $3
        and source_ref is not distinct from $4
        and deleted_at is null
      limit 1
    `,
    [payment.vecinoId, payment.concepto, payment.source, payment.sourceRef ?? null],
  );

  if (existing.rowCount > 0) {
    await client.query(
      `
        update pagos
        set
          monto = $2,
          fecha_pago = $3,
          period_year = $4,
          period_month = $5,
          observacion = $6,
          updated_at = now()
        where id = $1
      `,
      [
        existing.rows[0].id,
        payment.monto,
        payment.fechaPago,
        payment.periodYear,
        payment.periodMonth,
        payment.observacion,
      ],
    );
    return;
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
    `,
    [
      payment.vecinoId,
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

async function upsertVecino(client, vecino) {
  const existing = await client.query(
    `
      select id
      from vecinos
      where upper(pasaje) = upper($1)
        and numeracion = $2
      limit 1
    `,
    [vecino.pasaje, vecino.numeracion],
  );

  if (existing.rowCount > 0) {
    const updated = await client.query(
      `
        update vecinos
        set
          comuna = $2,
          pais = $3,
          direccion = $4,
          coordenadas = $5,
          latitud = $6,
          longitud = $7,
          representante_nombre = $8,
          telefono = $9,
          firma_vobo = $10,
          updated_at = now()
        where id = $1
        returning id
      `,
      [
        existing.rows[0].id,
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

    return updated.rows[0].id;
  }

  const inserted = await client.query(
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

  return inserted.rows[0].id;
}

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
    const configs = await fetchConfigs(client);
    let importedPaymentsCount = 0;

    if (sosMode) {
      await client.query(
        "delete from pagos where source in ('excel', 'excel_resumen') and period_year = $1",
        [year],
      );
    }

    const vecinoIdByKey = new Map();
    const importedMonthlyTotals = buildParsedPaymentsMap(parsed.payments);

    for (const vecino of parsed.vecinos) {
      const vecinoId = await upsertVecino(client, vecino);
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

      await upsertImportedPayment(client, {
        vecinoId,
        concepto: payment.concepto,
        monto: payment.monto,
        fechaPago: payment.fechaPago,
        periodYear: payment.periodYear,
        periodMonth: payment.periodMonth,
        observacion: payment.observacion,
        source: payment.source,
        sourceRef: payment.sourceRef,
      });
      importedPaymentsCount += 1;
    }

    for (const vecino of parsed.vecinos) {
      const vecinoId = vecinoIdByKey.get(`${vecino.pasaje}::${vecino.numeracion}`);

      if (!vecinoId) {
        continue;
      }

      for (const [concepto, equivalentQuotas] of [
        ["PORTONES", Number(vecino.cuotaPortonesInicial) || 0],
        ["MANTENCION", Number(vecino.cuotaMantencionInicial) || 0],
      ]) {
        if (equivalentQuotas <= 0) {
          continue;
        }

        const config = configs[normalizeConcept(concepto)];

        if (!config?.valor_cuota) {
          throw new AppError(
            400,
            `Falta configuración activa para ${concepto}. Ajusta CONFIGURACION_COBROS antes de importar.`,
          );
        }

        const targetAmount = equivalentQuotas * Number(config.valor_cuota);
        const alreadyImportedAmount =
          importedMonthlyTotals[`${vecino.pasaje}::${vecino.numeracion}:${concepto}`] ?? 0;
        const missingAmount = Math.max(0, targetAmount - alreadyImportedAmount);

        if (missingAmount <= 0) {
          continue;
        }

        await upsertImportedPayment(client, {
          vecinoId,
          concepto,
          monto: missingAmount,
          fechaPago: `${year}-01-01`,
          periodYear: year,
          periodMonth: null,
          observacion: `Precarga desde Resumen (${equivalentQuotas} cuotas equivalentes)`,
          source: "excel_resumen",
          sourceRef: `RESUMEN:${concepto}:${year}`,
        });
        importedPaymentsCount += 1;
      }
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
        pagos: importedPaymentsCount,
        sosMode,
      },
      db: client,
    });

    return {
      importedVecinos: parsed.vecinos.length,
      importedPayments: importedPaymentsCount,
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
