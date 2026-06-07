import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { spawn } from "child_process";
import path from "path";

export const addStickerMetadata = async (
   buffer: Buffer,
   packname: string,
   author: string
): Promise<Buffer> => {
   const qualities = [50, 30, 20, 10];
   const MAX_SIZE = 900 * 1024;

   for (const quality of qualities) {
      const sticker = new Sticker(buffer, {
         pack: packname,
         author: author,
         type: StickerTypes.FULL,
         quality,
      });

      const result = await sticker.toBuffer();
      console.log(`Sticker size quality=${quality}: ${result.length} bytes`);
      
      if (result.length <= MAX_SIZE) return result;
   }

   const sticker = new Sticker(buffer, {
      pack: packname,
      author: author,
      type: StickerTypes.FULL,
      quality: 10,
   });
   return await sticker.toBuffer();
};

export const makeBackgroundTransparent = async (
   buffer: Buffer,
): Promise<Buffer> => {
   return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, "../scripts/remove_bg.py");
      const proc = spawn("python3", [scriptPath]);

      const chunks: Buffer[] = [];
      const errorChunks: Buffer[] = [];

      proc.on("spawn", () => console.log("rembg process started"));
      proc.on("error", (err) => console.error("spawn error:", err));
      proc.on("close", (code) => console.log("rembg closed with code:", code));

      proc.stdout.on("data", (chunk) => chunks.push(chunk));
      proc.stderr.on("data", (err) => {
         errorChunks.push(err);
         console.error("rembg error:", err.toString());
      });
      proc.on("close", (code) => {
         if (code === 0) {
            resolve(Buffer.concat(chunks));
         } else {
            const errorMsg = Buffer.concat(errorChunks).toString();
            reject(new Error(`rembg exited with code ${code}: ${errorMsg}`));
         }
      });

      proc.stdin.write(buffer);
      proc.stdin.end();
   });
};