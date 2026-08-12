import { timingSafeEqual } from "crypto";

/**
 * Verifies the `Authorization: Bearer <INGEST_API_KEY>` header on an
 * ingestion request. Returns `null` when the request is authorized, or an
 * error message to return to the caller otherwise.
 */
export function checkIngestAuth(request: Request): string | null {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) {
    return "INGEST_API_KEY is not configured on the server.";
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return "Missing or malformed Authorization header. Use: Authorization: Bearer <INGEST_API_KEY>";
  }

  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  const matches =
    expectedBuf.length === tokenBuf.length &&
    timingSafeEqual(expectedBuf, tokenBuf);

  return matches ? null : "Invalid API key.";
}
