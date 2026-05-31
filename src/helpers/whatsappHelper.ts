import { Context } from "telegraf";
import { client } from "../bots/whatsapp";
import fs from "fs";
import messages from "../constants/messages";
import { StickerData } from "../types/sticker.type";
import { addStickerMetadata } from "./stickerExif";
import { removePlusInNumber } from "./phoneValidate";

export const sendStickerToWhatsApp = async (stickerData: StickerData, ctx: Context) => {
   const { filePath, mimeType, user } = stickerData;
   const { telegramId, name, username, whatsappNumber } = user;
   const userNumber = 
      `${removePlusInNumber(whatsappNumber || "")}@s.whatsapp.net`;

   try {
      const mediaBuffer = fs.readFileSync(filePath);

      await client.sendMessage(userNumber, {
         text: `Stiker dari Telegram 🎁\n\nPengirim\nNama: ${name}\nUsername: ${username ? "@" + username : "-"}\nId Telegram: ${telegramId}`,
      });

      const stickerBuffer = await addStickerMetadata(
         mediaBuffer,
         "Sticker",
         "Created by Tumbuhan (@rikkriuk)"
      );

      await client.sendMessage(userNumber, {
         sticker: stickerBuffer,
      });

      ctx.reply(messages.success, { parse_mode: "Markdown" });
   } catch (error) {
      console.log("Gagal mengirim stiker ke whatsapp");
      throw error;
   }
};