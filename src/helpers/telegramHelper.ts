import { Context, MiddlewareFn, Telegraf } from "telegraf";
import { Message } from "telegraf/types";
import axios from "axios";
import {
   checkAndResetPremium,
   decrementStickerLimit,
   getTotalPages,
   getTotalUsers,
   getUser,
   deleteUserReview,
   getUsersWithPagination,
   resetStickerLimitIfNeeded,
   resetUserProcessing,
   saveOrUpateUser,
   setUserLanguage,
   savePhoneNumber,
   setUserProcessing,
   updateLimit,
   blockUser,
   unblockUser,
   setPremium,
   removePremium,
   deleteUser,
   getAllUsers,
   getTopReferrers,
   toggleTelegramAI,
   toggleWAAI,
   getAIConfig,
   submitUserReview,
   updateUserReview,
   getRecentReviews,
   getReviewsPage,
   setWhatsappNumbers,
   setStickerPackName,
} from "../services/userService";
import { deleteBusinessQris, saveBusinessQris } from "../services/businessConfigService";
import { isValidWhatsAppNumber, looksLikePhoneNumber } from "./phoneValidate";
import { escapeMarkdown } from "./markdownHelper";
import { getFileUrl } from "./fileHelper";
import { downloadFile } from "../services/stickerService";
import fs from "fs";
import { formattedDate } from "./formattedDate";
import whatsappEmitter from "../events/eventEmitter";
import { setCommandsForUser } from "../middleware/adminMiddleware";
import {
   ADMIN_TELEGRAM_ID,
   ADMIN_NAME,
   ADMIN_TELEGRAM_USERNAME,
   isSuperAdmin,
   ROLES,
   USER_COMMANDS,
} from "../constants/roles";
import { getTimeUntilReset } from "./time";
import { askAI } from "../services/aiService";
import {
   PREMIUM_MAX_WHATSAPP_NUMBERS,
   REFERRAL_PREMIUM_DAYS,
   REFERRALS_PER_PREMIUM,
   REFERRAL_STICKER_LIMIT_BONUS,
   REVIEW_STICKER_LIMIT_BONUS,
   PREMIUM_PRICE_LABEL,
   STICKER_PACK_NAME_MAX_LENGTH,
} from "../constants/businessConfig";
import {
   Language,
   normalizeLanguage,
   translate,
   TranslationKey,
} from "../lang";

let isClientReady: boolean = false;
const pendingReviewUsers = new Set<number>();

const isTextMessage = (message: Message): message is Message.TextMessage => {
   return "text" in message;
};

const getLanguage = (ctx: Context): Language =>
   normalizeLanguage(ctx.state.language);

const t = (
   ctx: Context,
   key: Parameters<typeof translate>[1],
   values: Record<string, string | number> = {},
) => translate(getLanguage(ctx), key, values);

export const loadUserLanguage: MiddlewareFn<Context> = async (ctx, next) => {
   const user = ctx.from ? await getUser(ctx.from.id) : undefined;
   ctx.state.language = user?.language ?? "id";
   await next();
};

export const handleTelegramBotReady = async (bot: Telegraf) => {
   try {
      await bot.telegram.setMyCommands(USER_COMMANDS);
      if (Number.isSafeInteger(ADMIN_TELEGRAM_ID)) {
         await setCommandsForUser(ADMIN_TELEGRAM_ID, ROLES.ADMIN);
      }
   } catch (error) {
      console.error("Gagal memperbarui daftar command Telegram:", error);
   }

   console.log("Bot Telegram berjalan...");
};

whatsappEmitter.on("whatsappReady", () => {
   isClientReady = true;
})

const getStartReferral = (ctx: Context): number | undefined => {
   const startPayload = (ctx as any).startPayload as string | undefined;
   const referredBy = startPayload?.startsWith("ref_")
      ? Number(startPayload.slice(4))
      : undefined;
   return Number.isSafeInteger(referredBy) ? referredBy : undefined;
};

const showLanguageKeyboard = async (
   ctx: Context,
   callbackPrefix: "start_language" | "language",
   referredBy?: number,
) => {
   await ctx.reply(t(ctx, "chooseLanguage"), {
      reply_markup: {
         inline_keyboard: [[
            {
               text: "🇮🇩 Bahasa Indonesia",
               callback_data: callbackPrefix === "start_language"
                  ? `start_language_id_${referredBy ?? 0}`
                  : "language_id",
            },
            {
               text: "🇬🇧 English",
               callback_data: callbackPrefix === "start_language"
                  ? `start_language_en_${referredBy ?? 0}`
                  : "language_en",
            },
         ]],
      },
   });
};

