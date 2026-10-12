import type { NodeFamily } from "./lean";

// The slim, serializable shape the People network canvas renders. Built
// server-side in graph-page.tsx so the client never receives full entity
// records (biographies, metadata) for nodes it only draws as dots.

export interface NetworkNode {
  id: string;
  name: string;
  type: string;
  description: string;
  x: number;
  y: number;
  /** Rendered radius in px — scales with connections in view. */
  size: number;
  /** Connections within the current view. */
  degree: number;
  /** Colour channel: people by political family, everything else an institution. */
  family: NodeFamily;
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  relType: string;
  /** Human verb, e.g. "founded", "sits on". */
  label: string;
  role: string;
  validFrom?: string;
  validTo?: string;
  sourced?: boolean;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
  former?: boolean;
}

export interface SearchItem {
  id: string;
  name: string;
  type: string;
}

export function nodeSizeForDegree(degree: number): number {
  return Math.min(22, 3.5 + Math.sqrt(degree) * 2.4);
}
