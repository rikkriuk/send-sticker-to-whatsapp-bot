import axios from "axios";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { sendStickerToWhatsApp } from "../helpers/whatsappHelper";
import { deleteFile } from "../helpers/fileHelper";
import messages from "../constants/messages";
import { MediaData } from "../types/media.type";
import { createCanvas } from "canvas";
import zlib from "zlib";

const lottie = require("lottie-node");

const convertToAnimatedWebp = (inputPath: string, outputPath: string): Promise<void> => {
   return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
         .outputOptions([
            "-vcodec", "libwebp_anim",
            "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
            "-loop", "0",
            "-preset", "default",
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
};

export const downloadTgsFile = async (mediaData: MediaData, ctx: any) => {
   const { user, fileUrl, fileName, downloadPath } = mediaData;
   const tgsPath = `${downloadPath}/${fileName}.tgs`;
   const webpPath = `${downloadPath}/${fileName}.webp`;

   try {
      const writer = fs.createWriteStream(tgsPath);
      const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
      response.data.pipe(writer);
      await new Promise<void>((resolve, reject) => {
         writer.on("finish", resolve);
         writer.on("error", reject);
      });

      const tgsBuffer = fs.readFileSync(tgsPath);
      const lottieJson = JSON.parse(
         zlib.gunzipSync(tgsBuffer).toString("utf-8")
      );

      const width = 512, height = 512;
      const canvas = createCanvas(width, height);
      const anim = lottie.factory({
         animationData: lottieJson,
         renderer: "canvas",
         rendererSettings: { context: canvas.getContext("2d") },
      });

      const totalFrames = anim.totalFrames;
      const framePaths: string[] = [];

      for (let i = 0; i < totalFrames; i++) {
         anim.goToAndStop(i, true);
         const framePath = `${downloadPath}/${fileName}_frame_${String(i).padStart(4, "0")}.png`;
         const buffer = (canvas as any).toBuffer("image/png");
         fs.writeFileSync(framePath, buffer);
         framePaths.push(framePath);
      }

      await new Promise<void>((resolve, reject) => {
         ffmpeg()
            .input(`${downloadPath}/${fileName}_frame_%04d.png`)
            .inputFPS(lottieJson.fr ?? 30)
            .outputOptions([
               "-vcodec", "libwebp_anim",
               "-vf", "scale=512:512:force_original_aspect_ratio=decrease",
               "-loop", "0",
               "-preset", "default",
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

      await sendStickerToWhatsApp({ filePath: webpPath, mimeType: "image/webp", user }, ctx);

   } catch (error) {
      console.log("Gagal proses tgs file", error);
      throw error;
   } finally {
      deleteFile(tgsPath);
      deleteFile(webpPath);
      const frames = fs.readdirSync(downloadPath).filter(f => f.startsWith(`${fileName}_frame_`));
      frames.forEach(f => deleteFile(`${downloadPath}/${f}`));
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

      await convertToAnimatedWebp(webmPath, webpPath);
      const stats = fs.statSync(webpPath);
      console.log("WebP size:", stats.size, "bytes");

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

      await sendStickerToWhatsApp({ filePath, mimeType, user }, ctx);
      deleteFile(filePath);
   } catch (error) {
      console.log("Gagal proses webp/webm file", error);
      throw error;
   }
};