const finishStart = async (
   ctx: Context,
   referredBy?: number,
   registration?: Awaited<ReturnType<typeof saveOrUpateUser>>,
) => {
   if (!ctx.chat || ctx.chat.type !== "private") return;
   const language = getLanguage(ctx);
   await ctx.reply(
      `_${t(ctx, "greeting", { name: escapeMarkdown(ctx.chat.first_name ?? "") })}_`,
      { parse_mode: "Markdown" },
   );

   const { user, isNewUser, referralRewardGranted } =
      registration ?? await saveOrUpateUser(ctx.chat, referredBy);

   if (isNewUser && referredBy) {
      try {
         const referrer = await getUser(referredBy);
         const referrerLanguage = normalizeLanguage(referrer?.language);
         const referralLines = [
            translate(referrerLanguage, "referralJoined"),
            "",
            translate(referrerLanguage, "referralUsedLink", {
               name: escapeMarkdown(ctx.chat.first_name ?? ""),
            }),
            translate(referrerLanguage, "referralBonus", {
               bonus: REFERRAL_STICKER_LIMIT_BONUS,
            }),
            ...(referralRewardGranted
               ? [
                  translate(referrerLanguage, "referralPremium", {
                     days: REFERRAL_PREMIUM_DAYS,
                     referrals: REFERRALS_PER_PREMIUM,
                  }),
                  translate(referrerLanguage, "seePremium"),
               ]
               : []),
         ];
         await ctx.telegram.sendMessage(referredBy, referralLines.join("\n"), {
            parse_mode: "Markdown",
         });
      } catch (_) {}

      if (referralRewardGranted) {
         const referrer = await getUser(referredBy);
         if (referrer) {
            const referrerIsPremium = await checkAndResetPremium(referrer);
            await setCommandsForUser(
               referredBy,
               referrer.role,
               referrerIsPremium,
               normalizeLanguage(referrer.language),
            );
         }
      }
   }

   const isPremium = await checkAndResetPremium(user);
   await setCommandsForUser(ctx.chat.id, user.role, isPremium, language);

   if (isNewUser) {
      try {
         const referralLine = referredBy
            ? `\n${t(ctx, "referralFrom", { id: referredBy })}`
            : "";
         const adminMessage = `${referredBy ? t(ctx, "newUserViaReferral") : t(ctx, "newUser")}\n\n*${escapeMarkdown(user.name)}* ${user.isPremium ? "⭐" : ""}
├ ${t(ctx, "roleLabel")}: ${user.role}
├ ${t(ctx, "usernameLabel")}: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}
├ ${t(ctx, "whatsappLabel")}: ${user.whatsappNumber ? "+" + user.whatsappNumber : "-"}
├ ${t(ctx, "limitLabel")}: ${user.stickerLimit}${referralLine}
├ ${t(ctx, "createdLabel")}: ${formattedDate(user.createdAt)}
└ ${t(ctx, "telegramIdLabel")}: [${user.telegramId}](tg://user?id=${user.telegramId})`;

         await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminMessage, {
            parse_mode: "Markdown",
         });
      } catch (e) {
         console.warn("Gagal mengirim notifikasi user baru ke admin:", e);
      }
   }

   const totalUsers = await getTotalUsers();
   const reviews = await getRecentReviews(1);
   await ctx.reply(
      t(ctx, "about", {
         adminName: ADMIN_NAME,
         adminUsername: ADMIN_TELEGRAM_USERNAME,
      }),
      { parse_mode: "Markdown" },
   );
   await ctx.reply(
      t(ctx, "totalUsersInfo", {
         total: totalUsers,
         reviews: reviews.length > 0 ? t(ctx, "totalUsersReviews") : "",
      }),
      { parse_mode: "Markdown" },
   );
   await ctx.reply(t(ctx, "sendSticker"), { parse_mode: "Markdown" });
};

export const handleStart = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      ctx.reply(t(ctx, "chatNotFound"), { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat.id);
   const referredBy = getStartReferral(ctx);
   if (!user?.language) {
      await showLanguageKeyboard(ctx, "start_language", referredBy);
      return;
   }

   ctx.state.language = user.language;
   await finishStart(ctx, referredBy);
};

export const handleStartLanguage = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private" || !ctx.from) return;
   const callbackData = (ctx.callbackQuery as any)?.data as string | undefined;
   const match = callbackData?.match(/^start_language_(id|en)_(\d+)$/);
   if (!match) return;

   const language = match[1] as Language;
   const referredBy = Number(match[2]) || undefined;
   const registration = await saveOrUpateUser(ctx.chat, referredBy, language);
   ctx.state.language = language;
   await ctx.answerCbQuery();
   await finishStart(ctx, referredBy, registration);
};

export const handleLanguageCommand = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      await ctx.reply(t(ctx, "chatNotFound"), { parse_mode: "Markdown" });
      return;
   }
   await showLanguageKeyboard(ctx, "language");
};

export const handleLanguageSelection = async (ctx: Context) => {
   if (!ctx.from || ctx.chat?.type !== "private") return;
   const callbackData = (ctx.callbackQuery as any)?.data as string | undefined;
   const match = callbackData?.match(/^language_(id|en)$/);
   if (!match) return;

   const language = match[1] as Language;
   const user = await setUserLanguage(ctx.from.id, language);
   if (!user) {
      await ctx.answerCbQuery(translate(language, "clickStart"));
      return;
   }

   ctx.state.language = language;
   const isPremium = await checkAndResetPremium(user);
   await setCommandsForUser(user.telegramId, user.role, isPremium, language);
   await ctx.answerCbQuery();
   await ctx.editMessageText(translate(language, "languageChanged"));
};

export const handleWhatsappNumbers = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message) || !ctx.chat) return;

   const user = await getUser(ctx.chat.id);
   const hasFeatureAccess = user ? await checkAndResetPremium(user) : false;
   if (!user || !hasFeatureAccess) {
      if (user) await setCommandsForUser(user.telegramId, user.role, false, normalizeLanguage(user.language));
      await ctx.reply(t(ctx, "premiumOnly"));
      return;
   }

   const commandText = ctx.message.text.replace(/^\/numbers(?:@\S+)?/i, "").trim();
   if (!commandText) {
      const numbers = user.whatsappNumbers?.length
         ? user.whatsappNumbers
         : user.whatsappNumber ? [user.whatsappNumber] : [];
      await ctx.reply(
         t(ctx, "premiumNumbersCurrent", {
            numbers: numbers.map((number, index) => `${index + 1}. +${number}`).join("\n") || t(ctx, "noNumbers"),
            max: PREMIUM_MAX_WHATSAPP_NUMBERS,
         })
      );
      return;
   }

   const whitespaceSeparatedNumbers = commandText.split(/\s+/).filter(Boolean);
   const inputNumbers = commandText.includes(",")
      ? commandText.split(",").map((number) => number.trim()).filter(Boolean)
      : whitespaceSeparatedNumbers.length > 1 &&
          whitespaceSeparatedNumbers.every((number) => isValidWhatsAppNumber(number))
        ? whitespaceSeparatedNumbers
        : [commandText];
   if (inputNumbers.length === 0 || inputNumbers.length > PREMIUM_MAX_WHATSAPP_NUMBERS) {
      await ctx.reply(t(ctx, "premiumNumbersFormat", { max: PREMIUM_MAX_WHATSAPP_NUMBERS }));
      return;
   }

   const numbers: string[] = [];
   for (const inputNumber of inputNumbers) {
      const number = isValidWhatsAppNumber(inputNumber);
      if (!number) {
         await ctx.reply(t(ctx, "premiumNumbersInvalid"));
         return;
      }
      numbers.push(number);
   }

   if (new Set(numbers).size !== numbers.length) {
      await ctx.reply(t(ctx, "premiumNumbersInvalid"));
      return;
   }

   await setWhatsappNumbers(user.telegramId, numbers);
   await ctx.reply(t(ctx, "premiumNumbersSaved", {
      numbers: numbers.map((number, index) => `${index + 1}. +${number}`).join("\n"),
   }));
};

