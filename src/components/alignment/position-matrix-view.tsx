"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/search/search-input";
import type { Entity } from "@/lib/validation/entity";
import type { Claim } from "@/lib/validation/claim";

export function PositionMatrixView({
  claims,
  entities,
  searchPlaceholder,
}: {
  claims: Claim[];
  entities: Entity[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const { topics, rows } = useMemo(() => {
    const topicSet = new Set<string>();
    const bySpeakerTopic = new Map<string, Map<string, Claim>>();

    for (const c of claims) {
      if (!c.topic) continue;
      topicSet.add(c.topic);
      const bySpeaker = bySpeakerTopic.get(c.speakerEntityId) ?? new Map<string, Claim>();
      const existing = bySpeaker.get(c.topic);
      if (!existing || existing.date < c.date) bySpeaker.set(c.topic, c);
      bySpeakerTopic.set(c.speakerEntityId, bySpeaker);
    }

    const topicList = Array.from(topicSet).sort();
    const rowList = Array.from(bySpeakerTopic.entries())
      .map(([speakerId, byTopic]) => ({
        speaker: entityById.get(speakerId),
        speakerId,
        byTopic,
      }))
      .filter((r) => r.speaker)
      .sort((a, b) => a.speaker!.name.localeCompare(b.speaker!.name));

    return { topics: topicList, rows: rowList };
  }, [claims, entityById]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.speaker!.name.toLowerCase().includes(q));
  }, [rows, query]);

  if (topics.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate-400">
        No claims have a topic set yet — add a topic to a claim to start building the matrix.
      </p>
    );
  }

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />

      <div className="mt-6 overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 border-b border-slate-200 bg-white py-2 pr-4 text-left text-xs font-medium tracking-wider text-slate-400 uppercase dark:border-slate-800 dark:bg-slate-950">
                Person
              </th>
              {topics.map((t) => (
                <th
                  key={t}
                  className="border-b border-slate-200 px-4 py-2 text-left text-xs font-medium whitespace-nowrap text-slate-400 dark:border-slate-800"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.speakerId} className="border-b border-slate-100 dark:border-slate-900">
                <td className="sticky left-0 bg-white py-2.5 pr-4 font-medium whitespace-nowrap text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  {row.speaker!.name}
                </td>
                {topics.map((t) => {
                  const claim = row.byTopic.get(t);
                  return (
                    <td
                      key={t}
                      className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400"
                      title={claim?.quote}
                    >
                      {claim?.positionClassification || (claim ? "recorded" : "—")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
