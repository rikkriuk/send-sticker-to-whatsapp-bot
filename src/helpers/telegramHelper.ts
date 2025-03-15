import { Context } from "telegraf";

export const handleStart = (ctx: Context) => {
  ctx.reply("Selamat datang! Kirimkan pesan atau stiker untuk diuji.");
};

export const hears = (ctx: Context) => {
  ctx.reply("Halo! Ada yang bisa saya bantu?");
};

export const handleTextMessage = (ctx: Context) => {
  ctx.reply(`Anda mengirim teks: ${ctx.message}`);
};

export const handleStickerMessage = (ctx: Context) => {
  ctx.reply("Anda mengirim stiker!");
};
