import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/authRoutes.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { paymentRoutes } from "./routes/paymentRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { neighborRoutes } from "./routes/neighborRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.appOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("combined"));

  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos de acceso. Intenta nuevamente más tarde." },
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "comunidad-cobros-api" });
  });

  app.use("/api/auth", loginLimiter, authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/pagos", paymentRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/vecino", neighborRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

