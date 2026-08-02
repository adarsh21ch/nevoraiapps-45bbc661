import { Loader2, ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Single dominant member-portal CTA. Disabled while loading so submits can't be spammed. */
export function AuthButton({
  loading,
  children,
  loadingLabel = "Please wait…",
  showArrow = true,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  showArrow?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className="flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold tracking-wide text-white transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-accent-auth), color-mix(in oklab, var(--brand-accent-auth) 72%, black))",
        boxShadow: "0 12px 30px -14px color-mix(in oklab, var(--brand-accent-auth) 80%, transparent)",
      }}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {loadingLabel}
        </>
      ) : (
        <>
          {children}
          {showArrow ? <ArrowRight className="size-4" aria-hidden /> : null}
        </>
      )}
    </button>
  );
}

/** Form-level error / status banner. */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-auth-danger/40 bg-auth-danger/10 px-4 py-3 text-[13px] leading-relaxed text-auth-danger"
    >
      {message}
    </div>
  );
}
