import { Router } from "express";
import { pool } from "../db.js";

export const plansRouter = Router();

plansRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `select id, title, description, price_monthly, price_yearly from plans order by price_monthly asc nulls last`
    );

    const items = result.rows.flatMap((row) => {
      const out: Array<{
        id: string;
        title: string;
        price: number;
        currency: string;
        period: string;
        badge?: string;
      }> = [];

      if (row.price_monthly != null) {
        out.push({
          id: row.id,
          title: row.title,
          price: Number(row.price_monthly),
          currency: "KZT",
          period: "monthly",
        });
      }

      if (row.price_yearly != null) {
        out.push({
          id: row.id,
          title: row.title,
          price: Number(row.price_yearly),
          currency: "KZT",
          period: "yearly",
          badge: "Выгодно",
        });
      }

      return out;
    });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("/plans error:", err);
    return res.status(500).json({ ok: false });
  }
});
