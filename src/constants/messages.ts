const messages = {
   hi: "Hallo, ",
   process: "_Mengirim stiker..._",
   pending: "_Harap tunggu! Anda sedang mengirim stiker._",
   success: "_Stiker berhasil dikirim!_",
   failed: "_Stiker gagal dikirim!_",
   downloadFailed: "_Gagal mengunduh file_",
   about:
     "_Bot ini dirancang untuk memungkinkan pengguna mengirim stiker dari Telegram ke WhatsApp dengan mudah. \n\n/start - Mulai bot \n/help - Tentang bot \n/guide - Panduan bot\n/profile - informasi pengguna \n \n\nDeveloper: @rikkriuk_",
   whatsAppInfo: `_Bot belum menemukan nomor WhatsApp kamu, silahkan masukkan nomor WhatsApp! \n\nContoh: 085722710523
    _`,
   invalidNumber:
     "_Nomor tidak valid, silahkan masukkan nomor yang benar! \n\nContoh: 085722710523_",
   validNumber: "_Nomor tersimpan📝 \nSilahkan kirim stiker!_",
   inValidNumber: "_Nomor WhatsApp tidak valid._",
   existedNumber: "_Silahkan kirim stiker!\n\nJika ingin memperbaharui nomor WhatsApp, cukup ketika nomornya. contoh formatnya seperti ini: 081234567890_",
   inValidTextFormat: "_Harap kirimkan pesan dalam format teks._",
   chatNotFound: "_Chat tidak tersedia._",
   help: "_Halo! Ada yang bisa saya bantu?_",
   stickerLimit: "_Pengiriman stiker hari ini mencapai batas, kembali lagi besok!_",
   userNotFound: "_User tidak ditemukan_",
   updateLimit: "_Limit berhasil ditambah (10+)_",
   invalidUpdateLimitFormat: "_Masukan format yang benar \nContoh: /limit ID-NUMBER_",
   isWhatsappReady: "_Whatsapp belum diinisialisasi, mohon tunggu beberapa detik!_",
   inValidCommand: "_Command tidak dikenali \n/help_",
   guide: "_Panduan Penggunaan Bot:\n\n" +
   "1. Klik /start untuk memulai.\n" +
   "2. Setelah itu, masukkan nomor WhatsApp yang valid, contoh formatnya seperti ini: 081234567890\n" +
   "3. Setelah nomor terverifikasi, kirimkan stiker untuk melanjutkan proses.\n\n_" +
   "_Catatan: Setiap pengguna memiliki batas untuk mengirimkan stiker per-hari, kamu bisa melihat informasinya di /profile.\n\n_" +
   "_Jika ada masalah atau pertanyaan, kamu bisa ketik /help atau chat @rikkriuk untuk bantuan lebih lanjut._"
} as const;
 
export default messages;
 