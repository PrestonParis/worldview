import { Handle, Position, type NodeProps } from "@xyflow/react";
import { entityColors } from "@/lib/entity-colors";
import type { EntityType } from "@/lib/validation/entity";

export interface EntityNodeData {
  label: string;
  type: EntityType;
  [key: string]: unknown;
}

export function EntityNode({ data }: NodeProps) {
  const { label, type } = data as EntityNodeData;
  const colors = entityColors[type];

  return (
    <div
      className="cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-medium shadow-sm"
      style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      {label}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
