# Roadmap (internal)

Features planned but not built. None of this is shown in the app; it used to
appear in "What's planned for this page" dropdowns, nav blurbs, and the
Geography header, and was moved here on 2026-10-08 (see `platform-audit.md`).
When something ships, add it to the page's copy and delete it here.

## Feature gap audit — 2026-10-13

What the platform was missing as of this date, beyond layout. Shipped items
are listed so the next audit starts from here.

**Shipped 2026-10-13**
- Issue hubs: `/economy`, `/health-care`, `/guns`, `/housing`, `/education`,
  `/energy` (importers `import:fred`, `import:acs-issues`, `import:health`,
  `import:guns`, `import:naep`, `import:climate`; see `data-sources.md`).
  Nav now has Issues / Economy / Society menus.
- State profiles: `/states` and `/states/[slug]` — every topic for one state
  beside the U.S. value and the state's rank, plus presidential results and
  2026 races. Every hub's state table links to them; site search sends a
  state name there.

**Open, in priority order**
1. Sharing and export (deferred by choice). CSV download exists only on the
   contributions list, the crime state explorer, and the map export. Wanted:
   a CSV/PNG download on every `ChartCard`, a shareable deep link per chart
   and per StateExplorer view (metric + state in the URL), an embed snippet,
   and a "cite this" line with source and retrieval date.
2. Search reaches pages, not figures: "Ohio murder rate" or "border encounters
   2024" should land on the chart (and the state) that answers it.
3. Geography data layers (below): color states by any platform dataset.
4. Accounts do little beyond the quiz: follow a politician or bill, save a
   view, alerts.
5. Missing data on the new hubs: homelessness (HUD PIT; bot-checked
   downloads), NICS background checks and state gun laws, state energy mix
   (EIA key), state life expectancy, school spending per pupil.
6. Platform debt still open from `platform-audit.md`: no `loading.tsx`,
   unpaginated `/data/*` tables, no caching (`force-dynamic` everywhere),
   registration-code brute force.

## People & Power
- Endorsement graph (endorsement exists only as an edge type)
- Political dynasty / family graph
- Career timeline

## Legislation & Courts
- Amendment diff
- Campaign promise tracker
- Court case explorer (SCDB stats exist on `/legislation`; no case route)
- Supreme Court precedent graph

## Money & Influence
- Revolving door tracker (see `money-influence-plan.md`)

## Elections & Maps
- Election scenario simulator
- County / precinct political explorer
- Electoral swing map
- District explorer
- Gerrymandering viewer

## My Government
- Campaign promises and scorecards per official

## Geography
- Data layers: color countries/states by any platform dataset (choropleth helper
  in `src/lib/map/choroplethLayer.ts`; datasets API as the layer source)
- US state, county, and district boundaries
- War / geopolitics studio
- Alliance / treaty graph (needs a source, e.g. Correlates of War)
- Sanctions explorer (OFAC / EU lists)
- Trade dependency map (UN Comtrade or BACI)
- Starter templates
- Mobile / view-only layout below `lg`
- Phase 4 live broadcast output (see `geography-graphics-plan.md`)

## README
- Short product walkthrough video
