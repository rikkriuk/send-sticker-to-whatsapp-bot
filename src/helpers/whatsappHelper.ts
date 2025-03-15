export const sendStickerToWhatsApp = async (
   filePath: string,
   mimeType: string,
   user: string,
   ctx: any
) => {
   await ctx.reply("_Mengirim ke WhatsApp... 📩_", { parse_mode: "Markdown" });
   console.log(`Mengirim file ${filePath} ke ${user} dengan mimeType ${mimeType}`);
};
 