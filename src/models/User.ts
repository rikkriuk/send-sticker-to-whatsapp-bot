import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "../types/userModel.type";

const UserSchema: Schema = new Schema(
  {
    telegramId: { 
      type: Number, 
      required: true, 
      unique: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    userName: {
      type: String,
      required: false 
    },
    whatsappNumber: {
      type: String,
      required: false,
    },
    stickerLimit: {
      type: Number,
      default: 10,
    },
    isProcessing: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      required: true,
    },
    isPremium: { 
      type: Boolean, 
      default: false 
    },
    stickerLimitResetAt: {
      type: Date,
      default: null,
    },
    premiumExpiredAt: { 
      type: Date, 
      default: null 
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    isTelegramAIEnabled: {
      type: Boolean,
      default: true,
    },
    isWAAIEnabled: {
      type: Boolean,
      default: true,
    },
    hasReviewed: {
      type: Boolean,
      default: false,
    },
    reviewText: {
      type: String,
      default: "",
    },
    reviewSubmittedAt: {
      type: Date,
      default: null,
    },
    reviewUpdatedAt: {
      type: Date,
      default: null,
    },
    reviewRewardGranted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
