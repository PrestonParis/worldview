import type { ReactNode } from "react";
import { Header } from "@/components/nav/header";
import { getNavPreviews } from "@/lib/nav-previews";
import { getCurrentUser } from "@/lib/auth/session";
import { isEditor } from "@/lib/auth/guard";
import { CanEditProvider } from "@/components/auth/can-edit";
import { Footer } from "@/components/nav/footer";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  // A failed profile lookup shouldn't take down every page; treat it as signed out.
  const [user, previews] = await Promise.all([getCurrentUser().catch(() => null), getNavPreviews()]);

  return (
    <CanEditProvider canEdit={isEditor(user)}>
      <div className="flex min-h-full flex-col">
        <Header accountLabel={user ? (user.displayName ?? user.email ?? "Account") : null} previews={previews} />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
        <Footer />
      </div>
    </CanEditProvider>
  );
}
