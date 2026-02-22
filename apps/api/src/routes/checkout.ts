import { Router } from "express";
import { pool } from "../db.js";

export const checkoutRouter = Router();

function generateMockCheckout(telegramUserId: number, planId: string) {
  const event_id = `mock_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const checkout_url = `https://mock.local/checkout?event_id=${event_id}&telegram_user_id=${telegramUserId}&plan_id=${planId}`;
  return { event_id, checkout_url };
}

// Day 2 original route — kept for backward compatibility
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

  const { event_id, checkout_url } = generateMockCheckout(
    Number(telegram_user_id),
    String(plan_id)
  );

  await pool.query(
    `insert into mock_checkouts (event_id, telegram_user_id, plan_id, checkout_url)
     values ($1, $2, $3, $4)
     on conflict (event_id) do nothing`,
    [event_id, Number(telegram_user_id), String(plan_id), checkout_url]
  );

  return res.json({ ok: true, provider: "mock", event_id, checkout_url });
});

// Day 5: Mini App checkout — identifies user via query param (dev) or future auth
checkoutRouter.post("/start", async (req, res) => {
  const { plan_id } = req.body ?? {};

  const telegramUserId = Number(
    req.query.telegram_user_id ?? req.headers["x-telegram-user-id"]
  );

  if (!telegramUserId) {
    if (process.env.NODE_ENV === "production") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    return res.status(400).json({ ok: false, error: "telegram_user_id required" });
  }

  if (!plan_id) {
    return res.status(400).json({ ok: false, error: "plan_id required" });
  }

  // Validate plan exists
  const planCheck = await pool.query(`select id from plans where id = $1`, [String(plan_id)]);
  if (planCheck.rowCount === 0) {
    return res.status(400).json({ ok: false, error: "unknown plan_id" });
  }

  const mode = process.env.PAYMENT_MODE ?? "mock";
  if (mode !== "mock") {
    return res.status(501).json({ ok: false, error: "Only mock mode implemented" });
  }

  try {
    // Upsert user first to satisfy FK on mock_checkouts & subscriptions
    await pool.query(
      `insert into users (telegram_user_id)
       values ($1)
       on conflict (telegram_user_id) do nothing`,
      [telegramUserId]
    );

    const { event_id, checkout_url } = generateMockCheckout(telegramUserId, String(plan_id));

    await pool.query(
      `insert into mock_checkouts (event_id, telegram_user_id, plan_id, checkout_url)
       values ($1, $2, $3, $4)
       on conflict (event_id) do nothing`,
      [event_id, telegramUserId, String(plan_id), checkout_url]
    );

    return res.json({ ok: true, event_id, checkout_url });
  } catch (err) {
    console.error("/checkout/start error:", err);
    return res.status(500).json({ ok: false });
  }
});
