import { withTransaction } from "../db/pool.js";
import { AppError } from "../lib/appError.js";
import { normalizeConcept } from "../lib/normalizers.js";
import { logAudit } from "./auditService.js";
import { getVecinoLedger } from "./neighborService.js";

function toLegacyTipoPago(concepto) {
  return normalizeConcept(concepto).toLowerCase();
}

async function getPublicTableColumns(client, tableName) {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
    `,
    [tableName],
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function buildDynamicInsert(tableName, payload) {
  const entries = Object.entries(payload);
  const columns = entries.map(([column]) => column).join(", ");
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");

  return {
    sql: `insert into ${tableName} (${columns}) values (${placeholders})`,
    values: entries.map(([, value]) => value),
  };
}

async function ensureVecinoExists(client, vecinoId) {
  const result = await client.query(
    "select id, direccion, representante_nombre from vecinos where id = $1",
    [vecinoId],
  );
  const vecino = result.rows[0];

  if (!vecino) {
    throw new AppError(404, "Dirección no encontrada.");
  }

  return vecino;
}

export async function createPayment({ actor, ip, payload }) {
  const concepto = normalizeConcept(payload.concepto);

  if (!["PORTONES", "MANTENCION"].includes(concepto)) {
    throw new AppError(400, "Concepto inválido.");
  }

  if (!payload.fechaPago || !payload.monto) {
    throw new AppError(400, "Fecha y monto son obligatorios.");
  }

  return withTransaction(async (client) => {
    const vecino = await ensureVecinoExists(client, payload.vecinoId);
    const paymentDate = new Date(payload.fechaPago);
    const paymentColumns = await getPublicTableColumns(client, "pagos");
    const insertPayload = {
      vecino_id: payload.vecinoId,
      monto: Number(payload.monto),
      fecha_pago: payload.fechaPago,
      period_year: paymentDate.getUTCFullYear(),
      period_month: paymentDate.getUTCMonth() + 1,
      observacion: payload.observacion?.trim() || null,
      source: "manual",
      created_by: actor.id,
      updated_by: actor.id,
    };

    if (paymentColumns.has("concepto")) {
      insertPayload.concepto = concepto;
    }

    if (paymentColumns.has("tipo_pago")) {
      insertPayload.tipo_pago = toLegacyTipoPago(concepto);
    }

    const insert = buildDynamicInsert("pagos", insertPayload);
    const insertResult = await client.query(
      `${insert.sql} returning *`,
      insert.values,
    );

    const payment = insertResult.rows[0];

    await logAudit({
      userId: actor.id,
      role: actor.role,
      userIdentifier: actor.username ?? `${actor.pasaje} ${actor.numeracion}`,
      ip,
      action: "payment.create",
      entity: "pagos",
      entityId: payment.id,
      newValue: payment,
      metadata: {
        vecino: vecino.direccion,
      },
      db: client,
    });

    return payment;
  });
}

export async function updatePayment({ actor, ip, paymentId, payload }) {
  const concepto = normalizeConcept(payload.concepto);

  return withTransaction(async (client) => {
    const paymentColumns = await getPublicTableColumns(client, "pagos");
    const currentResult = await client.query(
      `
        select *
        from pagos
        where id = $1 and deleted_at is null
      `,
      [paymentId],
    );

    const current = currentResult.rows[0];

    if (!current) {
      throw new AppError(404, "Pago no encontrado.");
    }

    const mutableFields = {
      monto: Number(payload.monto),
      fecha_pago: payload.fechaPago,
      period_year: new Date(payload.fechaPago).getUTCFullYear(),
      period_month: new Date(payload.fechaPago).getUTCMonth() + 1,
      observacion: payload.observacion?.trim() || null,
      updated_by: actor.id,
    };

    if (paymentColumns.has("concepto")) {
      mutableFields.concepto = concepto;
    }

    if (paymentColumns.has("tipo_pago")) {
      mutableFields.tipo_pago = toLegacyTipoPago(concepto);
    }

    const updates = Object.keys(mutableFields)
      .map((column, index) => `${column} = $${index + 2}`)
      .join(", ");

    const updateResult = await client.query(
      `
        update pagos
        set
          ${updates}
        where id = $1
        returning *
      `,
      [paymentId, ...Object.values(mutableFields)],
    );

    const updated = updateResult.rows[0];

    await logAudit({
      userId: actor.id,
      role: actor.role,
      userIdentifier: actor.username ?? `${actor.pasaje} ${actor.numeracion}`,
      ip,
      action: "payment.update",
      entity: "pagos",
      entityId: paymentId,
      previousValue: current,
      newValue: updated,
      db: client,
    });

    return updated;
  });
}

export async function getPaymentLedger(vecinoId) {
  return getVecinoLedger(vecinoId);
}
