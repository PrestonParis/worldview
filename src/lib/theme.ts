"use client";

import { useSyncExternalStore } from "react";

// Theme is a `.dark` class on <html>. THEME_SCRIPT runs in <head> before first
// paint so a stored choice never flashes the wrong theme, and keeps following
// the OS while the choice is "system".

export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const PREF_EVENT = "themepref";

export const THEME_SCRIPT = `(function(){
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function pref(){ try { return localStorage.getItem("${STORAGE_KEY}") || "system"; } catch (e) { return "system"; } }
  function apply(){
    var p = pref();
    var dark = p === "dark" || (p === "system" && mq.matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }
  window.__applyTheme = apply;
  mq.addEventListener("change", apply);
  apply();
})();`;

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

function readPref(): ThemePref {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies for this page view.
    document.documentElement.classList.toggle(
      "dark",
      pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }
  window.__applyTheme?.();
  window.dispatchEvent(new Event(PREF_EVENT));
}

function subscribePref(onChange: () => void) {
  window.addEventListener(PREF_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREF_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The stored choice; "system" during server render. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribePref, readPref, () => "system");
}

function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Whether the page is currently dark; false during server render. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeDark,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

/** Non-hook read for imperative code (map/canvas setup). */
export const isDark = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/** Calls `onChange(dark)` whenever the page theme flips. */
export function onThemeChange(onChange: (dark: boolean) => void) {
  return subscribeDark(() => onChange(isDark()));
}
