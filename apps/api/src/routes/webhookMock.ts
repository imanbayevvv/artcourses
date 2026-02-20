import { Router } from "express";
import { pool } from "../db.js";

export const webhookMockRouter = Router();

type MockEventType = "payment_succeeded" | "payment_failed";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

webhookMockRouter.post("/mock", async (req, res) => {
  const { event_id, type } = req.body ?? {};
  const rawPayload = req.body ?? {};
  let logId: number | null = null;

  // 0) Создаём лог входящего webhook (даже если payload кривой)
  try {
    const ins = await pool.query(
      `
      insert into webhook_logs (provider, event_id, event_type, raw_payload)
      values ($1, $2, $3, $4::jsonb)
      returning id
      `,
      ["mock", String(event_id ?? ""), String(type ?? ""), JSON.stringify(rawPayload)]
    );
    logId = Number(ins.rows[0].id);
  } catch {
    // логирование не должно ломать обработку
  }

  async function markOk() {
    if (!logId) return;
    await pool.query(`update webhook_logs set processed_ok = true where id = $1`, [logId]);
  }

  async function markErr(message: string) {
    if (!logId) return;
    await pool.query(
      `update webhook_logs set processed_ok = false, error_text = $2 where id = $1`,
      [logId, message]
    );
  }

  try {
    // 1) Валидация
    if (!event_id || !type) {
      await markErr("event_id and type required");
      return res.status(400).json({ ok: false, error: "event_id and type required" });
    }

    const eventType = String(type) as MockEventType;
    if (eventType !== "payment_succeeded" && eventType !== "payment_failed") {
      await markErr("type must be payment_succeeded|payment_failed");
      return res.status(400).json({ ok: false, error: "type must be payment_succeeded|payment_failed" });
    }

    // 2) Idempotency
    try {
      await pool.query(`insert into webhook_events (provider, event_id) values ($1, $2)`, [
        "mock",
        String(event_id),
      ]);
    } catch {
      await markOk();
      return res.json({ ok: true, dedup: true });
    }

    // 3) Привязка event_id -> (user, plan) из mock_checkouts
    const chk = await pool.query(
      `select telegram_user_id, plan_id from mock_checkouts where event_id = $1`,
      [String(event_id)]
    );

    if (chk.rowCount === 0) {
      await markErr("unknown event_id");
      return res.status(400).json({ ok: false, error: "unknown event_id" });
    }

    const realTelegramUserId = Number(chk.rows[0].telegram_user_id);
    const realPlanId = String(chk.rows[0].plan_id);

    // 4) payment_failed
    if (eventType === "payment_failed") {
      await pool.query(
        `
        insert into payments (telegram_user_id, provider_payment_id, status, amount, currency, period_start, period_end)
        values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [realTelegramUserId, String(event_id), "failed", 0, "KZT", null, null]
      );

      await markOk();
      return res.json({ ok: true });
    }

    // 5) payment_succeeded
    const now = new Date();
    const periodStart = now;
    const periodEnd = realPlanId === "yearly" ? addYears(periodStart, 1) : addMonths(periodStart, 1);

    const planRes = await pool.query(
      `select id, price_monthly, price_yearly from plans where id = $1`,
      [realPlanId]
    );

    if (planRes.rowCount === 0) {
      await markErr("unknown plan_id");
      return res.status(400).json({ ok: false, error: "unknown plan_id" });
    }

    const plan = planRes.rows[0] as {
      id: string;
      price_monthly: number | null;
      price_yearly: number | null;
    };

    const amount =
      realPlanId === "yearly"
        ? Number(plan.price_yearly ?? 0)
        : Number(plan.price_monthly ?? 0);

    const currency = "KZT";

    await pool.query(
      `
      insert into payments (telegram_user_id, provider_payment_id, status, amount, currency, period_start, period_end)
      values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [realTelegramUserId, String(event_id), "succeeded", amount, currency, periodStart, periodEnd]
    );

    const upd = await pool.query(
      `
      update subscriptions
      set status = 'active',
          plan_id = $2,
          current_period_start = $3,
          current_period_end = $4,
          provider = 'mock',
          provider_subscription_id = $5,
          updated_at = now()
      where telegram_user_id = $1
      returning id
      `,
      [realTelegramUserId, realPlanId, periodStart, periodEnd, String(event_id)]
    );

    if (upd.rowCount === 0) {
      await pool.query(
        `
        insert into subscriptions
          (telegram_user_id, plan_id, status, current_period_start, current_period_end, provider, provider_subscription_id)
        values
          ($1, $2, 'active', $3, $4, 'mock', $5)
        `,
        [realTelegramUserId, realPlanId, periodStart, periodEnd, String(event_id)]
      );
    }

    await markOk();
    return res.json({ ok: true });
  } catch (e: any) {
    await markErr(String(e?.message ?? e));
    return res.status(500).json({ ok: false });
  }
});