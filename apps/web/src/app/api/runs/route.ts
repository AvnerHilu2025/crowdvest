import { NextRequest } from "next/server";
import { getApiBase, proxyGet } from "@/lib/api-proxy";

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.toString();
    const url = search
      ? `${getApiBase()}/runs?${search}`
      : `${getApiBase()}/runs`;
    return await proxyGet(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: msg },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
