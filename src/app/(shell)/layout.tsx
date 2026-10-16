import type { ReactNode } from "react";
import { Header } from "@/components/nav/header";
import { getNavPreviews } from "@/lib/nav-previews";
import { SessionProvider } from "@/components/auth/can-edit";
import { Footer } from "@/components/nav/footer";

// No cookies are read here, so public pages below can be served from cache;
// the signed-in state loads client-side (SessionProvider).
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const previews = await getNavPreviews();

  return (
    <SessionProvider>
      <div className="flex min-h-full flex-col">
        <Header previews={previews} />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
        <Footer />
      </div>
    </SessionProvider>
  );
}
