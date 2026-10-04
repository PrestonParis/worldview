import type { Metadata } from "next";
import { MyGovernmentLookup } from "@/components/my-government/my-government-lookup";

export const metadata: Metadata = {
  title: "My Government | Worldview",
  description: "Find the public offices and officials that represent a U.S. address.",
};

export default function MyGovernmentPage() {
  return <MyGovernmentLookup />;
}
