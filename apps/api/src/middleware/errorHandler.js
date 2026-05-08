import { isAppError } from "../lib/appError.js";

export function notFoundHandler(_req, _res, next) {
  next({ statusCode: 404, message: "Ruta no encontrada." });
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = isAppError(error) ? error.statusCode : error.statusCode ?? 500;
  const payload = {
    error: error.message ?? "Error interno del servidor.",
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(payload);
}

