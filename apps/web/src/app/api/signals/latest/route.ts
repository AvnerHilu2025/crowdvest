import { NextRequest } from "next/server";
import { getApiBase, proxyGet } from "@/lib/api-proxy";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.toString();
  const url = `${getApiBase()}/signals/latest${search ? `?${search}` : ""}`;
  return proxyGet(url);
}
