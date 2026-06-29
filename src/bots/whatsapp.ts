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
import { getUserByWhatsappNumber, getAIConfig } from "../services/userService";
import { askAI } from "../services/aiService";

let sock: ReturnType<typeof makeWASocket>;

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
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid as string;

        if (jid.endsWith("@g.us")) continue;

        const message = msg.message;
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

            const stickerBuffer = await addStickerMetadata(
              buffer,
              "Sticker",
              "Created by @SendStickerBot (WhatsApp)"
            );

            await sock.sendMessage(jid, { sticker: stickerBuffer });
          }
          continue;
        }

        const text =
          (message?.conversation as string) ||
          (message?.extendedTextMessage?.text as string);

        if (!text) continue;

        const trimmedText = text.trim();

        if (trimmedText.startsWith(".")) continue;

        // Cek global AI config (diatur admin)
        const aiConfig = await getAIConfig();
        if (!aiConfig.isWAAIEnabled) continue;

        const phoneNumber = jid.replace("@s.whatsapp.net", "");
        const user = await getUserByWhatsappNumber(phoneNumber);
        if (!user) continue;

        const reply = await askAI(trimmedText, "whatsapp");
        await sock.sendMessage(jid, { text: reply });
      }
    } catch (error) {
      console.error("Error processing incoming whatsapp message:", error);
    }
  });
};

connectToWhatsApp();

export { sock as client };
export { whatsappEmitter };