export const handleStickerName = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message) || !ctx.chat) return;

   const user = await getUser(ctx.chat.id);
   const hasFeatureAccess = user ? await checkAndResetPremium(user) : false;
   if (!user || !hasFeatureAccess) {
      if (user) await setCommandsForUser(user.telegramId, user.role, false, normalizeLanguage(user.language));
      await ctx.reply(t(ctx, "premiumOnly"));
      return;
   }

   const packName = ctx.message.text.replace(/^\/stickername(?:@\S+)?/i, "").trim();
   if (!packName) {
      await ctx.reply(t(ctx, "stickerNameCurrent", {
         name: user.stickerPackName || t(ctx, "defaultBot"),
      }));
      return;
   }

   if (packName.toLowerCase() === "reset") {
      await setStickerPackName(user.telegramId, "");
      await ctx.reply(t(ctx, "stickerNameReset"));
      return;
   }

   if (packName.length > STICKER_PACK_NAME_MAX_LENGTH || /[\r\n]/.test(packName)) {
      await ctx.reply(t(ctx, "stickerNameTooLong", { max: STICKER_PACK_NAME_MAX_LENGTH }));
      return;
   }

   await setStickerPackName(user.telegramId, packName);
   await ctx.reply(t(ctx, "stickerNameSaved", { name: packName }));
};

export const handleQrisCommand = async (ctx: Context) => {
   if (!isSuperAdmin(ctx.from?.id)) {
      await ctx.reply(t(ctx, "inValidCommand"), { parse_mode: "Markdown" });
      return;
   }
   await ctx.reply(t(ctx, "qrisUploadPrompt"));
};

export const handleQrisPhoto = async (ctx: Context) => {
   if (!ctx.message || !("photo" in ctx.message)) return;
   const caption = "caption" in ctx.message ? ctx.message.caption : undefined;
   if (!caption || !/^\/setqris(?:@\w+)?$/i.test(caption.trim())) return;

   if (!isSuperAdmin(ctx.from?.id) || ctx.chat?.type !== "private") {
      await ctx.reply(t(ctx, "inValidCommand"), { parse_mode: "Markdown" });
      return;
   }

   try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
      const response = await axios.get<ArrayBuffer>(fileUrl.href, { responseType: "arraybuffer" });
      const image = Buffer.from(response.data);
      if (!image.length) throw new Error("QRIS image is empty");

      await saveBusinessQris(image);
      await ctx.reply(t(ctx, "qrisSaved"));
   } catch (error) {
      console.error("Gagal menyimpan gambar QRIS:", error);
      await ctx.reply(t(ctx, "qrisSaveFailed"));
   }
};

export const handleDeleteQrisCommand = async (ctx: Context) => {
   if (!isSuperAdmin(ctx.from?.id)) {
      await ctx.reply(t(ctx, "inValidCommand"), { parse_mode: "Markdown" });
      return;
   }
   await deleteBusinessQris();
   await ctx.reply(t(ctx, "qrisDeleted"));
};

export const handleReviewCommand = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      ctx.reply(t(ctx, "chatNotFound"), { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat.id);
   if (!user) {
      ctx.reply(t(ctx, "clickStart"), { parse_mode: "Markdown" });
      return;
   }

   if (user.hasReviewed) {
      const reviewText = user.reviewText || t(ctx, "reviewNotAvailable");
      await ctx.reply(
         t(ctx, "reviewCurrent", { review: escapeMarkdown(reviewText) }),
         { parse_mode: "Markdown" }
      );
      pendingReviewUsers.add(ctx.chat.id);
      return;
   }

   pendingReviewUsers.add(ctx.chat.id);
   await ctx.reply(t(ctx, "reviewPrompt"), { parse_mode: "Markdown" });
};

const REVIEWS_PER_PAGE = 5;

export const handleReviewsList = async (
   ctx: Context,
   requestedPage: number = 1,
   editMessage: boolean = false
) => {
   let page = Math.max(1, Math.floor(Number.isFinite(requestedPage) ? requestedPage : 1));
   let { reviews, total } = await getReviewsPage(page, REVIEWS_PER_PAGE);
   const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));

   if (page > totalPages) {
      page = totalPages;
      ({ reviews, total } = await getReviewsPage(page, REVIEWS_PER_PAGE));
   }

   if (!reviews.length) {
      if (editMessage) {
         await ctx.editMessageText(t(ctx, "reviewsEmpty"), { parse_mode: "Markdown" });
      } else {
         await ctx.reply(t(ctx, "reviewsEmpty"), { parse_mode: "Markdown" });
      }
      return;
   }

   const currentUser = await getUser(ctx.chat?.id);
   const isAdmin = currentUser?.role === ROLES.ADMIN;
   const lines = reviews.map((review, index) => {
      const name = review.userName ? `@${escapeMarkdown(review.userName)}` : escapeMarkdown(review.name || "User");
      const text = escapeMarkdown(review.reviewText || "-");
      return `${(page - 1) * REVIEWS_PER_PAGE + index + 1}. *${name}*\n“${text}”`;
   });

   const baseReply = `${t(ctx, "reviewsLatest", { page, pages: totalPages })}\n\n${lines.join("\n\n")}`;

   const keyboard: { text: string; callback_data: string }[][] = [];
   if (isAdmin) {
      keyboard.push(...reviews.map((review) => [{
            text: t(ctx, "deleteReview", {
               user: review.userName || review.name || review.telegramId,
            }),
            callback_data: `delete_review_${review.telegramId}_${page}`,
         }]));
   }

   if (page > 1 || page < totalPages) {
      keyboard.push([
         ...(page > 1 ? [{ text: t(ctx, "previous"), callback_data: `reviews_page_${page - 1}` }] : []),
         ...(page < totalPages ? [{ text: t(ctx, "next"), callback_data: `reviews_page_${page + 1}` }] : []),
      ]);
   }

   const options = {
      parse_mode: "Markdown" as const,
      ...(keyboard.length > 0 ? { reply_markup: { inline_keyboard: keyboard } } : {}),
   };

   if (editMessage) {
      await ctx.editMessageText(baseReply, options);
   } else {
      await ctx.reply(baseReply, options);
   }
};

export const handleReviewsPage = async (ctx: Context) => {
   const data = (ctx.callbackQuery as any)?.data as string | undefined;
   const page = Number(data?.match(/^reviews_page_(\d+)$/)?.[1]);
   await ctx.answerCbQuery();
   await handleReviewsList(ctx, page, true);
};

