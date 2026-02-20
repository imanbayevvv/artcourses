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

const REASON_LABELS: Record<string, string> = {
  active: "Подписка активна",
  past_due_grace: "Ожидается оплата (льготный период)",
  canceled_until_end: "Подписка отменена, доступ до конца периода",
  expired: "Подписка истекла",
  none: "Нет подписки",
  missing_period_end: "Нет данных о периоде подписки",
};

export default function Page() {
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<TgUser | null>(null);
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

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
      await checkAccess(data.tgUser.id);
    } finally {
      setLoading(false);
    }
  }

  async function checkAccess(telegramUserId: number) {
    try {
      const r = await fetch(`${API}/me/access?telegram_user_id=${telegramUserId}`);
      const data: AccessData = await r.json();
      setAccessData(data);

      if (data.access) {
        await loadLibrary(telegramUserId);
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
        <pre style={{ marginTop: 16, padding: 12, background: "#111", color: "#fff", borderRadius: 12 }}>
          {error}
        </pre>
      )}

      {user && (
        <div style={{ marginTop: 16 }}>
          <div><b>{"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c:"}</b> {user.first_name} @{user.username}</div>
          <div><b>ID:</b> {user.id}</div>
        </div>
      )}

      {/* Paywall gate */}
      {user && accessData && !accessData.access && (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 16,
            border: "1px solid #e0c4c4",
            background: "#fff5f5",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>{"\ud83d\udd12"}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{"\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043d\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u0430"}</div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>
            {REASON_LABELS[accessData.reason] ?? accessData.reason}
          </div>
          <a
            href="https://t.me/ZaycevaArtCoursesBot?start=subscription"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 12,
              background: "black",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {"\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443"}
          </a>
        </div>
      )}

      {/* Library content — shown only when access is true */}
      {user && accessData && accessData.access && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#f0faf0",
              border: "1px solid #c4e0c4",
              marginBottom: 16,
            }}
          >
            <span style={{ fontWeight: 600 }}>{"\u2705 \u0414\u043e\u0441\u0442\u0443\u043f \u0430\u043a\u0442\u0438\u0432\u0435\u043d"}</span>
            {accessData.until && (
              <span style={{ opacity: 0.7, marginLeft: 8 }}>
                {"\u0434\u043e"} {new Date(accessData.until).toLocaleDateString("ru-RU")}
              </span>
            )}
            <div style={{ marginTop: 4, opacity: 0.6, fontSize: 13 }}>
              {REASON_LABELS[accessData.reason] ?? accessData.reason}
            </div>
          </div>

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

          <a
            href="https://t.me/ZaycevaArtCoursesBot?start=subscription"
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 12,
              background: "#333",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {"\u0423\u043f\u0440\u0430\u0432\u043b\u044f\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u043e\u0439"}
          </a>
        </div>
      )}
    </main>
  );
}
