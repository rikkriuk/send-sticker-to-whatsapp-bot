import { REFERRAL_STICKER_LIMIT_BONUS } from "./businessConfig";

export const ADMIN_TELEGRAM_USERNAME = process.env.ADMIN_USERNAME || "rikkriuk";
export const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
export const ADMIN_TELEGRAM_ID = parseInt(process.env.ADMIN_TELEGRAM_ID || "");
export const isSuperAdmin = (telegramId?: number) =>
   Number.isFinite(ADMIN_TELEGRAM_ID) && telegramId === ADMIN_TELEGRAM_ID;

export const USER_COMMANDS = [
   { 
      command: "start",
      description: "🚀 Mulai bot" 
   },
   { 
      command: "profile",
      description: "👤 Lihat profil" 
   },
   {
      command: "invite",
      description: `🎁 Referral: +${REFERRAL_STICKER_LIMIT_BONUS} limit`
   },
   {
      command: "leaderboard",
      description: "🏆 Top referral"
   },
   {
      command: "review",
      description: "⭐ Kasih ulasan bot"
   },
   {
      command: "premium",
      description: "⭐ Status & manfaat Premium"
   },
   {
      command: "list_review",
      description: "📜 Lihat ulasan"
   },
];

export const PREMIUM_COMMANDS = [
   ...USER_COMMANDS,
   {
      command: "numbers",
      description: "📱 Atur nomor WhatsApp"
   },
   {
      command: "stickername",
      description: "🏷️ Atur nama pembuat stiker"
   },
];

export const ADMIN_COMMANDS = [
   ...PREMIUM_COMMANDS,
   { 
      command: "broadcast",
      description: "📢 Kirim pesan ke semua pengguna" 
   },
   { 
      command: "limit", 
      description: "⚡ Tambah limit pengguna" 
   },
   { 
      command: "list",    
      description: "📋 Daftar pengguna" 
   },
   {
      command: "setpremium",
      description: "⭐ Set premium pengguna" 
   },
   { 
      command: "delete",  
      description: "🗑️ Hapus pengguna" 
   },
   {
      command: "block",
      description: "🚫 Blokir/Unblokir pengguna"
   },
   {
      command: "ai",
      description: "🤖 Pengaturan AI asisten",
   },
];

export const SUPER_ADMIN_COMMANDS = [
   ...ADMIN_COMMANDS.filter(({ command }) =>
      command !== "numbers" && command !== "stickername"
   ),
   ...PREMIUM_COMMANDS.slice(USER_COMMANDS.length),
   {
      command: "setqris",
      description: "🧾 Simpan gambar QRIS bisnis"
   },
   {
      command: "deleteqris",
      description: "🗑️ Hapus gambar QRIS bisnis"
   },
];

export const ROLES = {
   ADMIN: "admin",
   USER: "user",
}