export const handleDeleteReview = async (ctx: Context) => {
   const [, rawTelegramId, rawPage] = ((ctx.callbackQuery as any).data as string).match(
      /^delete_review_(\d+)(?:_(\d+))?$/
   )!;
   const telegramId = Number(rawTelegramId);
   const page = Number(rawPage || 1);
   const user = await getUser(telegramId);
   if (!user) {
      await ctx.answerCbQuery(t(ctx, "userNotFound"));
      return;
   }

   await deleteUserReview(telegramId);
   await ctx.answerCbQuery(t(ctx, "reviewDeleted"));
   await handleReviewsList(ctx, page, true);
};

export const handleTextMessage = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(t(ctx, "inValidTextFormat"), { parse_mode: "Markdown" });
      return;
   }

   const commandPattern = /^\/([a-zA-Z]+)(?:\s+(.+))?$/;
   const match = ctx.message.text.match(commandPattern);

   if (match) {
      ctx.reply(t(ctx, "inValidCommand"), { parse_mode: "Markdown" });
      return;
   }

   if (pendingReviewUsers.has(ctx.message.chat.id)) {
      pendingReviewUsers.delete(ctx.message.chat.id);

      const user = await getUser(ctx.message.chat.id);
      if (!user) {
         ctx.reply(t(ctx, "clickStart"), { parse_mode: "Markdown" });
         return;
      }

      const text = ctx.message.text.trim();
      if (!text) {
         ctx.reply(t(ctx, "inValidTextFormat"), { parse_mode: "Markdown" });
         return;
      }

      if (user.hasReviewed) {
         const result = await updateUserReview(user.telegramId, text);
         if (!result || !result.success) {
            ctx.reply(t(ctx, "inValidTextFormat"), { parse_mode: "Markdown" });
            return;
         }

         try {
            const adminReviewMessage = [
               t(ctx, "adminReviewUpdated"),
               "",
               `*${escapeMarkdown(user.name || "User")}* ${user.isPremium ? "⭐" : ""}`,
               `├ ${t(ctx, "usernameLabel")}: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}`,
               `├ ${t(ctx, "reviewLabel")}: ${escapeMarkdown(text)}`,
               `└ ${t(ctx, "telegramIdLabel")}: [${user.telegramId}](tg://user?id=${user.telegramId})`,
            ].join("\n");

            await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminReviewMessage, { parse_mode: "Markdown" });
         } catch (_) {}

         ctx.reply(t(ctx, "reviewUpdated"), { parse_mode: "Markdown" });
         return;
      }

      const result = await submitUserReview(user.telegramId, text);
      if (!result || result.success === false) {
         if (result?.reason === "already_reviewed") {
            ctx.reply(t(ctx, "reviewAlreadyExists"), { parse_mode: "Markdown" });
         } else {
            ctx.reply(t(ctx, "inValidTextFormat"), { parse_mode: "Markdown" });
         }
         return;
      }

      try {
         const adminReviewMessage = [
            t(ctx, "adminReviewNew"),
            "",
            `*${escapeMarkdown(user.name || "User")}* ${user.isPremium ? "⭐" : ""}`,
            `├ ${t(ctx, "usernameLabel")}: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}`,
            t(ctx, "adminReviewReward", { bonus: REVIEW_STICKER_LIMIT_BONUS }),
            `├ ${t(ctx, "reviewLabel")}: ${escapeMarkdown(text)}`,
            `└ ${t(ctx, "telegramIdLabel")}: [${user.telegramId}](tg://user?id=${user.telegramId})`,
         ].join("\n");

         await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminReviewMessage, { parse_mode: "Markdown" });
      } catch (_) {}

      ctx.reply(t(ctx, "reviewSubmitted"), { parse_mode: "Markdown" });
      return;
   }

   const number = isValidWhatsAppNumber(ctx.message.text);
   if (number) {
      const response = await savePhoneNumber(number, ctx.message.chat.id);
      if (response) {
         ctx.reply(t(ctx, "validNumber"), { parse_mode: "Markdown" });

         try {
            const { telegramId, name, userName, previousNumber, newNumber } = response as any;

            // Only notify admin when number was added or changed
            if (previousNumber !== newNumber) {
               const adminLines = [
                  t(ctx, "whatsappNumberUpdated"),
                  "",
                  t(ctx, "userInformation"),
                  "",
                  `*${escapeMarkdown(name)}*`,
                  `├ ${t(ctx, "usernameLabel")}: ${userName ? `@${escapeMarkdown(userName)}` : '-'}`,
                  t(ctx, "previousNumber", { number: previousNumber ? `+${previousNumber}` : '-' }),
                  t(ctx, "newNumber", { number: newNumber ? `+${newNumber}` : '-' }),
                  `└ ${t(ctx, "telegramIdLabel")}: [${telegramId}](tg://user?id=${telegramId})`,
               ];

               const adminMessage = adminLines.join('\n');
               await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminMessage, { parse_mode: "Markdown" });
            }
         } catch (e) {
            console.warn("Gagal mengirim notifikasi nomor ke admin:", e);
         }
      } else {
         ctx.reply(t(ctx, "clickStart"), { parse_mode: "Markdown" });
      }
   } else if (looksLikePhoneNumber(ctx.message.text)) {
      ctx.reply(t(ctx, "invalidNumber"), { parse_mode: "Markdown" });
      return;
   } else {
      const aiConfig = await getAIConfig();
      if (!aiConfig.isTelegramAIEnabled) {
         ctx.reply(t(ctx, "aiDisabled"), { parse_mode: "Markdown" });
         return;
      }

      const user = await getUser(ctx.message.chat.id);
      if (!user) {
         ctx.reply(t(ctx, "clickStart"), { parse_mode: "Markdown" });
         return;
      }

      const reply = await askAI(ctx.message.text, "telegram");
      ctx.reply(`_${escapeMarkdown(reply)}_`, { parse_mode: "Markdown" });
   }
};

export const hears = (ctx: Context) => {
   ctx.reply(t(ctx, "help"), { parse_mode: "Markdown" });
};

