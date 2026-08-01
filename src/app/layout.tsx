import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { THEME_COOKIE, type Theme } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "TempControl",
  description: "Harorat va namlik nazorati",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  /**
   * The theme lives in a cookie, not localStorage, so the server can stamp
   * `data-theme` on the very first byte. That removes both the flash of the
   * wrong theme and the inline bootstrap script React refuses to run.
   */
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = stored === "light" ? "light" : "dark";

  return (
    <html lang={locale} data-theme={theme}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
