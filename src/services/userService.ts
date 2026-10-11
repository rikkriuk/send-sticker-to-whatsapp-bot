import mongoose from "mongoose";
import { User } from "../models/User";
import { UserChat } from "../types/userChat";
import { IUser } from "../types/userModel.type";
import {
   REFERRALS_PER_PREMIUM,
   REFERRAL_PREMIUM_MONTHS,
   REFERRAL_STICKER_LIMIT_BONUS,
   DEFAULT_DAILY_STICKER_LIMIT,
   REVIEW_STICKER_LIMIT_BONUS,
} from "../constants/businessConfig";
import { isSuperAdmin } from "../constants/roles";

export const getAllUsers = async () => {
   return await User.find({}, { telegramId: 1 });
};

export const saveOrUpateUser = async (chat: UserChat, referredBy?: number) => {
   try {
      const { id, first_name, username } = chat;
      let user = await User.findOne({ telegramId: id });
      let isNewUser = false;
      let referralRewardGranted = false;

      if (!user) {
         isNewUser = true;
         user = new User({
            telegramId: id,
            name: first_name,
            userName: username || "",
         });

      } else {
         user.name = first_name;
         user.userName = username || "";
      }

      await user.save();

      if (isNewUser && referredBy && referredBy !== id) {
         const referrer = await User.findOneAndUpdate(
            { telegramId: referredBy },
            [
               {
                  $set: {
                     stickerLimit: {
                        $add: [
                           { $ifNull: ["$stickerLimit", DEFAULT_DAILY_STICKER_LIMIT] },
                           REFERRAL_STICKER_LIMIT_BONUS,
                        ],
                     },
                     referralCount: { $add: [{ $ifNull: ["$referralCount", 0] }, 1] },
                  },
               },
               {
                  $set: {
                     isPremium: {
                        $cond: [
                           { $eq: [{ $mod: ["$referralCount", REFERRALS_PER_PREMIUM] }, 0] },
                           true,
                           { $ifNull: ["$isPremium", false] },
                        ],
                     },
                     premiumExpiredAt: {
                        $cond: [
                           { $eq: [{ $mod: ["$referralCount", REFERRALS_PER_PREMIUM] }, 0] },
                           {
                              $dateAdd: {
                                 startDate: {
                                    $max: [
                                       { $ifNull: ["$premiumExpiredAt", new Date()] },
                                       new Date(),
                                    ],
                                 },
                                 unit: "month",
                                 amount: REFERRAL_PREMIUM_MONTHS,
                              },
                           },
                           { $ifNull: ["$premiumExpiredAt", null] },
                        ],
                     },
                  },
               },
            ],
            { new: true }
         );
         referralRewardGranted = Boolean(
            referrer && referrer.referralCount % REFERRALS_PER_PREMIUM === 0
         );
      }

      return { user, isNewUser, referralRewardGranted };
   } catch (error) {
      console.error("Error saat memperbaharui data user:", error);
      throw error;
   }
};

export const savePhoneNumber = async (number: string, telegramId: number) => {
   try {
      let user = await User.findOne({ telegramId });
      if (user) {
         const previousNumber = user.whatsappNumber || null;
         user.whatsappNumber = number;
         user.whatsappNumbers = [
            number,
            ...(user.whatsappNumbers || []).filter((savedNumber) => savedNumber !== number),
         ].slice(0, 2);
         await user.save();

         return {
            telegramId: user.telegramId,
            name: user.name,
            userName: user.userName,
            previousNumber,
            newNumber: user.whatsappNumber,
         };
      }

      return null;
   } catch (error) {
      console.error("Error saat memperbaharui data user:", error);
      throw error;
   }
}

export const setWhatsappNumbers = async (telegramId: number, numbers: string[]) => {
   const user = await User.findOne({ telegramId });
   if (!user) return null;

   user.whatsappNumber = numbers[0];
   user.whatsappNumbers = numbers;
   await user.save();
   return user;
};

