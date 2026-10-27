"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bookmark, ChevronDown, LoaderCircle, MapPin, Search } from "lucide-react";
import type {
  GovernmentLevel,
  GovernmentLookupResult,
  GovernmentOfficial,
  OfficialRecord,
} from "@/lib/my-government/types";
import type { AddressSuggestion } from "@/lib/my-government/suggestions";
import { FeatureList } from "@/components/ui/feature-list";
import { MyRaces } from "@/components/my-government/highlights";
import { OfficialAvatar, OfficialCard } from "@/components/my-government/official-card";
import { clearMyGovernment, saveMyGovernment, useMyGovernment } from "@/components/my-government/use-my-government";
import { savedAsLookup } from "@/lib/my-government/saved";

const GROUPS: Array<{ level: GovernmentLevel; label: string; description: string }> = [
  { level: "federal", label: "In Washington", description: "Your members of Congress" },
  { level: "state", label: "At the statehouse", description: "Your legislators and statewide officers" },
  { level: "county", label: "County", description: "Public safety and county services" },
  { level: "local", label: "Local", description: "Schools and city government" },
  { level: "courts", label: "Courts", description: "Trial and appellate judges" },
];

// Profile links and headline numbers for the officials shown, keyed by
// entity id and Bioguide id (federal officials arrive with only the latter).
function useOfficialRecords(officials: GovernmentOfficial[] | undefined) {
  const query = useMemo(() => {
    const e = [...new Set((officials ?? []).flatMap((o) => (o.entityId ? [o.entityId] : [])))].sort();
    const b = [...new Set((officials ?? []).flatMap((o) => (o.bioguideId && !o.entityId ? [o.bioguideId] : [])))].sort();
    return e.length || b.length ? new URLSearchParams({ e: e.join(","), b: b.join(",") }).toString() : "";
  }, [officials]);
  const [data, setData] = useState<{ query: string; records: OfficialRecord[] } | null>(null);

  useEffect(() => {
    if (!query) return;
    let live = true;
    fetch(`/api/my-government/records?${query}`)
      .then((res) => (res.ok ? res.json() : { records: [] }))
      .then((body: { records: OfficialRecord[] }) => {
        if (live) setData({ query, records: body.records });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [query]);

  return useMemo(() => {
    const byKey = new Map<string, OfficialRecord>();
    for (const r of data?.query === query ? data.records : []) {
      byKey.set(r.entityId, r);
      if (r.bioguideId) byKey.set(r.bioguideId, r);
    }
    return (o: GovernmentOfficial) => (o.entityId && byKey.get(o.entityId)) || (o.bioguideId && byKey.get(o.bioguideId)) || undefined;
  }, [data, query]);
}

function partySummary(officials: GovernmentOfficial[]): string {
  const counts = new Map<string, number>();
  for (const o of officials) {
    const p = o.party?.toUpperCase().startsWith("DEM") ? "D" : o.party?.toUpperCase().startsWith("REP") ? "R" : o.party ? "Other" : "";
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return ["D", "R", "Other"].flatMap((p) => (counts.get(p) ? [`${counts.get(p)} ${p}`] : [])).join(" · ");
}

export function MyGovernmentLookup({ initialAddress = "" }: { initialAddress?: string }) {
  const [address, setAddress] = useState(initialAddress);
  const [result, setResult] = useState<GovernmentLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [districtsOpen, setDistrictsOpen] = useState(false);
  // "saved" once this lookup is kept; "device" when only this browser has it.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "device">("idle");
  const saved = useMyGovernment();

  // With no fresh lookup (and no ?address=), show the saved result.
  const showingSaved = !result && !initialAddress && Boolean(saved);
  const shown = useMemo(
    () => result ?? (showingSaved && saved ? savedAsLookup(saved) : null),
    [result, saved, showingSaved],
  );
  const isSaved = showingSaved || saveState === "saved" || saveState === "device";

  const grouped = useMemo(() => {
    const map = new Map<GovernmentLevel, GovernmentOfficial[]>();
    for (const group of GROUPS) map.set(group.level, []);
    for (const official of shown?.officials ?? []) {
      map.get(official.level)?.push(official);
    }
    return map;
  }, [shown]);
  const recordFor = useOfficialRecords(shown?.officials);
  const people = (shown?.officials ?? []).filter((o) => o.status === "verified" && o.name);

  async function save() {
    if (!result) return;
    setSaveState("saving");
    setSaveState((await saveMyGovernment(result)) ? "saved" : "device");
  }

  async function forget() {
    setSaveState("idle");
    if (showingSaved) setAddress("");
    await clearMyGovernment();
  }

  async function lookupAddress(selectedAddress: string, magicKey?: string) {
    setLoading(true);
    setError("");
    setSuggestions([]);
    setSaveState("idle");
    try {
      const response = await fetch("/api/my-government", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: selectedAddress, magicKey }),
      });
      const body = (await response.json()) as GovernmentLookupResult & { error?: string };
      if (!response.ok) throw new Error(body.error || "Address lookup failed.");
      setResult(body);
    } catch (lookupError) {
      setResult(null);
      setError(lookupError instanceof Error ? lookupError.message : "Address lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function findSuggestions() {
    setSuggesting(true);
    setError("");
    setSuggestions([]);
    try {
      const response = await fetch("/api/my-government/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: address }),
      });
      const body = (await response.json()) as { suggestions?: AddressSuggestion[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Address suggestions are temporarily unavailable.");
      if (!body.suggestions?.length) {
        throw new Error("No matching addresses found. Add a city, state, or ZIP code and try again.");
      }
      setSuggestions(body.suggestions);
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : "Address suggestions are temporarily unavailable.");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/\b[A-Z]{2},?\s+\d{5}(?:-\d{4})?\b/i.test(address)) {
      await lookupAddress(address);
      return;
    }
    await findSuggestions();
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    setAddress(suggestion.text);
    void lookupAddress(suggestion.text, suggestion.magicKey);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <section
        className={`relative overflow-hidden rounded-[28px] bg-slate-950 text-white ${shown ? "px-6 py-6 sm:px-8" : "px-6 py-10 sm:px-10 sm:py-14"}`}
      >
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_75%_20%,#334155_0,transparent_34%),radial-gradient(circle_at_10%_100%,#1e3a5f_0,transparent_32%)]" />
        <div className={`relative ${shown ? "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" : "max-w-3xl"}`}>
          {shown ? (
            <h1 className="text-2xl font-semibold tracking-tight">Who represents you?</h1>
          ) : (
            <>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Who represents you?</h1>
              <FeatureList
                tone="inverse"
                className="mt-4"
                items={["Every district for one address", "From school board to Congress", "Who holds each office"]}
              />
            </>
          )}

          <div className={shown ? "w-full max-w-2xl" : "mt-8 max-w-3xl"}>
            <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/25 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <MapPin size={18} className="shrink-0 text-slate-400" />
                <span className="sr-only">Your home address</span>
                <input
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setSuggestions([]);
                    setError("");
                  }}
                  placeholder="Street address, city, state, ZIP"
                  autoComplete="street-address"
                  aria-controls={suggestions.length ? "address-suggestions" : undefined}
                  aria-expanded={suggestions.length > 0}
                  className="h-12 min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400"
                />
              </label>
              <button
                type="submit"
                disabled={loading || suggesting || address.trim().length < 5}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading || suggesting ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />}
                {loading ? "Finding districts" : suggesting ? "Finding addresses" : "Find my government"}
              </button>
            </form>

            {suggestions.length ? (
              <div id="address-suggestions" className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-950 shadow-2xl" role="listbox" aria-label="Available addresses">
                <p className="px-3 pb-2 pt-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">Choose an address</p>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.magicKey}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => selectSuggestion(suggestion)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                  >
                    <MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" />
                    <span>{suggestion.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {shown ? null : (
            <p className="mt-3 text-xs text-slate-400">Worldview does not save your address. Saving a result keeps only your districts and officials.</p>
          )}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        </div>
      </section>

      {!shown ? (
        <section className="grid gap-4 py-10 sm:grid-cols-3">
          {[
            ["1", "Match your address", "The Census geocoder identifies the exact government and school districts for your location."],
            ["2", "Resolve officeholders", "Current public rosters are matched to those districts, with every source attached."],
            ["3", "Follow the record", "Jump from each official to their votes, donors, and connections across Worldview."],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">{number}</span>
              <h2 className="mt-5 font-semibold text-slate-950 dark:text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
            </div>
          ))}
        </section>
      ) : (
        <div className="py-10">
          <section className="flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{showingSaved ? "Your saved government" : "Matched address"}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{shown.matchedAddress}</h2>
              {people.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex -space-x-1">
                    {people.map((o) => (
                      <OfficialAvatar key={o.id} name={o.name!} party={o.party} size="sm" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">{people.length} officials</span> represent this address
                    {partySummary(people) ? ` · ${partySummary(people)}` : ""}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              {isSaved ? (
                <button
                  type="button"
                  onClick={forget}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 dark:border-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  title="Stop highlighting these races and officials"
                >
                  <Bookmark size={15} fill="currentColor" /> Saved · Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={save}
                  disabled={saveState === "saving"}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <Bookmark size={15} /> {saved ? "Replace my saved government" : "Save as my government"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDistrictsOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <MapPin size={15} /> {shown.districts.length} matched districts
                <ChevronDown size={15} className={`transition-transform ${districtsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          </section>

          {saveState === "saved" || saveState === "device" ? (
            <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Saved. Elections and profiles across Worldview now point out your races and officials.
              {saveState === "device" ? (
                <> Kept on this device only — <Link href="/login?next=/my-government" className="font-medium text-blue-700 hover:underline dark:text-blue-300">sign in</Link> to keep it everywhere.</>
              ) : null}
            </p>
          ) : null}

          {isSaved ? <MyRaces className="mt-8" /> : null}

          {districtsOpen ? (
            <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
              {shown.districts.map((district) => (
                <span key={`${district.kind}-${district.geoid}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <strong className="font-semibold text-slate-900 dark:text-white">{district.kind}:</strong> {district.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-8 space-y-10">
            {GROUPS.map((group) => {
              const officials = grouped.get(group.level) ?? [];
              if (!officials.length) return null;
              return (
                <section key={group.level}>
                  <div className="mb-4 flex items-baseline gap-3">
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{group.label}</h2>
                    <p className="text-sm text-slate-400">{group.description}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {officials.map((official) => (
                      <OfficialCard key={official.id} official={official} record={recordFor(official)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {shown.coverage.gaps?.length ? (
            <section className="mt-12">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Also on this address, no officeholder roster yet</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {shown.coverage.gaps.map((gap) => (
                  <li
                    key={`${gap.office}-${gap.jurisdiction}`}
                    className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {gap.office} <span className="text-slate-400">· {gap.jurisdiction}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800">
            Sources: {shown.sources.map((source, index) => (
              <span key={source.url}>{index ? " · " : ""}<a href={source.url} target="_blank" rel="noreferrer" className="hover:text-slate-700 hover:underline dark:hover:text-slate-200">{source.label}</a></span>
            ))}
          </footer>
        </div>
      )}
    </div>
  );
}
