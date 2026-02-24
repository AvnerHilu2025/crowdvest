import { NextRequest } from "next/server";
import { getApiBase, proxyGet } from "@/lib/api-proxy";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const search = request.nextUrl.search;
  const url = `${getApiBase()}/runs/${encodeURIComponent(runId)}${search}`;

  try {
    return await proxyGet(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "upstream_error", message: msg, upstream: url }),
      {
        status: 502,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }
}
