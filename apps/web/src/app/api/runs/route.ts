import { NextRequest, NextResponse } from "next/server";

function getUpstreamBase(): string {
  const raw =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4001";
  return String(raw).replace(/\/$/, "") || "http://localhost:4001";
}

function parseLimit(value: string | null): number {
  if (value == null || value === "") return 30;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(n, 200);
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const baseUrl = getUpstreamBase();
  const upstreamUrl = `${baseUrl}/runs?limit=${limit}`;

  try {
    const res = await fetch(upstreamUrl, { cache: "no-store" });
    const body = await res.json();
    return NextResponse.json(body, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, upstream: upstreamUrl },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
