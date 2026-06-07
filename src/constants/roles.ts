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
];

export const ADMIN_COMMANDS = [
   ...USER_COMMANDS,
   { 
      command: "broadcast",
      description: "📢 Kirim pesan ke semua user" 
   },
   { 
      command: "limit", 
      description: "⚡ Tambah limit user" 
   },
   { 
      command: "list",    
      description: "📋 Daftar pengguna" 
   },
   { 
      command: "premium", 
      description: "⭐ Set premium user" 
   },
   { 
      command: "delete",  
      description: "🗑️ Hapus user" 
   },
   { 
      command: "block",
      description: "🚫 Blokir/Unblokir user" 
   },
];

export const ROLES = {
   ADMIN: "admin",
   USER: "user",
}