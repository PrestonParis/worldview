import { describe, expect, it } from "vitest";
import { createCompositionLayer } from "./composition";
import { resolveLayerBindings } from "./liveBindings";

describe("live layer bindings", () => {
  it("resolves text and color while preserving the static layer", () => {
    const layer = createCompositionLayer("title", 1);
    layer.text = "Static headline";
    layer.style.color = "#ffffff";
    layer.bindings = { text: "headline", color: "alert_color" };

    const resolved = resolveLayerBindings(layer, { headline: "Live headline", alert_color: "#ff0000" });
    expect(resolved.type === "composition" && resolved.text).toBe("Live headline");
    expect("style" in resolved && resolved.style.color).toBe("#ff0000");
    expect(layer.text).toBe("Static headline");
    expect(layer.style.color).toBe("#ffffff");
  });

  it("falls back to static values when keys are missing", () => {
    const layer = createCompositionLayer("title", 1);
    layer.bindings = { text: "missing" };
    expect(resolveLayerBindings(layer, {})).toBe(layer);
  });
});