export const setStickerPackName = async (telegramId: number, packName: string) => {
   return await User.findOneAndUpdate(
      { telegramId },
      { $set: { stickerPackName: packName } },
      { new: true }
   );
};

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
   const lastReset = user.stickerLimitResetAt 
      ? new Date(user.stickerLimitResetAt).getTime()
      : new Date(user.createdAt).getTime();
   const oneDay = 24 * 60 * 60 * 1000;

   if (now - lastReset >= oneDay) {
      await User.findByIdAndUpdate(user._id, { 
         stickerLimit: DEFAULT_DAILY_STICKER_LIMIT,
         stickerLimitResetAt: new Date(),
      });
      user.stickerLimit = DEFAULT_DAILY_STICKER_LIMIT;
      user.stickerLimitResetAt = new Date();
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

export const decrementStickerLimit = async (userId: mongoose.Types.ObjectId, role: string, amount: number = 1) => {
   if (role === "admin") {
      await User.findByIdAndUpdate(userId, {
         $set: { isProcessing: false }
      });
   } else {
      await User.findByIdAndUpdate(userId, {
         $inc: { stickerLimit: -amount },
         $set: { isProcessing: false }
      });
   }
};

export const updateLimit = async (telegramId: number | undefined, amount?: number) => {
   if (telegramId) {
      const user = await User.findOneAndUpdate(
         { telegramId: telegramId },
         { $set: { stickerLimit: amount || DEFAULT_DAILY_STICKER_LIMIT } },
         { new: true }
      )
   
      return user;
   }
}

export const getUsersWithPagination = async (page: number, limit: number, sort: "asc" | "desc" = "desc") => {
   const skip = (page - 1) * limit;
   return await User.find()
      .sort({ createdAt: sort === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limit);
};

export const getTotalUsers = async () => {
   return await User.countDocuments();
};

export const getTotalPages = async (limit: number) => {
   const count = await getTotalUsers();
   return Math.ceil(count / limit);
};

export const blockUser = async (telegramId: number) => {
   return await User.findOneAndUpdate(
      { telegramId },
      { $set: { isBlocked: true } },
      { new: true }
   );
};

export const unblockUser = async (telegramId: number) => {
   return await User.findOneAndUpdate(
      { telegramId },
      { $set: { isBlocked: false } },
      { new: true }
   );
};

export const setPremium = async (telegramId: number, days: number) => {
   const expiredAt = new Date();
   expiredAt.setDate(expiredAt.getDate() + days);
   return await User.findOneAndUpdate(
      { telegramId },
      { $set: { isPremium: true, premiumExpiredAt: expiredAt } },
      { new: true }
   );
};

export const checkAndResetPremium = async (user: IUser) => {
   if (isSuperAdmin(user.telegramId)) return true;

   if (user.isPremium && user.premiumExpiredAt && new Date() > user.premiumExpiredAt) {
      await User.findByIdAndUpdate(user._id, {
         $set: { isPremium: false, premiumExpiredAt: null }
      });
      user.isPremium = false;
      user.premiumExpiredAt = null;
      return false;
   }
   return user.isPremium;
};

export const removePremium = async (telegramId: number) => {
   return await User.findOneAndUpdate(
      { telegramId },
      { $set: { isPremium: false, premiumExpiredAt: null } },
      { new: true }
   );
};

export const deleteUser = async (telegramId: number) => {
   return await User.findOneAndDelete({ telegramId });
};

export const getTopReferrers = async (limit: number = 10) => {
   return await User.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1 })
      .limit(limit)
      .select("name userName telegramId referralCount isPremium");
};

export const getUserByWhatsappNumber = async (whatsappNumber: string) => {
   return await User.findOne({
      $or: [{ whatsappNumber }, { whatsappNumbers: whatsappNumber }],
   });
};

export const getAIConfig = async () => {
   const adminId = parseInt(process.env.ADMIN_TELEGRAM_ID || "");
   if (!adminId) return { isTelegramAIEnabled: true, isWAAIEnabled: true };
   const admin = await User.findOne({ telegramId: adminId });
   return {
      isTelegramAIEnabled: admin?.isTelegramAIEnabled ?? true,
      isWAAIEnabled: admin?.isWAAIEnabled ?? true,
   };
};

export const submitUserReview = async (telegramId: number, text: string) => {
   const user = await User.findOne({ telegramId });
   if (!user) return null;

   const cleaned = text.trim();
   if (!cleaned) return { success: false, reason: "empty" };
   if (user.hasReviewed) {
      return { success: false, reason: "already_reviewed" };
   }

   const updatedUser = await User.findOneAndUpdate(
      { telegramId },
      {
         $set: {
            hasReviewed: true,
            reviewText: cleaned,
            reviewSubmittedAt: new Date(),
            reviewUpdatedAt: new Date(),
            reviewRewardGranted: true,
         },
         $inc: {
            stickerLimit: REVIEW_STICKER_LIMIT_BONUS,
         },
      },
      { new: true }
   );

   return { success: true, rewardGranted: true, user: updatedUser };
};

export const updateUserReview = async (telegramId: number, text: string) => {
   const user = await User.findOne({ telegramId });
   if (!user) return null;

   const cleaned = text.trim();
   if (!cleaned) return { success: false, reason: "empty" };

   user.reviewText = cleaned;
   user.reviewUpdatedAt = new Date();
   await user.save();

   return { success: true, user };
};

export const getReviewsPage = async (page: number, limit: number) => {
   const filter = { hasReviewed: true, reviewText: { $exists: true, $ne: "" } };
   const [reviews, total] = await Promise.all([
      User.find(filter)
         .sort({ reviewUpdatedAt: -1, reviewSubmittedAt: -1, _id: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .select("telegramId name userName reviewText reviewUpdatedAt reviewSubmittedAt"),
      User.countDocuments(filter),
   ]);
   return { reviews, total };
};

export const getRecentReviews = async (limit: number = 10) => {
   return await getReviewsPage(1, limit).then(({ reviews }) => reviews);
};

export const getTotalReviews = async () => {
   return await User.countDocuments({ hasReviewed: true, reviewText: { $exists: true, $ne: "" } });
};

export const deleteUserReview = async (telegramId: number) => {
   return await User.findOneAndUpdate(
      { telegramId },
      {
         $set: {
            hasReviewed: false,
            reviewText: "",
            reviewSubmittedAt: null,
            reviewUpdatedAt: null,
            reviewRewardGranted: false,
         },
      },
      { new: true }
   );
};

export const toggleTelegramAI = async (telegramId: number) => {
   const user = await User.findOne({ telegramId });
   if (!user) return null;
   const newValue = !user.isTelegramAIEnabled;
   await User.findOneAndUpdate({ telegramId }, { $set: { isTelegramAIEnabled: newValue } });
   return newValue;
};

export const toggleWAAI = async (telegramId: number) => {
   const user = await User.findOne({ telegramId });
   if (!user) return null;
   const newValue = !user.isWAAIEnabled;
   await User.findOneAndUpdate({ telegramId }, { $set: { isWAAIEnabled: newValue } });
   return newValue;
};