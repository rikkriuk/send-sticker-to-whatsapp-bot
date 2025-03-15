import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { handleStart, hears, handleTextMessage, handleStickerMessage } from "../helpers/telegramHelper";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

bot.start((ctx) => handleStart(ctx));
bot.hears("hi", (ctx) => hears(ctx));
bot.on("text", (ctx) => handleTextMessage(ctx));
bot.on("sticker", (ctx) => handleStickerMessage(ctx));

bot.launch();

console.log("Bot Telegram berjalan...");
