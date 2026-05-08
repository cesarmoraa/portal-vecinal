import express from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, requireFreshPassword, requireRole } from "../middleware/auth.js";
import { getNeighborPortal } from "../services/neighborService.js";

export const neighborRoutes = express.Router();

neighborRoutes.use(requireAuth);
neighborRoutes.use(requireFreshPassword);
neighborRoutes.use(requireRole("vecino"));

neighborRoutes.get(
  "/portal",
  asyncHandler(async (req, res) => {
    const portal = await getNeighborPortal(req.user);
    res.json(portal);
  }),
);
