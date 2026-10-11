import { Context } from "telegraf";
import { Message } from "telegraf/types";
import axios from "axios";
import {
   checkAndResetPremium,
   decrementStickerLimit,
   getTotalPages,
   getTotalUsers,
   getUser,
   getUsersWithPagination,
   resetStickerLimitIfNeeded,
   resetUserProcessing,
   saveOrUpateUser,
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
import messages from "../constants/messages";
import { isValidWhatsAppNumber, looksLikePhoneNumber } from "./phoneValidate";
import { getFileUrl } from "./fileHelper";
import { downloadFile } from "../services/stickerService";
import fs from "fs";
import { formattedDate } from "./formattedDate";
import whatsappEmitter from "../events/eventEmitter";
import { setCommandsForUser } from "../middleware/adminMiddleware";
import {
   ADMIN_TELEGRAM_ID,
   ADMIN_TELEGRAM_USERNAME,
   isSuperAdmin,
   ROLES,
} from "../constants/roles";
import { getTimeUntilReset } from "./time";
import { askAI } from "../services/aiService";
import {
   PREMIUM_MAX_WHATSAPP_NUMBERS,
   REFERRAL_PREMIUM_MONTHS,
   REFERRALS_PER_PREMIUM,
   REFERRAL_STICKER_LIMIT_BONUS,
   REVIEW_STICKER_LIMIT_BONUS,
   PREMIUM_PRICE_LABEL,
   DEFAULT_STICKER_PACK_NAME,
   STICKER_PACK_NAME_MAX_LENGTH,
} from "../constants/businessConfig";

let isClientReady: boolean = false;
const pendingReviewUsers = new Set<number>();

const isTextMessage = (message: Message): message is Message.TextMessage => {
   return "text" in message;
};

export const escapeMarkdown = (text: string): string =>
   text.replace(/[_*`[\]]/g, (char) => `\\${char}`);

whatsappEmitter.on("whatsappReady", () => {
   isClientReady = true;
})

export const handleStart = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      ctx.reply(messages.chatNotFound, { parse_mode: "Markdown" });
      return;
   }
   
   await ctx.reply(`_${messages.hi}${escapeMarkdown(ctx.chat.first_name ?? '')}_`, { parse_mode: "Markdown" });

   const startPayload = (ctx as any).startPayload as string | undefined;
   const referredBy = startPayload?.startsWith("ref_")
      ? parseInt(startPayload.replace("ref_", ""))
      : undefined;

   const { user, isNewUser, referralRewardGranted } = await saveOrUpateUser(ctx.chat, referredBy);

   if (isNewUser && referredBy) {
      try {
         await ctx.telegram.sendMessage(
            referredBy,
            `🎉 *Teman kamu berhasil join!*\n\n👤 ${escapeMarkdown(ctx.chat.first_name ?? '')} menggunakan link invite kamu.\n✅ Limit sticker kamu bertambah *+${REFERRAL_STICKER_LIMIT_BONUS}*!${referralRewardGranted ? `\n⭐ Kamu mendapat Premium gratis ${REFERRAL_PREMIUM_MONTHS} bulan karena mencapai ${REFERRALS_PER_PREMIUM} referral!` : ""}`,
            { parse_mode: "Markdown" }
         );
      } catch (_) {}

      if (referralRewardGranted) {
         const referrer = await getUser(referredBy);
         if (referrer) {
            const referrerIsPremium = await checkAndResetPremium(referrer);
            await setCommandsForUser(referredBy, referrer.role, referrerIsPremium);
         }
      }
   }

   const isPremium = await checkAndResetPremium(user);
   await setCommandsForUser(ctx.chat.id, user.role, isPremium);

   if (isNewUser) {
      try {
         const referralLine = referredBy
            ? `\n├ Referral dari: [${referredBy}](tg://user?id=${referredBy})`
            : "";
         const adminMessage = `${referredBy ? "🔗 Pengguna Baru via Referral!" : "👤 Ada Pengguna Baru!"}\n\n*${escapeMarkdown(user.name)}* ${user.isPremium ? "⭐" : ""}
├ Role: ${user.role}
├ Username: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}
├ WhatsApp: ${user.whatsappNumber ? "+" + user.whatsappNumber : "-"}
├ Sticker Limit: ${user.stickerLimit}${referralLine}
├ Dibuat: ${formattedDate(user.createdAt)}
└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})`;

         await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminMessage, { parse_mode: "Markdown" });
      } catch (e) {
         console.warn("Gagal mengirim notifikasi user baru ke admin:", e);
      }
   }
   
   const totalUsers = await getTotalUsers();
   const reviews = await getRecentReviews(1);
   await ctx.reply(messages.about, { parse_mode: "Markdown" });
   await ctx.reply(messages.totalUsersInfo(totalUsers, reviews.length > 0), { parse_mode: "Markdown" });
   // if (!user.whatsappNumber) {
   //    await ctx.reply(messages.whatsAppInfo, { parse_mode: "Markdown" });
   // } else {
   //    await ctx.reply(messages.existedNumber, { parse_mode: "Markdown" });
   // }
   // await ctx.reply(messages.notes, { parse_mode: "Markdown" });
   await ctx.reply(messages.sendSticker, { parse_mode: "Markdown" });
};

