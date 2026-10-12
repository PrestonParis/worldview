"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <title>Worldview</title>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Worldview couldn&rsquo;t load</h1>
        <p style={{ color: "#64748b" }}>Try again in a moment.</p>
        <button type="button" onClick={() => retry()} style={{ marginTop: "1.5rem", padding: "0.5rem 1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
