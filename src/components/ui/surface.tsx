import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export const surfaceClass = "rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950";

export const insetSurfaceClass = "rounded-2xl bg-slate-50 dark:bg-slate-900";

type SurfaceProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Surface<T extends ElementType = "section">({
  as,
  children,
  className = "",
  ...props
}: SurfaceProps<T>) {
  const Component = as ?? "section";

  return (
    <Component className={`${surfaceClass} ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase ${className}`}>{children}</p>;
}
