import { Context } from "telegraf";
import { client } from "../bots/whatsapp";
import fs from "fs";
import messages from "../constants/messages";
import { StickerData } from "../types/sticker.type";
import { addStickerMetadata } from "./stickerExif";
import { removePlusInNumber } from "./phoneValidate";

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam
const lastSenderCache = new Map<string, { telegramId: number; ts: number }>();

// Bersihkan cache expired setiap jam
setInterval(() => {
   const now = Date.now();
   for (const [key, val] of lastSenderCache) {
      if (now - val.ts > CACHE_TTL) lastSenderCache.delete(key);
   }
}, 60 * 60 * 1000);

export const sendStickerToWhatsApp = async (stickerData: StickerData, ctx: Context) => {
   const { filePath, mimeType, user } = stickerData;
   const { telegramId, name, userName, whatsappNumber } = user;
   const userNumber = `${removePlusInNumber(whatsappNumber || "")}@s.whatsapp.net`;

   try {
      const mediaBuffer = await fs.promises.readFile(filePath);

      const cached = lastSenderCache.get(userNumber);
      const now = Date.now();
      if (!cached || cached.telegramId !== telegramId || now - cached.ts > CACHE_TTL) {
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
         lastSenderCache.set(userNumber, { telegramId, ts: now });
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