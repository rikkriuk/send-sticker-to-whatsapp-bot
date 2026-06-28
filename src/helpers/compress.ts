import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { animatedProcessingQueue, staticProcessingQueue } from "./queque";

const MAX_ASSET_SIZE = 900 * 1024;

const animatedSizes = [
   { q: 50, fps: 15 },
   { q: 30, fps: 12 },
   { q: 10, fps: 8 },
];

const staticSizes = [
   { q: 80 },
   { q: 50 },
   { q: 20 },
];

const convertToWebp = async (input: string, frameRate: number, output: string, animated = false): Promise<void> => {
   const queue = animated ? animatedProcessingQueue : staticProcessingQueue;

   await queue.add(async () => {
      if (animated) {
         let startIndex = 0;
         if (!input.includes('%')) {
            const inputSize = fs.statSync(input).size;
            if (inputSize > 5 * 1024 * 1024) startIndex = 2;
            else if (inputSize > 2 * 1024 * 1024) startIndex = 1;
         }

         for (const { q, fps } of animatedSizes.slice(startIndex)) {
            const options = [
               "-vcodec", "libwebp_anim",
               "-vf", `scale=512:512:force_original_aspect_ratio=decrease,fps=${fps}`,
               "-loop", "0",
               "-preset", "default",
               "-compression_level", "6",
               "-q:v", `${q}`,
               "-an",
               "-t", "00:00:06",
            ];

            await runFfmpeg(input, frameRate, output, options);

            const size = fs.statSync(output).size;
            console.log(`[animated] WebP size q=${q} fps=${fps}: ${size} bytes`);
            if (size <= MAX_ASSET_SIZE) break;
         }
      } else {
         // Static WebP: gunakan libwebp, bukan libwebp_anim
         for (const { q } of staticSizes) {
            const options = [
               "-vcodec", "libwebp",
               "-vf", "scale=512:512:force_original_aspect_ratio=decrease",
               "-compression_level", "6",
               "-q:v", `${q}`,
               "-an",
            ];

            await runFfmpeg(input, 0, output, options);

            const size = fs.statSync(output).size;
            console.log(`[static] WebP size q=${q}: ${size} bytes`);
            if (size <= MAX_ASSET_SIZE) break;
         }
      }
   });
};

const runFfmpeg = (input: string, frameRate: number, output: string, options: string[]): Promise<void> => {
   return new Promise<void>((resolve, reject) => {
      let stderr = "";
      const cmd = ffmpeg().input(input);
      if (frameRate > 0) cmd.inputFPS(frameRate);
      cmd
         .outputOptions(options)
         .output(output)
         .on("stderr", (line: string) => { stderr += line + "\n"; })
         .on("end", () => resolve())
         .on("error", (err: Error) => {
            console.error(`[ffmpeg stderr]\n${stderr}`);
            reject(err);
         })
         .run();
   });
};

export {
   convertToWebp,
}