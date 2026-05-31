import { Sticker, StickerTypes } from "wa-sticker-formatter";

export const addStickerMetadata = async (
   buffer: Buffer,
   packname: string,
   author: string
): Promise<Buffer> => {
   const sticker = new Sticker(buffer, {
      pack: packname,
      author: author,
      type: StickerTypes.FULL,
      quality: 100,
   });

   return await sticker.toBuffer();
};