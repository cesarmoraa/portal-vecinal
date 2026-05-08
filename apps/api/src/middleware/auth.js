import { query } from "../db/pool.js";
import { AppError } from "../lib/appError.js";
import { verifySession } from "../lib/security.js";
import { env } from "../config/env.js";

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[env.cookieName];

  if (!token) {
    return next(new AppError(401, "Sesión no válida."));
  }

  try {
    const payload = verifySession(token);
    const result = await query(
      `
        select
          u.id,
          u.role,
          u.vecino_id,
          u.username,
          u.pasaje,
          u.numeracion,
          u.full_name,
          u.phone,
          u.must_change_password,
          u.active,
          v.representante_nombre,
          v.telefono
        from users u
        left join vecinos v on v.id = u.vecino_id
        where u.id = $1
      `,
      [payload.sub],
    );

    const user = result.rows[0];

    if (!user || !user.active) {
      throw new AppError(401, "Usuario inactivo o no encontrado.");
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(new AppError(401, "Sesión expirada o inválida."));
  }
}

export function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "No tienes permisos para esta acción."));
    }

    return next();
  };
}

export function requireFreshPassword(req, _res, next) {
  if (req.user?.must_change_password) {
    return next(
      new AppError(428, "Debes actualizar tu PIN temporal antes de continuar."),
    );
  }

  return next();
}
