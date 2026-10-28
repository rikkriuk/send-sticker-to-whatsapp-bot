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
   handleSetPremiumCommand,
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
   handleReviewsPage,
   handleWhatsappNumbers,
   handleStickerName,
   handleQrisCommand,
   handleQrisPhoto,
   handleDeleteQrisCommand,
   handleStartLanguage,
   handleLanguageCommand,
   handleLanguageSelection,
   handleDeleteReview,
   loadUserLanguage,
   handleTelegramBotReady,
} from "../helpers/telegramHelper";
import { adminOnly } from "../middleware/adminMiddleware";
import { escapeMarkdown } from "../helpers/markdownHelper";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);

bot.use(loadUserLanguage);

bot.start((ctx) => handleStart(ctx));
bot.command("language", (ctx) => handleLanguageCommand(ctx));
bot.action(/^start_language_(id|en)_(\d+)$/, (ctx) => handleStartLanguage(ctx));
bot.action(/^language_(id|en)$/, (ctx) => handleLanguageSelection(ctx));
bot.command("profile", (ctx) => handleProfile(ctx));
bot.command("numbers", (ctx) => handleWhatsappNumbers(ctx));
bot.command("stickername", (ctx) => handleStickerName(ctx));
bot.command("setqris", (ctx) => handleQrisCommand(ctx));
bot.command("deleteqris", (ctx) => handleDeleteQrisCommand(ctx));
bot.command("help", (ctx) => handleHelper(ctx));
bot.command("guide", (ctx) => handleGuide(ctx));
bot.command("review", (ctx) => handleReviewCommand(ctx));
bot.command("list_review", (ctx) => handleReviewsList(ctx));
bot.command("invite", (ctx) => handleInvite(ctx));
bot.action("review_prompt", async (ctx) => {
   await ctx.answerCbQuery();
   await handleReviewCommand(ctx);
});
bot.action(/^delete_review_(\d+)(?:_(\d+))?$/, adminOnly, handleDeleteReview);
bot.action(/^reviews_page_\d+$/, (ctx) => handleReviewsPage(ctx));
bot.command("leaderboard", (ctx) => handleLeaderboard(ctx));
bot.command("ai", adminOnly, (ctx) => handleAISettings(ctx));

bot.command("broadcast", adminOnly, (ctx) => handleBroadcast(ctx));
bot.command("limit", adminOnly, (ctx) => handleLimitCommand(ctx));
bot.command("premium", (ctx) => handlePremiumCommand(ctx));
bot.command("setpremium", adminOnly, (ctx) => handleSetPremiumCommand(ctx));
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
bot.on("photo", (ctx) => handleQrisPhoto(ctx));
bot.on("sticker", (ctx) => handleStickerMessage(ctx));

bot.catch((err, ctx) => {
   console.error(`[Bot Error] Update ${ctx.updateType}:`, err);
});

bot.launch()
   .then(() => handleTelegramBotReady(bot))
   .catch((error) => {
      console.error("Gagal menjalankan bot Telegram:", error);
   });