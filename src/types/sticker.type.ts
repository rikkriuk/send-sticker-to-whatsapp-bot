import { IUser } from "./userModel.type";

export type StickerData = {
   filePath: string;
   mimeType: string;
   user: IUser;
}