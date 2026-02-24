import { NextRequest, NextResponse } from "next/server";

function getUpstreamBase(): string {
  const raw =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4001";
  return String(raw).replace(/\/$/, "") || "http://localhost:4001";
}

export async function GET(request: NextRequest) {
  const assetSymbol = request.nextUrl.searchParams.get("assetSymbol") ?? "SPY";
  const baseUrl = getUpstreamBase();
  const upstreamUrl = `${baseUrl}/results/latest?assetSymbol=${encodeURIComponent(assetSymbol)}`;

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