export const handleStickerMessage = async (ctx: Context) => {
   const message = ctx.message as { sticker: { file_id: string; file_unique_id: string; is_animated: boolean; is_video: boolean } };
   const fileId = message?.sticker?.file_id;
   const fileUniqueId = message?.sticker?.file_unique_id;
   const isAnimated = message?.sticker?.is_animated;
   const isVideo = message?.sticker?.is_video;

   const limitCost = isAnimated ? 3 : 1;

   if (!isClientReady) {
      ctx.reply(t(ctx, "whatsappNotReady"), { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat?.id);
   if (!user) {
      ctx.reply(t(ctx, "clickStart"), { parse_mode: "Markdown" });
      return;
   }

   if (user.isBlocked) {
      ctx.reply(t(ctx, "blocked"), { parse_mode: "Markdown" });
      return;
   }

   const isPremium = await checkAndResetPremium(user);

   const replyStickerLimit = (ctx: Context) => {
      const buttons: any[] = [];

      if (!user.hasReviewed) {
         buttons.push([{ text: t(ctx, "reviewButton", { bonus: REVIEW_STICKER_LIMIT_BONUS }), callback_data: "review_prompt" }]);
      }

      buttons.push([{ text: t(ctx, "inviteButton", { bonus: REFERRAL_STICKER_LIMIT_BONUS }), callback_data: "get_invite_link" }]);
      buttons.push([{ text: t(ctx, "premiumButton", { price: PREMIUM_PRICE_LABEL }), url: `https://t.me/${ADMIN_TELEGRAM_USERNAME}` }]);

      return ctx.reply(
         t(ctx, "stickerLimit", {
            resetTime: getTimeUntilReset(user.stickerLimitResetAt ?? user.createdAt),
         }),
         {
            parse_mode: "Markdown",
            reply_markup: {
               inline_keyboard: buttons,
            }
         }
      );
   };

   if (!isPremium) {
      await resetStickerLimitIfNeeded(user);
      if (user.stickerLimit < limitCost) {
         await replyStickerLimit(ctx);
         return;
      }
   }

   if (!user.whatsappNumber) {
      ctx.reply(t(ctx, "whatsappInfo"), { parse_mode: "Markdown" });
      return;
   }

   const isAdmin = user.role === ROLES.ADMIN;

   if (!isAdmin) {
      if (user.isProcessing) {
         ctx.reply(t(ctx, "pending"), { parse_mode: "Markdown" });
         return;
      }
      await setUserProcessing(user._id);
   }

   ctx.reply(t(ctx, "process"), { parse_mode: "Markdown" });

   processSticker(ctx, user, fileId, fileUniqueId, isPremium, limitCost).catch(async (error) => {
      console.error("Error processing sticker:", error);
      if (!isAdmin) await resetUserProcessing(user._id);
   });
};

const processSticker = async (ctx: Context, user: any, fileId: string, fileUniqueId: string, isPremium: boolean, limitCost: number = 1) => {
   try {
      const downloadPath = "/tmp";
      if (!fs.existsSync(downloadPath)) {
         fs.mkdirSync(downloadPath, { recursive: true });
      }

      const mediaData = {
         user: user,
         fileUrl: await getFileUrl(fileId),
         fileName: `${new Date().getTime()}`,
         downloadPath: downloadPath,
         fileUniqueId,
      };

      await downloadFile(mediaData, ctx);
      if (!isPremium) {
         await decrementStickerLimit(user._id, user.role, limitCost);
      }
   } catch (error) {
      ctx.reply(t(ctx, "failed"), { parse_mode: "Markdown" });
      throw error;
   } finally {
      if (user.role !== ROLES.ADMIN) {
         await resetUserProcessing(user._id)
      };
   }
};

export const handleProfile = async (ctx: Context) => {
   const user = await getUser(ctx.chat?.id);
   if (!user) {
      ctx.reply(t(ctx, "clickStart"), { parse_mode: "Markdown" });
      return;
   }
   
   const isPremium = await checkAndResetPremium(user);
   await setCommandsForUser(user.telegramId, user.role, isPremium, normalizeLanguage(user.language));
   await resetStickerLimitIfNeeded(user);
   const premiumStatus = isPremium
      ? user.premiumExpiredAt
         ? t(ctx, "premiumExpired", { date: formattedDate(user.premiumExpiredAt) })
         : t(ctx, "premiumActive")
      : t(ctx, "regular");

   const userInfo = `${t(ctx, "profileTitle")}\n
*${escapeMarkdown(user.name)}* ${isPremium ? "⭐" : ""}
├ ${t(ctx, "accountRole")}: ${user.role}
├ ${t(ctx, "username")}: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}
├ ${t(ctx, "whatsapp")}: ${user.whatsappNumber ? '+' + `\`${user.whatsappNumber}\`` : '-'}
├ ${t(ctx, "profileSecondNumber")}: ${user.whatsappNumbers?.[1] ? `+\`${user.whatsappNumbers[1]}\`` : "-"}
├ ${t(ctx, "stickerAuthor")}: ${user.stickerPackName || t(ctx, "defaultBot")}
├ ${t(ctx, "stickerLimitLabel")}: ${user.stickerLimit}
├ ${t(ctx, "statusAccount")}: ${premiumStatus}
├ ${t(ctx, "status")}: ${user.isProcessing ? t(ctx, "processing") : t(ctx, "notProcessing")}
├ ${t(ctx, "created")}: ${formattedDate(user.createdAt)}
├ ${t(ctx, "updated")}: ${formattedDate(user.updatedAt)}
└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})`;

   ctx.reply(userInfo, { parse_mode: "Markdown" });
}

export const handleAddLimit = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(t(ctx, "inValidTextFormat"), { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat?.id);
   if (user?.role !== "admin") {
      ctx.reply(t(ctx, "inValidCommand"), { parse_mode: "Markdown" });
      return;
   }

   const text = ctx.message?.text;
   const match = text?.match(/^\/limit (\d+)$/);
   if (match && match[1]) {
      const telegramId = match[1];
      const user = await updateLimit(Number(telegramId));
      if (!user) {
         ctx.reply(t(ctx, "userNotFound"), { parse_mode: "Markdown" });
         return;
      } else {
         ctx.reply(t(ctx, "updateLimit"), { parse_mode: "Markdown" });
      }
   } else {
      ctx.reply(t(ctx, "invalidUpdateLimitFormat"), { parse_mode: "Markdown" });
   }
}

export const handleListUser = async (ctx: Context) => {
   const cbData = ctx.callbackQuery ? (ctx.callbackQuery as any).data as string : null;
   const parts = cbData?.split("_") ?? [];

   const page = cbData ? parseInt(parts[1]) : 1;
   const sort = (parts[2] === "asc" ? "asc" : "desc") as "asc" | "desc";

   const limit = 10;
   const [users, totalPages, totalUsers] = await Promise.all([
      getUsersWithPagination(page, limit, sort),
      getTotalPages(limit),
      getTotalUsers(),
   ]);

   if (users.length === 0) {
      ctx.reply(t(ctx, "userNotFound"), { parse_mode: "Markdown" });
      return;
   }

   const sortLabel = sort === "desc" ? t(ctx, "newest") : t(ctx, "oldest");
   const toggleSort = sort === "desc" ? "asc" : "desc";
   const toggleLabel = sort === "desc" ? t(ctx, "sortOldest") : t(ctx, "sortNewest");

   let message = `${t(ctx, "listTitle", {
      total: totalUsers,
      page,
      pages: totalPages,
      sort: sortLabel,
   })}\n\n`;

   users.forEach((user, index) => {
      const no = (page - 1) * limit + index + 1;
      const whatsapp = user.whatsappNumber ? `+${user.whatsappNumber}` : "-";
      const username = user.userName ? `@${escapeMarkdown(user.userName)}` : "-";

      message += `*${no}. ${escapeMarkdown(user.name)}* ${user.isPremium ? "⭐" : ""}\n`;
      message += `├ ${t(ctx, "accountRole")}: ${user.role}\n`;
      message += `├ ${t(ctx, "username")}: ${username}\n`;
      message += `├ ${t(ctx, "whatsapp")}: \`${whatsapp}\`\n`;
      message += `├ ${t(ctx, "stickerLimitLabel")}: ${user.stickerLimit}\n`;
      message += `└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})\n\n`;
   });

   const navButtons = [];
   if (page > 1) navButtons.push({ text: t(ctx, "previous"), callback_data: `list_${page - 1}_${sort}` });
   if (page < totalPages) navButtons.push({ text: t(ctx, "next"), callback_data: `list_${page + 1}_${sort}` });

   const keyboard = {
      reply_markup: {
         inline_keyboard: [
            [{ text: `📅 ${toggleLabel}`, callback_data: `list_1_${toggleSort}` }],
            ...(navButtons.length > 0 ? [navButtons] : []),
         ],
      },
   };

   if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: "Markdown", ...keyboard });
      await ctx.answerCbQuery();
   } else {
      ctx.reply(message, { parse_mode: "Markdown", ...keyboard });
   }
};

