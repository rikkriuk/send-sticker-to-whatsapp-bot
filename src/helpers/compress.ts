import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

const MAX_ASSET_SIZE = 900 * 1024;

const targetSizes = [
   { q: 50, fps: 15 },
   { q: 30, fps: 12 },
   { q: 20, fps: 10 },
   { q: 10, fps: 8 },
];

const convertToWebp = async (input: string, frameRate: number, output: string): Promise<void> => {
   let startIndex = 0;

   if (!input.includes('%')) {
      const inputSize = fs.statSync(input).size;
      if (inputSize > 5 * 1024 * 1024) startIndex = 2;
      else if (inputSize > 2 * 1024 * 1024) startIndex = 1;
   }

   const sizes = targetSizes.slice(startIndex);

   for (const { q, fps } of sizes) {
      const options = [
         "-vcodec", "libwebp_anim",
         "-vf", `scale=512:512:force_original_aspect_ratio=decrease,fps=${fps}`,
         "-loop", "0",
         "-preset", "default",
         "-compression_level", "6",
         "-q:v", `${q}`,
         "-an", "-vsync", "0",
         "-t", "00:00:06",
      ];

      await new Promise<void>((resolve, reject) => {
         ffmpeg()
            .input(input)
            .inputFPS(frameRate)
            .outputOptions(options)
            .output(output)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
      });

      const size = fs.statSync(output).size;
      console.log(`WebP size q=${q} fps=${fps}: ${size} bytes`);
      if (size <= MAX_ASSET_SIZE) break;
   }
};

export {
   convertToWebp,
}