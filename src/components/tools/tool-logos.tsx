import Image from "next/image";
import type { ProductId } from "@/lib/tools/catalog";

interface LogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function SubpoenaLogo({ size = 48, className = "", priority = false }: LogoProps) {
  return (
    <Image
      src="/brands/subpoena-logo.svg"
      alt="Subpoena Logo"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-2xl object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-105 ${className}`}
    />
  );
}

export function WritLogo({ size = 48, className = "", priority = false }: LogoProps) {
  return (
    <Image
      src="/brands/writ-logo.svg"
      alt="Writ Logo"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-2xl object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-105 ${className}`}
    />
  );
}

export function IssueViewLogo({ size = 48, className = "", priority = false }: LogoProps) {
  return (
    <Image
      src="/brands/issueview-logo.svg"
      alt="IssueView Logo"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-2xl object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-105 ${className}`}
    />
  );
}

export function AtlasLogo({ size = 48, className = "", priority = false }: LogoProps) {
  return (
    <Image
      src="/brands/atlas-logo.svg"
      alt="Worldview Atlas Logo"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-2xl object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-105 ${className}`}
    />
  );
}

export function ToolLogo({
  tool,
  size = 48,
  className = "",
  priority = false,
}: LogoProps & { tool: ProductId | string }) {
  switch (tool) {
    case "subpoena":
      return <SubpoenaLogo size={size} className={className} priority={priority} />;
    case "writ":
      return <WritLogo size={size} className={className} priority={priority} />;
    case "issueview":
      return <IssueViewLogo size={size} className={className} priority={priority} />;
    case "atlas":
      return <AtlasLogo size={size} className={className} priority={priority} />;
    default:
      return null;
  }
}
