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
   handleLeaderboard,
   handleAISettings,
   handleAIToggle,
   handleReviewCommand,
   handleReviewsList,
} from "../helpers/telegramHelper";
import { adminOnly } from "../middleware/adminMiddleware";
import { getUser } from "../services/userService";
import { deleteUserReview } from "../services/userService";
import { escapeMarkdown } from "../helpers/telegramHelper";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

bot.start((ctx) => handleStart(ctx));
bot.command("profile", (ctx) => handleProfile(ctx));
bot.command("help", (ctx) => handleHelper(ctx));
bot.command("guide", (ctx) => handleGuide(ctx));
bot.command("review", (ctx) => handleReviewCommand(ctx));
bot.command("list_review", (ctx) => handleReviewsList(ctx));
bot.command("invite", (ctx) => handleInvite(ctx));
bot.action(/^delete_review_(\d+)$/, adminOnly, async (ctx) => {
   const telegramId = Number((ctx.callbackQuery as any).data?.replace("delete_review_", ""));
   const user = await getUser(telegramId);
   if (!user) {
      await ctx.answerCbQuery("User tidak ditemukan");
      return;
   }

   await deleteUserReview(telegramId);
   await ctx.answerCbQuery("✅ Review berhasil dihapus");
   await ctx.editMessageText(`✅ Review dari *${escapeMarkdown(user.name || "User")}* berhasil dihapus.`, { parse_mode: "Markdown" });
});
bot.command("leaderboard", (ctx) => handleLeaderboard(ctx));
bot.command("ai", adminOnly, (ctx) => handleAISettings(ctx));

bot.command("broadcast", adminOnly, (ctx) => handleBroadcast(ctx));
bot.command("limit", adminOnly, (ctx) => handleLimitCommand(ctx));
bot.command("premium", adminOnly, (ctx) => handlePremiumCommand(ctx));
bot.command("block", adminOnly, (ctx) => handleBlockCommand(ctx));
bot.command("list",  adminOnly, (ctx) => handleListUser(ctx));
bot.command("delete", adminOnly, (ctx) => handleDeleteCommand(ctx));
   
bot.action(/^list_\d+_(asc|desc)$/, adminOnly, (ctx) => handleListUser(ctx));
bot.action(/^(limit|premium|block|delete)_(user|page)_/, adminOnly, (ctx) => handleUserAction(ctx));
bot.action(/^(setlimit|setpremium|setblock|setdelete)_/, adminOnly, (ctx) => handleExecuteAction(ctx));
bot.action("get_invite_link", (ctx) => handleInvite(ctx));
bot.action(/^ai_toggle_(telegram|wa)$/, adminOnly, (ctx) => handleAIToggle(ctx));

bot.hears("hi", (ctx) => hears(ctx));
bot.on("text", (ctx) => handleTextMessage(ctx));
bot.on("sticker", (ctx) => handleStickerMessage(ctx));

bot.catch((err, ctx) => {
   console.error(`[Bot Error] Update ${ctx.updateType}:`, err);
});

bot.launch();

console.log("Bot Telegram berjalan...");