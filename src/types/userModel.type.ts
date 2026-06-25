import mongoose from "mongoose";

export type UserRole = "admin" | "user";

export interface IUser extends Document {
  _id?: mongoose.Types.ObjectId,
  telegramId: number;
  name: string;
  userName?: string;
  whatsappNumber?: string;
  stickerLimit: number;
  isProcessing: boolean;
  role: UserRole;
  isPremium: boolean;
  stickerLimitResetAt?: Date;
  premiumExpiredAt: Date | null;
  isBlocked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}