import type { Pool } from "pg";

export type AccessReason =
  | "active"
  | "past_due_grace"
  | "canceled_until_end"
  | "expired"
  | "none"
  | "missing_period_end";

export interface AccessResult {
  ok: true;
  access: boolean;
  status: string;
  until: string | null;
  reason: AccessReason;
}

/**
 * Pure function: compute access from a subscription row (or null).
 * Single source of truth for all access rules.
 */
export function computeAccessFromSubscription(
  sub: { status: string; current_period_end: string | Date | null } | null,
  now: Date,
  graceDays: number
): AccessResult {
  if (!sub) {
    return { ok: true, access: false, status: "none", until: null, reason: "none" };
  }

  const { status, current_period_end } = sub;

  // No period_end recorded — cannot grant access
  if (!current_period_end) {
    return { ok: true, access: false, status, until: null, reason: "missing_period_end" };
  }

  const periodEnd = new Date(current_period_end);
  if (isNaN(periodEnd.getTime())) {
    return { ok: true, access: false, status, until: null, reason: "missing_period_end" };
  }

  // A) active: access while now < current_period_end
  if (status === "active") {
    if (now < periodEnd) {
      return { ok: true, access: true, status, until: periodEnd.toISOString(), reason: "active" };
    }
    return { ok: true, access: false, status, until: null, reason: "expired" };
  }

  // B) past_due: grace window = current_period_end + GRACE_DAYS
  if (status === "past_due") {
    const graceEnd = new Date(periodEnd);
    graceEnd.setDate(graceEnd.getDate() + graceDays);
    if (now < graceEnd) {
      return { ok: true, access: true, status, until: graceEnd.toISOString(), reason: "past_due_grace" };
    }
    return { ok: true, access: false, status, until: null, reason: "expired" };
  }

  // C) canceled: access until current_period_end
  if (status === "canceled") {
    if (now < periodEnd) {
      return { ok: true, access: true, status, until: periodEnd.toISOString(), reason: "canceled_until_end" };
    }
    return { ok: true, access: false, status, until: null, reason: "expired" };
  }

  // Any other status (expired, unknown) => no access
  return { ok: true, access: false, status, until: null, reason: "expired" };
}

/**
 * Load subscription for a user and compute access.
 */
export async function getAccessForTelegramUserId(
  pool: Pool,
  telegramUserId: number,
  graceDays: number
): Promise<AccessResult> {
  const result = await pool.query(
    `select status, current_period_end
     from subscriptions
     where telegram_user_id = $1
     order by updated_at desc nulls last
     limit 1`,
    [telegramUserId]
  );

  const sub = result.rowCount! > 0 ? result.rows[0] : null;
  return computeAccessFromSubscription(sub, new Date(), graceDays);
}
