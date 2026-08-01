"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { LOCALE_COOKIE } from "@/i18n/config";
import { LOCALES } from "@/lib/types";
import { THEME_COOKIE, THEME_MAX_AGE } from "@/lib/theme";

/**
 * Preferences live in cookies so the server can apply them on the first byte —
 * no flash of the wrong theme, no client bootstrap script.
 */

export async function setLocaleFromSettings(formData: FormData) {
  const parsed = z.enum(LOCALES).safeParse(formData.get("locale"));
  if (!parsed.success) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: THEME_MAX_AGE,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function setThemeAction(formData: FormData) {
  const parsed = z.enum(["light", "dark"]).safeParse(formData.get("theme"));
  if (!parsed.success) return;

  const store = await cookies();
  store.set(THEME_COOKIE, parsed.data, {
    path: "/",
    maxAge: THEME_MAX_AGE,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
