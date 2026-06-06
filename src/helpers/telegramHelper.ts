import { Context } from "telegraf";
import { Message } from "telegraf/types";
import { 
   checkAndResetPremium, 
   decrementStickerLimit, 
   getTotalPages, 
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
} from "../services/userService";
import messages from "../constants/messages";
import { isValidWhatsAppNumber } from "./phoneValidate";
import { getFileUrl } from "./fileHelper";
import { downloadFile } from "../services/stickerService";
import fs from "fs";
import { formattedDate } from "./formattedDate";
import whatsappEmitter from "../events/eventEmitter";
import { setCommandsForUser } from "../middleware/adminMiddleware";
import { ADMIN_TELEGRAM_USERNAME, ROLES } from "../constants/roles";

let isClientReady: boolean = false;

const isTextMessage = (message: Message): message is Message.TextMessage => {
   return "text" in message;
};

whatsappEmitter.on("whatsappReady", () => {
   isClientReady = true;
})

export const handleStart = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      ctx.reply(messages.chatNotFound, { parse_mode: "Markdown" });
      return;
   }
   
   await ctx.reply(`_${messages.hi + ctx.chat.first_name}_`, { parse_mode: "Markdown" });
   const { user, isNewUser } = await saveOrUpateUser(ctx?.chat);

   await setCommandsForUser(ctx.chat.id, user.role);

   if (isNewUser) {
      try {
         const adminMessage = `Ada Pengguna Baru! \n\n👤 *Informasi:*
\n*${user.name}* ${user.isPremium ? "⭐" : ""}
├ Role: ${user.role}
├ Username: ${user.userName ? `@${user.userName}` : "-"}
├ WhatsApp: ${user.whatsappNumber ? '+' + `${user.whatsappNumber}` : '-'}
├ Sticker Limit: ${user.stickerLimit}
├ Dibuat: ${formattedDate(user.createdAt)}
└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})`;

         const adminTarget = ADMIN_TELEGRAM_USERNAME ? `@${ADMIN_TELEGRAM_USERNAME}` : undefined;
         if (adminTarget) {
            await ctx.telegram.sendMessage(
               adminTarget, 
               adminMessage, 
               { 
                  parse_mode: "Markdown" 
               }
            );
         }
      } catch (e) {
         console.warn("Gagal mengirim notifikasi user baru ke admin:", e);
      }
   }
   
   await ctx.reply(messages.about, { parse_mode: "Markdown" });
   if (!user.whatsappNumber) {
      await ctx.reply(messages.whatsAppInfo, { parse_mode: "Markdown" });
   } else {
      await ctx.reply(messages.existedNumber, { parse_mode: "Markdown" });
   }
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

   const number = isValidWhatsAppNumber(ctx.message.text);
   if (number) {
      const response = await savePhoneNumber(number, ctx.message.chat.id);
      if (response) {
         ctx.reply(messages.validNumber, { parse_mode: "Markdown" });
      } else {
         ctx.reply("Klik /start", { parse_mode: "Markdown" });
      }
   } else {
      ctx.reply(messages.inValidNumber, { parse_mode: "Markdown" });
   }
};

export const hears = (ctx: Context) => {
   ctx.reply(messages.help, { parse_mode: "Markdown" });
};

export const handleStickerMessage = async (ctx: Context) => {
   const message = ctx.message as { sticker: { file_id: string } };
   const fileId = message?.sticker?.file_id;

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

   const replyStickerLimit = (ctx: Context) => ctx.reply(messages.stickerLimit, {
      parse_mode: "Markdown",
      reply_markup: {
         inline_keyboard: [[
            { text: "⭐ Upgrade Premium", url: `https://t.me/${ADMIN_TELEGRAM_USERNAME}` }
         ]]
      }
   });

   if (!isPremium) {
      await resetStickerLimitIfNeeded(user);
      if (user.stickerLimit <= 0) {
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

   processSticker(ctx, user, fileId, isPremium).catch(async (error) => {
      console.error("Error processing sticker:", error);
      if (!isAdmin) await resetUserProcessing(user._id);
   });
};

const processSticker = async (ctx: Context, user: any, fileId: string, isPremium: boolean) => {
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
      };

      await downloadFile(mediaData, ctx);
      if (!isPremium) {
         await decrementStickerLimit(user._id, user.role);
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
   
   await resetStickerLimitIfNeeded(user);
   const premiumStatus = user.isPremium && user.premiumExpiredAt 
      ? `⭐ Premium (exp: ${formattedDate(user.premiumExpiredAt)})`
      : "Regular";

   const userInfo = `👤 *Informasi Profil:*\n
*${user.name}* ${user.isPremium ? "⭐" : ""}
├ Role: ${user.role}
├ Username: ${user.userName ? `@${user.userName}` : "-"}
├ WhatsApp: ${user.whatsappNumber ? '+' + `\`${user.whatsappNumber}\`` : '-'}
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
   const page = ctx.callbackQuery
      ? parseInt((ctx.callbackQuery as any).data.split("_")[1])
      : 1;

   const limit = 10;
   const users = await getUsersWithPagination(page, limit);
   const totalPages = await getTotalPages(limit);

   if (users.length === 0) {
      ctx.reply(messages.userNotFound, { parse_mode: "Markdown" });
      return;
   }

   let message = `*Daftar Pengguna (Halaman ${page} dari ${totalPages}):*\n\n`;
  
   users.forEach((user, index) => {
      const no = (page - 1) * limit + index + 1;
      const whatsapp = user.whatsappNumber ? `+${user.whatsappNumber}` : "-";
      const username = user.userName ? `@${user.userName}` : "-";

      message += `*${no}. ${user.name}* ${user.isPremium ? "⭐" : ""}\n`;
      message += `├ Role: ${user.role}\n`;
      message += `├ Username: ${username}\n`;
      message += `├ WhatsApp: \`${whatsapp}\`\n`;
      message += `├ Limit: ${user.stickerLimit}\n`;
      message += `└ Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})\n\n`
   });

   const buttons = [];
   if (page > 1) {
      buttons.push({ text: "⬅️ Sebelumnya", callback_data: `list_${page - 1}` });
   }
   if (page < totalPages) {
      buttons.push({ text: "Berikutnya ➡️", callback_data: `list_${page + 1}` });
   }

   const keyboard = buttons.length > 0
      ? { reply_markup: { inline_keyboard: [buttons] } }
      : {};

   if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
         parse_mode: "Markdown",
         ...keyboard,
      });
      await ctx.answerCbQuery();
   } else {
      ctx.reply(message, {
         parse_mode: "Markdown",
         ...keyboard,
      });
   }
};

export const handleHelper = (ctx: Context) => {
   ctx.reply(messages.about, { parse_mode: "Markdown" });
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
      text: `${user.name} ${user.isPremium ? "⭐" : ""} ${user.isBlocked ? "🚫" : ""}`,
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
         await ctx.answerCbQuery("❌ Premium berhasil dihapus");
         await notify(ctx, telegramId, `❌ *Status Premium kamu telah dihapus.*\nHubungi admin jika ada pertanyaan.`);
      } else {
         await setPremium(telegramId, parseInt(value));
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
};

export const handleExecuteAction = async (ctx: Context) => {
   const data = (ctx.callbackQuery as any).data as string;
   const [action, telegramIdStr, value, fromPageStr] = data.split("_");
   const telegramId = parseInt(telegramIdStr);
   const fromPage = parseInt(fromPageStr);

   await actionHandlers[action]?.(ctx, telegramId, value);
   await handleSelectUser(ctx, action.replace("set", ""), fromPage);
};