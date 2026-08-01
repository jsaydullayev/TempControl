"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { Languages } from "lucide-react";

import { setLocaleAction } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";

export function LocaleSwitcher() {
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const formData = new FormData();
    formData.set("locale", event.target.value);
    startTransition(() => {
      void setLocaleAction(formData);
    });
  }

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm"
      style={{
        border: "1px solid var(--hairline)",
        color: "var(--ink-secondary)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Languages size={15} aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={current}
        onChange={onChange}
        className="pr-1 outline-none"
        // The popup list is rendered by the OS: a transparent background makes
        // it fall back to white, and light ink then disappears on it.
        style={{ background: "var(--surface-1)", color: "var(--ink-primary)" }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} style={{ background: "var(--surface-1)", color: "var(--ink-primary)" }}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