export const handleHelper = async (ctx: Context) => {
   const totalUsers = await getTotalUsers();
   const reviews = await getRecentReviews(1);
   await ctx.reply(t(ctx, "about", { adminName: ADMIN_NAME, adminUsername: ADMIN_TELEGRAM_USERNAME }), { parse_mode: "Markdown" });
   await ctx.reply(t(ctx, "totalUsersInfo", {
      total: totalUsers,
      reviews: reviews.length > 0 ? t(ctx, "totalUsersReviews") : "",
   }), { parse_mode: "Markdown" });
}

export const handleGuide = (ctx: Context) => {
   ctx.reply(t(ctx, "guide"), { parse_mode: "Markdown" });
}

export const handleSelectUser = async (ctx: Context, action: string, page: number = 1) => {
   const limit = 15;
   const users = await getUsersWithPagination(page, limit);
   const totalPages = await getTotalPages(limit);

   if (users.length === 0) {
      ctx.reply(t(ctx, "userNotFound"), { parse_mode: "Markdown" });
      return;
   }

   const actionLabelKeys: Partial<Record<string, TranslationKey>> = {
      limit: "actionLimit",
      premium: "actionPremium",
      block: "actionBlock",
      delete: "actionDelete",
   };
   const actionLabelKey = actionLabelKeys[action];
   let message = `${t(ctx, "selectUser", {
      action: actionLabelKey ? t(ctx, actionLabelKey) : action,
      page,
      pages: totalPages,
   })}\n\n`;

   const userButtons = users.map(user => ([{
      text: `${user.name} (${user.userName || "N/A"}) ${user.isPremium ? "⭐" : ""} ${user.isBlocked ? "🚫" : ""}`,
      callback_data: `${action}_user_${user.telegramId}_${page}`
   }]));

   const navButtons = [];
   if (page > 1) navButtons.push({ text: t(ctx, "previous"), callback_data: `${action}_page_${page - 1}` });
   if (page < totalPages) navButtons.push({ text: t(ctx, "next"), callback_data: `${action}_page_${page + 1}` });

   const keyboard = [
      ...userButtons,
      ...(navButtons.length > 0 ? [navButtons] : [])
   ];

   const opts = {
      parse_mode: "Markdown" as const,
      reply_markup: { inline_keyboard: keyboard }
   };

   if (ctx.callbackQuery) {
      await ctx.editMessageText(message, opts);
      await ctx.answerCbQuery();
   } else {
      ctx.reply(message, opts);
   }
};

export const handleLimitCommand = async (ctx: Context) => {
   await handleSelectUser(ctx, "limit");
};

export const handlePremiumCommand = async (ctx: Context) => {
   const user = await getUser(ctx.chat?.id);
   if (!user) {
      await ctx.reply(t(ctx, "clickStartToRegister"), { parse_mode: "Markdown" });
      return;
   }

   const isPremium = await checkAndResetPremium(user);
   const premiumStatus = isPremium
      ? user.premiumExpiredAt
         ? t(ctx, "premiumActiveUntil", { date: formattedDate(user.premiumExpiredAt) })
         : t(ctx, "premiumActiveStatus")
      : t(ctx, "regularStatus");
   const benefits = [
      t(ctx, "premiumBenefitDaily"),
      t(ctx, "premiumBenefitBatch"),
      t(ctx, "premiumBenefitNumbers", { max: PREMIUM_MAX_WHATSAPP_NUMBERS }),
      t(ctx, "premiumBenefitAuthor"),
   ];

   await ctx.reply(
      [
         t(ctx, "premiumTitle"),
         "",
         premiumStatus,
         t(ctx, "premiumPrice", { price: PREMIUM_PRICE_LABEL }),
         "",
         t(ctx, "premiumBenefits"),
         ...benefits,
         "",
         t(ctx, "premiumUpgradePrompt"),
      ].join("\n"),
      {
         parse_mode: "Markdown",
         reply_markup: {
            inline_keyboard: [[{
               text: t(ctx, "contactAdmin"),
               url: `https://t.me/${ADMIN_TELEGRAM_USERNAME}`,
            }]],
         },
      }
   );
};

export const handleSetPremiumCommand = async (ctx: Context) => {
   await handleSelectUser(ctx, "premium");
};

export const handleBlockCommand = async (ctx: Context) => {
   await handleSelectUser(ctx, "block");
};

export const handleDeleteCommand = async (ctx: Context) => {
   await handleSelectUser(ctx, "delete");
};

