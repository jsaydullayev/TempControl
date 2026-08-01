"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

import { THEME_COOKIE, THEME_MAX_AGE, type Theme } from "@/lib/theme";

/**
 * The server already read the cookie and stamped `data-theme`, so the current
 * theme arrives as a prop. Nothing is read after mount: no effect, no null
 * first render, and no flash of the wrong icon.
 */
export function ThemeToggle({ label, theme: initial }: { label: string; theme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    // The DOM is updated directly so the change is instant; the cookie makes
    // the next server render agree.
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_MAX_AGE}; samesite=lax`;
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
