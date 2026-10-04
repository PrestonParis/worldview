import type { ReactNode } from "react";
import { Header } from "@/components/nav/header";
import { getCurrentUser } from "@/lib/auth/session";
import { CanEditProvider } from "@/components/auth/can-edit";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <CanEditProvider canEdit={Boolean(user)}>
      <div className="flex min-h-full flex-col">
        <Header accountLabel={user ? (user.displayName ?? user.email ?? "Account") : null} />
        <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      </div>
    </CanEditProvider>
  );
}