export const handleWhatsappNumbers = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message) || !ctx.chat) return;

   const user = await getUser(ctx.chat.id);
   const hasFeatureAccess = user ? await checkAndResetPremium(user) : false;
   if (!user || !hasFeatureAccess) {
      if (user) await setCommandsForUser(user.telegramId, user.role, false);
      await ctx.reply("Fitur ini hanya tersedia untuk Premium.");
      return;
   }

   const commandText = ctx.message.text.replace(/^\/numbers(?:@\S+)?/i, "").trim();
   if (!commandText) {
      const numbers = user.whatsappNumbers?.length
         ? user.whatsappNumbers
         : user.whatsappNumber ? [user.whatsappNumber] : [];
      await ctx.reply(
         `Nomor penerima Premium saat ini:\n${numbers.map((number, index) => `${index + 1}. +${number}`).join("\n") || "Belum ada nomor"}\n\nAtur maksimal ${PREMIUM_MAX_WHATSAPP_NUMBERS} nomor dengan /numbers <nomor utama> [nomor kedua]. Contoh: /numbers 081234567890 081234567891`
      );
      return;
   }

   const inputNumbers = commandText.split(/[,\s]+/).filter(Boolean);
   if (inputNumbers.length === 0 || inputNumbers.length > PREMIUM_MAX_WHATSAPP_NUMBERS) {
      await ctx.reply(`Maksimal ${PREMIUM_MAX_WHATSAPP_NUMBERS} nomor. Format: /numbers <nomor utama> [nomor kedua]`);
      return;
   }

   const numbers: string[] = [];
   for (const inputNumber of inputNumbers) {
      const number = isValidWhatsAppNumber(inputNumber);
      if (!number) {
         await ctx.reply("Nomor tidak valid atau ada nomor duplikat. Contoh: /numbers 081234567890 081234567891");
         return;
      }
      numbers.push(number);
   }

   if (new Set(numbers).size !== numbers.length) {
      await ctx.reply("Nomor tidak valid atau ada nomor duplikat. Contoh: /numbers 081234567890 081234567891");
      return;
   }

   await setWhatsappNumbers(user.telegramId, numbers);
   await ctx.reply(`Nomor WhatsApp berhasil disimpan:\n${numbers.map((number, index) => `${index + 1}. +${number}`).join("\n")}`);
};

export const handleStickerName = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message) || !ctx.chat) return;

   const user = await getUser(ctx.chat.id);
   const hasFeatureAccess = user ? await checkAndResetPremium(user) : false;
   if (!user || !hasFeatureAccess) {
      if (user) await setCommandsForUser(user.telegramId, user.role, false);
      await ctx.reply("Fitur ini hanya tersedia untuk Premium.");
      return;
   }

   const packName = ctx.message.text.replace(/^\/stickername(?:@\S+)?/i, "").trim();
   if (!packName) {
      await ctx.reply(`Nama pack stiker saat ini: ${user.stickerPackName || DEFAULT_STICKER_PACK_NAME}\nUbah dengan /stickername <nama>. Gunakan /stickername reset untuk kembali ke default.`);
      return;
   }

   if (packName.toLowerCase() === "reset") {
      await setStickerPackName(user.telegramId, "");
      await ctx.reply("Nama pack stiker dikembalikan ke default.");
      return;
   }

   if (packName.length > STICKER_PACK_NAME_MAX_LENGTH || /[\r\n]/.test(packName)) {
      await ctx.reply(`Nama pack maksimal ${STICKER_PACK_NAME_MAX_LENGTH} karakter dan harus satu baris.`);
      return;
   }

   await setStickerPackName(user.telegramId, packName);
   await ctx.reply(`Nama pack stiker berhasil diubah menjadi: ${packName}`);
};

