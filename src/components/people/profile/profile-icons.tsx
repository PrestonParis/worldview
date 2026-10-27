import { BookOpen, CircleDollarSign, LayoutGrid, Quote, type LucideIcon } from "lucide-react";
import type { ProfileTabId } from "@/lib/people/profile-modules";

// One icon per profile module, used in the tab bar and section headings.
export const profileIcons: Record<ProfileTabId, LucideIcon> = {
  overview: LayoutGrid,
  biography: BookOpen,
  money: CircleDollarSign,
  quotes: Quote,
};
