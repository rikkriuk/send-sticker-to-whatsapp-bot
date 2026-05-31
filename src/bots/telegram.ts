import { Telegraf } from "telegraf";
import { handleStart, hears, handleTextMessage, handleStickerMessage, handleProfile, handleAddLimit, handleListUser, handleHelper, handleGuide, handleLimitCommand, handlePremiumCommand, handleBlockCommand, handleUserAction, handleExecuteAction } from "../helpers/telegramHelper";
import { adminOnly } from "../middleware/adminMiddleware";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

bot.start((ctx) => handleStart(ctx));
bot.command("profile", (ctx) => handleProfile(ctx));
bot.command("help", (ctx) => handleHelper(ctx));
bot.command("guide", (ctx) => handleGuide(ctx));

bot.command("limit", adminOnly, (ctx) => handleLimitCommand(ctx));
bot.command("premium", adminOnly, (ctx) => handlePremiumCommand(ctx));
bot.command("block", adminOnly, (ctx) => handleBlockCommand(ctx));
bot.command("list",  adminOnly, (ctx) => handleListUser(ctx));

bot.action(/^list_\d+$/, adminOnly, (ctx) => handleListUser(ctx));
bot.action(/^(limit|premium|block)_(user|page)_/, adminOnly, (ctx) => handleUserAction(ctx));
bot.action(/^(setlimit|setpremium|setblock)_/, adminOnly, (ctx) => handleExecuteAction(ctx));

bot.hears("hi", (ctx) => hears(ctx));
bot.on("text", (ctx) => handleTextMessage(ctx));
bot.on("sticker", (ctx) => handleStickerMessage(ctx));

bot.launch();

console.log("Bot Telegram berjalan...");