export const handleQrisCommand = async (ctx: Context) => {
   if (!isSuperAdmin(ctx.from?.id)) {
      await ctx.reply(messages.inValidCommand, { parse_mode: "Markdown" });
      return;
   }
   await ctx.reply("Kirim gambar QRIS dengan caption /setqris untuk menyimpan atau mengganti QRIS bisnis.");
};

export const handleQrisPhoto = async (ctx: Context) => {
   if (!ctx.message || !("photo" in ctx.message)) return;
   const caption = "caption" in ctx.message ? ctx.message.caption : undefined;
   if (!caption || !/^\/setqris(?:@\w+)?$/i.test(caption.trim())) return;

   if (!isSuperAdmin(ctx.from?.id) || ctx.chat?.type !== "private") {
      await ctx.reply(messages.inValidCommand, { parse_mode: "Markdown" });
      return;
   }

   try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
      const response = await axios.get<ArrayBuffer>(fileUrl.href, { responseType: "arraybuffer" });
      const image = Buffer.from(response.data);
      if (!image.length) throw new Error("QRIS image is empty");

      await saveBusinessQris(image);
      await ctx.reply("Gambar QRIS bisnis berhasil disimpan.");
   } catch (error) {
      console.error("Gagal menyimpan gambar QRIS:", error);
      await ctx.reply("Gagal menyimpan gambar QRIS. Coba kirim ulang fotonya.");
   }
};

export const handleDeleteQrisCommand = async (ctx: Context) => {
   if (!isSuperAdmin(ctx.from?.id)) {
      await ctx.reply(messages.inValidCommand, { parse_mode: "Markdown" });
      return;
   }
   await deleteBusinessQris();
   await ctx.reply("Gambar QRIS bisnis berhasil dihapus.");
};

