import { Context } from "telegraf";
import { Message } from "telegraf/types";
import { getUser, saveOrUpateUser, savePhoneNumber } from "../services/userService";
import messages from "../constants/messages";
import { isValidWhatsAppNumber } from "./phoneValidate";
import { getFileUrl } from "./fileHelper";
import { downloadFile } from "../services/stickerService";
import fs from "fs";

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
   } catch (error) {
      ctx.reply(messages.failed, { parse_mode: "Markdown" });
      console.log("Gagal mengirim stiker", error);
      throw error;
   }
};
