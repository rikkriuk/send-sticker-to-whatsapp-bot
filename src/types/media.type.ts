import { IUser } from "./userModel.type";

export type MediaData = {
   user: IUser;
   fileUrl: string;
   fileName: string;
   downloadPath: string;
}