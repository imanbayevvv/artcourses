import { Router } from "express";
import { pool } from "../db.js";

export const usersRouter = Router();

usersRouter.post("/upsert", async (req, res) => {
  const { telegram_user_id, username, first_name } = req.body ?? {};

  if (!telegram_user_id) {
    return res.status(400).json({ ok: false, error: "telegram_user_id required" });
  }

  try {
    await pool.query(
      `
      insert into users (telegram_user_id, username, first_name)
      values ($1, $2, $3)
      on conflict (telegram_user_id)
      do update set username = excluded.username,
                    first_name = excluded.first_name
      `,
      [telegram_user_id, username ?? null, first_name ?? null]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});
