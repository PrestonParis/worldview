import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { entityColorFor } from "@/lib/entity-colors";
import type { EntityType } from "@/lib/validation/entity";

export interface EntityNodeData {
  label: string;
  type: EntityType;
  [key: string]: unknown;
}

// Memoized because the graph can render 1,000+ of these — without it, any
// store update (selection, viewport, etc.) re-renders every node instead of
// just the ones whose own props actually changed.
export const EntityNode = memo(function EntityNode({ data }: NodeProps) {
  const { label, type } = data as EntityNodeData;
  const colors = entityColorFor(type);

  return (
    <div
      className="cursor-pointer rounded-full border-2 px-6 py-3 text-base font-semibold whitespace-nowrap shadow-sm"
      style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      {label}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});
