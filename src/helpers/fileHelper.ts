import axios from "axios";
import fs from "fs";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const getFileUrl = async (fileId: string) => {
   const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
   try {
     const response = await axios.get(url);
     const filePath = response.data.result.file_path;
     return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
   } catch (error) {
     console.log("Gagal mendapatkan file url", error);
     throw error;
   }
};

export const deleteFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`File ${filePath} dihapus.`);
  }
};
