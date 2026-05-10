import express from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, requireFreshPassword, requireRole } from "../middleware/auth.js";
import { getDashboardOverview } from "../services/dashboardService.js";
import { exportExecutiveOverviewWorkbook } from "../services/adminService.js";

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

dashboardRoutes.get(
  "/export-excel",
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year || new Date().getFullYear());
    const buffer = await exportExecutiveOverviewWorkbook({
      actor: req.user,
      req,
      year,
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vista-general-${year}.xlsx"`,
    );
    res.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  }),
);
