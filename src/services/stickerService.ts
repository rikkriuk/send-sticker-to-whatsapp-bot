import axios from "axios";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { sendStickerToWhatsApp } from "../helpers/whatsappHelper";
import { deleteFile } from "../helpers/fileHelper";
import messages from "../constants/messages";
import { MediaData } from "../types/media.type";
import { execSync } from "child_process";
import path from "path";
import { getUserQueue } from "../helpers/queque";
import { compressWebp } from "../helpers/compress";

const convertToAnimatedWebp = (inputPath: string, outputPath: string): Promise<void> => {
   return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
         .outputOptions([
            "-vcodec", "libwebp_anim",
            "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
            "-loop", "0",
            "-preset", "default",
            "-compression_level", "6",
            "-q:v", "50",
            "-an",
            "-vsync", "0",
            "-t", "00:00:06",
         ])
         .output(outputPath)
         .on("end", () => resolve())
         .on("error", reject)
         .run();
   });
};

export const downloadFile = async (mediaData: MediaData, ctx: any) => {
   const queue = getUserQueue(mediaData.user.telegramId);
   return queue.add(async () => {
      const dataType = mediaData.fileUrl.split(".");
      try {
         if (dataType[dataType.length - 1] === "tgs") {
            await downloadTgsFile(mediaData, ctx);
         } else if (dataType[dataType.length - 1] === "webm") {
            await downloadWebmFile(mediaData, ctx);
         } else {
            await downloadWebpWebmFile(mediaData, ctx, { fileType: "webp", mimeType: "image/webp" });
         }
      } catch (error) {
         await ctx.reply(messages.downloadFailed, { parse_mode: "Markdown" });
         console.log("Gagal mengunduh file", error);
         throw error;
      }
   });
};

export const downloadTgsFile = async (mediaData: MediaData, ctx: any) => {
   const { user, fileUrl, fileName, downloadPath } = mediaData;
   const tgsPath = `${downloadPath}/${fileName}.tgs`;
   const webpPath = `${downloadPath}/${fileName}.webp`;
   const framesDir = `${downloadPath}/${fileName}_frames`;

   try {
      const writer = fs.createWriteStream(tgsPath);
      const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
      response.data.pipe(writer);
      await new Promise<void>((resolve, reject) => {
         writer.on("finish", resolve);
         writer.on("error", reject);
      });

      fs.mkdirSync(framesDir, { recursive: true });

      const scriptPath = path.join(__dirname, "../../src/scripts/tgs2frames.py");
      const result = execSync(`python3 ${scriptPath} ${tgsPath} ${framesDir}`).toString().trim();
      
      const [, , frStr] = result.split(":");
      const frameRate = parseFloat(frStr) || 60;

      await new Promise<void>((resolve, reject) => {
         ffmpeg()
            .input(`${framesDir}/frame_%04d.png`)
            .inputFPS(frameRate)
            .outputOptions([
               "-vcodec", "libwebp_anim",
               "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
               "-loop", "0",
               "-preset", "default",
               "-compression_level", "6",
               "-q:v", "50",
               "-an",
               "-vsync", "0",
               "-t", "00:00:06",
            ])
            .output(webpPath)
            .on("end", () => resolve())
            .on("error", reject)
            .run();
      });

      const stats = fs.statSync(webpPath);
      console.log("WebP size:", stats.size, "bytes");

      await compressWebp(webpPath);
      await sendStickerToWhatsApp({ filePath: webpPath, mimeType: "image/webp", user }, ctx);

   } catch (error) {
      console.log("Gagal proses tgs file", error);
      throw error;
   } finally {
      deleteFile(tgsPath);
      deleteFile(webpPath);
      try { fs.rmSync(framesDir, { recursive: true }); } catch(_) {}
   }
};

export const downloadWebmFile = async (mediaData: MediaData, ctx: any) => {
   const { user, fileUrl, fileName, downloadPath } = mediaData;
   const webmPath = `${downloadPath}/${fileName}.webm`;
   const webpPath = `${downloadPath}/${fileName}.webp`;

   try {
      const writer = fs.createWriteStream(webmPath);
      const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
         writer.on("finish", resolve);
         writer.on("error", reject);
      });

      const fileSize = fs.statSync(webmPath).size;
      if (fileSize === 0) {
         throw new Error("Downloaded WebM file is empty");
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      await convertToAnimatedWebp(webmPath, webpPath);
      const stats = fs.statSync(webpPath);
      console.log("WebP size:", stats.size, "bytes");

      await compressWebp(webpPath);
      await sendStickerToWhatsApp({ filePath: webpPath, mimeType: "image/webp", user }, ctx);

      deleteFile(webmPath);
      deleteFile(webpPath);
   } catch (error) {
      console.log("Gagal proses webm file", error);
      throw error;
   }
};

export const downloadWebpWebmFile = async (
  mediaData: MediaData,
  ctx: any,
  options: { fileType: string; mimeType: string }
) => {
   const { user, fileUrl, fileName, downloadPath } = mediaData;
   const { fileType, mimeType } = options;
   const filePath = `${downloadPath}/${fileName}.${fileType}`;

   try {
      const writer = fs.createWriteStream(filePath);
      const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
         writer.on("finish", resolve);
         writer.on("error", reject);
      });

      if (fileType === "webp") {
         await compressWebp(filePath);
      }
      await sendStickerToWhatsApp({ filePath, mimeType, user }, ctx);
      deleteFile(filePath);
   } catch (error) {
      console.log("Gagal proses webp/webm file", error);
      throw error;
   }
};