export const handleReviewCommand = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      ctx.reply(messages.chatNotFound, { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat.id);
   if (!user) {
      ctx.reply("Klik /start", { parse_mode: "Markdown" });
      return;
   }

   if (user.hasReviewed) {
      const reviewText = user.reviewText || "Belum ada review";
      await ctx.reply(
         `*Review kamu saat ini:*\n\n“${escapeMarkdown(reviewText)}”\n\n_Kamu bisa memperbarui review dengan mengirim teks baru di chat ini. Reward hanya diberikan sekali._`,
         { parse_mode: "Markdown" }
      );
      pendingReviewUsers.add(ctx.chat.id);
      return;
   }

   pendingReviewUsers.add(ctx.chat.id);
   await ctx.reply(messages.reviewPrompt, { parse_mode: "Markdown" });
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
         await ctx.editMessageText(messages.reviewsEmpty, { parse_mode: "Markdown" });
      } else {
         await ctx.reply(messages.reviewsEmpty, { parse_mode: "Markdown" });
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

   const baseReply = `*Ulasan Terbaru* (${page}/${totalPages})\n\n${lines.join("\n\n")}`;

   const keyboard: { text: string; callback_data: string }[][] = [];
   if (isAdmin) {
      keyboard.push(...reviews.map((review) => [{
            text: `🗑️ Hapus review @${review.userName || review.name || review.telegramId}`,
            callback_data: `delete_review_${review.telegramId}_${page}`,
         }]));
   }

   if (page > 1 || page < totalPages) {
      keyboard.push([
         ...(page > 1 ? [{ text: "⬅️ Sebelumnya", callback_data: `reviews_page_${page - 1}` }] : []),
         ...(page < totalPages ? [{ text: "Berikutnya ➡️", callback_data: `reviews_page_${page + 1}` }] : []),
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

export const handleTextMessage = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
      return;
   }

   const commandPattern = /^\/([a-zA-Z]+)(?:\s+(.+))?$/;
   const match = ctx.message.text.match(commandPattern);

   if (match) {
      ctx.reply(messages.inValidCommand, { parse_mode: "Markdown" });
      return;
   }

   if (pendingReviewUsers.has(ctx.message.chat.id)) {
      pendingReviewUsers.delete(ctx.message.chat.id);

      const user = await getUser(ctx.message.chat.id);
      if (!user) {
         ctx.reply("Klik /start", { parse_mode: "Markdown" });
         return;
      }

      const text = ctx.message.text.trim();
      if (!text) {
         ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
         return;
      }

      if (user.hasReviewed) {
         const result = await updateUserReview(user.telegramId, text);
         if (!result || !result.success) {
            ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
            return;
         }

         try {
            const adminReviewMessage = [
               "✏️ *Review User Diperbarui!*",
               "",
               `*${escapeMarkdown(user.name || "User")}* ${user.isPremium ? "⭐" : ""}`,
               `├ Username: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}`,
               `├ Review: ${escapeMarkdown(text)}`,
               `└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})`,
            ].join("\n");

            await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminReviewMessage, { parse_mode: "Markdown" });
         } catch (_) {}

         ctx.reply(messages.reviewUpdated, { parse_mode: "Markdown" });
         return;
      }

      const result = await submitUserReview(user.telegramId, text);
      if (!result || result.success === false) {
         if (result?.reason === "already_reviewed") {
            ctx.reply(messages.reviewAlreadyExists, { parse_mode: "Markdown" });
         } else {
            ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
         }
         return;
      }

      try {
         const adminReviewMessage = [
            "⭐ *Review Baru Diterima!*",
            "",
            `*${escapeMarkdown(user.name || "User")}* ${user.isPremium ? "⭐" : ""}`,
            `├ Username: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}`,
            `├ Reward: +${REVIEW_STICKER_LIMIT_BONUS} limit sticker`,
            `├ Review: ${escapeMarkdown(text)}`,
            `└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})`,
         ].join("\n");

         await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminReviewMessage, { parse_mode: "Markdown" });
      } catch (_) {}

      ctx.reply(messages.reviewSubmitted, { parse_mode: "Markdown" });
      return;
   }

   const number = isValidWhatsAppNumber(ctx.message.text);
   if (number) {
      const response = await savePhoneNumber(number, ctx.message.chat.id);
      if (response) {
         ctx.reply(messages.validNumber, { parse_mode: "Markdown" });

         try {
            const { telegramId, name, userName, previousNumber, newNumber } = response as any;

            // Only notify admin when number was added or changed
            if (previousNumber !== newNumber) {
               const adminLines = [
                  "Pembaruan Nomor WhatsApp!",
                  "",
                  "👤 *Informasi Pengguna:*",
                  "",
                  `*${escapeMarkdown(name)}*`,
                  `├ Username: ${userName ? `@${escapeMarkdown(userName)}` : '-'}`,
                  `├ Sebelumnya: ${previousNumber ? '+' + previousNumber : '-'}`,
                  `├ Baru: ${newNumber ? '+' + newNumber : '-'}`,
                  `└ Telegram ID: [${telegramId}](tg://user?id=${telegramId})`,
               ];

               const adminMessage = adminLines.join('\n');
               await ctx.telegram.sendMessage(ADMIN_TELEGRAM_ID, adminMessage, { parse_mode: "Markdown" });
            }
         } catch (e) {
            console.warn("Gagal mengirim notifikasi nomor ke admin:", e);
         }
      } else {
         ctx.reply("Klik /start", { parse_mode: "Markdown" });
      }
   } else if (looksLikePhoneNumber(ctx.message.text)) {
      ctx.reply(messages.invalidNumber, { parse_mode: "Markdown" });
      return;
   } else {
      const aiConfig = await getAIConfig();
      if (!aiConfig.isTelegramAIEnabled) {
         ctx.reply("_AI asisten sedang dinonaktifkan oleh admin._", { parse_mode: "Markdown" });
         return;
      }

      const user = await getUser(ctx.message.chat.id);
      if (!user) {
         ctx.reply("Klik /start", { parse_mode: "Markdown" });
         return;
      }

      const reply = await askAI(ctx.message.text, "telegram");
      ctx.reply(`_${escapeMarkdown(reply)}_`, { parse_mode: "Markdown" });
   }
};

export const hears = (ctx: Context) => {
   ctx.reply(messages.help, { parse_mode: "Markdown" });
};

