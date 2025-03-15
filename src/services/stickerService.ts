import axios from "axios";
import fs from "fs";
import { sendStickerToWhatsApp } from "../helpers/whatsappHelper";
import { deleteFile } from "../helpers/fileHelper";
import messages from "../constants/messages";
import { MediaData } from "../types/media.type";
const tgs2 = require("tgs2");

export const downloadFile = async (mediaData: MediaData, ctx: any) => {
   const dataType = mediaData.fileUrl.split(".");
   try {
      if (dataType[dataType.length - 1] === "tgs") {
         await downloadTgsFile(mediaData, ctx);
      } else if (dataType[dataType.length - 1] === "webm") {
         await downloadWebpWebmFile(mediaData, ctx, {
            fileType: "webm",
            mimeType: "video/webm",
         });
      } else {
         await downloadWebpWebmFile(mediaData, ctx, {
            fileType: "webp",
            mimeType: "image/jpeg",
         });
      }
   } catch (error) {
      await ctx.reply(messages.downloadFailed, { parse_mode: "Markdown" });
      console.log("Gagal mengunduh file", error);
      throw error;
   }
};

export const downloadTgsFile = async (mediaData: MediaData, ctx: any) => {
   const { user, fileUrl, downloadPath } = mediaData;
   const fileName = fileUrl.split("/").pop()?.split(".")[0];

   try {
      await tgs2.url2Gif(fileUrl, {
         lottie_config: { format: "mp4" },
         exportPath: downloadPath,
      });
   
      
      const filePath = `${downloadPath}/${fileName}.mp4`;
      const stickerData = {
            filePath,
            mimeType : "video/mp4",
            user,
         }
      await sendStickerToWhatsApp(stickerData, ctx);
      deleteFile(filePath);
   } catch (error) {
      console.log("Gagal proses tgs file", error);
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
      const response = await axios({
         url: fileUrl,
         method: "GET",
         responseType: "stream",
      });
   
      response.data.pipe(writer);
   
      const stickerData = {
            filePath,
            mimeType,
            user,
      }
   
      writer.on("finish", async () => {
         await sendStickerToWhatsApp(stickerData, ctx);
         deleteFile(filePath);
      });

      return new Promise<void>((resolve, reject) => {
         writer.on("finish", resolve);
         writer.on("error", reject);
      });
   } catch (error) {
      console.log("Gagal proses webp/webm file", error);
      throw error;
   }
};
