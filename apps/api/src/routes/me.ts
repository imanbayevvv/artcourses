import { Router } from "express";
import { pool } from "../db.js";
import { getAccessForTelegramUserId } from "../services/access.js";

export const meRouter = Router();

const GRACE_DAYS = Number(process.env.GRACE_DAYS) || 7;

meRouter.get("/access", async (req, res) => {
  // In dev mode allow query param; in production require real auth (future)
  const telegramUserId = Number(req.query.telegram_user_id);

  if (!telegramUserId) {
    if (process.env.NODE_ENV === "production") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    return res.status(400).json({ ok: false, error: "telegram_user_id required" });
  }

  try {
    const access = await getAccessForTelegramUserId(pool, telegramUserId, GRACE_DAYS);
    return res.json(access);
  } catch (err) {
    console.error("/me/access error:", err);
    return res.status(500).json({ ok: false });
  }
});

meRouter.get("/subscription", async (req, res) => {
  // временно: берём user_id из query, чтобы не блокироваться
  // дальше заменим на initData.user.id
  const telegram_user_id = Number(req.query.telegram_user_id);
  if (!telegram_user_id) {
    return res.status(400).json({ ok: false, error: "telegram_user_id required (temporary)" });
  }

  const sub = await pool.query(
    `
    select s.status, s.current_period_end, s.plan_id, p.title as plan_title
    from subscriptions s
    left join plans p on p.id = s.plan_id
    where s.telegram_user_id = $1
    `,
    [telegram_user_id]
  );

  if (sub.rowCount === 0) {
    return res.json({ ok: true, status: "none" });
  }

  const row = sub.rows[0];
  return res.json({
    ok: true,
    status: row.status,
    current_period_end: row.current_period_end,
    plan_id: row.plan_id,
    plan_title: row.plan_title,
  });
});