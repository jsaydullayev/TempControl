import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/types";

export const LOCALE_COOKIE = "tc_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export { DEFAULT_LOCALE, LOCALES };
export type { Locale };
