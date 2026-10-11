const positiveIntegerFromEnv = (name: string, fallback: number): number => {
   const value = Number(process.env[name]);
   return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

export const REFERRALS_PER_PREMIUM = positiveIntegerFromEnv("REFERRALS_PER_PREMIUM", 10);
export const REFERRAL_STICKER_LIMIT_BONUS = positiveIntegerFromEnv(
   "REFERRAL_STICKER_LIMIT_BONUS",
   10
);
export const REFERRAL_PREMIUM_MONTHS = positiveIntegerFromEnv("REFERRAL_PREMIUM_MONTHS", 1);
export const DEFAULT_DAILY_STICKER_LIMIT = positiveIntegerFromEnv(
   "DEFAULT_DAILY_STICKER_LIMIT",
   10
);
export const REVIEW_STICKER_LIMIT_BONUS = positiveIntegerFromEnv(
   "REVIEW_STICKER_LIMIT_BONUS",
   10
);
export const PREMIUM_PRICE_LABEL = process.env.PREMIUM_PRICE_LABEL?.trim() || "5K";
export const PREMIUM_MAX_WHATSAPP_NUMBERS = Math.min(
   2,
   positiveIntegerFromEnv("PREMIUM_MAX_WHATSAPP_NUMBERS", 2)
);
export const STICKER_PACK_NAME_MAX_LENGTH = positiveIntegerFromEnv(
   "STICKER_PACK_NAME_MAX_LENGTH",
   30
);
export const STICKER_PACK_NAME = "Sticker";
