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
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
