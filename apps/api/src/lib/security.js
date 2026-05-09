import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const SALT_ROUNDS = 12;

export async function hashSecret(secret) {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export async function compareSecret(secret, hashed) {
  return bcrypt.compare(secret, hashed);
}

export function signSession(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      vecinoId: user.vecino_id ?? null,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifySession(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function setSessionCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: 1000 * 60 * 60 * 8,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
  });
}

export function extractIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip;
}
