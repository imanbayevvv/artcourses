import { Router } from "express";
import { pool } from "../db.js";

export const webhookMockRouter = Router();

type MockEventType = "payment_succeeded" | "payment_failed" | "subscription_canceled";

const ALLOWED_TYPES: ReadonlySet<string> = new Set<MockEventType>([
  "payment_succeeded",
  "payment_failed",
  "subscription_canceled",
]);

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

  // 0) Log incoming webhook (even if payload is bad)
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
    // logging must not break processing
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
    // 1) Validate required fields
    if (!event_id || !type) {
      await markErr("event_id and type required");
      return res.status(400).json({ ok: false, error: "event_id and type required" });
    }

    const eventType = String(type) as MockEventType;
    if (!ALLOWED_TYPES.has(eventType)) {
      await markErr("type must be payment_succeeded|payment_failed|subscription_canceled");
      return res.status(400).json({
        ok: false,
        error: "type must be payment_succeeded|payment_failed|subscription_canceled",
      });
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

    // 3) Resolve event_id -> (user, plan) from mock_checkouts
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

    // 4) Validate plan_id exists in plans table
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

    // 5) Fetch existing subscription (if any) for period extension logic
    const existingSub = await pool.query(
      `select current_period_end, status, plan_id
       from subscriptions
       where telegram_user_id = $1
       order by updated_at desc
       limit 1`,
      [realTelegramUserId]
    );

    // ── Handle subscription_canceled ──
    if (eventType === "subscription_canceled") {
      if (existingSub.rowCount! > 0) {
        await pool.query(
          `update subscriptions
           set status = 'canceled',
               updated_at = now()
           where telegram_user_id = $1`,
          [realTelegramUserId]
        );
      } else {
        await pool.query(
          `insert into subscriptions
             (telegram_user_id, plan_id, status, current_period_start, current_period_end, provider, provider_subscription_id)
           values
             ($1, $2, 'canceled', null, null, 'mock', $3)`,
          [realTelegramUserId, realPlanId, String(event_id)]
        );
      }

      await markOk();
      return res.json({ ok: true });
    }

    // ── Handle payment_failed ──
    if (eventType === "payment_failed") {
      // Record failed payment
      await pool.query(
        `insert into payments (telegram_user_id, provider_payment_id, status, amount, currency, period_start, period_end)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [realTelegramUserId, String(event_id), "failed", 0, "KZT", null, null]
      );

      // Transition subscription to past_due (do NOT change period dates)
      if (existingSub.rowCount! > 0) {
        await pool.query(
          `update subscriptions
           set status = 'past_due',
               updated_at = now()
           where telegram_user_id = $1`,
          [realTelegramUserId]
        );
      } else {
        await pool.query(
          `insert into subscriptions
             (telegram_user_id, plan_id, status, current_period_start, current_period_end, provider, provider_subscription_id)
           values
             ($1, $2, 'past_due', null, null, 'mock', $3)`,
          [realTelegramUserId, realPlanId, String(event_id)]
        );
      }

      await markOk();
      return res.json({ ok: true });
    }

    // ── Handle payment_succeeded ──
    const now = new Date();

    // Compute base = max(current_period_end, now)
    let base = now;
    if (existingSub.rowCount! > 0) {
      const existingEnd = existingSub.rows[0].current_period_end;
      if (existingEnd) {
        const endDate = new Date(existingEnd);
        if (!isNaN(endDate.getTime()) && endDate > now) {
          base = endDate;
        }
      }
    }

    const periodStart = base;
    const periodEnd = realPlanId === "yearly" ? addYears(base, 1) : addMonths(base, 1);

    const amount =
      realPlanId === "yearly"
        ? Number(plan.price_yearly ?? 0)
        : Number(plan.price_monthly ?? 0);

    // Record succeeded payment
    await pool.query(
      `insert into payments (telegram_user_id, provider_payment_id, status, amount, currency, period_start, period_end)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [realTelegramUserId, String(event_id), "succeeded", amount, "KZT", periodStart, periodEnd]
    );

    // Upsert subscription as active
    const upd = await pool.query(
      `update subscriptions
       set status = 'active',
           plan_id = $2,
           current_period_start = $3,
           current_period_end = $4,
           provider = 'mock',
           provider_subscription_id = $5,
           updated_at = now()
       where telegram_user_id = $1
       returning id`,
      [realTelegramUserId, realPlanId, periodStart, periodEnd, String(event_id)]
    );

    if (upd.rowCount === 0) {
      await pool.query(
        `insert into subscriptions
           (telegram_user_id, plan_id, status, current_period_start, current_period_end, provider, provider_subscription_id)
         values
           ($1, $2, 'active', $3, $4, 'mock', $5)`,
        [realTelegramUserId, realPlanId, periodStart, periodEnd, String(event_id)]
      );
    }

    await markOk();
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("webhook/mock error:", e);
    await markErr(String(e?.message ?? e));
    return res.status(500).json({ ok: false });
  }
});
