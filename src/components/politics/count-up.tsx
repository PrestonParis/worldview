"use client";

import { useEffect, useState } from "react";

// A number counting up to its value once, after `delay`. Renders the final
// value on the server and under reduced motion, so it never shows a wrong
// figure without JavaScript.
export function CountUp({
  value,
  duration = 1100,
  delay = 0,
  animate = true,
}: {
  value: number;
  duration?: number;
  delay?: number;
  animate?: boolean;
}) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let start = 0;
    const ease = (t: number) => 1 - (1 - t) ** 3;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * ease(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    // The reveal keeps the figure faded out until hydration, so dropping to
    // zero here is never seen as a jump.
    queueMicrotask(() => setShown(0));
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, duration, delay, animate]);

  return <>{shown}</>;
}
