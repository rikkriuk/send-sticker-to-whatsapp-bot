import mongoose from "mongoose";
import { User } from "../models/User";
import { UserChat } from "../types/userChat";

export const saveOrUpateUser = async (chat: UserChat) => {
   try {
      const { id, first_name, username, type } = chat;
      let user = await User.findOne({ telegramId: id });

      if (!user) {
         user = new User({
            telegramId: id,
            name: first_name,
            username: username || "",
         })
      } else {
         user.name = first_name;
         user.username = username || "";
      }

      await user.save();
      return user;
   } catch (error) {
      console.error("Error saat memperbaharui data user:", error);
      throw error;
   }
}

export const savePhoneNumber = async (number: string, telegramId: number) => {
   try {
      let user = await User.findOne({ telegramId });
      if (user) {
         user.whatsappNumber = number;
         await user.save();
      } 

      return user?.whatsappNumber;
   } catch (error) {
      console.error("Error saat memperbaharui data user:", error);
      throw error;
   }
}

export const getUser = async (telegramId: number | undefined) => {
   try {
      if (telegramId) {
         return await User.findOne({ telegramId });
      }
   } catch (error) {
      console.error("Error saat mengambil data user:", error);
      throw error;
   }
}

export const resetStickerLimitIfNeeded = async (user: any) => {
   const now = Date.now();
   const lastUpdated = new Date(user.updatedAt).getTime();
   const oneDay = 24 * 60 * 60 * 1000;

   if (now - lastUpdated >= oneDay) {
      await User.findByIdAndUpdate(user._id, { 
         stickerLimit: 10, 
         updatedAt: new Date(),
      });
      user.stickerLimit = 10;
   }
};

export const setUserProcessing = async (userId: mongoose.Types.ObjectId) => {
   return await User.findOneAndUpdate(
      { _id: userId, isProcessing: false },
      { isProcessing: true }, 
      { new: true }
   );
};

export const resetUserProcessing = async (userId: mongoose.Types.ObjectId) => {
   await User.findByIdAndUpdate(userId, { isProcessing: false });
};

export const decrementStickerLimit = async (userId: mongoose.Types.ObjectId, role: string) => {
   if (role === "admin") {
      await User.findByIdAndUpdate(userId, {
         $set: { updatedAt: new Date(), isProcessing: false }
      });
   } else {
      await User.findByIdAndUpdate(userId, {
         $inc: { stickerLimit: -1 },
         $set: { updatedAt: new Date(), isProcessing: false }
      });
   }
};

export const updateLimit = async (telegramId: number | undefined) => {
   if (telegramId) {
      const user = await User.findOneAndUpdate(
         { telegramId: telegramId },
         { $set: { stickerLimit: 10 } },
         { new: true }
      )
   
      return user;
   }
}

export const getUsersWithPagination = async (page: number, limit: number) => {
   const skip = (page - 1) * limit;
   const users = await User.find()
     .skip(skip)
     .limit(limit);
 
   return users;
};

export const getTotalPages = async (limit: number) => {
   const count = await User.countDocuments();
   return Math.ceil(count / limit);
};