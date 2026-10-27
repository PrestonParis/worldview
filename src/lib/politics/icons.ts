// The icon vocabulary for political domains and analysis sections, so a
// domain looks the same on the results page, an Atlas entry and the compare
// workspace. One stroke weight and size scale, set by the components.

import {
  BookOpen,
  Church,
  Clock,
  Coins,
  Cpu,
  Gavel,
  GitCompareArrows,
  Globe,
  Landmark,
  LayoutDashboard,
  Leaf,
  Map,
  Network,
  Plane,
  Scale,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Swords,
  UserRound,
  Users,
  Vote,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { axes } from "../quiz/axes";
import type { AxisGroup, AxisId } from "../quiz/types";

export const GROUP_ICON: Record<AxisGroup, LucideIcon> = {
  governance: Landmark,
  economy: Coins,
  foreign: Globe,
  society: Users,
  tech: Cpu,
};

const AXIS_OVERRIDES: Partial<Record<AxisId, LucideIcon>> = {
  voting: Vote,
  liberty: Shield,
  violence: Swords,
  force: Swords,
  religion: Church,
  immigration: Plane,
  justice: Gavel,
  identity: Scale,
  environment: Leaf,
};

// Every axis's icon, by id: its own where it has one, else its domain's.
export const AXIS_ICON = Object.fromEntries(
  axes.map((a) => [a.id, AXIS_OVERRIDES[a.id] ?? GROUP_ICON[a.group]]),
) as Record<AxisId, LucideIcon>;

export const SECTION_ICON = {
  overview: LayoutDashboard,
  map: Map,
  positions: SlidersHorizontal,
  compare: GitCompareArrows,
  history: Clock,
  people: UserRound,
  connections: Network,
  activity: Waypoints,
  reading: BookOpen,
  texts: ScrollText,
} satisfies Record<string, LucideIcon>;

export type SectionIconId = keyof typeof SECTION_ICON;
