import dotenv from "dotenv";

dotenv.config();

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
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
  importYear: Number(process.env.IMPORT_YEAR ?? new Date().getFullYear()),
  exportYear: Number(process.env.EXPORT_YEAR ?? new Date().getFullYear()),
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "Admin2026!",
  adminFullName: process.env.ADMIN_FULL_NAME ?? "Administrador Inicial",
};

