import type { ReactNode } from "react";
import { Header } from "@/components/nav/header";
import { createClient } from "@/lib/supabase/server";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-col">
      <Header email={user?.email ?? null} />
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
