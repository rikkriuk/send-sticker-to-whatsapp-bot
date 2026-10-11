import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { downloadContentFromMessage, proto } from "@whiskeysockets/baileys";
import { addStickerMetadata, makeBackgroundTransparent } from "../helpers/stickerExif";
import qrcode from "qrcode-terminal";
import whatsappEmitter from "../events/eventEmitter";
import { Boom } from "@hapi/boom";
import { getUserByWhatsappNumber, getAIConfig, checkAndResetPremium } from "../services/userService";
import { askAI } from "../services/aiService";
import { getBusinessQris } from "../services/businessConfigService";
import { DEFAULT_STICKER_PACK_NAME, QRIS_IMAGE_CAPTION } from "../constants/businessConfig";

let sock: ReturnType<typeof makeWASocket>;

const normalizeWhatsAppNumber = (value?: string) => {
  const number = (value || "").replace(/\D/g, "");
  if (number.startsWith("0")) return `62${number.slice(1)}`;
  if (number.startsWith("8")) return `62${number}`;
  return number;
};

const getPhoneNumberFromJid = (jid?: string) =>
  jid?.split("@")[0].split(":")[0];

const connectToWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Client is ready!");
      whatsappEmitter.emit("whatsappReady");
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Disconnected. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        await connectToWhatsApp();
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    try {
      const messages = m.messages;
      for (const msg of messages) {
        if (!msg.message) continue;

        const jid = msg.key.remoteJid as string;

        if (jid.endsWith("@g.us")) continue;

        const resolvedJid = jid.endsWith("@lid")
          ? ((msg.key as any).remoteJidAlt ?? jid)
          : jid;

        if (resolvedJid.endsWith("@lid")) continue;

        const message = msg.message;

        if (msg.key.fromMe) {
          const text =
            (message.conversation as string) ||
            (message.extendedTextMessage?.text as string) ||
            "";
          const configuredAdminNumber = normalizeWhatsAppNumber(process.env.ADMIN_WHATSAPP);
          const ownNumber = normalizeWhatsAppNumber(
            getPhoneNumberFromJid(sock.user?.phoneNumber) ||
              getPhoneNumberFromJid(sock.user?.id)
          );

          if (text.trim().toLowerCase() === "qris") {
            if (!configuredAdminNumber || !ownNumber || configuredAdminNumber !== ownNumber) {
              console.warn(
                "Perintah QRIS diabaikan: nomor ADMIN_WHATSAPP tidak cocok dengan nomor WhatsApp yang terhubung."
              );
              continue;
            }

            const qrisImage = await getBusinessQris();
            if (!qrisImage) {
              console.warn("QRIS belum didaftarkan melalui Telegram superadmin.");
              await sock.sendMessage(resolvedJid, {
                text: "QRIS bisnis belum tersedia. Daftarkan gambar melalui Telegram dengan /setqris.",
              });
            } else {
              await sock.sendMessage(resolvedJid, {
                image: qrisImage,
                caption: QRIS_IMAGE_CAPTION,
              });
              console.log(`Gambar QRIS bisnis terkirim ke ${resolvedJid}.`);
            }
          }
          continue;
        }

        const imageMsg =
          (message as any).imageMessage || (message as any).documentMessage;

        const caption =
          imageMsg?.caption
            || (message?.conversation as any)
            || (message?.extendedTextMessage?.text as any);

        if (imageMsg && caption) {
          const trimmed = String(caption).trim();

          if (trimmed === ".sticker" || trimmed === ".sticker-t") {
            const stream = await downloadContentFromMessage(imageMsg, "image");
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(Buffer.from(chunk));
            }
            let buffer: Buffer = Buffer.concat(chunks);

            if (trimmed === ".sticker-t") {
              try {
                buffer = await makeBackgroundTransparent(buffer);
              } catch (e) {
                console.warn("Failed to make background transparent:", e);
              }
            }

            const phoneNumber = resolvedJid.replace("@s.whatsapp.net", "");
            const stickerUser = await getUserByWhatsappNumber(phoneNumber);
            const isPremium = stickerUser ? await checkAndResetPremium(stickerUser) : false;
            const stickerBuffer = await addStickerMetadata(
              buffer,
              isPremium && stickerUser?.stickerPackName
                ? stickerUser.stickerPackName
                : DEFAULT_STICKER_PACK_NAME,
              "Created by @SendStickerBot (WhatsApp)"
            );

            await sock.sendMessage(resolvedJid, { sticker: stickerBuffer });
          }
          continue;
        }

        const text =
          (message?.conversation as string) ||
          (message?.extendedTextMessage?.text as string);

        if (!text) continue;

        const trimmedText = text.trim();

        if (trimmedText.startsWith(".")) continue;

        const aiConfig = await getAIConfig();
        if (!aiConfig.isWAAIEnabled) continue;

        const phoneNumber = resolvedJid.replace("@s.whatsapp.net", "");
        const user = await getUserByWhatsappNumber(phoneNumber);
        if (!user) continue;

        const reply = await askAI(trimmedText, "whatsapp");
        const finalReply = reply?.trim();

        if (!finalReply) continue;

        await sock.sendMessage(resolvedJid, { text: finalReply });
      }
    } catch (error) {
      console.error("Error processing incoming whatsapp message:", error);
    }
  });
};

connectToWhatsApp();

export { sock as client };
export { whatsappEmitter };