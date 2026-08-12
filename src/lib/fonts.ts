// Font choices for the text tool. `id` is what's stored on the layer/tool
// options; `family` is the actual CSS value used to render it. Geist is
// already loaded globally via next/font in layout.tsx (--font-geist-sans /
// --font-geist-mono), so those two are free; serif/impact fall back to
// whatever the OS provides, which is fine for a personal tool.
export const TEXT_FONT_OPTIONS = [
  { id: "sans", label: "Sans", family: "var(--font-geist-sans), system-ui, sans-serif" },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Mono", family: "var(--font-geist-mono), monospace" },
  {
    id: "impact",
    label: "Impact",
    family: "Impact, 'Arial Narrow Bold', 'Helvetica Neue', sans-serif",
  },
] as const;

export type TextFontId = (typeof TEXT_FONT_OPTIONS)[number]["id"];

export function resolveFontFamily(id: string): string {
  return TEXT_FONT_OPTIONS.find((f) => f.id === id)?.family ?? TEXT_FONT_OPTIONS[0].family;
}
