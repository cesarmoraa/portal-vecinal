import express from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, requireFreshPassword, requireRole } from "../middleware/auth.js";
import { getDashboardOverview } from "../services/dashboardService.js";

export const dashboardRoutes = express.Router();

dashboardRoutes.use(requireAuth);
dashboardRoutes.use(requireFreshPassword);
dashboardRoutes.use(requireRole("admin", "tesorero"));

dashboardRoutes.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const overview = await getDashboardOverview();
    res.json(overview);
  }),
);
