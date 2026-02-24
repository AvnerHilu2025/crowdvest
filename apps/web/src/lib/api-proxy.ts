/**
 * Simple HTTP proxy helper. Uses fetch only - no filesystem, no .next, no manifest.
 */
const API_BASE =
  (process.env.API_URL ?? "http://localhost:4001").replace(/\/$/, "") ||
  "http://localhost:4001";

export function getApiBase(): string {
  return API_BASE;
}

export async function proxyGet(url: string): Promise<Response> {
  const upstream = await fetch(url, { cache: "no-store" });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ??
        "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
