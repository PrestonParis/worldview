import { currentUserIsOwner } from "@/lib/auth/guard";
import { loadProviderData, ProviderQueryError } from "@/lib/map/providers/server";
import type { DataProviderId } from "@/lib/types";

const PROVIDERS = new Set<DataProviderId>([
  "worldview", "ais-ships", "usgs-earthquakes", "gdacs", "nasa-firms",
  "natural-earth-disputes", "marine-regions-eez",
]);

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  if (!(await currentUserIsOwner())) return Response.json({ error: "Not found." }, { status: 404 });
  const { provider } = await params;
  if (!PROVIDERS.has(provider as DataProviderId)) {
    return Response.json({ error: `Unknown Geography provider ${provider}.` }, { status: 404 });
  }
  try {
    const result = await loadProviderData(provider as DataProviderId, new URL(request.url).searchParams);
    return Response.json(result, {
      headers: { "Cache-Control": provider === "ais-ships" ? "private, max-age=2" : provider === "usgs-earthquakes" ? "private, max-age=30" : "private, max-age=300" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Provider request failed." },
      { status: error instanceof ProviderQueryError ? 400 : 502 },
    );
  }
}
