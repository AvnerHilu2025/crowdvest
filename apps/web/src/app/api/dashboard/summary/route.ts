import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBase(): string {
  // Prefer env, fallback to local api
  return (
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.API_BASE ||
    "http://localhost:4001"
  );
}

export async function GET(request: NextRequest) {
  const base = getBase();
  const search = request.nextUrl.search; // includes leading "?" or ""
  const upstreamUrl = `${base}/dashboard/summary${search}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      // avoid Next caching weirdness
      cache: "no-store",
    });

    const body = await upstreamRes.text();

    // Pass through status; ensure json content-type for jq/curl
    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        "content-type": upstreamRes.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: "dashboard_summary_proxy_failed", message: msg, upstreamUrl },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }
}
