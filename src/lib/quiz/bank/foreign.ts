import type { Statement } from "../types";
import { st, on } from "./helpers";

// Foreign axes: engagement, force.

export const foreignStatements: Statement[] = [
  // ── Engagement: Internationalist (-1) ↔ America First (+1) ──
  st("engagement.01", -1, "Humanity should eventually be governed by a global federation of nations."),
  st("engagement.02", -1, "The United States should accept the rulings of international courts even when they go against U.S. interests."),
  st("engagement.03", -0.75, "The United States should join the International Criminal Court."),
  st("engagement.04", -0.75, "Foreign aid is one of the best uses of American tax money."),
  st("engagement.05", -0.5, "NATO is essential to American security."),
  st("engagement.06", -0.5, "Problems like climate change and pandemics can only be solved through binding international agreements.", on("environment", -0.4, 0.3)),
  st("engagement.07", -0.25, "Working through alliances gives America more influence than acting alone."),
  st("engagement.08", -0.25, "The United States should stay in the World Trade Organization.", on("trade", 0.4, 0.3)),
  st("engagement.09", 0, "International cooperation is valuable, but America should never give up control over its own decisions."),
  st("engagement.10", 0, "Foreign aid is worthwhile when it directly advances U.S. interests."),
  st("engagement.11", 0.25, "Allies should pay much more for their own defense before the U.S. commits to protecting them."),
  st("engagement.12", 0.25, "American leaders should focus on problems at home before problems abroad."),
  st("engagement.13", 0.5, "The United States should leave the World Health Organization."),
  st("engagement.14", 0.5, "The United States should never sign a treaty that limits its sovereignty."),
  st("engagement.15", 0.75, "Foreign aid should be cut to almost nothing."),
  st("engagement.16", 0.75, "The United States should withdraw from NATO.", on("force", 0.5, 0.3)),
  st("engagement.17", 1, "The United States should leave the United Nations."),
  st("engagement.18", 1, "America has no obligations to any other country."),
  st("engagement.19", -0.75, "America has a moral duty to help people in poor countries."),
  st("engagement.20", 0.75, "Global institutions mainly serve the interests of foreign elites, not ordinary Americans."),

  // ── Force: Interventionist (-1) ↔ Restraint (+1) ──
  st("force.01", -1, "The United States should be willing to use military force to spread democracy abroad."),
  st("force.02", -1, "America should maintain overwhelming military superiority over every other country, whatever it costs."),
  st("force.03", -0.75, "The United States should strike first against hostile nations that are developing nuclear weapons."),
  st("force.04", -0.75, "Defense spending should be increased substantially."),
  st("force.05", -0.5, "U.S. troops should remain stationed in Europe, Asia, and the Middle East to deter aggression."),
  st("force.06", -0.5, "The United States should use military force to stop genocide in other countries."),
  st("force.07", -0.25, "A strong American military presence abroad makes war less likely, not more."),
  st("force.08", -0.25, "Drone strikes against terrorist leaders in other countries are justified."),
  st("force.09", 0, "The United States should use force abroad only with the support of its allies."),
  st("force.10", 0, "Military force is sometimes necessary, but diplomacy and sanctions should be tried first."),
  st("force.11", 0.25, "Military force should be used only when vital American interests are directly threatened."),
  st("force.12", 0.25, "The wars in Iraq and Afghanistan were mistakes."),
  st("force.13", 0.5, "Defense spending should be cut and the savings used elsewhere."),
  st("force.14", 0.5, "All U.S. troops should be withdrawn from the Middle East."),
  st("force.15", 0.75, "The United States should close most of its overseas military bases."),
  st("force.16", 0.75, "The United States should not send weapons to countries at war."),
  st("force.17", 1, "War is never justified except to defend against a direct attack on the United States."),
  st("force.18", 1, "The U.S. military should be reduced to a purely defensive force."),
  st("force.19", -0.75, "The United States should defend Taiwan militarily if China invades."),
  st("force.20", 0.75, "American troops should be sent into combat only if the homeland itself is threatened."),
];
