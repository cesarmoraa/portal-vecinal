import { query } from "../db/pool.js";

export async function logAudit({
  userId = null,
  role = null,
  userIdentifier = null,
  ip = null,
  action,
  entity,
  entityId = null,
  previousValue = null,
  newValue = null,
  metadata = null,
  db = null,
}) {
  const executor = db ?? { query };

  await executor.query(
    `
      insert into auditoria (
        usuario_id,
        usuario_identificador,
        rol,
        ip,
        accion,
        entidad,
        entidad_id,
        valor_anterior,
        valor_nuevo,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)
    `,
    [
      userId,
      userIdentifier,
      role,
      ip,
      action,
      entity,
      entityId,
      previousValue ? JSON.stringify(previousValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

