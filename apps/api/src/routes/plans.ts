import { Router } from "express";
import { pool } from "../db.js";

export const plansRouter = Router();

plansRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `select id, title, description, price_monthly, price_yearly from plans order by price_monthly asc nulls last`
    );

    const items = result.rows
      .map((row) => {
        const isYearly = row.id === "yearly";
        const price = Number(isYearly ? row.price_yearly : row.price_monthly) || 0;

        return {
          id: String(row.id),
          title: String(row.title),
          price,
          currency: "KZT" as const,
          period: isYearly ? "yearly" : "monthly",
          ...(isYearly ? { badge: "Выгодно" } : {}),
        };
      })
      .filter((item) => item.price > 0);

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("/plans error:", err);
    return res.status(500).json({ ok: false });
  }
});
