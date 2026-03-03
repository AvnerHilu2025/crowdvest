import { NextRequest, NextResponse } from "next/server";

function getUpstreamBase(): string {
  const raw =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4001";
  return String(raw).replace(/\/$/, "") || "http://localhost:4001";
}

export async function GET(request: NextRequest) {
  const baseUrl = getUpstreamBase();
  const assetSymbol = request.nextUrl.searchParams.get("assetSymbol") ?? "";
  const window = request.nextUrl.searchParams.get("window") ?? "30";

  const params = new URLSearchParams();
  if (assetSymbol) params.set("assetSymbol", assetSymbol);
  params.set("window", window);

  const upstreamUrl = `${baseUrl}/dashboard/drift?${params.toString()}`;

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
