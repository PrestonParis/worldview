import type { ReactNode } from "react";
import { ToolShell } from "@/components/tools/shell/tool-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return <ToolShell tool="subpoena">{children}</ToolShell>;
}
