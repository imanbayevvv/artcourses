import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

const API_URL = process.env.API_URL ?? "http://localhost:3001";

function money(amount: number) {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

async function getSubStatus(telegramUserId: number) {
  const r = await fetch(`${API_URL}/subscriptions/status/${telegramUserId}`);
  if (!r.ok) return null;
  return (await r.json()) as any;
}

async function createCheckout(telegramUserId: number, planId: "monthly" | "yearly") {
  const r = await fetch(`${API_URL}/checkout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram_user_id: telegramUserId, plan_id: planId }),
  });
  if (!r.ok) throw new Error(`checkout/create failed: ${r.status}`);
  return (await r.json()) as any;
}

bot.command("start", async (ctx) => {
  const url = process.env.WEBAPP_URL!;
  if (!url?.startsWith("https://")) {
    return ctx.reply("WEBAPP_URL должен быть HTTPS. Сейчас: " + url);
  }

  // 1) Ставим кнопку меню Mini App (как у тебя было)
  await ctx.api.setChatMenuButton({
    chat_id: ctx.chat.id,
    menu_button: {
      type: "web_app",
      text: "Open",
      web_app: { url },
    },
  });

  // 2) Пишем пользователя в БД (по-хорошему)
  // (не критично, но правильно)
  try {
    await fetch(`${API_URL}/users/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_user_id: ctx.from?.id,
        username: ctx.from?.username ?? null,
        first_name: ctx.from?.first_name ?? null,
      }),
    });
  } catch {}

  await ctx.reply(
    "Добро пожаловать в ArtCourses.\n\nКоманды:\n/subscription — управление подпиской\n/open — открыть Mini App"
  );
});

// просто подсказка
bot.command("open", async (ctx) => {
  await ctx.reply("Жми кнопку Open рядом с полем ввода 👇");
});

bot.command("subscription", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return ctx.reply("Не вижу user id");

  const status = await getSubStatus(userId);

  let text = "Подписка: ";
  if (!status || status.status === "none") {
    text += "нет активной\n";
  } else {
    text += `${status.status}\n`;
    if (status.current_period_end) text += `Доступ до: ${status.current_period_end}\n`;
    if (status.plan_title) text += `План: ${status.plan_title}\n`;
  }

  text += "\nВыберите план:";

  const kb = new InlineKeyboard()
    .text(`Месяц — ${money(4990)} ₸`, "buy:monthly")
    .row()
    .text(`Год — ${money(49900)} ₸`, "buy:yearly");

  await ctx.reply(text, { reply_markup: kb });
});

bot.callbackQuery(/^buy:(monthly|yearly)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  if (!userId) return;

  const planId = ctx.match[1] as "monthly" | "yearly";

  try {
    const checkout = await createCheckout(userId, planId);

    await ctx.reply(
      `Ссылка на оплату (mock):\n${checkout.checkout_url}\n\n` +
        `После "оплаты" дерни webhook mock с event_id:\n${checkout.event_id}`
    );
  } catch (e: any) {
    await ctx.reply("Ошибка создания оплаты: " + String(e?.message ?? e));
  }
});

bot.catch((err) => console.error(err));
bot.start();
console.log("Bot started");