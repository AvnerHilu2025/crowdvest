import { NextRequest, NextResponse } from "next/server";

function getUpstreamBase(): string {
  const raw =
    process.env.API_BASE_URL ??
    process.env.API_BASE ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4001";
  return String(raw).replace(/\/$/, "") || "http://localhost:4001";
}

export async function POST(request: NextRequest) {
  const baseUrl = getUpstreamBase();
  const upstreamUrl = `${baseUrl}/strategy-profiles/active`;

  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, upstream: upstreamUrl },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
