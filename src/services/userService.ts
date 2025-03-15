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