import "dotenv/config";
import express from "express";
import { pool } from "./db.js";
import { usersRouter } from "./routes/users.js";
import { subsRouter } from "./routes/subscriptions.js";
import { checkoutRouter } from "./routes/checkout.js";
import { webhookMockRouter } from "./routes/webhookMock.js";
import { meRouter } from "./routes/me.js";
import { libraryRouter } from "./routes/library.js";
import { plansRouter } from "./routes/plans.js";
import { verifyTelegramWebAppInitData } from "./telegramAuth.ts";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookMockRouter);
app.use("/users", usersRouter);
app.use("/me", meRouter);
app.use("/library", libraryRouter);
app.use("/plans", plansRouter);
app.use("/subscriptions", subsRouter);
app.post("/auth/telegram", async (req, res) => {
  const initData = String(req.body?.initData ?? "");
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) return res.status(500).json({ ok: false, error: "BOT_TOKEN missing in .env" });

  const result = verifyTelegramWebAppInitData(initData, botToken);
  if (!result.ok) return res.status(401).json(result);

  const userRaw = result.data["user"];
  const tgUser = userRaw ? JSON.parse(userRaw) : null;

  if (!tgUser?.id) return res.status(400).json({ ok: false, error: "user missing in initData" });

  // upsert user
  await pool.query(
    `
    insert into users (telegram_user_id, username, first_name)
    values ($1, $2, $3)
    on conflict (telegram_user_id)
    do update set username = excluded.username,
                  first_name = excluded.first_name
    `,
    [tgUser.id, tgUser.username ?? null, tgUser.first_name ?? null]
  );

  return res.json({ ok: true, tgUser });
});


app.get("/health", async (_req, res) => {
  try {
    const result = await pool.query("select now()");
    res.json({ ok: true, time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
});
