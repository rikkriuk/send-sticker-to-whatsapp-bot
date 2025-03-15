import mongoose from "mongoose";

export type UserRole = "admin" | "user";

export interface IUser extends Document {
  _id?: mongoose.Types.ObjectId,
  telegramId: number;
  name: string;
  username?: string;
  whatsappNumber?: string;
  stickerLimit: number;
  isProcessing: boolean;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}