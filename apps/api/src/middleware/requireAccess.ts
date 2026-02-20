import type { Request, Response, NextFunction } from "express";
import { pool } from "../db.js";
import { getAccessForTelegramUserId } from "../services/access.js";

const GRACE_DAYS = Number(process.env.GRACE_DAYS) || 7;

/**
 * Express middleware: blocks request with 403 if user has no active subscription access.
 * On success, populates res.locals.access with { status, until, reason }.
 */
export async function requireAccess(req: Request, res: Response, next: NextFunction) {
  // Determine telegram_user_id:
  // In dev mode: accept query param or x-telegram-user-id header
  // In production: would come from verified auth context (future)
  const raw =
    req.query.telegram_user_id ??
    req.headers["x-telegram-user-id"];

  const telegramUserId = Number(raw);

  if (!telegramUserId) {
    if (process.env.NODE_ENV === "production") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    return res.status(400).json({ ok: false, error: "telegram_user_id required" });
  }

  try {
    const result = await getAccessForTelegramUserId(pool, telegramUserId, GRACE_DAYS);

    if (!result.access) {
      return res.status(403).json({
        ok: false,
        error: "subscription_required",
        reason: result.reason,
        status: result.status,
        until: null,
      });
    }

    res.locals.access = {
      status: result.status,
      until: result.until,
      reason: result.reason,
    };

    return next();
  } catch (err) {
    console.error("requireAccess error:", err);
    return res.status(500).json({ ok: false });
  }
}