export const handleStickerMessage = async (ctx: Context) => {
   const message = ctx.message as { sticker: { file_id: string; file_unique_id: string; is_animated: boolean; is_video: boolean } };
   const fileId = message?.sticker?.file_id;
   const fileUniqueId = message?.sticker?.file_unique_id;
   const isAnimated = message?.sticker?.is_animated;
   const isVideo = message?.sticker?.is_video;

   const limitCost = isAnimated ? 3 : 1;

   if (!isClientReady) {
      ctx.reply(messages.isWhatsappReady, { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat?.id);
   if (!user) {
      ctx.reply("Klik /start", { parse_mode: "Markdown" });
      return;
   }

   if (user.isBlocked) {
      ctx.reply("🚫 Akun kamu telah diblokir. Hubungi admin.", { parse_mode: "Markdown" });
      return;
   }

   const isPremium = await checkAndResetPremium(user);

   const replyStickerLimit = (ctx: Context) => {
      const buttons: any[] = [];

      if (!user.hasReviewed) {
         buttons.push([{ text: `⭐ Kasih Ulasan Bot (+${REVIEW_STICKER_LIMIT_BONUS} limit)`, callback_data: "review_prompt" }]);
      }

      buttons.push([{ text: `👥 Undang Teman (+${REFERRAL_STICKER_LIMIT_BONUS} limit)`, callback_data: "get_invite_link" }]);
      buttons.push([{ text: `⭐ Upgrade Premium (unlimited) - ${PREMIUM_PRICE_LABEL}`, url: `https://t.me/${ADMIN_TELEGRAM_USERNAME}` }]);

      return ctx.reply(
         messages.stickerLimit(getTimeUntilReset(user.stickerLimitResetAt ?? user.createdAt)),
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
      ctx.reply(messages.whatsAppInfo, { parse_mode: "Markdown" });
      return;
   }

   const isAdmin = user.role === ROLES.ADMIN;

   if (!isAdmin) {
      if (user.isProcessing) {
         ctx.reply(messages.pending, { parse_mode: "Markdown" });
         return;
      }
      await setUserProcessing(user._id);
   }

   ctx.reply(messages.process, { parse_mode: "Markdown" });

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
      ctx.reply(messages.failed, { parse_mode: "Markdown" });
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
      ctx.reply("Klik /start", { parse_mode: "Markdown" });
      return;
   }
   
   const isPremium = await checkAndResetPremium(user);
   await setCommandsForUser(user.telegramId, user.role, isPremium);
   await resetStickerLimitIfNeeded(user);
   const premiumStatus = isPremium
      ? user.premiumExpiredAt
         ? `⭐ Premium (exp: ${formattedDate(user.premiumExpiredAt)})`
         : "⭐ Premium"
      : "Regular";

   const userInfo = `👤 *Informasi Profil:*\n
*${escapeMarkdown(user.name)}* ${isPremium ? "⭐" : ""}
├ Role: ${user.role}
├ Username: ${user.userName ? `@${escapeMarkdown(user.userName)}` : "-"}
├ WhatsApp: ${user.whatsappNumber ? '+' + `\`${user.whatsappNumber}\`` : '-'}
├ Nomor WhatsApp kedua: ${user.whatsappNumbers?.[1] ? `+\`${user.whatsappNumbers[1]}\`` : "-"}
├ Nama Pack Stiker: ${user.stickerPackName || DEFAULT_STICKER_PACK_NAME}
├ Sticker Limit: ${user.stickerLimit}
├ Status Akun: ${premiumStatus}
├ Proses: ${user.isProcessing ? "Sedang diproses" : "Tidak diproses"}
├ Dibuat: ${formattedDate(user.createdAt)}
├ Diperbarui: ${formattedDate(user.updatedAt)}
└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})`;

   ctx.reply(userInfo, { parse_mode: "Markdown" });
}

export const handleAddLimit = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat?.id);
   if (user?.role !== "admin") {
      ctx.reply(messages.inValidCommand, { parse_mode: "Markdown" });
      return;
   }

   const text = ctx.message?.text;
   const match = text?.match(/^\/limit (\d+)$/);
   if (match && match[1]) {
      const telegramId = match[1];
      const user = await updateLimit(Number(telegramId));
      if (!user) {
         ctx.reply(messages.userNotFound, { parse_mode: "Markdown" });
         return;
      } else {
         ctx.reply(messages.updateLimit, { parse_mode: "Markdown" });
      }
   } else {
      ctx.reply(messages.invalidUpdateLimitFormat, { parse_mode: "Markdown" });
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
      ctx.reply(messages.userNotFound, { parse_mode: "Markdown" });
      return;
   }

   const sortLabel = sort === "desc" ? "Terbaru ↓" : "Terlama ↑";
   const toggleSort = sort === "desc" ? "asc" : "desc";
   const toggleLabel = sort === "desc" ? "Urutkan: Terlama ↑" : "Urutkan: Terbaru ↓";

   let message = `*Daftar ${totalUsers} Pengguna (Halaman ${page} dari ${totalPages}) — ${sortLabel}:*\n\n`;

   users.forEach((user, index) => {
      const no = (page - 1) * limit + index + 1;
      const whatsapp = user.whatsappNumber ? `+${user.whatsappNumber}` : "-";
      const username = user.userName ? `@${escapeMarkdown(user.userName)}` : "-";

      message += `*${no}. ${escapeMarkdown(user.name)}* ${user.isPremium ? "⭐" : ""}\n`;
      message += `├ Role: ${user.role}\n`;
      message += `├ Username: ${username}\n`;
      message += `├ WhatsApp: \`${whatsapp}\`\n`;
      message += `├ Limit: ${user.stickerLimit}\n`;
      message += `└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})\n\n`;
   });

   const navButtons = [];
   if (page > 1) navButtons.push({ text: "⬅️ Sebelumnya", callback_data: `list_${page - 1}_${sort}` });
   if (page < totalPages) navButtons.push({ text: "Berikutnya ➡️", callback_data: `list_${page + 1}_${sort}` });

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
   await ctx.reply(messages.about, { parse_mode: "Markdown" });
   await ctx.reply(messages.totalUsersInfo(totalUsers, reviews.length > 0), { parse_mode: "Markdown" });
}

