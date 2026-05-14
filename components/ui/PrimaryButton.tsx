import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "secondary" | "danger";
};

const toneClass = {
  primary:
    "bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-lift hover:from-brand-500 hover:to-brand-700 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none",
  secondary:
    "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-400 disabled:bg-slate-100",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white hover:from-rose-500 hover:to-rose-700 disabled:from-slate-300 disabled:to-slate-300"
};

export function PrimaryButton({
  children,
  tone = "primary",
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed ${toneClass[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
