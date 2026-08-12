import type { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: `${base} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`,
  ghost: `${base} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`,
  danger: `${base} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`,
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return <button className={`${variants[variant]} ${className}`} {...props} />;
}
