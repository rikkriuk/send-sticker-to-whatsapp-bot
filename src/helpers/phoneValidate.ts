import { parsePhoneNumberFromString } from "libphonenumber-js";

const normalizePhoneInput = (input: string): string | null => {
   const trimmed = input.trim();
   if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;

   const compact = trimmed.replace(/[\s().-]/g, "");
   if (compact.startsWith("00")) return `+${compact.slice(2)}`;
   if (compact.startsWith("+")) return compact;
   if (compact.startsWith("0")) return compact;

   return `+${compact}`;
};

export const isValidWhatsAppNumber = (number: string): string | null => {
   const normalized = normalizePhoneInput(number);
   if (!normalized) return null;

   const phoneNumber = normalized.startsWith("0")
      ? parsePhoneNumberFromString(normalized, "ID")
      : parsePhoneNumberFromString(normalized);

   return phoneNumber?.isValid() ? phoneNumber.number.slice(1) : null;
};

export const removePlusInNumber = (number: string): string => {
   return number.replace(/\+/g, "");
}

export const looksLikePhoneNumber = (text: string): boolean => {
   const normalized = normalizePhoneInput(text);
   if (!normalized) return false;

   const digits = normalized.replace(/\D/g, "");
   return digits.length >= 8 && digits.length <= 15;
};