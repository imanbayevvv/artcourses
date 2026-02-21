import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import {
  CATEGORIES,
  PRODUCTS,
  buildPlanOptions,
  getProductsByCategory,
  getProductById,
  money,
  planIdForCheckout,
} from "./catalog.js";

const bot = new Bot(process.env.BOT_TOKEN!);
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const WEBAPP_URL = process.env.WEBAPP_URL!;

// ── helpers ────────────────────────────────────────────────────

async function getSubStatus(telegramUserId: number) {
  const r = await fetch(`${API_URL}/subscriptions/status/${telegramUserId}`);
  if (!r.ok) return null;
  return (await r.json()) as any;
}

async function createCheckout(telegramUserId: number, planId: string) {
  const r = await fetch(`${API_URL}/checkout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
      plan_id: planIdForCheckout(planId),
    }),
  });
  if (!r.ok) throw new Error(`checkout/create failed: ${r.status}`);
  return (await r.json()) as any;
}

// ── /start — main menu ────────────────────────────────────────

bot.command("start", async (ctx) => {
  if (!WEBAPP_URL?.startsWith("https://")) {
    return ctx.reply("WEBAPP_URL должен быть HTTPS. Сейчас: " + WEBAPP_URL);
  }

  // Set Mini App menu button
  await ctx.api.setChatMenuButton({
    chat_id: ctx.chat.id,
    menu_button: { type: "web_app", text: "Open", web_app: { url: WEBAPP_URL } },
  });

  // Upsert user
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

  const kb = new InlineKeyboard()
    .text("📚 Каталог курсов", "menu:catalog")
    .row()
    .text("🎓 Мои курсы", "menu:my_courses")
    .row()
    .text("💳 Подписка", "menu:subscription")
    .row()
    .text("💬 Поддержка", "menu:support");

  await ctx.reply(
    "Добро пожаловать в ArtCourses!\n\nВыберите раздел:",
    { reply_markup: kb }
  );
});

// ── /open — hint ──────────────────────────────────────────────

bot.command("open", async (ctx) => {
  await ctx.reply("Жми кнопку Open рядом с полем ввода 👇");
});

// ── /subscription — quick access ──────────────────────────────

bot.command("subscription", async (ctx) => {
  await showSubscription(ctx);
});

// ── Main menu callbacks ───────────────────────────────────────

bot.callbackQuery("menu:catalog", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showCategories(ctx);
});

bot.callbackQuery("menu:my_courses", async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard().webApp("Открыть библиотеку", WEBAPP_URL);
  await ctx.editMessageText(
    "🎓 Ваши курсы доступны в Mini App.\nНажмите кнопку ниже:",
    { reply_markup: kb }
  );
});

bot.callbackQuery("menu:subscription", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSubscription(ctx);
});

bot.callbackQuery("menu:support", async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard().text("← Назад", "menu:back");
  await ctx.editMessageText(
    "💬 Поддержка\n\nНапишите ваш вопрос в чат, и мы ответим в ближайшее время.\n\nИли свяжитесь: @ArtCoursesSupport",
    { reply_markup: kb }
  );
});

bot.callbackQuery("menu:back", async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard()
    .text("📚 Каталог курсов", "menu:catalog")
    .row()
    .text("🎓 Мои курсы", "menu:my_courses")
    .row()
    .text("💳 Подписка", "menu:subscription")
    .row()
    .text("💬 Поддержка", "menu:support");

  await ctx.editMessageText("Выберите раздел:", { reply_markup: kb });
});

// ── Catalog: categories ───────────────────────────────────────

async function showCategories(ctx: any) {
  const kb = new InlineKeyboard();
  for (const cat of CATEGORIES) {
    kb.text(cat.title, `cat:${cat.id}`).row();
  }
  kb.text("← Назад", "menu:back");

  const text = "📚 Каталог курсов\n\nВыберите категорию:";
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

// ── Catalog: category → products ──────────────────────────────

bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const categoryId = ctx.match[1] ?? "";
  const products = getProductsByCategory(categoryId);
  const category = CATEGORIES.find((c) => c.id === categoryId);

  if (products.length === 0) {
    const kb = new InlineKeyboard().text("← Назад", "menu:catalog");
    return ctx.editMessageText("В этой категории пока нет курсов.", { reply_markup: kb });
  }

  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(`${p.title} — ${p.shortDesc}`, `prod:${p.id}`).row();
  }
  kb.text("← Назад", "menu:catalog");

  await ctx.editMessageText(
    `📂 ${category?.title ?? "Категория"}\n\nВыберите курс:`,
    { reply_markup: kb }
  );
});

// ── Catalog: product detail ───────────────────────────────────

bot.callbackQuery(/^prod:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const product = getProductById(ctx.match[1] ?? "");

  if (!product) {
    return ctx.editMessageText("Продукт не найден.");
  }

  const kb = new InlineKeyboard()
    .text("🛒 Выбрать план", "choose_plan")
    .row()
    .text("← Назад", `cat:${product.category}`);

  const text = [
    `📖 ${product.title}`,
    "",
    product.fullDesc,
    "",
    `👤 Кому подходит: ${product.audience}`,
    `📦 Что внутри: ${product.contents}`,
  ].join("\n");

  await ctx.editMessageText(text, { reply_markup: kb });
});

// ── Plan selection ────────────────────────────────────────────

bot.callbackQuery("choose_plan", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlanSelection(ctx);
});

async function showPlanSelection(ctx: any) {
  const plans = buildPlanOptions();
  const kb = new InlineKeyboard();

  for (const plan of plans) {
    let label = plan.label;
    if (plan.badge) label += ` ${plan.badge}`;
    label += ` — ${money(plan.price)} ₸`;
    kb.text(label, plan.callbackData).row();
  }
  kb.text("← Назад", "menu:back");

  let text = "💳 Выберите план подписки:\n\n";
  for (const plan of plans) {
    text += `• ${plan.label}`;
    if (plan.badge) text += ` ${plan.badge}`;
    text += `: ${money(plan.price)} ₸`;
    if (plan.oldPrice) {
      text += ` (было ${money(plan.oldPrice)} ₸)`;
    }
    text += "\n";
  }

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

// ── Plan selected → confirm → checkout ────────────────────────

bot.callbackQuery(/^plan:(monthly|quarterly|yearly)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const planId = ctx.match[1] ?? "monthly";
  const plans = buildPlanOptions();
  const plan = plans.find((p) => p.id === planId)!;

  let text = `✅ Вы выбрали: ${plan.label}\n`;
  text += `💰 Стоимость: ${money(plan.price)} ₸\n`;
  if (plan.oldPrice) {
    text += `Было: ${money(plan.oldPrice)} ₸ → Стало: ${money(plan.price)} ₸ ${plan.badge ?? ""}\n`;
  }

  const kb = new InlineKeyboard()
    .text("💳 Перейти к оплате", `pay:${planId}`)
    .row()
    .text("← Назад к планам", "choose_plan");

  await ctx.editMessageText(text, { reply_markup: kb });
});

// ── Checkout ──────────────────────────────────────────────────

bot.callbackQuery(/^pay:(monthly|quarterly|yearly)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const planId = ctx.match[1] ?? "monthly";

  try {
    const checkout = await createCheckout(userId, planId);

    await ctx.editMessageText(
      `Ссылка на оплату (mock):\n${checkout.checkout_url}\n\n` +
      `После "оплаты" отправьте webhook mock с event_id:\n${checkout.event_id}`
    );
  } catch (e: any) {
    await ctx.editMessageText("Ошибка создания оплаты: " + String(e?.message ?? e));
  }
});

// ── Subscription status ───────────────────────────────────────

async function showSubscription(ctx: any) {
  const userId = ctx.from?.id;
  if (!userId) return ctx.reply("Не удалось определить пользователя.");

  const status = await getSubStatus(userId);

  let text = "💳 Подписка\n\n";
  if (!status || status.status === "none") {
    text += "У вас нет активной подписки.\n\nВыберите план, чтобы получить доступ ко всем курсам:";
    await showPlanSelection(ctx);
    return;
  }

  const statusLabels: Record<string, string> = {
    active: "✅ Активна",
    past_due: "⚠️ Ожидается оплата",
    canceled: "❌ Отменена",
    expired: "🔒 Истекла",
  };

  text += `Статус: ${statusLabels[status.status] ?? status.status}\n`;
  if (status.plan_title) text += `План: ${status.plan_title}\n`;
  if (status.current_period_end) {
    const until = new Date(status.current_period_end).toLocaleDateString("ru-RU");
    text += `Доступ до: ${until}\n`;
  }

  if (status.status === "canceled" && status.current_period_end) {
    const until = new Date(status.current_period_end).toLocaleDateString("ru-RU");
    text += `\nПодписка отменена, доступ сохранится до ${until}`;
  }

  if (status.status === "past_due") {
    text += "\n⚠️ Проблема с оплатой. Обновите способ оплаты.";
  }

  const kb = new InlineKeyboard();
  if (status.status === "active" || status.status === "past_due" || status.status === "canceled") {
    kb.webApp("📖 Открыть библиотеку", WEBAPP_URL).row();
  }
  if (status.status === "expired" || status.status === "past_due") {
    kb.text("🛒 Выбрать план", "choose_plan").row();
  }
  kb.text("← Главное меню", "menu:back");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

// ── Error handling ────────────────────────────────────────────

bot.catch((err) => console.error(err));
bot.start();
console.log("Bot started");
