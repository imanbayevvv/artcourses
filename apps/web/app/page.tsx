"use client";

import { useEffect, useState } from "react";

type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type AccessData = {
  ok: boolean;
  access: boolean;
  status: string;
  until: string | null;
  reason: string;
};

type LibraryItem = {
  id: string;
  title: string;
  lessons: number;
};

type PlanItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  period: string;
  badge?: string;
};

const REASON_LABELS: Record<string, string> = {
  active: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u0430",
  past_due_grace: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044f \u043e\u043f\u043b\u0430\u0442\u0430 (\u043b\u044c\u0433\u043e\u0442\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434)",
  canceled_until_end: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043e\u0442\u043c\u0435\u043d\u0435\u043d\u0430, \u0434\u043e\u0441\u0442\u0443\u043f \u0434\u043e \u043a\u043e\u043d\u0446\u0430 \u043f\u0435\u0440\u0438\u043e\u0434\u0430",
  expired: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u0438\u0441\u0442\u0435\u043a\u043b\u0430",
  none: "\u041d\u0435\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438",
  missing_period_end: "\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0435 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438",
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: "\u0432 \u043c\u0435\u0441\u044f\u0446",
  yearly: "\u0432 \u0433\u043e\u0434",
};

function formatPrice(price: number, currency: string) {
  return `${price.toLocaleString("ru-RU")} ${currency}`;
}

