import { Telegraf } from "telegraf";
import { 
   handleStart, 
   hears, 
   handleTextMessage, 
   handleStickerMessage, 
   handleProfile, 
   handleListUser, 
   handleHelper, 
   handleGuide, 
   handleLimitCommand, 
   handlePremiumCommand, 
   handleBlockCommand, 
   handleUserAction, 
   handleExecuteAction, 
   handleDeleteCommand,
   handleBroadcast,
   handleInvite,
} from "../helpers/telegramHelper";
import { adminOnly } from "../middleware/adminMiddleware";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

bot.start((ctx) => handleStart(ctx));
bot.command("profile", (ctx) => handleProfile(ctx));
bot.command("help", (ctx) => handleHelper(ctx));
bot.command("guide", (ctx) => handleGuide(ctx));
bot.command("invite", (ctx) => handleInvite(ctx));

bot.command("broadcast", adminOnly, (ctx) => handleBroadcast(ctx));
bot.command("limit", adminOnly, (ctx) => handleLimitCommand(ctx));
bot.command("premium", adminOnly, (ctx) => handlePremiumCommand(ctx));
bot.command("block", adminOnly, (ctx) => handleBlockCommand(ctx));
bot.command("list",  adminOnly, (ctx) => handleListUser(ctx));
bot.command("delete", adminOnly, (ctx) => handleDeleteCommand(ctx));
   
bot.action(/^list_\d+$/, adminOnly, (ctx) => handleListUser(ctx));
bot.action(/^(limit|premium|block|delete)_(user|page)_/, adminOnly, (ctx) => handleUserAction(ctx));
bot.action(/^(setlimit|setpremium|setblock|setdelete)_/, adminOnly, (ctx) => handleExecuteAction(ctx));
bot.action("get_invite_link", (ctx) => handleInvite(ctx));

bot.hears("hi", (ctx) => hears(ctx));
bot.on("text", (ctx) => handleTextMessage(ctx));
bot.on("sticker", (ctx) => handleStickerMessage(ctx));

bot.launch();

console.log("Bot Telegram berjalan...");