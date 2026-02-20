import { Router } from "express";
import { pool } from "../db.js";

export const checkoutRouter = Router();

checkoutRouter.post("/create", async (req, res) => {
  const { telegram_user_id, plan_id } = req.body ?? {};

  if (!telegram_user_id || !plan_id) {
    return res
      .status(400)
      .json({ ok: false, error: "telegram_user_id and plan_id required" });
  }

  const mode = process.env.PAYMENT_MODE ?? "mock";
  if (mode !== "mock") {
    return res
      .status(501)
      .json({ ok: false, error: "Only mock mode implemented for Day 2" });
  }

  const event_id = `mock_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const base = process.env.PUBLIC_WEBAPP_URL ?? "https://example.com";

  const checkout_url = `${base}/mock-checkout?event_id=${encodeURIComponent(
    event_id
  )}&telegram_user_id=${encodeURIComponent(
    telegram_user_id
  )}&plan_id=${encodeURIComponent(plan_id)}`;

  // ✅ привязываем event_id к (user, plan) на сервере
  await pool.query(
    `
    insert into mock_checkouts (event_id, telegram_user_id, plan_id)
    values ($1, $2, $3)
    on conflict (event_id) do nothing
    `,
    [event_id, Number(telegram_user_id), String(plan_id)]
  );

  return res.json({ ok: true, provider: "mock", event_id, checkout_url });
});