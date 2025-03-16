# Send Sticker to WhatsApp Bot

Bot ini digunakan untuk mengirim stiker ke WhatsApp menggunakan whatsapp-web.js.

## 🚀 Cara Menjalankan di Lokal

### 1. Clone Repository

```sh
git clone https://github.com/rikkriuk/send-sticker-to-whatsapp-bot.git
cd send-sticker-to-whatsapp-bot
```

### 2. Download `ffmpeg` di Root Directory

Bot ini memerlukan `ffmpeg` untuk konversi media (jika diperlukan untuk fitur tambahan). Pastikan Anda telah mengunduh dan meletakkannya di direktori proyek.

#### Install `ffmpeg` (Linux/MacOS)

```sh
sudo apt update && sudo apt install ffmpeg -y  # Debian/Ubuntu
brew install ffmpeg  # macOS (Homebrew)
```

#### Install `ffmpeg` (Windows)

1. Unduh `ffmpeg` dari [situs resmi](https://ffmpeg.org/download.html).
2. Ekstrak dan tambahkan path `bin` ke Environment Variables.

### 3. Install Dependencies

```sh
npm install
```

### 4. Jalankan Bot

#### Untuk Pengembangan (Lokal)

```sh
npm run dev
```

#### Untuk Production

```sh
npm run start:build
```

Bot akan mulai berjalan, dan Anda perlu memindai kode QR yang muncul di terminal dengan WhatsApp Web untuk menghubungkan bot ke akun WhatsApp Anda.

---
