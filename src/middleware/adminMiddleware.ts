import { Context, MiddlewareFn } from "telegraf";
import { getUser } from "../services/userService";
import messages from "../constants/messages";
import {
   ADMIN_COMMANDS,
   isSuperAdmin,
   PREMIUM_COMMANDS,
   ROLES,
   SUPER_ADMIN_COMMANDS,
   USER_COMMANDS,
} from "../constants/roles";
import { bot } from "../bots/telegram";

export const adminOnly: MiddlewareFn<Context> = async (ctx, next) => {
   const user = await getUser(ctx.chat?.id);
   if (user?.role !== ROLES.ADMIN) {
      ctx.reply(messages.inValidCommand, { parse_mode: "Markdown" });
      return;
   }
   return next();
};

export const setCommandsForUser = async (
   telegramId: number,
   role: string,
   isPremium: boolean = false
) => {
   const commands = isSuperAdmin(telegramId)
      ? SUPER_ADMIN_COMMANDS
      : role === ROLES.ADMIN
         ? (isPremium ? ADMIN_COMMANDS : ADMIN_COMMANDS.filter(({ command }) =>
            command !== "numbers" && command !== "stickername"
         ))
         : isPremium ? PREMIUM_COMMANDS : USER_COMMANDS;
   await bot.telegram.setMyCommands(commands, {
      scope: { type: "chat", chat_id: telegramId },
   });
};