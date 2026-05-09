import { isAppError } from "../lib/appError.js";

export function notFoundHandler(_req, _res, next) {
  next({ statusCode: 404, message: "Ruta no encontrada." });
}

function isDatabaseConnectivityError(error) {
  const code = `${error?.code ?? ""}`.toUpperCase();
  const message = `${error?.message ?? ""}`.toLowerCase();

  if (
    [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "28P01",
      "53300",
      "57P01",
    ].includes(code)
  ) {
    return true;
  }

  return [
    "getaddrinfo",
    "password authentication failed",
    "connect etimedout",
    "connection terminated unexpectedly",
    "no pg_hba.conf entry",
  ].some((token) => message.includes(token));
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = isAppError(error) ? error.statusCode : error.statusCode ?? 500;
  const payload = {
    error:
      statusCode >= 500 && isDatabaseConnectivityError(error)
        ? "Servicio temporalmente no disponible. Intenta nuevamente más tarde."
        : error.message ?? "Error interno del servidor.",
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(payload);
}
