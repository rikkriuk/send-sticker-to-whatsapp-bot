import { Context } from "telegraf";
import { client } from "../bots/whatsapp";
import fs from "fs";
import messages from "../constants/messages";
import { StickerData } from "../types/sticker.type";
import { addStickerMetadata } from "./stickerExif";
import { removePlusInNumber } from "./phoneValidate";

const lastSenderCache = new Map<string, number>();

export const sendStickerToWhatsApp = async (stickerData: StickerData, ctx: Context) => {
   const { filePath, mimeType, user } = stickerData;
   const { telegramId, name, userName, whatsappNumber } = user;
   const userNumber = `${removePlusInNumber(whatsappNumber || "")}@s.whatsapp.net`;

   try {
      const mediaBuffer = fs.readFileSync(filePath);

      const lastSender = lastSenderCache.get(userNumber);
      if (lastSender !== telegramId) {
         const lines = [
            "🎁 *Stiker dari Telegram*",
            "",
            "👤 *Pengirim:*",
            `├ Nama: ${name}`,
            `├ Username: ${userName ? "@" + userName : "-"}`,
            `└ Id Telegram: ${telegramId}`,
         ];

         await client.sendMessage(userNumber, {
            text: lines.join("\n"),
         });
         lastSenderCache.set(userNumber, telegramId);
      }

      const stickerBuffer = await addStickerMetadata(
         mediaBuffer,
         "Sticker",
         `Created by @SendStickerBot (${userName ? "@" + userName : name})`
      );

      await client.sendMessage(userNumber, { sticker: stickerBuffer });
      ctx.reply(messages.success, { parse_mode: "Markdown" });
   } catch (error) {
      console.log("Gagal mengirim stiker ke whatsapp");
      throw error;
   }
};