import { Context } from "telegraf";
import { client } from "../bots/whatsapp";
import fs from "fs";
import { normalizeLanguage, translate } from "../lang";
import { StickerData } from "../types/sticker.type";
import { addStickerMetadata } from "./stickerExif";
import { removePlusInNumber } from "./phoneValidate";
import { PREMIUM_MAX_WHATSAPP_NUMBERS, STICKER_PACK_NAME } from "../constants/businessConfig";
import { checkAndResetPremium, getUser } from "../services/userService";

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
   const latestUser = await getUser(user.telegramId);
   if (!latestUser) {
      throw new Error(`Telegram user ${user.telegramId} was not found before sticker delivery`);
   }

   const { telegramId, name, userName, whatsappNumber } = latestUser;
   const language = normalizeLanguage(latestUser.language);
   const hasPremiumAccess = await checkAndResetPremium(latestUser);
   const numbers = latestUser.whatsappNumbers?.length
      ? latestUser.whatsappNumbers
      : whatsappNumber ? [whatsappNumber] : [];
   const recipientNumbers = (hasPremiumAccess ? numbers : numbers.slice(0, 1))
      .slice(0, PREMIUM_MAX_WHATSAPP_NUMBERS);
   if (recipientNumbers.length === 0) {
      throw new Error(`No WhatsApp recipient configured for Telegram user ${telegramId}`);
   }

   try {
      const mediaBuffer = await fs.promises.readFile(filePath);
      const stickerAuthor = hasPremiumAccess && latestUser.stickerPackName
         ? latestUser.stickerPackName
         : `Created by @SendStickerBot (${userName ? "@" + userName : name})`;
      console.log(`Generating sticker metadata for user ${telegramId} with author "${stickerAuthor}".`);

      const stickerBuffer = await addStickerMetadata(
         mediaBuffer,
         STICKER_PACK_NAME,
         stickerAuthor
      );

      for (const number of recipientNumbers) {
         const userNumber = `${removePlusInNumber(number)}@s.whatsapp.net`;
         const cached = lastSenderCache.get(userNumber);
         const now = Date.now();
         if (!cached || cached.telegramId !== telegramId || now - cached.ts > CACHE_TTL) {
            const lines = [
               translate(language, "stickerDeliveryTitle"),
               "",
               translate(language, "sender"),
               `├ ${translate(language, "nameLabel")}: ${name}`,
               `├ ${translate(language, "usernameLabel")}: ${userName ? "@" + userName : "-"}`,
               `└ ${translate(language, "telegramIdLabel")}: ${telegramId}`,
            ];

            await client.sendMessage(userNumber, {
               text: lines.join("\n"),
            });
            lastSenderCache.set(userNumber, { telegramId, ts: now });
         }
         await client.sendMessage(userNumber, { sticker: stickerBuffer });
      }
      ctx.reply(translate(normalizeLanguage(ctx.state.language), "success"), { parse_mode: "Markdown" });
   } catch (error) {
      console.log("Gagal mengirim stiker ke whatsapp");
      throw error;
   }
};