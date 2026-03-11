import { NextRequest } from "next/server";
import { getApiBase, proxyGet } from "@/lib/api-proxy";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const url = `${getApiBase()}/runs/${encodeURIComponent(runId)}/metadata`;
    return await proxyGet(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: msg },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
