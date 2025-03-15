import { Telegraf } from "telegraf";
import { handleStart, hears, handleTextMessage, handleStickerMessage, handleProfile, handleAddLimit, handleListUser } from "../helpers/telegramHelper";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

bot.start((ctx) => handleStart(ctx));
bot.command("profile", (ctx) => handleProfile(ctx));
bot.command("limit", (ctx) => handleAddLimit(ctx));
bot.command("list", (ctx) => handleListUser(ctx));
bot.hears("hi", (ctx) => hears(ctx));
bot.on("text", (ctx) => handleTextMessage(ctx));
bot.on("sticker", (ctx) => handleStickerMessage(ctx));
bot.launch();

console.log("Bot Telegram berjalan...");
