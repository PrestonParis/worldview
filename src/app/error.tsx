"use client";

import { ErrorPanel } from "@/components/errors/error-panel";

export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="px-4">
      <ErrorPanel {...props} />
    </div>
  );
}
