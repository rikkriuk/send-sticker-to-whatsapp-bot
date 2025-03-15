import { Context } from "telegraf";
import { client } from "../bots/whatsapp";
import { MessageMedia } from "whatsapp-web.js";
import fs from "fs";
import messages from "../constants/messages";
import { StickerData } from "../types/sticker.type";

export const sendStickerToWhatsApp = async (stickerData: StickerData, ctx: Context) => {
   const { filePath, mimeType, user } = stickerData;
   const { telegramId, name, username, whatsappNumber } = user;
   const userNumber = `${whatsappNumber}@c.us`;
   
   try {
      await client.sendMessage(
         userNumber,
         `Stiker dari Telegram 🎁 \n\nPengirim\nNama: ${name}\nUsername: ${username ? '@' + username : '-'}\nId Telegram: ${telegramId}`
      );
   
      const mediaBuffer = fs.readFileSync(filePath);
      const media = new MessageMedia(mimeType, mediaBuffer.toString("base64"));
      
      await client.sendMessage(userNumber, media, {
         sendMediaAsSticker: true,
         stickerName: "Sticker",
         stickerAuthor: "Created by Tumbuhan (@rikkriuk)",
      });

      ctx.reply(messages.success, { parse_mode: "Markdown" });
   } catch (error) {
      console.log("Gagal mengirim stiker ke whatsapp");
      throw error;
   }
};
 