export default function Page() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<TgUser | null>(null);
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      setInitData(tg.initData || "");
    }
  }, []);

  async function login() {
    setError("");
    setAccessData(null);
    setLibrary([]);
    setPlans([]);
    setLoading(true);

    try {
      const r = await fetch(`${API}/auth/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const data = await r.json();
      if (!data.ok) {
        setError("Auth failed: " + JSON.stringify(data));
        return;
      }

      setUser(data.tgUser);
      await refreshState(data.tgUser.id);
    } finally {
      setLoading(false);
    }
  }

  async function refreshState(telegramUserId: number) {
    await Promise.all([
      checkAccess(telegramUserId),
      loadPlans(),
    ]);
  }

  async function checkAccess(telegramUserId: number) {
    try {
      const r = await fetch(`${API}/me/access?telegram_user_id=${telegramUserId}`);
      const data: AccessData = await r.json();
      setAccessData(data);

      if (data.access) {
        await loadLibrary(telegramUserId);
      } else {
        setLibrary([]);
      }
    } catch (err) {
      console.error("Access check error:", err);
    }
  }

  async function loadLibrary(telegramUserId: number) {
    try {
      const r = await fetch(`${API}/library?telegram_user_id=${telegramUserId}`);
      if (r.ok) {
        const data = await r.json();
        setLibrary(data.items ?? []);
      }
    } catch (err) {
      console.error("Library load error:", err);
    }
  }

  async function loadPlans() {
    try {
      const r = await fetch(`${API}/plans`);
      if (r.ok) {
        const data = await r.json();
        setPlans(data.items ?? []);
      }
    } catch (err) {
      console.error("Plans load error:", err);
    }
  }

  async function handleCheckout(planId: string, period: string) {
    if (!user || actionLoading) return;
    setActionLoading(true);
    setError("");

    try {
      const r = await fetch(
        `${API}/checkout/start?telegram_user_id=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: planId }),
        }
      );

      const data = await r.json();
      if (!data.ok) {
        setError("Checkout error: " + (data.error ?? JSON.stringify(data)));
        return;
      }

      // Navigate to checkout URL
      const checkoutUrl = data.checkout_url;
      // @ts-ignore
      const tg = window.Telegram?.WebApp;
      if (tg?.openLink) {
        tg.openLink(checkoutUrl);
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (err: any) {
      setError("Checkout error: " + (err?.message ?? err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!user || actionLoading) return;
    setActionLoading(true);
    setError("");

    try {
      const r = await fetch(
        `${API}/subscriptions/cancel?telegram_user_id=${user.id}`,
        { method: "POST" }
      );

      const data = await r.json();
      if (!data.ok) {
        setError("Cancel error: " + (data.error ?? JSON.stringify(data)));
        return;
      }

      await refreshState(user.id);
    } catch (err: any) {
      setError("Cancel error: " + (err?.message ?? err));
    } finally {
      setActionLoading(false);
    }
  }

  // Should we show plan cards?
  const showPlans = accessData && (!accessData.access || accessData.status !== "active");

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>ArtCourses</h1>

      <div style={{ marginTop: 12, opacity: 0.8 }}>
        initData: {initData ? "\u2705 \u0435\u0441\u0442\u044c" : "\u274c \u043d\u0435\u0442"}
      </div>

      {!user && (
        <button
          onClick={login}
          disabled={loading}
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #444",
            background: "white",
            cursor: loading ? "wait" : "pointer",
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : "\u0412\u043e\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Telegram"}
        </button>
      )}

      {error && (
        <pre style={{ marginTop: 16, padding: 12, background: "#111", color: "#fff", borderRadius: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {error}
        </pre>
      )}

      {user && (
        <div style={{ marginTop: 16 }}>
          <div><b>{"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c:"}</b> {user.first_name} @{user.username}</div>
          <div><b>ID:</b> {user.id}</div>
        </div>
      )}

      {/* Status card */}
      {user && accessData && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${accessData.access ? "#c4e0c4" : "#e0c4c4"}`,
            background: accessData.access ? "#f0faf0" : "#fff5f5",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {accessData.access ? "\u2705" : "\ud83d\udd12"}{" "}
            {REASON_LABELS[accessData.reason] ?? accessData.reason}
          </div>
          {accessData.until && (
            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
              {"\u0414\u043e\u0441\u0442\u0443\u043f \u0434\u043e"}: {new Date(accessData.until).toLocaleDateString("ru-RU")}
            </div>
          )}
        </div>
      )}

      {/* Plan cards — show when no access or not active */}
      {user && showPlans && plans.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043b\u0430\u043d"}</h2>
          {plans.map((plan) => (
            <div
              key={`${plan.id}_${plan.period}`}
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid #ddd",
                background: "#fafafa",
                marginBottom: 10,
                position: "relative",
              }}
            >
              {plan.badge && (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    right: 12,
                    background: "#4caf50",
                    color: "#fff",
                    padding: "2px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {plan.badge}
                </span>
              )}
              <div style={{ fontWeight: 600, fontSize: 16 }}>{plan.title}</div>
              <div style={{ marginTop: 4, opacity: 0.7 }}>
                {formatPrice(plan.price, plan.currency)} {PERIOD_LABELS[plan.period] ?? plan.period}
              </div>
              <button
                onClick={() => handleCheckout(plan.id, plan.period)}
                disabled={actionLoading}
                style={{
                  marginTop: 10,
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "black",
                  color: "white",
                  fontWeight: 600,
                  cursor: actionLoading ? "wait" : "pointer",
                  opacity: actionLoading ? 0.6 : 1,
                  width: "100%",
                }}
              >
                {actionLoading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : "\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Library content — shown only when access is true */}
      {user && accessData && accessData.access && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{"\ud83c\udfa8 \u041a\u0443\u0440\u0441\u044b"}</h2>

          {library.length === 0 && <div style={{ opacity: 0.5 }}>{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..."}</div>}

          {library.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fafafa",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div style={{ opacity: 0.6, fontSize: 13 }}>{item.lessons} {"\u0443\u0440\u043e\u043a\u043e\u0432"}</div>
            </div>
          ))}

          {/* Cancel button — only when active */}
          {accessData.status === "active" && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              style={{
                marginTop: 12,
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "white",
                color: "#c00",
                fontWeight: 600,
                cursor: actionLoading ? "wait" : "pointer",
                opacity: actionLoading ? 0.6 : 1,
                width: "100%",
              }}
            >
              {actionLoading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
