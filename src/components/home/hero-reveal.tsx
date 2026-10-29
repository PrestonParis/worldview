"use client";

import Image from "next/image";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { StatePath } from "@/lib/geo/state-paths";
import { SLOGAN } from "@/lib/site";
import { fill, ink, quantileBreaks, stepFor, type StateMeasure } from "./state-map";
import styles from "./hero-reveal.module.css";

// Set once the intro has started in this tab; INTRO_SEEN_SCRIPT reads it
// before first paint so later visits in the session skip straight to the page.
const INTRO_KEY = "wv:intro";
const INTRO_SEEN_SCRIPT = `try{if(sessionStorage.getItem("${INTRO_KEY}"))document.documentElement.setAttribute("data-intro-seen","")}catch(e){}`;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (t: number) => 1 - (1 - t) ** 3;
// Eased progress through the [start, end] slice of the scroll.
const span = (progress: number, start: number, end: number) => ease(clamp((progress - start) / (end - start)));

// The stage pins while the track's extra height scrolls past; that scroll
// distance drives the intro: title out, logo folds into the map, the map
// flies onto the real one (same colours, tilt and box), then the cover fades
// around it and the overlay drops with nothing moving.
export function HeroReveal({ width, height, states, measure, children }: {
  width: number;
  height: number;
  states: StatePath[];
  measure?: StateMeasure;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const finishRef = useRef<() => void>(() => {});
  // Decided once per mount, so Strict Mode's effect re-run doesn't see the
  // session flag this mount just wrote and skip its own intro.
  const playRef = useRef<boolean | null>(null);

  const stepOf = useMemo(() => {
    const values = measure?.values ?? {};
    const breaks = quantileBreaks(Object.values(values).filter((v): v is number => v !== null && Number.isFinite(v)));
    return (abbr: string) => stepFor(values[abbr], breaks);
  }, [measure]);

  // A layout effect, so a return visit hides the overlay before it paints.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (playRef.current === null) {
      let seen = root.hasAttribute("data-intro-seen");
      try {
        seen ||= sessionStorage.getItem(INTRO_KEY) !== null;
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {}
      playRef.current = !seen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (!playRef.current) {
      root.setAttribute("data-intro-seen", "");
      return;
    }
    const track = trackRef.current;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    const logo = logoRef.current;
    if (!track || !stage || !overlay || !logo) return;

    // A reload would otherwise restore a scroll position past the intro and
    // skip it, so the intro always starts at the top.
    const restoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "instant" });

    let frame: number | null = null;
    // Plays once per session: when it completes (or is skipped) the spacer
    // and pin come off and the scroll position shifts so the page stays put.
    const finish = (scrollTop?: number) => {
      const distance = track.offsetHeight - stage.offsetHeight;
      track.setAttribute("data-done", "");
      overlay.setAttribute("data-done", "");
      root.setAttribute("data-intro-seen", "");
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.scrollTo({ top: scrollTop ?? Math.max(0, window.scrollY - distance), behavior: "instant" });
    };
    finishRef.current = () => finish(0);

    const render = () => {
      frame = null;
      const distance = track.offsetHeight - stage.offsetHeight;
      if (distance <= 0) return;
      const stickTop = parseFloat(getComputedStyle(stage).top) || 0;
      const progress = clamp((stickTop - track.getBoundingClientRect().top) / distance);
      if (progress >= 1) {
        finish();
        return;
      }

      const viewWidth = window.innerWidth;
      // Start under the logo, centred a little low where its clip collapses.
      const startWidth = logo.offsetWidth * 0.9;
      const startHeight = startWidth * (height / width);
      const logoCenter = logo.offsetTop + logo.offsetHeight * 0.18;
      const start = { left: (viewWidth - startWidth) / 2, top: logoCenter - startHeight / 2, width: startWidth, height: startHeight };

      // The real map's untilted frame: the stage is pinned at its natural
      // offset, so this is exactly where the map sits once the cover lifts,
      // even when part of it is below the fold. Its perspective origin is
      // 42% down the frame, which also holds the legend under the map.
      let end = start;
      let endOrigin = start.height * 0.42;
      const target = document.querySelector<HTMLElement>("[data-home-map-target]");
      if (target) {
        const rect = target.getBoundingClientRect();
        end = { left: rect.left, top: rect.top, width: rect.width, height: rect.width * (height / width) };
        endOrigin = rect.height * 0.42;
      }

      const morph = span(progress, 0.25, 0.8);
      const lerp = (a: number, b: number) => a + (b - a) * morph;
      const mix = (a: number, b: number) => `${lerp(a, b)}px`;
      const vars: Record<string, string> = {
        "--title": String(span(progress, 0.04, 0.3)),
        "--logo": String(span(progress, 0.15, 0.45)),
        "--logo-fade": String(span(progress, 0.3, 0.45)),
        "--appear": String(span(progress, 0.22, 0.34)),
        "--morph": String(morph),
        "--labels": String(span(progress, 0.7, 0.85)),
        "--settle": String(span(progress, 0.82, 1)),
        "--gx": mix(start.left, end.left),
        "--gy": mix(start.top, end.top),
        "--gw": mix(start.width, end.width),
        "--gh": mix(start.height, end.height),
        "--go": mix(start.height * 0.42, endOrigin),
      };
      for (const [name, value] of Object.entries(vars)) overlay.style.setProperty(name, value);
    };
    function schedule() {
      if (frame === null) frame = window.requestAnimationFrame(render);
    }

    render();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      history.scrollRestoration = restoration;
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [width, height]);

  return (
    <>
      {/* Runs during HTML parsing on full loads; inert (text/plain) when React
          renders it on a client-side visit, where the layout effect covers it. */}
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: INTRO_SEEN_SCRIPT }}
      />
      <div ref={trackRef} className={styles.track}>
        <div ref={stageRef} className={styles.stage}>
          {children}
        </div>
      </div>
      <div ref={overlayRef} className={styles.overlay}>
        <div className={styles.backdrop} />
        <button type="button" onClick={() => finishRef.current()} className={styles.skip}>
          Skip intro
        </button>
        <div className={styles.introTitle} aria-hidden="true">
          {SLOGAN}
        </div>
        <div ref={logoRef} className={styles.logo} aria-hidden="true">
          <Image src="/worldview-mark-red.png" alt="" width={1254} height={1254} priority />
        </div>
        <div className={styles.scrollCue} aria-hidden="true">
          Scroll
        </div>
        <div className={styles.mapGhost} aria-hidden="true">
          <svg viewBox={`0 0 ${width} ${height}`}>
            <g className={styles.ghostDepth}>
              {states.map((state) => <path key={state.abbr} d={state.d} style={{ fill: fill(stepOf(state.abbr)) }} />)}
            </g>
            <g className={styles.ghostStates}>
              {states.map((state) => <path key={state.abbr} d={state.d} style={{ fill: fill(stepOf(state.abbr)) }} />)}
            </g>
            {measure ? (
              <g className={styles.ghostLabels}>
                {states.map((state) =>
                  state.label ? (
                    <text
                      key={state.abbr}
                      x={state.label[0]}
                      y={state.label[1]}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[13px] font-medium"
                      style={{ fill: ink(stepOf(state.abbr)) }}
                    >
                      {state.abbr}
                    </text>
                  ) : null,
                )}
              </g>
            ) : null}
          </svg>
        </div>
      </div>
    </>
  );
}
