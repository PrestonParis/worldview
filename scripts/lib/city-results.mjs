// Elections a city runs itself (data/elections/ga/schedule.json, `cities`):
// read from the city's own results page, and any results document it links
// to, then evaluated and stored like SOS contests under source "city:{id}".
// Parsing is in src/lib/elections/close-races/city.ts. Before polls close
// the contests are stored with no votes, so the report lists them and
// coverage counts them from the start.

import { fetchRetry } from "./bulk.mjs";
import { raiseAlert } from "./alerts.mjs";
import { writeContests } from "./close-races-store.mjs";
import { cityContest, extractVotes, pageText, resultLinks } from "../../src/lib/elections/close-races/city.ts";
import { evaluateContest } from "../../src/lib/elections/close-races/evaluate.ts";
import { stableHash } from "../../src/lib/elections/close-races/merge.ts";

const MAX_DOCUMENTS = 5;

async function documentText(url) {
  const res = await fetchRetry(url, { timeoutMs: 30_000 }, { attempts: 2, label: url });
  const type = res.headers.get("content-type") ?? "";
  if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(url)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return { html: "", text: String(text).replace(/\s+/g, " ") };
  }
  const html = await res.text();
  return { html, text: pageText(html) };
}

/** Votes per contest for one city, or nulls before polls close / when nothing is posted. */
export async function readCity(city, { now = new Date() } = {}) {
  const none = () => city.contests.map((contest) => ({ contest, votes: null }));
  if (now.getTime() < Date.parse(city.pollsCloseUtc)) return { contests: none(), text: null, note: "results after polls close" };
  let text;
  try {
    const page = await documentText(city.resultsUrl);
    const texts = [page.text];
    for (const url of resultLinks(page.html, city.resultsUrl).slice(0, MAX_DOCUMENTS)) {
      try {
        texts.push((await documentText(url)).text);
      } catch (err) {
        console.warn(`  ${city.name}: ${url} failed: ${err.message}`);
      }
    }
    text = texts.join(" \n ");
  } catch (err) {
    return { contests: none(), text: null, note: `results page unreadable: ${err.message}`.slice(0, 300) };
  }
  const contests = city.contests.map((contest) => ({ contest, votes: extractVotes(text, contest.candidates) }));
  const read = contests.filter((c) => c.votes).length;
  return { contests, text, note: read === contests.length ? "results read from the city's page" : read ? `${contests.length - read} contest(s) not posted yet` : "no results posted yet" };
}

/**
 * Reads and stores every scheduled city's contests. Returns the coverage
 * observations (src/lib/elections/close-races/coverage.ts).
 */
export async function syncCities(pg, { electionId, electionDate, sourceUpdatedAt = null, kind, cities, municipalRules = {}, overrides = {}, dryRun = false, now = new Date() }) {
  const observations = [];
  for (const city of cities) {
    const read = await readCity(city, { now });
    const evaluated = read.contests.map(({ contest, votes }) =>
      evaluateContest(cityContest(city, contest, votes, votes ? now.toISOString() : null), { electionKind: kind, municipalRules, overrides }),
    );
    for (const e of evaluated) {
      console.log(`  ${city.name}: ${e.name} — ${e.margin.totalVotes ? e.options.map((o) => `${o.name} ${o.votes}`).join(", ") : read.note}`);
    }
    if (!dryRun) {
      await writeContests(pg, { source: `city:${city.id}`, electionId, header: { electionDate, lastUpdated: sourceUpdatedAt }, kind, evaluated, complete: true });
      // Polls have closed and the page (as it reads now) gives no result:
      // one alert per distinct page text, so a newly posted result that
      // doesn't parse is reported once.
      if (read.text != null && read.contests.some((c) => !c.votes)) {
        await raiseAlert(pg, {
          election: electionId,
          key: `city-unread:${city.id}:${stableHash(read.text)}`,
          kind: "city_results",
          severity: "info",
          message: `${city.name}: ${read.note}; results page ${city.resultsUrl}`,
        });
      }
    }
    observations.push({ id: city.id, name: city.name, resultsUrl: city.resultsUrl, source: city.source ?? null, expected: city.contests.length, tracked: evaluated.length, note: read.note });
  }
  return observations;
}
