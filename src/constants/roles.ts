export const ADMIN_TELEGRAM_USERNAME = process.env.ADMIN_USERNAME || "rikkriuk";
export const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
export const ADMIN_TELEGRAM_ID = parseInt(process.env.ADMIN_TELEGRAM_ID || "");

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
      description: "🎁 Dapatkan 15+ limit gratis"
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
      command: "list_review",
      description: "📜 Lihat semua ulasan"
   },
];

export const ADMIN_COMMANDS = [
   ...USER_COMMANDS,
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
      command: "premium", 
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

export const ROLES = {
   ADMIN: "admin",
   USER: "user",
}