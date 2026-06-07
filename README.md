# Send Sticker to WhatsApp Bot

Bot untuk mengirim stiker Telegram ke WhatsApp secara otomatis.

## 📋 Requirements

- Node.js >= 18
- Python3 & pip3
- ffmpeg

## 🚀 Cara Menjalankan di Lokal

### 1. Clone Repository

```sh
git clone https://github.com/rikkriuk/send-sticker-to-whatsapp-bot.git
cd send-sticker-to-whatsapp-bot
```

### 2. Install ffmpeg

#### Linux/Ubuntu
```sh
sudo apt update && sudo apt install ffmpeg -y
```

#### macOS
```sh
brew install ffmpeg
```

#### Windows
1. Download dari [ffmpeg.org](https://ffmpeg.org/download.html)
2. Ekstrak dan tambahkan folder `bin` ke Environment Variables

### 3. Install Dependencies

#### Linux/macOS
```sh
chmod +x install.sh && ./install.sh
```

#### Windows
```bat
install.bat
```

Script ini akan otomatis menginstall:
- Node.js dependencies (`npm install`)
- Python dependencies (`lottie`, `cairosvg`, `Pillow`, `rembg`)
- Build project (`npm run build`)

### 4. Setup Environment

```sh
cp .env.example .env
```

Isi file `.env` dengan konfigurasi yang diperlukan.

### 5. Jalankan Bot

#### Development
```sh
npm run dev
```

#### Production
```sh
npm run start:build
```

Scan QR code yang muncul di terminal dengan WhatsApp untuk menghubungkan bot.

---

## ⚠️ Notes

- Pertama kali menjalankan, `rembg` akan mendownload model AI (~100MB)
- Stiker animasi (TGS) dikonversi via Python secara lokal tanpa API eksternal
- Pastikan koneksi WhatsApp stabil sebelum mengirim banyak stiker