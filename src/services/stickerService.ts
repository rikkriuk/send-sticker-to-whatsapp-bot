import axios from "axios";
import fs from "fs";
import { sendStickerToWhatsApp } from "../helpers/whatsappHelper";
import { deleteFile } from "../helpers/fileHelper";
const tgs2 = require("tgs2");

interface MediaData {
  user: string;
  fileUrl: string;
  fileName: string;
  downloadPath: string;
}

export const downloadFile = async (mediaData: MediaData, ctx: any) => {
  await ctx.reply("_Proses 1 berhasil✅_", { parse_mode: "Markdown" });
  const dataType = mediaData.fileUrl.split(".");

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
};

export const downloadTgsFile = async (mediaData: MediaData, ctx: any) => {
  await ctx.reply("_Proses 2 berhasil✅_", { parse_mode: "Markdown" });

  const { user, fileUrl, downloadPath } = mediaData;
  const fileName = fileUrl.split("/").pop()?.split(".")[0];

  await tgs2.url2Gif(fileUrl, {
    lottie_config: { format: "mp4" },
    exportPath: downloadPath,
  });

  const filePath = `${downloadPath}/${fileName}.mp4`;
  await sendStickerToWhatsApp(filePath, "video/mp4", user, ctx);
  deleteFile(filePath);
};

export const downloadWebpWebmFile = async (
  mediaData: MediaData,
  ctx: any,
  options: { fileType: string; mimeType: string }
) => {
  await ctx.reply("_Proses 2 berhasil✅_", { parse_mode: "Markdown" });

  const { user, fileUrl, fileName, downloadPath } = mediaData;
  const { fileType, mimeType } = options;
  const filePath = `${downloadPath}/${fileName}.${fileType}`;

  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  writer.on("finish", async () => {
    await sendStickerToWhatsApp(filePath, mimeType, user, ctx);
    deleteFile(filePath);
  });

  return new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};
