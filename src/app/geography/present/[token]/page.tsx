import type { Metadata } from "next";
import { MapWorkspace } from "@/components/map/MapWorkspace";

export const metadata: Metadata = {
  title: "Live map presentation · Worldview",
  robots: { index: false, follow: false },
};

export default async function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex h-screen overflow-hidden bg-neutral-900">
      <MapWorkspace signedIn={false} presentationToken={token} />
    </main>
  );
}
