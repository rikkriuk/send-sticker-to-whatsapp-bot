const messages = {
   hi: "Hallo, ",
   process: "_Mengirim stiker..._",
   success: "_Stiker berhasil dikirim!_",
   failed: "_Stiker gagal dikirim!_",
   downloadFailed: "_Gagal mengunduh file_",
   about:
     "_Bot ini dirancang untuk memungkinkan pengguna mengirim stiker dari Telegram ke WhatsApp dengan mudah. \n\nDeveloper: @rikkriuk_",
   whatsAppInfo: `_Bot belum menemukan nomor WhatsApp kamu, silahkan masukkan nomor WhatsApp! \n\nContoh: 085722710523
    _`,
   invalidNumber:
     "_Nomor tidak valid, silahkan masukkan nomor yang benar! \n\nContoh: 085722710523_",
   validNumber: "_Nomor tersimpan📝 \nSilahkan kirim stiker!_",
   inValidNumber: "_Nomor WhatsApp tidak valid._",
   inValidTextFormat: "_Harap kirimkan pesan dalam format teks._",
   chatNotFound: "_Chat tidak tersedia._",
   help: "_Halo! Ada yang bisa saya bantu?_",
   stickerLimit:
     "_Pengiriman stiker kamu telah mencapai batas, mohon tunggu beberapa menit!_",
} as const;
 
export default messages;
 