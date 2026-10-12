# Roadmap (internal)

Features planned but not built. None of this is shown in the app; it used to
appear in "What's planned for this page" dropdowns, nav blurbs, and the
Geography header, and was moved here on 2026-10-08 (see `platform-audit.md`).
When something ships, add it to the page's copy and delete it here.

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
