import { Router } from "express";
import { pool } from "../db.js";

export const subsRouter = Router();

subsRouter.get("/status/:telegram_user_id", async (req, res) => {
  const telegramUserId = Number(req.params.telegram_user_id);

  if (!telegramUserId) {
    return res.status(400).json({ ok: false });
  }

  try {
    const result = await pool.query(
      `
      select s.status,
             s.current_period_end,
             p.id as plan_id,
             p.title as plan_title
      from subscriptions s
      join plans p on p.id = s.plan_id
      where s.telegram_user_id = $1
      order by s.created_at desc
      limit 1
      `,
      [telegramUserId]
    );

    if (result.rowCount === 0) {
      return res.json({ ok: true, status: "none" });
    }

    res.json({ ok: true, ...result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});