export const handleUserAction = async (ctx: Context) => {
   const data = (ctx.callbackQuery as any).data as string;
   const parts = data.split("_");

   if (parts[1] === "page") {
      const action = parts[0];
      const page = parseInt(parts[2]);
      await handleSelectUser(ctx, action, page);
      return;
   }

   const action = parts[0];
   const telegramId = parseInt(parts[2]);
   const fromPage = parseInt(parts[3]);

   if (action === "limit") {
      await ctx.editMessageText(
         t(ctx, "limitSelection", { id: telegramId }),
         {
         parse_mode: "Markdown",
         reply_markup: {
            inline_keyboard: [
               [
                  { 
                     text: "+10", 
                     callback_data: `setlimit_${telegramId}_10_${fromPage}` 
                  },
                  { 
                     text: "+25", 
                     callback_data: `setlimit_${telegramId}_25_${fromPage}` 
                  },
                  { 
                     text: "+50", 
                     callback_data: `setlimit_${telegramId}_50_${fromPage}` 
                  },
                  { 
                     text: "+100", 
                     callback_data: `setlimit_${telegramId}_100_${fromPage}` 
                  },
               ],
               [
                  { 
                     text: t(ctx, "cancel"),
                     callback_data: `limit_page_${fromPage}` 
                  }
               ]
            ]
         }
         }
      );
   } else if (action === "premium") {
      const selectedUser = await getUser(telegramId);
      await ctx.editMessageText(
         t(ctx, "premiumSelection", { id: telegramId }),
         {
         parse_mode: "Markdown",
         reply_markup: {
            inline_keyboard: [
               [
                  { 
                     text: t(ctx, "durationDays", { days: 7 }),
                     callback_data: `setpremium_${telegramId}_7_${fromPage}` },
                  { 
                     text: t(ctx, "durationDays", { days: 30 }),
                     callback_data: `setpremium_${telegramId}_30_${fromPage}` },
                  { 
                     text: t(ctx, "durationDays", { days: 90 }),
                     callback_data: `setpremium_${telegramId}_90_${fromPage}` 
                  },
               ],
               ...(selectedUser?.isPremium ? [
               [
                  { 
                     text: t(ctx, "removePremium"),
                     callback_data: `setpremium_${telegramId}_remove_${fromPage}` 
                  }
               ]] : []),
               [
                  { 
                     text: t(ctx, "cancel"),
                     callback_data: `premium_page_${fromPage}` 
                  }
               ]
            ]
         }
         }
      );
   } else if (action === "block") {
      const selectedUser = await getUser(telegramId);
      await ctx.editMessageText(
         t(ctx, "blockSelection", { id: telegramId }),
         {
         parse_mode: "Markdown",
         reply_markup: {
            inline_keyboard: [
               [
                  selectedUser?.isBlocked
                     ? { 
                        text: t(ctx, "unblock"),
                        callback_data: `setblock_${telegramId}_unblock_${fromPage}` 
                     } : { 
                        text: t(ctx, "block"),
                        callback_data: `setblock_${telegramId}_block_${fromPage}` 
                     }
               ],
               [
                  {
                     text: t(ctx, "cancel"),
                     callback_data: `block_page_${fromPage}`
                  }
               ]
            ]
         }
         }
      );
   } else if (action === "delete") {
      const selectedUser = await getUser(telegramId);
      if (!selectedUser) {
         await ctx.answerCbQuery(t(ctx, "userNotFound"));
         return;
      }
      await ctx.editMessageText(
         t(ctx, "deleteSelection", {
            id: telegramId,
            name: selectedUser.name,
            premium: selectedUser.isPremium ? "⭐" : "",
            username: selectedUser.userName ? `@${selectedUser.userName}` : "-",
         }),
         {
            parse_mode: "Markdown",
            reply_markup: {
               inline_keyboard: [
                  [
                     {
                        text: t(ctx, "confirmDelete"),
                        callback_data: `setdelete_${telegramId}_confirm_${fromPage}`
                     },
                     {
                        text: t(ctx, "cancel"),
                        callback_data: `delete_page_${fromPage}`
                     }
                  ]
               ]
            }
         }
      );
   }

   await ctx.answerCbQuery();
};

const notify = async (
   ctx: Context,
   telegramId: number,
   key: Parameters<typeof translate>[1],
   values: Record<string, string | number> = {},
   language?: Language,
) => {
   const recipient = language ? undefined : await getUser(telegramId);
   const recipientLanguage = language ?? normalizeLanguage(recipient?.language);
   return ctx.telegram.sendMessage(
      telegramId,
      translate(recipientLanguage, key, values),
      { parse_mode: "Markdown" },
   );
};

const actionHandlers: Record<string, (ctx: Context, telegramId: number, value: string) => Promise<void>> = {
   setlimit: async (ctx, telegramId, value) => {
      await updateLimit(telegramId, parseInt(value));
      await ctx.answerCbQuery(t(ctx, "limitAdded", { amount: value }));
      await notify(ctx, telegramId, "limitAddedNotice", { amount: value });
   },

   setpremium: async (ctx, telegramId, value) => {
      if (value === "remove") {
         await removePremium(telegramId);
         const user = await getUser(telegramId);
         if (user) {
            try {
               await setCommandsForUser(telegramId, user.role, false, normalizeLanguage(user.language));
            } catch (error) {
               console.error(`Gagal memperbarui command Telegram untuk user ${telegramId}:`, error);
            }
         }
         await ctx.answerCbQuery(t(ctx, "premiumRemoved"));
         await notify(ctx, telegramId, "premiumRemovedNotice");
      } else {
         await setPremium(telegramId, parseInt(value));
         const user = await getUser(telegramId);
         if (user) {
            try {
               await setCommandsForUser(telegramId, user.role, true, normalizeLanguage(user.language));
            } catch (error) {
               console.error(`Gagal memperbarui command Telegram untuk user ${telegramId}:`, error);
            }
         }
         await ctx.answerCbQuery(t(ctx, "premiumSet", { days: value }));
         await notify(ctx, telegramId, "premiumGranted", { days: value });
      }
   },

   setblock: async (ctx, telegramId, value) => {
      if (value === "block") {
         await blockUser(telegramId);
         await ctx.answerCbQuery(t(ctx, "userBlocked"));
         await notify(ctx, telegramId, "blockedNotice");
      } else {
         await unblockUser(telegramId);
         await ctx.answerCbQuery(t(ctx, "userUnblocked"));
         await notify(ctx, telegramId, "unblockedNotice");
      }
   },

   setdelete: async (ctx, telegramId, value) => {
      if (value === "confirm") {
         const user = await getUser(telegramId);
         await deleteUser(telegramId);
         await ctx.answerCbQuery(t(ctx, "userDeleted"));
         try {
            await notify(ctx, telegramId, "deletedNotice", {}, normalizeLanguage(user?.language));
         } catch (_) {}
      } else {
         await ctx.answerCbQuery(t(ctx, "cancelled"));
      }
   },
};

