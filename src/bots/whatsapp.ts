import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import whatsappEmitter from "../events/eventEmitter";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--single-process"],
  },
});

client.on("ready", () => {
  console.log("Client is ready!");
  whatsappEmitter.emit("whatsappReady");
});

client.on("qr", (qr: string) => {
  qrcode.generate(qr, { small: true });
});

client.initialize();

export { client, whatsappEmitter };
