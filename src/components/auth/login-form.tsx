"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, LogIn } from "lucide-react";

import { loginAction, type LoginState } from "@/server/auth/actions";

const INITIAL: LoginState = {};

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="login" name="login" label={t("login")} autoComplete="username" autoFocus />
      <Field
        id="password"
        name="password"
        label={t("password")}
        type="password"
        autoComplete="current-password"
      />

      {state.error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: "color-mix(in srgb, var(--status-critical) 12%, transparent)" }}
        >
          <AlertCircle size={16} style={{ color: "var(--status-critical)" }} aria-hidden />
          <span style={{ color: "var(--ink-primary)" }}>
            {state.error === "throttled" ? t("throttled") : t("invalid")}
          </span>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
        style={{ background: "var(--series-1)" }}
      >
        <LogIn size={16} aria-hidden />
        {pending ? t("signingIn") : t("submit")}
      </button>

      <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
        {t("staySignedIn")}
      </p>
    </form>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

function Field({ id, label, ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm" style={{ color: "var(--ink-secondary)" }}>
        {label}
      </label>
      <input
        id={id}
        required
        className="rounded-lg px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
        style={{
          background: "var(--surface-1)",
          color: "var(--ink-primary)",
          border: "1px solid var(--hairline)",
        }}
        {...rest}
      />
    </div>
  );
}
