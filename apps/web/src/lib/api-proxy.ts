/**
 * HTTP proxy helper for API routes. Never throws; returns JSON error payload on failure.
 */
export function getApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4001";
  return String(raw).replace(/\/$/, "") || "http://localhost:4001";
}

export interface ProxyErrorPayload {
  ok: false;
  error: string;
  upstreamStatus?: number;
  upstreamBody?: string;
}

function jsonError(payload: ProxyErrorPayload, status: number): Response {
  return Response.json(payload, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Proxy GET to upstream API. Returns Response with passthrough body on success.
 * On upstream 4xx/5xx or fetch failure, returns JSON error payload (never throws).
 */
export async function proxyGet(url: string): Promise<Response> {
  let upstream: Response;
  let body: string;

  try {
    upstream = await fetch(url, { cache: "no-store" });
    body = await upstream.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(
      { ok: false, error: msg },
      502,
    );
  }

  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "content-type":
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
  };

  if (upstream.ok) {
    return new Response(body, {
      status: upstream.status,
      headers,
    });
  }

  return jsonError(
    {
      ok: false,
      error: `Upstream returned ${upstream.status}`,
      upstreamStatus: upstream.status,
      upstreamBody: body.slice(0, 500),
    },
    upstream.status >= 400 ? upstream.status : 502,
  );
}