export const handleExecuteAction = async (ctx: Context) => {
   const data = (ctx.callbackQuery as any).data as string;
   const [action, telegramIdStr, value, fromPageStr] = data.split("_");
   const telegramId = parseInt(telegramIdStr);
   const fromPage = parseInt(fromPageStr);

   await actionHandlers[action]?.(ctx, telegramId, value);
   await handleSelectUser(ctx, action.replace("set", ""), fromPage);
};

export const handleBroadcast = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) return;

   const text = ctx.message.text.replace("/broadcast", "").trim();
   if (!text) {
      ctx.reply(t(ctx, "broadcastFormat"), { parse_mode: "Markdown" });
      return;
   }

   await ctx.reply(t(ctx, "broadcastStarted"));

   runBroadcast(ctx, text).catch((err) => {
      console.error("Broadcast error:", err);
   });
};

export const handleInvite = async (ctx: Context) => {
   const botUsername = process.env.BOT_USERNAME;
   const telegramId = ctx.chat?.id;
   const inviteLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

   await ctx.reply(t(ctx, "inviteTitle"), { parse_mode: "Markdown" });
   await ctx.reply(inviteLink);
   await ctx.reply(t(ctx, "inviteInstructions", {
      bonus: REFERRAL_STICKER_LIMIT_BONUS,
      referrals: REFERRALS_PER_PREMIUM,
      days: REFERRAL_PREMIUM_DAYS,
   }), { parse_mode: "Markdown" });
};

export const handleLeaderboard = async (ctx: Context) => {
   const topReferrers = await getTopReferrers(10);

   if (topReferrers.length === 0) {
      ctx.reply(t(ctx, "noReferrals"), { parse_mode: "Markdown" });
      return;
   }

   const medals = ["🥇", "🥈", "🥉"];
   const rows = topReferrers.map((user, i) => {
      const rank = medals[i] ?? `${i + 1}.`;
      const name = user.userName ? `@${escapeMarkdown(user.userName)}` : escapeMarkdown(user.name);
      const premium = user.isPremium ? " ⭐" : "";
      return `${rank} ${name}${premium} — *${t(ctx, "leaderboardRow", { count: user.referralCount })}*`;
   });

   const message = [
      t(ctx, "leaderboardTitle"),
      rows.join("\n"),
      "",
      t(ctx, "leaderboardInstructions", {
         bonus: REFERRAL_STICKER_LIMIT_BONUS,
         days: REFERRAL_PREMIUM_DAYS,
         referrals: REFERRALS_PER_PREMIUM,
      }),
   ].join("\n");

   ctx.reply(message, { parse_mode: "Markdown" });
};

const buildAISettingsMessage = (
   ctx: Context,
   isTelegramAIEnabled: boolean,
   isWAAIEnabled: boolean,
) => {
   const teleStatus = t(ctx, isTelegramAIEnabled ? "enabled" : "disabled");
   const waStatus = t(ctx, isWAAIEnabled ? "enabled" : "disabled");
   return [
      t(ctx, "aiSettings"),
      `├ Telegram: ${teleStatus}`,
      `└ WhatsApp: ${waStatus}`,
   ].join("\n");
};

const buildAISettingsKeyboard = (
   ctx: Context,
   isTelegramAIEnabled: boolean,
   isWAAIEnabled: boolean,
) => ({
   reply_markup: {
      inline_keyboard: [
         [
            {
               text: t(ctx, isTelegramAIEnabled ? "disableTelegramAI" : "enableTelegramAI"),
               callback_data: "ai_toggle_telegram",
            },
         ],
         [
            {
               text: t(ctx, isWAAIEnabled ? "disableWhatsappAI" : "enableWhatsappAI"),
               callback_data: "ai_toggle_wa",
            },
         ],
      ],
   },
});

export const handleAISettings = async (ctx: Context) => {
   const config = await getAIConfig();

   const text = buildAISettingsMessage(ctx, config.isTelegramAIEnabled, config.isWAAIEnabled);
   const keyboard = buildAISettingsKeyboard(ctx, config.isTelegramAIEnabled, config.isWAAIEnabled);

   ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
};

export const handleAIToggle = async (ctx: Context) => {
   const callbackData = (ctx as any).callbackQuery?.data as string;
   const adminId = parseInt(process.env.ADMIN_TELEGRAM_ID || "");

   let config = await getAIConfig();
   let newTelegramAI = config.isTelegramAIEnabled;
   let newWAAI = config.isWAAIEnabled;

   if (callbackData === "ai_toggle_telegram") {
      const result = await toggleTelegramAI(adminId);
      if (result === null) return;
      newTelegramAI = result;
      await ctx.answerCbQuery(t(ctx, newTelegramAI ? "telegramAIEnabled" : "telegramAIDisabled"));
   } else if (callbackData === "ai_toggle_wa") {
      const result = await toggleWAAI(adminId);
      if (result === null) return;
      newWAAI = result;
      await ctx.answerCbQuery(t(ctx, newWAAI ? "whatsappAIEnabled" : "whatsappAIDisabled"));
   }

   const text = buildAISettingsMessage(ctx, newTelegramAI, newWAAI);
   const keyboard = buildAISettingsKeyboard(ctx, newTelegramAI, newWAAI);

   try {
      await (ctx as any).editMessageText(text, { parse_mode: "Markdown", ...keyboard });
   } catch {
      ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
   }
};

const runBroadcast = async (ctx: Context, text: string) => {
   const users = await getAllUsers();
   let success = 0;
   let failed = 0;

   const BATCH_SIZE = 10;
   const DELAY_BETWEEN_BATCH = 2000;

   for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
         batch.map(user =>
            ctx.telegram.sendMessage(user.telegramId, text, { parse_mode: "Markdown" })
         )
      );

      results.forEach(r => {
         if (r.status === "fulfilled") success++;
         else failed++;
      });

      if (i + BATCH_SIZE < users.length) {
         await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCH));
      }
   }

   await ctx.reply(t(ctx, "broadcastFinished", { success, failed }));
};