export const handleGuide = (ctx: Context) => {
   ctx.reply(messages.guide, { parse_mode: "Markdown" });
}

export const handleSelectUser = async (ctx: Context, action: string, page: number = 1) => {
   const limit = 15;
   const users = await getUsersWithPagination(page, limit);
   const totalPages = await getTotalPages(limit);

   if (users.length === 0) {
      ctx.reply(messages.userNotFound, { parse_mode: "Markdown" });
      return;
   }

   let message = `*Pilih user untuk ${action} (Halaman ${page} dari ${totalPages}):*\n\n`;

   const userButtons = users.map(user => ([{
      text: `${user.name} (${user.userName || "N/A"}) ${user.isPremium ? "⭐" : ""} ${user.isBlocked ? "🚫" : ""}`,
      callback_data: `${action}_user_${user.telegramId}_${page}`
   }]));

   const navButtons = [];
   if (page > 1) navButtons.push({ text: "⬅️ Sebelumnya", callback_data: `${action}_page_${page - 1}` });
   if (page < totalPages) navButtons.push({ text: "Berikutnya ➡️", callback_data: `${action}_page_${page + 1}` });

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
         `*Tambah limit untuk user \`${telegramId}\`*\nPilih jumlah limit:`,
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
                     text: "❌ Batal", 
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
         `*Set premium untuk user \`${telegramId}\`*\nPilih durasi:`,
         {
         parse_mode: "Markdown",
         reply_markup: {
            inline_keyboard: [
               [
                  { 
                     text: "7 Hari", 
                     callback_data: `setpremium_${telegramId}_7_${fromPage}` },
                  { 
                     text: "30 Hari", 
                     callback_data: `setpremium_${telegramId}_30_${fromPage}` },
                  { 
                     text: "90 Hari", 
                     callback_data: `setpremium_${telegramId}_90_${fromPage}` 
                  },
               ],
               ...(selectedUser?.isPremium ? [
               [
                  { 
                     text: "❌ Hapus Premium", 
                     callback_data: `setpremium_${telegramId}_remove_${fromPage}` 
                  }
               ]] : []),
               [
                  { 
                     text: "❌ Batal", 
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
         `*Blokir/Unblokir user \`${telegramId}\`?*`,
         {
         parse_mode: "Markdown",
         reply_markup: {
            inline_keyboard: [
               [
                  selectedUser?.isBlocked
                     ? { 
                        text: "✅ Unblokir", 
                        callback_data: `setblock_${telegramId}_unblock_${fromPage}` 
                     } : { 
                        text: "🚫 Blokir", 
                        callback_data: `setblock_${telegramId}_block_${fromPage}` 
                     }
               ],
               [
                  { 
                     text: "❌ Batal", 
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
         await ctx.answerCbQuery("User tidak ditemukan");
         return;
      }
      await ctx.editMessageText(
         `*Hapus user \`${telegramId}\`?*\n\n⚠️ Tindakan ini tidak bisa dibatalkan!\n\n👤 ${selectedUser.name} ${selectedUser.isPremium ? "⭐" : ""}\n└ Username: ${selectedUser.userName ? `@${selectedUser.userName}` : "-"}`,
         {
            parse_mode: "Markdown",
            reply_markup: {
               inline_keyboard: [
                  [
                     {
                        text: "🗑️ Ya, Hapus",
                        callback_data: `setdelete_${telegramId}_confirm_${fromPage}`
                     },
                     {
                        text: "❌ Batal",
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

const notify = (ctx: Context, telegramId: number, message: string) =>
   ctx.telegram.sendMessage(telegramId, message, { parse_mode: "Markdown" });

const actionHandlers: Record<string, (ctx: Context, telegramId: number, value: string) => Promise<void>> = {
   setlimit: async (ctx, telegramId, value) => {
      await updateLimit(telegramId, parseInt(value));
      await ctx.answerCbQuery(`✅ Limit +${value} berhasil ditambahkan`);
      await notify(ctx, telegramId, `✅ *Limit sticker kamu ditambah +${value}!*\nSekarang kamu bisa kirim lebih banyak sticker.`);
   },

   setpremium: async (ctx, telegramId, value) => {
      if (value === "remove") {
         await removePremium(telegramId);
         const user = await getUser(telegramId);
         if (user) {
            try {
               await setCommandsForUser(telegramId, user.role, false);
            } catch (error) {
               console.error(`Gagal memperbarui command Telegram untuk user ${telegramId}:`, error);
            }
         }
         await ctx.answerCbQuery("❌ Premium berhasil dihapus");
         await notify(ctx, telegramId, `❌ *Status Premium kamu telah dihapus.*\nHubungi admin jika ada pertanyaan.`);
      } else {
         await setPremium(telegramId, parseInt(value));
         const user = await getUser(telegramId);
         if (user) {
            try {
               await setCommandsForUser(telegramId, user.role, true);
            } catch (error) {
               console.error(`Gagal memperbarui command Telegram untuk user ${telegramId}:`, error);
            }
         }
         await ctx.answerCbQuery(`⭐ Premium ${value} hari berhasil diset`);
         await notify(ctx, telegramId, `⭐ *Selamat! Akun kamu sekarang Premium selama ${value} hari.*\nNikmati limit sticker tanpa batas!`);
      }
   },

   setblock: async (ctx, telegramId, value) => {
      if (value === "block") {
         await blockUser(telegramId);
         await ctx.answerCbQuery("🚫 User berhasil diblokir");
         await notify(ctx, telegramId, `🚫 *Akun kamu telah diblokir.*\nHubungi admin jika ada pertanyaan.`);
      } else {
         await unblockUser(telegramId);
         await ctx.answerCbQuery("✅ User berhasil diunblokir");
         await notify(ctx, telegramId, `✅ *Akun kamu telah diunblokir.*\nKamu sudah bisa menggunakan bot kembali.`);
      }
   },

   setdelete: async (ctx, telegramId, value) => {
      if (value === "confirm") {
         await deleteUser(telegramId);
         await ctx.answerCbQuery("🗑️ User berhasil dihapus");
         try {
            await notify(ctx, telegramId, `🗑️ *Akun kamu telah dihapus dari sistem.*\nHubungi admin jika ada pertanyaan.`);
         } catch (_) {}
      } else {
         await ctx.answerCbQuery("❌ Dibatalkan");
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
      ctx.reply("Format: `/broadcast pesan kamu`", { parse_mode: "Markdown" });
      return;
   }

   await ctx.reply("📤 Broadcast dimulai di background, kamu akan diberi tahu setelah selesai...");

   runBroadcast(ctx, text).catch((err) => {
      console.error("Broadcast error:", err);
   });
};

export const handleInvite = async (ctx: Context) => {
   const botUsername = process.env.BOT_USERNAME;
   const telegramId = ctx.chat?.id;
   const inviteLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

   await ctx.reply(`🔗 *Link Undangan Kamu:*`, { parse_mode: "Markdown" });
   await ctx.reply(inviteLink);
   await ctx.reply(`📢 Salin dan bagikan link di atas ke teman kamu!\nSetiap teman yang join, kamu dapat *+${REFERRAL_STICKER_LIMIT_BONUS} limit sticker*. Setiap ${REFERRALS_PER_PREMIUM} referral, kamu juga mendapat *Premium gratis ${REFERRAL_PREMIUM_MONTHS} bulan*.`, { parse_mode: "Markdown" });
};

export const handleLeaderboard = async (ctx: Context) => {
   const topReferrers = await getTopReferrers(10);

   if (topReferrers.length === 0) {
      ctx.reply("Belum ada referral. Jadilah yang pertama! /invite", { parse_mode: "Markdown" });
      return;
   }

   const medals = ["🥇", "🥈", "🥉"];
   const rows = topReferrers.map((user, i) => {
      const rank = medals[i] ?? `${i + 1}.`;
      const name = user.userName ? `@${escapeMarkdown(user.userName)}` : escapeMarkdown(user.name);
      const premium = user.isPremium ? " ⭐" : "";
      return `${rank} ${name}${premium} — *${user.referralCount}* teman`;
   });

   const message = [
      "🏆 *Top Referral*\n",
      rows.join("\n"),
      "",
      `_Undang teman lewat /invite: +${REFERRAL_STICKER_LIMIT_BONUS} limit per teman dan Premium gratis ${REFERRAL_PREMIUM_MONTHS} bulan setiap ${REFERRALS_PER_PREMIUM} referral!_`,
   ].join("\n");

   ctx.reply(message, { parse_mode: "Markdown" });
};

const buildAISettingsMessage = (isTelegramAIEnabled: boolean, isWAAIEnabled: boolean) => {
   const teleStatus = isTelegramAIEnabled ? "✅ Aktif" : "❌ Nonaktif";
   const waStatus = isWAAIEnabled ? "✅ Aktif" : "❌ Nonaktif";
   return [
      "⚙️ *Pengaturan AI Asisten*\n",
      `├ Telegram: ${teleStatus}`,
      `└ WhatsApp: ${waStatus}`,
   ].join("\n");
};

const buildAISettingsKeyboard = (isTelegramAIEnabled: boolean, isWAAIEnabled: boolean) => ({
   reply_markup: {
      inline_keyboard: [
         [
            {
               text: isTelegramAIEnabled ? "🔴 Matikan AI Telegram" : "🟢 Aktifkan AI Telegram",
               callback_data: "ai_toggle_telegram",
            },
         ],
         [
            {
               text: isWAAIEnabled ? "🔴 Matikan AI WhatsApp" : "🟢 Aktifkan AI WhatsApp",
               callback_data: "ai_toggle_wa",
            },
         ],
      ],
   },
});

export const handleAISettings = async (ctx: Context) => {
   const config = await getAIConfig();

   const text = buildAISettingsMessage(config.isTelegramAIEnabled, config.isWAAIEnabled);
   const keyboard = buildAISettingsKeyboard(config.isTelegramAIEnabled, config.isWAAIEnabled);

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
      (ctx as any).answerCbQuery(newTelegramAI ? "AI Telegram diaktifkan ✅" : "AI Telegram dimatikan ❌");
   } else if (callbackData === "ai_toggle_wa") {
      const result = await toggleWAAI(adminId);
      if (result === null) return;
      newWAAI = result;
      (ctx as any).answerCbQuery(newWAAI ? "AI WhatsApp diaktifkan ✅" : "AI WhatsApp dimatikan ❌");
   }

   const text = buildAISettingsMessage(newTelegramAI, newWAAI);
   const keyboard = buildAISettingsKeyboard(newTelegramAI, newWAAI);

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

   await ctx.reply(`✅ Broadcast selesai!\n\n📨 Berhasil: ${success}\n❌ Gagal: ${failed}`);
};
