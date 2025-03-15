import { Context } from "telegraf";
import { Message } from "telegraf/types";
import { decrementStickerLimit, getTotalPages, getUser, getUsersWithPagination, resetStickerLimitIfNeeded, resetUserProcessing, saveOrUpateUser, savePhoneNumber, setUserProcessing, updateLimit } from "../services/userService";
import messages from "../constants/messages";
import { isValidWhatsAppNumber } from "./phoneValidate";
import { getFileUrl } from "./fileHelper";
import { downloadFile } from "../services/stickerService";
import fs from "fs";
import { formattedDate } from "./formattedDate";

const isTextMessage = (message: Message): message is Message.TextMessage => {
   return "text" in message;
};

export const handleStart = async (ctx: Context) => {
   if (!ctx.chat || ctx.chat.type !== "private") {
      ctx.reply(messages.chatNotFound, { parse_mode: "Markdown" });
      return;
   }
   
   await ctx.reply(messages.hi + ctx.chat.first_name, { parse_mode: "Markdown" });
   const user = await saveOrUpateUser(ctx?.chat);
   await ctx.reply(messages.about, { parse_mode: "Markdown" });
   if (!user.whatsappNumber) {
      await ctx.reply(messages.whatsAppInfo, { parse_mode: "Markdown" });
   }
};

export const handleTextMessage = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
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

   const user = await getUser(ctx.chat?.id);
   if (!user || !user.whatsappNumber) {
      ctx.reply("Klik /start", { parse_mode: "Markdown" });
      return;
   }

   await resetStickerLimitIfNeeded(user);

   const updatedUser = await setUserProcessing(user._id);
   if (!updatedUser) {
      ctx.reply(messages.pending, { parse_mode: "Markdown" });
      return;
   }
   
   ctx.reply(messages.process, { parse_mode: "Markdown" });
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
      await decrementStickerLimit(user._id, user.role);
   } catch (error) {
      ctx.reply(messages.failed, { parse_mode: "Markdown" });
      await resetUserProcessing(user._id);
      throw error;
   }
};

export const handleProfile = async (ctx: Context) => {
   const user = await getUser(ctx.chat?.id);
   if (!user) {
      ctx.reply("Klik /start", { parse_mode: "Markdown" });
      return;
   }
   
   await resetStickerLimitIfNeeded(user);
   const userInfo = `_Informasi Profile:_\n
   - Nama: ${user.name}
   - Telegram ID: [${user.telegramId}](tg://user?id=${user.telegramId})
   - Role: ${user.role}
   - WhatsApp: ${user.whatsappNumber}
   - Sticker Limit: ${user.stickerLimit}
   - Status Processing: ${user.isProcessing ? "Sedang diproses" : "Tidak diproses"}
   - Dibuat pada: ${formattedDate(user.createdAt)}
   - Diperbarui pada: ${formattedDate(user.updatedAt)}`;

   ctx.reply(userInfo, { parse_mode: "Markdown" });
}

export const handleAddLimit = async (ctx: Context) => {
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat?.id);
   if (user?.role !== "admin") return;

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
   if (!ctx.message || !isTextMessage(ctx.message)) {
      ctx.reply(messages.inValidTextFormat, { parse_mode: "Markdown" });
      return;
   }

   const user = await getUser(ctx.chat?.id);
   if (user?.role !== "admin") return;

   const page = parseInt(ctx.message?.text?.split(" ")[1] || "1");
   const limit = 5;
   
   const users = await getUsersWithPagination(page, limit);
   const totalPages = await getTotalPages(limit);
 
   if (users.length === 0) {
     ctx.reply(messages.userNotFound, { parse_mode: "Markdown" });
     return;
   }

   let message = `_Daftar Pengguna (Halaman ${page} dari ${totalPages}):_\n\n`;
   users.forEach((user, index) => {
      message += `${index + 1}. Nama: ${user.name}, \nTelegram ID: [${user.telegramId}](tg://user?id=${user.telegramId}), \nRole: ${user.role}\nStiker Limit: ${user.stickerLimit}\n`;
   });

   let navigationMessage = '';
   if (page > 1) {
      navigationMessage += `/list ${page - 1} - Sebelumnya\n`;
   }
   if (page < totalPages) {
      navigationMessage += `/list ${page + 1} - Berikutnya\n`;
   }

   ctx.reply(message + "\n" + navigationMessage, { parse_mode: "Markdown" });
 };