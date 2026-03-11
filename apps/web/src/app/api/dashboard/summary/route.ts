import { NextRequest, NextResponse } from "next/server";

const SAFE_DEFAULTS = {
  productionAggregationMode: null,
  aggregationModeRanking: [] as unknown[],
  strategyProfile: null,
  strategyDefaults: null,
  runFlowDefaults: null,
  executionPreset: null,
  launchPlan: null,
  dataSource: { type: "synthetic" as const, datasetVersion: null, provider: null },
  crowdSignals: { window: 20, items: [] as unknown[] },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shapeData(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };

  if (!("productionAggregationMode" in out) || out.productionAggregationMode == null) {
    out.productionAggregationMode = SAFE_DEFAULTS.productionAggregationMode;
  }
  if (!Array.isArray(out.aggregationModeRanking)) {
    out.aggregationModeRanking = SAFE_DEFAULTS.aggregationModeRanking;
  }
  if (!("strategyProfile" in out) || out.strategyProfile == null || !isPlainObject(out.strategyProfile)) {
    out.strategyProfile = SAFE_DEFAULTS.strategyProfile;
  }
  if (!("strategyDefaults" in out) || out.strategyDefaults == null || !isPlainObject(out.strategyDefaults)) {
    out.strategyDefaults = SAFE_DEFAULTS.strategyDefaults;
  }
  if (!("runFlowDefaults" in out) || out.runFlowDefaults == null || !isPlainObject(out.runFlowDefaults)) {
    out.runFlowDefaults = SAFE_DEFAULTS.runFlowDefaults;
  }
  if (!("executionPreset" in out) || out.executionPreset == null || !isPlainObject(out.executionPreset)) {
    out.executionPreset = SAFE_DEFAULTS.executionPreset;
  }
  if (!("launchPlan" in out) || out.launchPlan == null || !isPlainObject(out.launchPlan)) {
    out.launchPlan = SAFE_DEFAULTS.launchPlan;
  }
  if (
    !("dataSource" in out) ||
    out.dataSource == null ||
    !isPlainObject(out.dataSource)
  ) {
    out.dataSource = { ...SAFE_DEFAULTS.dataSource };
  } else {
    const ds = out.dataSource as Record<string, unknown>;
    if (typeof ds.type !== "string") ds.type = "synthetic";
    if (!("datasetVersion" in ds)) ds.datasetVersion = null;
    if (!("provider" in ds)) ds.provider = null;
  }
  if (
    !("crowdSignals" in out) ||
    out.crowdSignals == null ||
    !isPlainObject(out.crowdSignals) ||
    !Array.isArray((out.crowdSignals as Record<string, unknown>).items)
  ) {
    out.crowdSignals = { ...SAFE_DEFAULTS.crowdSignals };
  }
  if (
    !("signalValidation" in out) ||
    out.signalValidation == null ||
    !isPlainObject(out.signalValidation)
  ) {
    out.signalValidation = {
      total: 0,
      validated: 0,
      accuracyRate: null,
      latestItems: [],
    };
  } else {
    const sv = out.signalValidation as Record<string, unknown>;
    if (typeof sv.total !== "number") sv.total = 0;
    if (typeof sv.validated !== "number") sv.validated = 0;
    if (sv.accuracyRate != null && typeof sv.accuracyRate !== "number") sv.accuracyRate = null;
    if (!Array.isArray(sv.latestItems)) sv.latestItems = [];
  }
  if ("signalHistoryStats" in out && out.signalHistoryStats != null && isPlainObject(out.signalHistoryStats)) {
    const shs = out.signalHistoryStats as Record<string, unknown>;
    if (typeof shs.totalSnapshots !== "number" || typeof shs.symbolsCovered !== "number") {
      out.signalHistoryStats = { totalSnapshots: 0, symbolsCovered: 0 };
    }
  }

  return out;
}

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

    let data: unknown;
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

    if (!isPlainObject(data)) {
      data = {};
    }

    let shaped: Record<string, unknown>;
    try {
      shaped = shapeData(data);
    } catch {
      shaped = data;
    }

    return NextResponse.json(shaped, {
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
