import Image from "next/image";

export function AtlasMark({ size = 40, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <Image
      src="/worldview-mark-red.svg"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${animated ? "atlas-mark" : ""} ${className}`}
    />
  );
}
