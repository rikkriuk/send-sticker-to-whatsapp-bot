import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

const MAX_SIZE_BYTES = 500 * 1024;

const compressWebp = async (webpPath: string): Promise<void> => {
   const stats = fs.statSync(webpPath);
   if (stats.size <= MAX_SIZE_BYTES) return;

   const qualities = [40, 30, 20, 10];
   for (const q of qualities) {
      const tmpPath = `${webpPath}.tmp.webp`;
      await new Promise<void>((resolve, reject) => {
         ffmpeg(webpPath)
            .outputOptions([
               "-vcodec", "libwebp_anim",
               "-loop", "0",
               "-preset", "default",
               "-compression_level", "6",
               "-q:v", `${q}`,
               "-an",
            ])
            .output(tmpPath)
            .on("end", () => resolve())
            .on("error", reject)
            .run();
      });

      const newSize = fs.statSync(tmpPath).size;
      fs.renameSync(tmpPath, webpPath);
      console.log(`Compressed to q=${q}: ${newSize} bytes`);

      if (newSize <= MAX_SIZE_BYTES) break;
   }
};

export {
   compressWebp,
}