import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL_PLACEHOLDERS = new Set([
  "PEGAR_DATABASE_URL_DE_SUPABASE",
  "postgresql://postgres:password@db.supabase.co:5432/postgres",
]);

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function isPlaceholderDatabaseUrl(value) {
  const normalized = `${value ?? ""}`.trim();

  if (!normalized || DATABASE_URL_PLACEHOLDERS.has(normalized)) {
    return true;
  }

  if (normalized.includes("[YOUR-PASSWORD]")) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.hostname === "base";
  } catch {
    return true;
  }
}

function resolveCookieSameSite() {
  const raw = `${process.env.COOKIE_SAME_SITE ?? ""}`.trim().toLowerCase();
  const fallback = `${process.env.COOKIE_SECURE ?? "false"}` === "true" ? "none" : "lax";

  if (!raw) {
    return fallback;
  }

  if (!["lax", "strict", "none"].includes(raw)) {
    return fallback;
  }

  if (raw === "none" && `${process.env.COOKIE_SECURE ?? "false"}` !== "true") {
    return "lax";
  }

  return raw;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  appOrigin: requireEnv("APP_ORIGIN", "http://localhost:5173"),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  cookieName: process.env.COOKIE_NAME ?? "comunidad_session",
  cookieSecure: `${process.env.COOKIE_SECURE ?? "false"}` === "true",
  cookieSameSite: resolveCookieSameSite(),
  importYear: Number(process.env.IMPORT_YEAR ?? new Date().getFullYear()),
  exportYear: Number(process.env.EXPORT_YEAR ?? new Date().getFullYear()),
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "Admin2026!",
  adminFullName: process.env.ADMIN_FULL_NAME ?? "Administrador Inicial",
};
