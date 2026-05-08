import express from "express";
import multer from "multer";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, requireFreshPassword, requireRole } from "../middleware/auth.js";
import {
  createTreasurer,
  resetNeighborPin,
} from "../services/authService.js";
import {
  exportDatabaseToWorkbook,
  importWorkbookToDatabase,
  listAudit,
  searchVecinosForAdmin,
  updateBillingConfig,
} from "../services/adminService.js";

const upload = multer({ storage: multer.memoryStorage() });

export const adminRoutes = express.Router();

adminRoutes.use(requireAuth);
adminRoutes.use(requireFreshPassword);
adminRoutes.use(requireRole("admin"));

adminRoutes.get(
  "/auditoria",
  asyncHandler(async (req, res) => {
    const rows = await listAudit({ limit: req.query.limit ?? 100 });
    res.json({ rows });
  }),
);

adminRoutes.get(
  "/vecinos",
  asyncHandler(async (req, res) => {
    const rows = await searchVecinosForAdmin(req.query.q ?? "");
    res.json({ rows });
  }),
);

adminRoutes.post(
  "/tesoreros",
  asyncHandler(async (req, res) => {
    const user = await createTreasurer({ actor: req.user, payload: req.body, req });
    res.status(201).json({ user });
  }),
);

adminRoutes.post(
  "/reset-neighbor-pin",
  asyncHandler(async (req, res) => {
    const result = await resetNeighborPin({ actor: req.user, payload: req.body, req });
    res.json(result);
  }),
);

adminRoutes.put(
  "/configuracion-cobros/:concepto",
  asyncHandler(async (req, res) => {
    const config = await updateBillingConfig({
      actor: req.user,
      req,
      concept: req.params.concepto,
      payload: req.body,
    });
    res.json({ config });
  }),
);

adminRoutes.post(
  "/import-excel",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const result = await importWorkbookToDatabase({
      actor: req.user,
      req,
      source: req.file?.buffer,
      year: Number(req.body.year || new Date().getFullYear()),
      sosMode: `${req.body.sosMode}` === "true",
    });
    res.json(result);
  }),
);

adminRoutes.get(
  "/export-excel",
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year || new Date().getFullYear());
    const buffer = await exportDatabaseToWorkbook({
      actor: req.user,
      req,
      year,
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="comunidad-export-${year}.xlsx"`,
    );
    res.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  }),
);
