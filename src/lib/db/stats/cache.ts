import { unstable_cache } from "next/cache";

export const AREA_STATS_TAG = "area-stats";

export function cacheStatsQuery<Arguments extends unknown[], Result>(
  name: string,
  query: (...args: Arguments) => Promise<Result>,
) {
  return unstable_cache(query, ["area-stats", name], {
    tags: [AREA_STATS_TAG],
    revalidate: 86_400,
  });
}
