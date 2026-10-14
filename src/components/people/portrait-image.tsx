"use client";

import { useEffect, useRef, useState } from "react";

// A portrait that removes itself when its URL is dead, revealing the
// monogram underneath. The mount check catches images that failed before
// hydration attached onError.
export function PortraitImage({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- externally hosted member portraits
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover object-top"
    />
  );
}
