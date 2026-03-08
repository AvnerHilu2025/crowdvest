import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4001";
    const upstreamUrl = new URL("/dashboard/summary", apiBaseUrl);

    req.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    const text = await upstreamRes.text();

    if (!upstreamRes.ok) {
      return new NextResponse(text || "Upstream error", {
        status: upstreamRes.status,
        headers: {
          "content-type": upstreamRes.headers.get("content-type") || "text/plain; charset=utf-8",
        },
      });
    }

    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return new NextResponse(text || "Invalid upstream JSON", {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }

    if (typeof data !== "object" || data === null) {
      data = {};
    }

    if (!("productionAggregationMode" in data)) {
      data.productionAggregationMode = null;
    }

    if (!Array.isArray(data.aggregationModeRanking)) {
      data.aggregationModeRanking = [];
    }

    if (!("strategyProfile" in data) || data.strategyProfile == null || typeof data.strategyProfile !== "object") {
      data.strategyProfile = {
        key: "conservative",
        name: "Conservative",
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
        intendedUse: "production",
      };
    }

    const defaultStrategyDefaults = {
      benchmarkDefaults: {
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
        symbols: ["SPY", "QQQ", "IWM"],
        windows: [29, 60, 120],
        n: 20,
      },
      runDefaults: {
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
        assetSymbols: ["SPY", "QQQ", "IWM"],
        points: 29,
      },
    };
    if (!("strategyDefaults" in data) || data.strategyDefaults == null || typeof data.strategyDefaults !== "object") {
      data.strategyDefaults = defaultStrategyDefaults;
    }

    if (!("strategyDefaults" in data) || data.strategyDefaults == null || typeof data.strategyDefaults !== "object") {
      data.strategyDefaults = {
        benchmarkDefaults: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20 },
        runDefaults: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", assetSymbols: ["SPY", "QQQ", "IWM"], points: 29 },
      };
    }

    return NextResponse.json(data, {
      status: 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.stack || error.message : "Unknown proxy error";
    return new NextResponse(message, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
