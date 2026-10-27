import type { Statement } from "../types";
import { st, on } from "./helpers";

// Tech & nature axes: environment, technology. Kept separate because
// people combine them freely (pro-nuclear and AI-cautious, green and
// pro-biotech); whether they correlate is for response data to show.

export const techStatements: Statement[] = [
  // ── Environment: Environmental (-1) ↔ Growth-first (+1) ──
  st("environment.01", -1, "Economic growth must stop or reverse to protect the planet."),
  st("environment.02", -1, "Climate change is an existential threat that justifies any economic sacrifice."),
  st("environment.03", -0.75, "All fossil fuel use in the United States should end within 15 years."),
  st("environment.04", -0.75, "New oil and gas drilling should be banned."),
  st("environment.05", -0.5, "Protecting endangered species should take priority over economic development."),
  st("environment.06", -0.5, "Government should invest heavily in public transit to reduce car dependence."),
  st("environment.07", -0.25, "Environmental regulations are worth the higher prices they cause."),
  st("environment.08", -0.25, "The federal government should subsidize electric vehicles.", on("redistribution", -0.2, 0.1)),
  st("environment.09", 0, "Clean energy and economic growth can go hand in hand."),
  st("environment.10", 0, "Climate change is real, but policies to fight it should not raise energy prices for families."),
  st("environment.11", 0.25, "Environmental reviews for new power lines should have firm deadlines."),
  st("environment.21", 0.25, "Natural gas should remain a major source of America's electricity for decades to come."),
  st("environment.13", 0.5, "Oil and gas drilling on federal lands should be expanded."),
  st("environment.14", 0.5, "Limits on power-plant emissions should be rolled back.", on("regulation", 0.4, 0.3)),
  st("environment.15", 0.75, "Concerns about climate change should not slow down energy production."),
  st("environment.16", 0.75, "The Environmental Protection Agency should be abolished.", on("regulation", 0.7, 0.3)),
  st("environment.17", 1, "Climate change is not a serious problem."),
  st("environment.18", 1, "Economic growth should always take priority over environmental protection."),
  st("environment.19", -0.5, "Americans should change how they live, such as driving and flying less, to protect the environment."),
  st("environment.20", 0.75, "Federal subsidies for wind and solar power should end."),

  // ── Technology: Precautionary (-1) ↔ Accelerationist (+1) ──
  st("technology.01", -1, "Genetic engineering of humans should be permanently banned."),
  st("technology.02", -1, "Building artificial intelligence smarter than humans should be banned outright."),
  st("technology.03", -0.75, "Development of the most advanced AI systems should be paused until they can be proven safe."),
  st("technology.04", -0.75, "Nuclear power is too dangerous and should be phased out."),
  st("technology.05", -0.5, "Genetically modified foods should be tightly regulated."),
  st("technology.06", -0.5, "Automation that eliminates jobs should be slowed by regulation or taxes."),
  st("technology.22", -0.25, "New chemicals should have to be proven safe before they can be sold, not pulled from the market after harm appears."),
  st("technology.08", -0.25, "Self-driving cars should not be allowed on public roads until they are proven far safer than human drivers."),
  st("technology.09", 0, "Artificial intelligence will bring major benefits and major risks in roughly equal measure."),
  st("technology.10", 0, "Innovation is valuable, but government should oversee technologies that could cause large-scale harm."),
  st("technology.12", 0.25, "Self-driving cars should be allowed on public roads once they are as safe as human drivers."),
  st("technology.13", 0.5, "AI development should be largely free of government regulation.", on("regulation", 0.5, 0.3)),
  st("technology.14", 0.5, "The benefits of new technology almost always outweigh its risks."),
  st("technology.15", 0.75, "Adults should be free to use technology to enhance their physical abilities."),
  st("technology.16", 0.75, "Settling space should be a national priority."),
  st("technology.17", 1, "Technological progress should move as fast as possible, whatever the disruption."),
  st("technology.18", 1, "Human aging should be treated as a disease to be cured."),
  st("technology.19", -0.5, "Social media should be heavily restricted for anyone under 18."),
  st("technology.20", 0.5, "Parents should be allowed to use gene editing to prevent serious diseases in their children."),
  // Replaces technology.11 (nuclear power), which read energy politics as a view on technology.
  st("technology.21", 0.25, "Delivery drones should be allowed to fly over residential neighborhoods."),
];
