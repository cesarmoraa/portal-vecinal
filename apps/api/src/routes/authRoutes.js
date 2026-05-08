import express from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AppError } from "../lib/appError.js";
import { requireAuth } from "../middleware/auth.js";
import {
  changeOwnPin,
  getSessionUser,
  login,
  logout,
} from "../services/authService.js";

export const authRoutes = express.Router();

authRoutes.post(
  "/login",
  asyncHandler(async (req, res) => {
    const role = req.body.role;

    if (!["admin", "tesorero", "vecino"].includes(role)) {
      throw new AppError(400, "Rol de acceso inválido.");
    }

    const user = await login(req.body, req, res);
    res.json({ user });
  }),
);

authRoutes.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await logout(req, res);
    res.json({ ok: true });
  }),
);

authRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: getSessionUser(req.user) });
  }),
);

authRoutes.post(
  "/change-pin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await changeOwnPin(req.user, req.body, req);
    res.json(result);
  }),
);

