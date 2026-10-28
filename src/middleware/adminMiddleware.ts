import { Context, MiddlewareFn } from "telegraf";
import { getUser } from "../services/userService";
import {
   ADMIN_COMMANDS,
   isSuperAdmin,
   PREMIUM_COMMANDS,
   ROLES,
   SUPER_ADMIN_COMMANDS,
   USER_COMMANDS,
} from "../constants/roles";
import { bot } from "../bots/telegram";
import { REFERRAL_STICKER_LIMIT_BONUS } from "../constants/businessConfig";
import { normalizeLanguage, translate } from "../lang";

export const adminOnly: MiddlewareFn<Context> = async (ctx, next) => {
   const user = await getUser(ctx.chat?.id);
   if (user?.role !== ROLES.ADMIN) {
      ctx.reply(translate(normalizeLanguage(ctx.state.language), "inValidCommand"), { parse_mode: "Markdown" });
      return;
   }
   return next();
};

export const setCommandsForUser = async (
   telegramId: number,
   role: string,
   isPremium: boolean = false,
   language: "id" | "en" = "id",
) => {
   const commands = isSuperAdmin(telegramId)
      ? SUPER_ADMIN_COMMANDS
      : role === ROLES.ADMIN
         ? (isPremium ? ADMIN_COMMANDS : ADMIN_COMMANDS.filter(({ command }) =>
            command !== "numbers" && command !== "stickername"
         ))
         : isPremium ? PREMIUM_COMMANDS : USER_COMMANDS;
   const englishDescriptions: Record<string, string> = {
      start: "🚀 Start the bot",
      language: "🌐 Change language",
      profile: "👤 View your profile",
      invite: `🎁 Referral: +${REFERRAL_STICKER_LIMIT_BONUS} limit`,
      leaderboard: "🏆 Referral leaderboard",
      review: "⭐ Leave a bot review",
      premium: "⭐ Premium status and benefits",
      list_review: "📜 View reviews",
      numbers: "📱 Manage WhatsApp numbers",
      stickername: "🏷️ Set sticker creator name",
      broadcast: "📢 Message all users",
      limit: "⚡ Add a user's limit",
      list: "📋 List users",
      setpremium: "⭐ Set a user's Premium status",
      delete: "🗑️ Delete a user",
      block: "🚫 Block or unblock a user",
      ai: "🤖 AI assistant settings",
      setqris: "🧾 Save business QRIS image",
      deleteqris: "🗑️ Delete business QRIS image",
   };
   const localizedCommands = language === "en"
      ? commands.map(({ command, description }) => ({
         command,
         description: englishDescriptions[command] ?? description,
      }))
      : commands;
   await bot.telegram.setMyCommands(localizedCommands, {
      scope: { type: "chat", chat_id: telegramId },
   });
};