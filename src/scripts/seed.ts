import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
dotenv.config();

const seed = async () => {
   await mongoose.connect(process.env.MONGO_URI as string);
   console.log("✅ Connected to MongoDB");

   const telegramId = Number(process.env.ADMIN_TELEGRAM_ID);
   const name = process.env.ADMIN_NAME as string;
   const userName = process.env.ADMIN_USERNAME as string;
   const whatsappNumber = process.env.ADMIN_WHATSAPP as string;

   if (!telegramId || !name) {
      console.error("❌ ADMIN_TELEGRAM_ID dan ADMIN_NAME wajib diisi di .env");
      process.exit(1);
   }

   const existing = await User.findOne({ telegramId });
   if (existing) {
      await User.findOneAndUpdate(
         { telegramId },
         {
         $set: {
            name,
            userName,
            whatsappNumber,
            role: "admin",
            stickerLimit: 999,
         },
         }
      );
      console.log("✅ Admin berhasil diupdate!");
      await mongoose.disconnect();
      return;
   }

   await User.create({
      telegramId,
      name,
      userName,
      whatsappNumber,
      role: "admin",
      stickerLimit: 999,
      isProcessing: false,
   });

   console.log("✅ Admin berhasil dibuat!");
   await mongoose.disconnect();
};

seed().catch(console.error);