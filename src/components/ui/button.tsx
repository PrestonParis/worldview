import type { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center rounded-xl font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";

const variants = {
  primary: `${base} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`,
  default: `${base} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500`,
  outline: `${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`,
  ghost: `${base} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`,
  danger: `${base} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`,
};

const sizes = {
  sm: "px-2.5 py-1.5 text-xs",
  default: "px-3.5 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface ButtonVariantOptions {
  variant?: ButtonVariant | "default";
  size?: ButtonSize;
  className?: string;
}

export function getButtonClassName({
  variant = "primary",
  size = "default",
  className = "",
}: ButtonVariantOptions = {}): string {
  const chosenVariant = variants[variant as ButtonVariant] ?? variants.primary;
  const chosenSize = sizes[size as ButtonSize] ?? sizes.default;
  return `${chosenVariant} ${chosenSize} ${className}`.trim();
}

// Support both callable function and object property access for backwards compatibility
export const buttonVariants = Object.assign(getButtonClassName, variants);

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
