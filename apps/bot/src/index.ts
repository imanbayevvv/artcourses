import "dotenv/config";
import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", async (ctx) => {
  const url = process.env.WEBAPP_URL!;
  if (!url.startsWith("https://")) {
    return ctx.reply("WEBAPP_URL должен быть HTTPS. Сейчас: " + url);
  }

  await ctx.api.setChatMenuButton({
    chat_id: ctx.chat.id,
    menu_button: {
      type: "web_app",
      text: "Open",
      web_app: { url },
    },
  });

  await ctx.reply("Готово. Теперь жми кнопку Open рядом с полем ввода 👇");
});

bot.start();
console.log("Bot started");
