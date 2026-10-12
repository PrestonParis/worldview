"use client";

import { ErrorPanel } from "@/components/errors/error-panel";

export default function ShellError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel {...props} />;
}
