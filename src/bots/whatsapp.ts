import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import whatsappEmitter from "../events/eventEmitter";
import { Boom } from "@hapi/boom";

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
};

connectToWhatsApp();

export { sock as client };
export { whatsappEmitter };