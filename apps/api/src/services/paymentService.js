import { withTransaction } from "../db/pool.js";
import { AppError } from "../lib/appError.js";
import { normalizeConcept } from "../lib/normalizers.js";
import { logAudit } from "./auditService.js";
import { getVecinoLedger } from "./neighborService.js";

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

    const insertResult = await client.query(
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
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'manual', $8, $8)
        returning *
      `,
      [
        payload.vecinoId,
        concepto,
        Number(payload.monto),
        payload.fechaPago,
        paymentDate.getUTCFullYear(),
        paymentDate.getUTCMonth() + 1,
        payload.observacion?.trim() || null,
        actor.id,
      ],
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

    const updateResult = await client.query(
      `
        update pagos
        set
          concepto = $2,
          monto = $3,
          fecha_pago = $4,
          period_year = $5,
          period_month = $6,
          observacion = $7,
          updated_by = $8
        where id = $1
        returning *
      `,
      [
        paymentId,
        concepto,
        Number(payload.monto),
        payload.fechaPago,
        new Date(payload.fechaPago).getUTCFullYear(),
        new Date(payload.fechaPago).getUTCMonth() + 1,
        payload.observacion?.trim() || null,
        actor.id,
      ],
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
