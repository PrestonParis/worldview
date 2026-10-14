import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicMapProject } from "@/lib/db/mapProjects";

const tokenSchema = z.uuid();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const parsed = tokenSchema.safeParse((await params).token);
  if (!parsed.success) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const project = await getPublicMapProject(parsed.data);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const etag = `\"${project.updatedAt}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json(project, {
    headers: { ETag: etag, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
