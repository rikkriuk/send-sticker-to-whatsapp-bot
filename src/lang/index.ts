import id from "./id";
import en from "./en";

export type Language = "id" | "en";
export type TranslationKey = keyof typeof id;

const translations = { id, en };

export const normalizeLanguage = (language?: string | null): Language =>
  language === "en" ? "en" : "id";

export const translate = (
  language: Language,
  key: TranslationKey,
  values: Record<string, string | number> = {},
): string => {
  const template = translations[language][key];
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : placeholder,
  );
};
