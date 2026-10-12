"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Landmark,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  Scale,
  Users,
  Vote,
} from "lucide-react";
import type {
  GovernmentLevel,
  GovernmentLookupResult,
  GovernmentOfficial,
} from "@/lib/my-government/types";
import type { AddressSuggestion } from "@/lib/my-government/suggestions";

const GROUPS: Array<{ level: GovernmentLevel; label: string; description: string }> = [
  { level: "local", label: "Local", description: "Schools and city government" },
  { level: "county", label: "County", description: "Public safety and county services" },
  { level: "state", label: "State", description: "Legislature and executive" },
  { level: "federal", label: "Federal", description: "Congress" },
  { level: "courts", label: "Courts", description: "Trial and appellate judges" },
];

const LEVEL_ICONS: Record<GovernmentLevel, typeof Building2> = {
  local: Users,
  county: Building2,
  state: Landmark,
  federal: Landmark,
  courts: Scale,
};

function connectionHref(base: string, official: GovernmentOfficial): string {
  const params = new URLSearchParams({ official: official.name ?? official.office });
  if (official.bioguideId) params.set("bioguide", official.bioguideId);
  return `${base}?${params.toString()}`;
}

function OfficeCard({ official }: { official: GovernmentOfficial }) {
  const verified = official.status === "verified";
  const Icon = LEVEL_ICONS[official.level];
  const links = [
    { label: "Votes", icon: Vote, href: "/legislation" },
    { label: "Money", icon: BadgeDollarSign, href: "/money" },
    { label: "Promises", icon: CheckCircle2, href: "/legislation" },
    { label: "Scorecards", icon: ShieldCheck, href: "/people" },
  ];

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/20 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <Icon size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{official.office}</p>
            <h3 className={`mt-1 text-base font-semibold ${verified ? "text-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
              {official.name ?? "Official not yet resolved"}
            </h3>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${verified ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
          {verified ? "Verified" : "District only"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-900">
          <MapPin size={12} /> {official.jurisdiction}
        </span>
        {official.party ? <span>{official.party}</span> : null}
      </div>

      {verified ? (
        <div className="mt-5 grid grid-cols-4 gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          {links.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.label}
                href={connectionHref(item.href, official)}
                className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                <ItemIcon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400 dark:border-slate-800">
          The district is confirmed. A verified officeholder roster is not connected for this office yet.
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
        <a
          href={official.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          {official.sourceLabel} <ExternalLink size={11} />
        </a>
        {official.website ? (
          <a href={official.website} target="_blank" rel="noreferrer" className="font-medium text-slate-700 hover:underline dark:text-slate-200">
            Official site
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function MyGovernmentLookup({ initialAddress = "" }: { initialAddress?: string }) {
  const [address, setAddress] = useState(initialAddress);
  const [result, setResult] = useState<GovernmentLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [districtsOpen, setDistrictsOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<GovernmentLevel, GovernmentOfficial[]>();
    for (const group of GROUPS) map.set(group.level, []);
    for (const official of result?.officials ?? []) {
      map.get(official.level)?.push(official);
    }
    return map;
  }, [result]);

  async function lookupAddress(selectedAddress: string, magicKey?: string) {
    setLoading(true);
    setError("");
    setSuggestions([]);
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
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_75%_20%,#334155_0,transparent_34%),radial-gradient(circle_at_10%_100%,#1e3a5f_0,transparent_32%)]" />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
            <MapPin size={13} /> Address-based representation
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Who represents you?</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Start with one address. See the districts and public offices that govern it—from school board and county offices to the statehouse and Congress.
          </p>

          <div className="mt-8 max-w-3xl">
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
          <p className="mt-3 text-xs text-slate-400">Used only for this lookup. Worldview does not save your address.</p>
          {error ? <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        </div>
      </section>

      {!result ? (
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
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Matched address</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{result.matchedAddress}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {result.coverage.resolved} verified {result.coverage.resolved === 1 ? "official" : "officials"} found
                {result.coverage.gaps?.length ? ` · ${result.coverage.gaps.length} coverage ${result.coverage.gaps.length === 1 ? "gap" : "gaps"}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDistrictsOpen((open) => !open)}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 sm:self-auto"
            >
              <MapPin size={15} /> {result.districts.length} matched districts
              <ChevronDown size={15} className={`transition-transform ${districtsOpen ? "rotate-180" : ""}`} />
            </button>
          </section>

          {districtsOpen ? (
            <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
              {result.districts.map((district) => (
                <span key={`${district.kind}-${district.geoid}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <strong className="font-semibold text-slate-900 dark:text-white">{district.kind}:</strong> {district.name}
                </span>
              ))}
            </div>
          ) : null}

          {result.coverage.gaps?.length ? (
            <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold">Some offices still need a verified roster</p>
                <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-200/80">
                  Worldview found the jurisdictions but will not guess an officeholder: {result.coverage.gaps.map((gap) => `${gap.office} (${gap.jurisdiction})`).join(" · ")}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-10 space-y-12">
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
                    {officials.map((official) => <OfficeCard key={official.id} official={official} />)}
                  </div>
                </section>
              );
            })}
          </div>

          <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800">
            Sources: {result.sources.map((source, index) => (
              <span key={source.url}>{index ? " · " : ""}<a href={source.url} target="_blank" rel="noreferrer" className="hover:text-slate-700 hover:underline dark:hover:text-slate-200">{source.label}</a></span>
            ))}
          </footer>
        </div>
      )}
    </div>
  );
}
