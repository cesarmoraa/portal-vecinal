import express from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, requireFreshPassword, requireRole } from "../middleware/auth.js";
import { createPayment, getPaymentLedger, updatePayment } from "../services/paymentService.js";
import { listVecinos } from "../services/neighborService.js";

export const paymentRoutes = express.Router();

paymentRoutes.use(requireAuth);
paymentRoutes.use(requireFreshPassword);
paymentRoutes.use(requireRole("admin", "tesorero"));

paymentRoutes.get(
  "/vecinos",
  asyncHandler(async (req, res) => {
    const rows = await listVecinos(req.query.q ?? "");
    res.json({ rows });
  }),
);

paymentRoutes.get(
  "/vecinos/:vecinoId",
  asyncHandler(async (req, res) => {
    const ledger = await getPaymentLedger(req.params.vecinoId);
    res.json(ledger);
  }),
);

paymentRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const payment = await createPayment({
      actor: req.user,
      ip: req.ip,
      payload: req.body,
    });
    res.status(201).json({ payment });
  }),
);

paymentRoutes.put(
  "/:paymentId",
  asyncHandler(async (req, res) => {
    const payment = await updatePayment({
      actor: req.user,
      ip: req.ip,
      paymentId: req.params.paymentId,
      payload: req.body,
    });
    res.json({ payment });
  }),
);
