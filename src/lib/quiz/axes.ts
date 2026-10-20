import type { Axis, AxisGroup, AxisId } from "./types";

export const AXIS_GROUPS: { id: AxisGroup; label: string }[] = [
  { id: "governance", label: "Governance" },
  { id: "economy", label: "Economy" },
  { id: "foreign", label: "Foreign policy" },
  { id: "society", label: "Society" },
  { id: "tech", label: "Technology & environment" },
];

export const groupLabel = (group: AxisGroup) => AXIS_GROUPS.find((g) => g.id === group)?.label ?? group;

export const axes: Axis[] = [
  // Governance
  { id: "federalism", group: "governance", name: "Federalism", negative: { label: "States", description: "Power belongs closest to the people: states and localities set most policy and serve as laboratories." }, positive: { label: "Federal", description: "National problems need national rules: federal standards apply uniformly across the country." } },
  { id: "executive", group: "governance", name: "Executive power", negative: { label: "Checks & balances", description: "Power is divided and slow on purpose: Congress, courts, and independent agencies constrain the president." }, positive: { label: "Strong executive", description: "An elected president should be able to act decisively and control the executive branch." } },
  { id: "liberty", group: "governance", name: "Liberty vs. security", negative: { label: "Civil liberty", description: "Privacy and due process come first, even at some cost to safety." }, positive: { label: "Security", description: "Government needs broad tools — surveillance, emergency powers — to keep people safe." } },
  { id: "voting", group: "governance", name: "Elections", negative: { label: "Broad access", description: "The franchise should be broad, voting easy, and national outcomes closely tied to the popular majority." }, positive: { label: "Restricted", description: "Voting may be limited by eligibility and integrity rules, while indirect institutions protect against bare majorities." } },
  { id: "democracy", group: "governance", name: "Democracy", negative: { label: "Democratic", description: "Government is legitimate only when chosen in free, competitive elections, with opposition free to organize." }, positive: { label: "Autocratic", description: "Authority can rightly rest with a party, leader, monarch, clergy, or elite rather than with elections." } },
  { id: "violence", group: "governance", name: "Political violence", negative: { label: "Nonviolent", description: "Political change and political order rest on persuasion, law, and peaceful means, never force." }, positive: { label: "Force-accepting", description: "Violence, by citizens or the state, is a legitimate political tool when the cause is just enough." } },
  // Economy
  { id: "ownership", group: "economy", name: "Ownership", negative: { label: "Public", description: "Key industries and services should be publicly or collectively owned." }, positive: { label: "Private", description: "Private ownership should be the rule across the economy, including services government provides today." } },
  { id: "regulation", group: "economy", name: "Regulation", negative: { label: "Regulated", description: "Markets need firm rules on business, finance, labor, and consumer protection." }, positive: { label: "Laissez-faire", description: "Markets work best with minimal government rules." } },
  { id: "redistribution", group: "economy", name: "Redistribution", negative: { label: "Redistributive", description: "Progressive taxes and a strong safety net should reduce inequality." }, positive: { label: "Self-reliant", description: "Low taxes and a minimal safety net; people keep what they earn and support themselves." } },
  { id: "trade", group: "economy", name: "Trade", negative: { label: "Protectionist", description: "Tariffs and industrial policy should protect domestic workers and industries." }, positive: { label: "Free trade", description: "Open trade with few barriers benefits consumers and the economy." } },
  // Foreign
  { id: "engagement", group: "foreign", name: "Global engagement", negative: { label: "Internationalist", description: "Alliances, treaties, international institutions, and foreign aid serve America's interests." }, positive: { label: "America First", description: "National sovereignty first; skeptical of alliances, global institutions, and aid." } },
  { id: "force", group: "foreign", name: "Military posture", negative: { label: "Interventionist", description: "A strong military used actively abroad keeps the country and world safer." }, positive: { label: "Restraint", description: "Military commitments and force abroad should be rare, with a more limited defense posture." } },
  // Society
  { id: "social", group: "society", name: "Social change", negative: { label: "Progressive", description: "Society should keep changing its norms around gender, sexuality, and family." }, positive: { label: "Traditional", description: "Long-standing norms around gender, sexuality, and family should be preserved." } },
  { id: "religion", group: "society", name: "Religion & state", negative: { label: "Secular", description: "Religion is kept out of law and government; at the far end, the state actively discourages it." }, positive: { label: "Religious", description: "Religious faith should shape public life; at the far end, religious law governs." } },
  { id: "immigration", group: "society", name: "Immigration & identity", negative: { label: "Open", description: "High immigration and a pluralist national identity." }, positive: { label: "Restrictive", description: "Lower immigration, strict enforcement, and assimilation into a shared culture." } },
  { id: "justice", group: "society", name: "Criminal justice", negative: { label: "Reform", description: "Shrink incarceration and policing; focus on rehabilitation and root causes." }, positive: { label: "Law & order", description: "Strong policing and firm punishment deter crime." } },
  { id: "identity", group: "society", name: "Race & group policy", negative: { label: "Group-conscious", description: "Policy should actively address group disparities, including by race." }, positive: { label: "Colorblind", description: "Government should treat individuals identically regardless of race or group." } },
  { id: "race", group: "society", name: "Race & nationhood", negative: { label: "Integrationist", description: "Americans of every race form one people; race should carry no political standing of its own." }, positive: { label: "Racial nationalist", description: "Races are distinct peoples with their own interests, and each should organize, and if possible live, as a nation of its own." } },
  // Tech & nature
  { id: "environment", group: "tech", name: "Environment & energy", negative: { label: "Environmental", description: "Protect the climate and natural world, even at real economic cost." }, positive: { label: "Growth-first", description: "Energy abundance and economic growth come first; environmental rules should not hold them back." } },
  { id: "technology", group: "tech", name: "Technology", negative: { label: "Precautionary", description: "Move carefully with powerful technologies like AI and genetic engineering until they are proven safe." }, positive: { label: "Accelerationist", description: "Rapid technological progress is the best path to a better future." } },
];

export const axisById: Record<AxisId, Axis> = Object.fromEntries(axes.map((a) => [a.id, a])) as Record<AxisId, Axis>;
