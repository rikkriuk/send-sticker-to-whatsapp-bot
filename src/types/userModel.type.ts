export type UserRole = "admin" | "user";

export interface IUser extends Document {
  telegramId: number;
  name: string;
  username?: string;
  whatsappNumber?: string;
  stickerLimit: number;
  role: UserRole;
}