export const ADMIN_TELEGRAM_USERNAME = process.env.ADMIN_USERNAME || "rikkriuk";
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
      command: "guide",   
      description: "📖 Panduan penggunaan" 
   },
   { 
      command: "help",    
      description: "❓ Bantuan" 
   },
   {
      command: "invite",
      description: "🎁 Dapatkan 15+ limit gratis"
   },
   {
      command: "leaderboard",
      description: "🏆 Top referral"
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
];

export const ROLES = {
   ADMIN: "admin",
   USER: "user",
}