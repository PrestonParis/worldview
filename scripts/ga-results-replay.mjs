// Election-night rehearsal server for scripts/sync-ga-results.mjs. Serves a
// completed 2026-cycle election (default: the May 19 primary, all 159
// counties) from the SOS JSON API under a replay id, played back as
// if it were counting live: each frame scales every vote count and reporting
// unit up toward the final total, moves lastUpdated, and stays unofficial
// until the last frame. Scripted incidents along the way:
//
//   --flip=N     frame N puts the runner-up of the closest state contest
//                ahead (leader change); frame N+1 restores it, which also
//                lowers that contest's total (vote decrease, "correction")
//   --outage=N   frame N answers the state feed with 503 (the ingester falls
//                back to the media export, which the replay doesn't serve,
//                then to last-known-good data)
//
// Usage:
//   node scripts/ga-results-replay.mjs --election=GeneralPrimary51926 [--as=REPLAYGeneralPrimary51926] [--frames=8] [--step=20] [--port=4319] [--flip=3] [--outage=5]
//   npm run sync:ga-results -- --base-url=http://localhost:4319 --election=REPLAYGeneralPrimary51926 --watch --every=5 --until=5m
//
// Source payloads are cached once under .cache/ga-replay/<election>/.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { arg } from "./lib/bulk.mjs";
import { sosClient } from "./lib/ga-sos.mjs";

const SOURCE = arg("election", "GeneralPrimary51926");
const AS = arg("as", `REPLAY${SOURCE.replace(/\W/g, "")}`);
const FRAMES = Number(arg("frames", 8));
const STEP_MS = Number(arg("step", 20)) * 1000;
const PORT = Number(arg("port", 4319));
const FLIP = Number(arg("flip", 3));
const OUTAGE = Number(arg("outage", 5));
const CACHE = path.join(".cache", "ga-replay", SOURCE);

const client = sosClient({ concurrency: 4 });

async function cached(name, load) {
  const file = path.join(CACHE, `${name}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const json = (await load()).json;
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json));
  return json;
}

console.log(`replay: loading ${SOURCE} (cached in ${CACHE})…`);
const state = await cached("state", () => client.state(SOURCE));
const byJurisdiction = new Map(state.jurisdiction.childLocalities.map((c) => [String(c.id).toLowerCase(), c.shortName]));
const countySlugs = state.localityElections.map((e) => byJurisdiction.get(String(e.jurisdictionId).toLowerCase())).filter(Boolean);
const counties = new Map();
for (const r of await client.pool(countySlugs, async (slug) => [slug, await cached(slug, () => client.county(slug, SOURCE))])) {
  if (r.ok) counties.set(r.value[0], r.value[1]);
}
console.log(`replay: ${counties.size} counties`);

// The closest two-way state contest: the one the leader flip targets.
const target = state.ballotItems
  .map((b) => ({ b, o: [...b.summaryResults.ballotOptions].sort((x, y) => y.voteCount - x.voteCount) }))
  .filter(({ o }) => o.length >= 2 && o[0].voteCount > 0)
  .sort((a, b) => (a.o[0].voteCount - a.o[1].voteCount) - (b.o[0].voteCount - b.o[1].voteCount))[0]?.b;
console.log(`replay: leader flip on "${target?.name?.[0]?.text}"`);

const started = Date.now();
const frameNow = () => Math.min(FRAMES - 1, Math.floor((Date.now() - started) / STEP_MS));
const fraction = (f) => (f + 1) / FRAMES;
const stamp = (f) => new Date(Date.parse("2026-11-03T19:00:00Z") + f * 15 * 60_000).toISOString();

function scaleItem(item, f, { flip, correction }) {
  const isTarget = target && (item.id === target.id || item.parentId === target.id);
  // The correction frame holds the target at the previous frame's count and
  // takes 40 votes back, so its total goes down.
  const k = fraction(isTarget && correction ? f - 1 : f);
  const out = structuredClone(item);
  const rs = out.reportingStatus;
  if (rs) rs.reportingUnits = Math.round((rs.totalUnits ?? 0) * k);
  for (const o of out.summaryResults?.ballotOptions ?? []) {
    o.voteCount = Math.round((o.voteCount ?? 0) * k);
    for (const g of o.groupResults ?? []) g.voteCount = Math.round((g.voteCount ?? 0) * k);
  }
  if (isTarget && (flip || correction)) {
    const o = [...out.summaryResults.ballotOptions].sort((x, y) => y.voteCount - x.voteCount);
    if (flip) o[1].voteCount = o[0].voteCount + 25; // runner-up briefly ahead
    if (correction) o[1].voteCount = Math.max(0, o[1].voteCount - 40); // corrected downward
  }
  return out;
}

function frameOf(payload, f) {
  const out = structuredClone(payload);
  const last = f === FRAMES - 1;
  const opts = { flip: f === FLIP, correction: f === FLIP + 1 };
  out.ballotItems = (payload.ballotItems ?? []).map((b) => scaleItem(b, f, opts));
  if (out.election) Object.assign(out.election, { lastUpdated: stamp(f), isOfficialResults: last });
  for (const e of out.localityElections ?? []) Object.assign(e, { lastUpdated: stamp(f), isOfficialResults: last });
  return out;
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const f = frameNow();
    const url = new URL(req.url, "http://replay");
    const p = decodeURIComponent(url.pathname);
    const api = "/results/public/api";
    if (p === `${api}/jurisdictions/Georgia`) {
      return send(res, 200, { elections: [{ publicElectionId: AS, electionDate: "2026-11-03", name: [{ languageId: "en", text: `Replay of ${SOURCE}` }] }] });
    }
    if (p === `${api}/elections/Georgia/${AS}`) {
      return send(res, 200, { ...state.election, lastUpdated: stamp(f), isOfficialResults: f === FRAMES - 1 });
    }
    if (p === `${api}/elections/Georgia/${AS}/data`) {
      if (f === OUTAGE) return send(res, 503, { error: "replay outage" });
      return send(res, 200, frameOf(state, f));
    }
    const county = p.match(new RegExp(`^${api}/elections/([^/]+)/${AS}/data$`));
    if (county && counties.has(county[1])) return send(res, 200, frameOf(counties.get(county[1]), f));
    return send(res, 404, { error: "not in replay" });
  })
  .listen(PORT, () => console.log(`replay: ${AS} on http://localhost:${PORT}, ${FRAMES} frames × ${STEP_MS / 1000}s (flip ${FLIP}, outage ${OUTAGE})`));

setInterval(() => console.log(`replay: frame ${frameNow() + 1}/${FRAMES}`), STEP_MS).unref();
