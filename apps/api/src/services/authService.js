import { query, withTransaction } from "../db/pool.js";
import { AppError } from "../lib/appError.js";
import {
  last4Digits,
  normalizePasaje,
  normalizeUsername,
} from "../lib/normalizers.js";
import {
  clearSessionCookie,
  compareSecret,
  extractIp,
  hashSecret,
  setSessionCookie,
  signSession,
} from "../lib/security.js";
import { logAudit } from "./auditService.js";

const MAX_FAILED_ATTEMPTS = 6;
const LOCK_MINUTES = 15;

function isUserActive(user) {
  if (typeof user?.active === "boolean") {
    return user.active;
  }

  if (typeof user?.activo === "boolean") {
    return user.activo;
  }

  return true;
}

function getStoredSecretHash(user) {
  return user?.pin_hash ?? user?.password_hash ?? null;
}

async function getPublicTableColumns(db, tableName) {
  const result = await db.query(
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

function publicUser(user) {
  return {
    id: user.id,
    role: user.role,
    vecinoId: user.vecino_id ?? null,
    fullName: user.full_name,
    mustChangePassword: user.must_change_password,
    username: user.username ?? null,
    pasaje: user.pasaje ?? null,
    numeracion: user.numeracion ?? null,
  };
}

async function loadLoginUser(payload) {
  if (payload.role === "vecino") {
    const pasaje = normalizePasaje(payload.pasaje);
    const numeracion = Number(payload.numeracion);
    const result = await query(
      `
        select *
        from users
        where role = 'vecino'
          and pasaje = $1
          and numeracion = $2
      `,
      [pasaje, numeracion],
    );

    return result.rows[0] ?? null;
  }

  const username = normalizeUsername(payload.username);
  const result = await query(
    `
      select *
      from users
      where lower(username) = $1
        and role in ('admin', 'tesorero')
    `,
    [username],
  );

  return result.rows[0] ?? null;
}

async function registerFailedAttempt(user, ip, payload) {
  if (!user) {
    await logAudit({
      userIdentifier:
        payload.role === "vecino"
          ? `${normalizePasaje(payload.pasaje)} ${payload.numeracion}`
          : normalizeUsername(payload.username),
      role: payload.role,
      ip,
      action: "auth.login_failed",
      entity: "users",
      metadata: { reason: "user_not_found" },
    });
    return;
  }

  const attempts = user.failed_login_attempts + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = locked
    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
    : null;

  await query(
    `
      update users
      set
        failed_login_attempts = $2,
        locked_until = $3
      where id = $1
    `,
    [user.id, attempts, lockedUntil],
  );

  await logAudit({
    userId: user.id,
    userIdentifier: user.username ?? `${user.pasaje} ${user.numeracion}`,
    role: user.role,
    ip,
    action: "auth.login_failed",
    entity: "users",
    entityId: user.id,
    metadata: {
      failedLoginAttempts: attempts,
      lockedUntil,
    },
  });
}

export async function login(payload, req, res) {
  const ip = extractIp(req);
  const user = await loadLoginUser(payload);
  const secret = payload.role === "vecino" ? `${payload.pin ?? ""}` : `${payload.password ?? ""}`;

  if (!user) {
    await registerFailedAttempt(null, ip, payload);
    throw new AppError(401, "Credenciales inválidas.");
  }

  if (!isUserActive(user)) {
    throw new AppError(403, "Usuario inactivo.");
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new AppError(423, "Cuenta temporalmente bloqueada por seguridad.");
  }

  const isValid = await compareSecret(secret, getStoredSecretHash(user));

  if (!isValid) {
    await registerFailedAttempt(user, ip, payload);
    throw new AppError(401, "Credenciales inválidas.");
  }

  await query(
    `
      update users
      set
        failed_login_attempts = 0,
        locked_until = null,
        last_login_at = now()
      where id = $1
    `,
    [user.id],
  );

  const token = signSession(user);
  setSessionCookie(res, token);

  await logAudit({
    userId: user.id,
    userIdentifier: user.username ?? `${user.pasaje} ${user.numeracion}`,
    role: user.role,
    ip,
    action: "auth.login_success",
    entity: "users",
    entityId: user.id,
  });

  return publicUser(user);
}

export async function logout(req, res) {
  clearSessionCookie(res);

  if (req.user) {
    await logAudit({
      userId: req.user.id,
      userIdentifier: req.user.username ?? `${req.user.pasaje} ${req.user.numeracion}`,
      role: req.user.role,
      ip: extractIp(req),
      action: "auth.logout",
      entity: "users",
      entityId: req.user.id,
    });
  }
}

export async function changeOwnPin(user, payload, req) {
  const currentPin = `${payload.currentPin ?? ""}`;
  const newPin = `${payload.newPin ?? ""}`;

  if (!/^\d{4}$/.test(newPin)) {
    throw new AppError(400, "El nuevo PIN debe tener exactamente 4 dígitos numéricos.");
  }

  const dbUserResult = await query("select * from users where id = $1", [user.id]);
  const dbUser = dbUserResult.rows[0];
  const valid = await compareSecret(currentPin, getStoredSecretHash(dbUser));

  if (!valid) {
    throw new AppError(401, "PIN actual incorrecto.");
  }

  const hashed = await hashSecret(newPin);

  await withTransaction(async (client) => {
    const userColumns = await getPublicTableColumns(client, "users");
    const updates = {
      pin_hash: hashed,
      must_change_password: false,
    };

    if (userColumns.has("password_hash")) {
      updates.password_hash = hashed;
    }

    const setClause = Object.keys(updates)
      .map((column, index) => `${column} = $${index + 2}`)
      .join(", ");

    await client.query(
      `
        update users
        set
          ${setClause}
        where id = $1
      `,
      [user.id, ...Object.values(updates)],
    );

    await logAudit({
      userId: user.id,
      userIdentifier: user.username ?? `${user.pasaje} ${user.numeracion}`,
      role: user.role,
      ip: extractIp(req),
      action: "auth.change_pin",
      entity: "users",
      entityId: user.id,
      metadata: { mustChangePassword: false },
      db: client,
    });
  });

  return { ok: true };
}

export async function createTreasurer({ actor, payload, req }) {
  if (!payload.username || !payload.password || !payload.fullName) {
    throw new AppError(400, "Usuario, nombre y contraseña son obligatorios.");
  }

  const username = normalizeUsername(payload.username);
  const hash = await hashSecret(`${payload.password}`);

  return withTransaction(async (client) => {
    const userColumns = await getPublicTableColumns(client, "users");
    const existing = await client.query(
      `
        select id
        from users
        where lower(username) = $1
          and role = 'tesorero'
        limit 1
      `,
      [username],
    );

    const payloadFields = {
      role: "tesorero",
      username,
      full_name: payload.fullName.trim(),
      phone: payload.phone?.trim() || null,
      pin_hash: hash,
      must_change_password: false,
    };

    if (userColumns.has("password_hash")) {
      payloadFields.password_hash = hash;
    }

    if (userColumns.has("active")) {
      payloadFields.active = true;
    }

    if (userColumns.has("activo")) {
      payloadFields.activo = true;
    }

    let created;

    if (existing.rowCount > 0) {
      const mutableFields = { ...payloadFields };
      delete mutableFields.role;
      delete mutableFields.username;

      const updates = Object.keys(mutableFields)
        .map((column, index) => `${column} = $${index + 2}`)
        .join(", ");

      const result = await client.query(
        `
          update users
          set
            ${updates}
          where id = $1
          returning id, role, username, full_name, phone, must_change_password
        `,
        [existing.rows[0].id, ...Object.values(mutableFields)],
      );
      created = result.rows[0];
    } else {
      const insert = buildDynamicInsert("users", payloadFields);
      const result = await client.query(
        `${insert.sql} returning id, role, username, full_name, phone, must_change_password`,
        insert.values,
      );
      created = result.rows[0];
    }

    await logAudit({
      userId: actor.id,
      userIdentifier: actor.username ?? `${actor.pasaje} ${actor.numeracion}`,
      role: actor.role,
      ip: extractIp(req),
      action: "admin.create_treasurer",
      entity: "users",
      entityId: created.id,
      newValue: created,
      db: client,
    });

    return created;
  });
}

export async function resetNeighborPin({ actor, payload, req }) {
  const vecinoResult = await query(
    `
      select
        u.*,
        v.telefono,
        v.direccion
      from users u
      join vecinos v on v.id = u.vecino_id
      where u.role = 'vecino' and u.vecino_id = $1
    `,
    [payload.vecinoId],
  );

  const vecinoUser = vecinoResult.rows[0];

  if (!vecinoUser) {
    throw new AppError(404, "Vecino no encontrado.");
  }

  const temporaryPin =
    payload.mode === "random"
      ? `${Math.floor(1000 + Math.random() * 9000)}`
      : last4Digits(vecinoUser.telefono);
  const hashed = await hashSecret(temporaryPin);

  await withTransaction(async (client) => {
    const userColumns = await getPublicTableColumns(client, "users");
    const updates = {
      pin_hash: hashed,
      must_change_password: true,
      failed_login_attempts: 0,
      locked_until: null,
    };

    if (userColumns.has("password_hash")) {
      updates.password_hash = hashed;
    }

    const setClause = Object.keys(updates)
      .map((column, index) => `${column} = $${index + 2}`)
      .join(", ");

    await client.query(
      `
        update users
        set
          ${setClause}
        where id = $1
      `,
      [vecinoUser.id, ...Object.values(updates)],
    );

    await logAudit({
      userId: actor.id,
      userIdentifier: actor.username ?? `${actor.pasaje} ${actor.numeracion}`,
      role: actor.role,
      ip: extractIp(req),
      action: "admin.reset_neighbor_pin",
      entity: "users",
      entityId: vecinoUser.id,
      metadata: {
        vecinoId: payload.vecinoId,
        direccion: vecinoUser.direccion,
        mode: payload.mode ?? "phone_last4",
      },
      db: client,
    });
  });

  return {
    vecinoId: payload.vecinoId,
    temporaryPin,
    mustChangePassword: true,
  };
}

export function getSessionUser(user) {
  return publicUser(user);
}
