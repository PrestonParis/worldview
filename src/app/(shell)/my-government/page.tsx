import type { Metadata } from "next";
import { MyGovernmentLookup } from "@/components/my-government/my-government-lookup";

export const metadata: Metadata = {
  title: "My Government | Worldview",
  description: "Find the public offices and officials that represent a U.S. address.",
};

export default async function MyGovernmentPage({ searchParams }: PageProps<"/my-government">) {
  const params = await searchParams;
  const address = typeof params.address === "string" ? params.address : "";
  return <MyGovernmentLookup initialAddress={address} />;
}
