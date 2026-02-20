"use client";

import { useEffect, useState } from "react";

type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
};

export default function Page() {
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<TgUser | null>(null);
  const [sub, setSub] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
  // @ts-ignore
  const tg = window.Telegram?.WebApp;
  console.log("Telegram WebApp:", tg);
  if (tg) {
    tg.ready();
    setInitData(tg.initData || "");
  }
}, []);

  async function login() {
    setError("");
    setSub(null);
    
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

    const s = await fetch(`${API}/subscriptions/status/${data.tgUser.id}`);
    const sd = await s.json();
    setSub(sd);
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>ArtCourses</h1>

      <div style={{ marginTop: 12, opacity: 0.8 }}>
        initData: {initData ? "✅ есть" : "❌ нет"}
      </div>

      <button
        onClick={login}
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #444",
          background: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Войти через Telegram
      </button>

      {error && (
        <pre style={{ marginTop: 16, padding: 12, background: "#111", color: "#fff", borderRadius: 12 }}>
          {error}
        </pre>
      )}

      {user && (
        <div style={{ marginTop: 16 }}>
          <div><b>Пользователь:</b> {user.first_name} @{user.username}</div>
          <div><b>ID:</b> {user.id}</div>
        </div>
      )}

      {sub && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            border: "1px solid #ddd",
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Подписка</div>

          {sub.status === "none" ? (
            <>
              <div style={{ marginTop: 8 }}>Нет активной подписки</div>
              <a
                href="https://t.me/ZaycevaArtCoursesBot?start=subscription"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "black",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Оформить подписку
              </a>
            </>
          ) : (
            <>
              <div style={{ marginTop: 8 }}>
                Статус: <b>{sub.status}</b>
              </div>
  
              {sub.plan_title && (
                <div>План: {sub.plan_title}</div>
              )}

              {sub.current_period_end && (
                <div>
                  Доступ до:{" "}
                  {new Date(sub.current_period_end).toLocaleString("ru-RU")}
                </div>
              )}

              <a
                href="https://t.me/ZaycevaArtCoursesBot?start=subscription"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#333",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Управлять подпиской
              </a>
            </>
          )}
        </div>
      )}      

    </main>
  );
}
