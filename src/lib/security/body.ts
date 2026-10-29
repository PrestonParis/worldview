import "server-only";

export class RequestBodyTooLarge extends Error {}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyTooLarge();
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new RequestBodyTooLarge();
  return JSON.parse(text);
}
