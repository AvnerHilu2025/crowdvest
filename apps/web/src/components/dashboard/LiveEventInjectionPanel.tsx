"use client";

import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type InjectedEventRow = {
  id: string;
  createdAt: string;
  title: string;
  sourceType: string;
  sentiment: number;
  step: number;
  assetSymbol: string;
};

type InjectResponse = {
  injectedEventId: string;
  affectedRunId: string;
  runVariantId: string;
  recalculationStatus: "completed" | "failed" | "skipped";
  recalculationDetail?: string;
  affectedArchetypesSummary: string[];
  simulationPlatform?: string;
  targetArchetypeCount?: number;
  archetypeScaleCount?: number;
  mixedInterpretationActive?: boolean;
  interpretationSummary?: string;
};
type EventMutationResponse = {
  affectedRunId: string;
  runVariantId: string;
  assetSymbol: string;
  deletedCount: number;
  removedEventId?: string;
  recalculationStatus: "completed" | "failed" | "skipped";
  recalculationDetail?: string;
};

type SimulationSource = "custom" | "x" | "facebook" | "reddit" | "sec" | "newswire";
type InjectionInputMode = "form" | "json";

type PresetFields = {
  sourceType: "news" | "social" | "macro" | "rumor";
  sourceName: string;
  title: string;
  sentiment: string;
  confidence: string;
  urgency: string;
  relevance: string;
  reach: string;
  credibility: string;
  step: string;
  targetArchetypesRaw: string;
  sensitivityOverridesRaw: string;
  archetypeSentimentScaleRaw: string;
  defaultArchetypeSentimentScale: string;
};

const SOURCE_PRESETS: Record<Exclude<SimulationSource, "custom">, PresetFields & { simulationPlatform: string }> = {
  x: {
    simulationPlatform: "x",
    sourceType: "social",
    sourceName: "x-live-timeline",
    title: "X panic: unverified headline spreads (simulated)",
    sentiment: "-0.55",
    confidence: "0.45",
    urgency: "0.88",
    relevance: "0.72",
    reach: "0.92",
    credibility: "0.38",
    step: "2",
    targetArchetypesRaw: "",
    sensitivityOverridesRaw: JSON.stringify({ info: 1.35, event: 1.45 }, null, 0),
    defaultArchetypeSentimentScale: "1",
    archetypeSentimentScaleRaw: JSON.stringify(
      {
        noise_amplifier: 1.65,
        news_reactor: 1.48,
        late_event_follower: 1.28,
        event_sniper: 1.38,
        info_skeptic: 0.32,
        conservative_planner: 0.38,
        mean_reversion: -0.95,
      },
      null,
      2,
    ),
  },
  facebook: {
    simulationPlatform: "facebook",
    sourceType: "social",
    sourceName: "facebook-groups-demo",
    title: "Facebook community drift: slow consensus building (simulated)",
    sentiment: "0.22",
    confidence: "0.55",
    urgency: "0.35",
    relevance: "0.7",
    reach: "0.58",
    credibility: "0.52",
    step: "2",
    targetArchetypesRaw: "",
    sensitivityOverridesRaw: JSON.stringify({ info: 1.08, event: 0.92 }, null, 0),
    defaultArchetypeSentimentScale: "0.88",
    archetypeSentimentScaleRaw: JSON.stringify(
      {
        passive_allocator: 1.22,
        stability_seeker: 1.18,
        late_event_follower: 1.12,
        news_reactor: 1.08,
        linear_quant: 0.52,
        conservative_planner: 0.55,
        momentum_trader: 0.58,
      },
      null,
      2,
    ),
  },
  reddit: {
    simulationPlatform: "reddit",
    sourceType: "social",
    sourceName: "r-wallstreetbets-demo",
    title: "Reddit split: same post, opposite reads by archetype (simulated)",
    sentiment: "0.4",
    confidence: "0.5",
    urgency: "0.62",
    relevance: "0.68",
    reach: "0.78",
    credibility: "0.42",
    step: "2",
    targetArchetypesRaw: "",
    sensitivityOverridesRaw: JSON.stringify({ info: 1.28, event: 1.18 }, null, 0),
    defaultArchetypeSentimentScale: "0.9",
    archetypeSentimentScaleRaw: JSON.stringify(
      {
        momentum_trader: 1.32,
        mean_reversion: -1.12,
        news_reactor: 1.22,
        info_skeptic: -0.88,
        regime_contrarian: 0.95,
        optimist: 1.05,
        pessimist: -1.0,
      },
      null,
      2,
    ),
  },
  sec: {
    simulationPlatform: "sec",
    sourceType: "macro",
    sourceName: "sec-edgar-sim",
    title: "SEC filing excerpt: material update (simulated)",
    sentiment: "0.35",
    confidence: "0.9",
    urgency: "0.42",
    relevance: "0.88",
    reach: "0.55",
    credibility: "0.94",
    step: "2",
    targetArchetypesRaw: "",
    sensitivityOverridesRaw: JSON.stringify({ info: 1.22, event: 0.88 }, null, 0),
    defaultArchetypeSentimentScale: "0.95",
    archetypeSentimentScaleRaw: JSON.stringify(
      {
        conservative_planner: 1.38,
        macro_follower: 1.28,
        long_horizon_allocator: 1.22,
        info_skeptic: 1.15,
        noise_amplifier: 0.22,
      },
      null,
      2,
    ),
  },
  newswire: {
    simulationPlatform: "newswire",
    sourceType: "news",
    sourceName: "demo-newswire",
    title: "Newswire: broad market headline (simulated)",
    sentiment: "0.28",
    confidence: "0.82",
    urgency: "0.55",
    relevance: "0.8",
    reach: "0.82",
    credibility: "0.88",
    step: "2",
    targetArchetypesRaw: "",
    sensitivityOverridesRaw: JSON.stringify({ info: 1.18, event: 1.12 }, null, 0),
    defaultArchetypeSentimentScale: "0.95",
    archetypeSentimentScaleRaw: JSON.stringify(
      {
        news_reactor: 1.38,
        event_sniper: 1.18,
        false_event_reactor: 1.08,
        info_skeptic: 0.72,
        momentum_trader: 1.05,
        conservative_planner: 0.92,
      },
      null,
      2,
    ),
  },
};

const JSON_EVENT_LIBRARY: Array<{ id: string; label: string; payload: Record<string, unknown> }> = [
  {
    id: "reddit-panic",
    label: "Reddit Panic",
    payload: {
      sourceType: "social",
      sourceName: "r-wallstreetbets-demo",
      title: "Reddit panic wave: risk-off cascade",
      sentiment: -0.78,
      confidence: 0.6,
      urgency: 0.86,
      relevance: 0.82,
      reach: 0.92,
      credibility: 0.35,
      step: 2,
      simulationPlatform: "reddit",
      sensitivityOverrides: { info: 1.25, event: 1.35 },
      defaultArchetypeSentimentScale: 1,
    },
  },
  {
    id: "positive-news-spike",
    label: "Positive News Spike",
    payload: {
      sourceType: "news",
      sourceName: "demo-newswire",
      title: "Positive guidance surprise from leadership update",
      sentiment: 0.72,
      confidence: 0.88,
      urgency: 0.64,
      relevance: 0.9,
      reach: 0.84,
      credibility: 0.9,
      step: 2,
      simulationPlatform: "newswire",
      sensitivityOverrides: { info: 1.12, event: 1.08 },
      defaultArchetypeSentimentScale: 1,
    },
  },
  {
    id: "conflicting-signals",
    label: "Conflicting Signals",
    payload: {
      sourceType: "social",
      sourceName: "r-wallstreetbets-demo",
      title: "Conflicting social interpretation stress test",
      sentiment: -0.55,
      confidence: 0.58,
      urgency: 0.72,
      relevance: 0.78,
      reach: 0.88,
      credibility: 0.46,
      step: 2,
      simulationPlatform: "reddit",
      sensitivityOverrides: { info: 1.18, event: 1.22 },
      defaultArchetypeSentimentScale: 0.95,
      archetypeSentimentScale: {
        momentum_trader: 1.4,
        mean_reversion: -1.1,
        conservative_planner: 0.2,
        info_skeptic: -0.8,
      },
    },
  },
  {
    id: "fake-rumor",
    label: "Fake Rumor",
    payload: {
      sourceType: "rumor",
      sourceName: "viral-forward-chain",
      title: "Unverified fake rumor spreads rapidly",
      sentiment: -0.46,
      confidence: 0.3,
      urgency: 0.83,
      relevance: 0.68,
      reach: 0.95,
      credibility: 0.12,
      step: 2,
      simulationPlatform: "x",
      sensitivityOverrides: { info: 1.3, event: 1.4 },
      defaultArchetypeSentimentScale: 1,
    },
  },
];

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(15, 23, 42, 0.10)",
  borderRadius: 10,
  padding: 16,
  marginBottom: 24,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(15, 23, 42, 0.55)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(15, 23, 42, 0.15)",
  fontSize: 13,
  boxSizing: "border-box",
};

function parseTargetArchetypes(raw: string): string[] | undefined {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isRecordOfFiniteNumbers(value: unknown): value is Record<string, number> {
  if (!isPlainRecord(value)) return false;
  for (const [k, v] of Object.entries(value)) {
    if (!k.trim()) return false;
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  return true;
}

function buildJsonPayloadWithValidation(input: {
  rawJson: string;
  runId: string;
  runVariantId?: string | null;
  assetSymbol: string;
}): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } {
  const raw = input.rawJson.trim();
  if (!raw) return { ok: false, message: "JSON payload is empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "JSON payload is invalid" };
  }
  if (!isPlainRecord(parsed)) {
    return { ok: false, message: "JSON payload must be a JSON object" };
  }

  const payload: Record<string, unknown> = { ...parsed };
  if (payload.runId == null || String(payload.runId).trim() === "") payload.runId = input.runId;
  if (payload.assetSymbol == null || String(payload.assetSymbol).trim() === "") payload.assetSymbol = input.assetSymbol;
  if ((payload.runVariantId == null || String(payload.runVariantId).trim() === "") && input.runVariantId != null) {
    payload.runVariantId = input.runVariantId;
  }

  if (!("defaultArchetypeSentimentScale" in payload) && "defaultarchetypesentimentscale" in payload) {
    return {
      ok: false,
      message: "Use exact key casing: defaultArchetypeSentimentScale (not defaultarchetypesentimentscale)",
    };
  }

  if (typeof payload.sentiment !== "number" || !Number.isFinite(payload.sentiment)) {
    return { ok: false, message: "JSON payload: sentiment must be a finite number" };
  }
  if (typeof payload.step !== "number" || !Number.isFinite(payload.step)) {
    return { ok: false, message: "JSON payload: step must be a finite number" };
  }
  if (
    payload.archetypeSentimentScale !== undefined &&
    !isRecordOfFiniteNumbers(payload.archetypeSentimentScale)
  ) {
    return {
      ok: false,
      message: "JSON payload: archetypeSentimentScale must be an object of string:number",
    };
  }
  if (
    payload.defaultArchetypeSentimentScale !== undefined &&
    (typeof payload.defaultArchetypeSentimentScale !== "number" ||
      !Number.isFinite(payload.defaultArchetypeSentimentScale))
  ) {
    return {
      ok: false,
      message: "JSON payload: defaultArchetypeSentimentScale must be a finite number",
    };
  }
  if (payload.sensitivityOverrides !== undefined && !isPlainRecord(payload.sensitivityOverrides)) {
    return { ok: false, message: "JSON payload: sensitivityOverrides must be a JSON object" };
  }

  return { ok: true, body: payload };
}

function applyPresetToState(next: SimulationSource, apply: (p: PresetFields) => void): void {
  if (next === "custom") return;
  const { simulationPlatform: _p, ...preset } = SOURCE_PRESETS[next];
  apply(preset);
}

export function LiveEventInjectionPanel(props: {
  runId: string | null;
  assetSymbol: string;
  runVariantId?: string | null;
  onSimulationProcessingStateChange?: (state: { active: boolean; title: string; message: string }) => void;
  onSimulationRefreshRequested?: () => Promise<void>;
}) {
  const { runId, assetSymbol, runVariantId, onSimulationProcessingStateChange, onSimulationRefreshRequested } = props;
  const [sourceType, setSourceType] = useState<"news" | "social" | "macro" | "rumor">("news");
  const [sourceName, setSourceName] = useState("demo-wire");
  const [title, setTitle] = useState("Live injection: sentiment probe");
  const [sentiment, setSentiment] = useState("0.25");
  const [confidence, setConfidence] = useState("0.75");
  const [urgency, setUrgency] = useState("0.4");
  const [relevance, setRelevance] = useState("0.85");
  const [reach, setReach] = useState("0.6");
  const [credibility, setCredibility] = useState("0.55");
  const [step, setStep] = useState("2");
  const [simulationSource, setSimulationSource] = useState<SimulationSource>("custom");
  const [inputMode, setInputMode] = useState<InjectionInputMode>("form");
  const [targetArchetypesRaw, setTargetArchetypesRaw] = useState("");
  const [sensitivityOverridesRaw, setSensitivityOverridesRaw] = useState("");
  const [archetypeSentimentScaleRaw, setArchetypeSentimentScaleRaw] = useState("");
  const [defaultArchetypeSentimentScale, setDefaultArchetypeSentimentScale] = useState("");
  const [jsonPayloadRaw, setJsonPayloadRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<InjectResponse | null>(null);
  const [recent, setRecent] = useState<InjectedEventRow[]>([]);

  const loadRecent = useCallback(async () => {
    if (!runId) {
      setRecent([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/simulation/injected-events?runId=${encodeURIComponent(runId)}&limit=20`,
        { cache: "no-store", headers: { accept: "application/json" } },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items?: InjectedEventRow[] };
      if (Array.isArray(data.items)) setRecent(data.items);
    } catch {
      /* ignore */
    }
  }, [runId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const buildFormPayload = (): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } => {
    let sensitivityOverrides: Record<string, number> | undefined;
    const rawOv = sensitivityOverridesRaw.trim();
    if (rawOv) {
      try {
        const parsed = JSON.parse(rawOv) as unknown;
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return {
            ok: false,
            message:
              'sensitivityOverrides must be a JSON object with channel keys only, e.g. {"info":1.15,"event":1.05}',
          };
        }
        sensitivityOverrides = parsed as Record<string, number>;
      } catch {
        return { ok: false, message: "sensitivityOverrides: invalid JSON" };
      }
    }

    let archetypeSentimentScale: Record<string, number> | undefined;
    const rawScale = archetypeSentimentScaleRaw.trim();
    if (rawScale) {
      try {
        const parsed = JSON.parse(rawScale) as unknown;
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { ok: false, message: "archetypeSentimentScale must be a JSON object mapping archetype id → number" };
        }
        archetypeSentimentScale = parsed as Record<string, number>;
      } catch {
        return { ok: false, message: "archetypeSentimentScale: invalid JSON" };
      }
    }

    let defaultArchetypeSentimentScaleNum: number | undefined;
    const defTrim = defaultArchetypeSentimentScale.trim();
    if (defTrim) {
      const n = Number(defTrim);
      if (!Number.isFinite(n)) {
        return { ok: false, message: "defaultArchetypeSentimentScale must be a finite number" };
      }
      defaultArchetypeSentimentScaleNum = n;
    }

    const simulationPlatform = simulationSource !== "custom" ? simulationSource : undefined;

    return {
      ok: true,
      body: {
        runId,
        runVariantId: runVariantId ?? undefined,
        assetSymbol: assetSymbol.trim(),
        sourceType,
        sourceName: sourceName.trim(),
        title: title.trim(),
        sentiment: Number(sentiment),
        confidence: Number(confidence),
        urgency: Number(urgency),
        relevance: Number(relevance),
        reach: Number(reach),
        credibility: Number(credibility),
        step: Number(step),
        targetArchetypes: parseTargetArchetypes(targetArchetypesRaw),
        sensitivityOverrides,
        simulationPlatform,
        archetypeSentimentScale,
        defaultArchetypeSentimentScale: defaultArchetypeSentimentScaleNum,
      },
    };
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionMessage(null);
    setLastSuccess(null);
    if (!runId) {
      setError("No active run on this dashboard — pick a run with scaling data first.");
      return;
    }
    const sym = assetSymbol.trim();
    if (!sym) {
      setError("assetSymbol is empty — select an asset in the dashboard filters.");
      return;
    }

    let body: Record<string, unknown>;
    if (inputMode === "json") {
      const parsedPayload = buildJsonPayloadWithValidation({
        rawJson: jsonPayloadRaw,
        runId,
        runVariantId,
        assetSymbol: sym,
      });
      if (!parsedPayload.ok) {
        setError(parsedPayload.message);
        return;
      }
      body = parsedPayload.body;
    } else {
      const formPayload = buildFormPayload();
      if (!formPayload.ok) {
        setError(formPayload.message);
        return;
      }
      body = formPayload.body;
    }

    setSubmitting(true);
    onSimulationProcessingStateChange?.({
      active: true,
      title: "Processing simulation",
      message: "Injecting event and recalculating crowd behavior...",
    });
    try {
      const res = await fetch(`${API_BASE}/simulation/inject-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text };
      }
      if (!res.ok) {
        const msg =
          typeof data === "object" && data != null && "message" in data
            ? String((data as { message: unknown }).message)
            : text || `HTTP ${res.status}`;
        setError(msg);
        return;
      }
      const ok = data as InjectResponse;
      setLastSuccess(ok);
      onSimulationProcessingStateChange?.({
        active: true,
        title: "Processing simulation",
        message: "Refreshing timeline and personas...",
      });
      await loadRecent();
      if (onSimulationRefreshRequested) {
        await onSimulationRefreshRequested();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
      onSimulationProcessingStateChange?.({ active: false, title: "", message: "" });
    }
  };

  const runMutation = async (url: string, successPrefix: string) => {
    setMutating(true);
    onSimulationProcessingStateChange?.({
      active: true,
      title: "Processing simulation",
      message: "Applying simulation changes and recalculating crowd behavior...",
    });
    setError(null);
    setActionMessage(null);
    setLastSuccess(null);
    try {
      const res = await fetch(url, { method: "DELETE", headers: { accept: "application/json" } });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text };
      }
      if (!res.ok) {
        const msg =
          typeof data === "object" && data != null && "message" in data
            ? String((data as { message: unknown }).message)
            : text || `HTTP ${res.status}`;
        setError(msg);
        return;
      }
      const out = data as EventMutationResponse;
      setActionMessage(
        `${successPrefix}: deleted ${out.deletedCount} event(s), recalculation ${out.recalculationStatus}${
          out.recalculationDetail ? ` — ${out.recalculationDetail}` : ""
        }`,
      );
      onSimulationProcessingStateChange?.({
        active: true,
        title: "Processing simulation",
        message: "Refreshing timeline and personas...",
      });
      await loadRecent();
      if (onSimulationRefreshRequested) {
        await onSimulationRefreshRequested();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setMutating(false);
      onSimulationProcessingStateChange?.({ active: false, title: "", message: "" });
    }
  };

  if (!runId) {
    return (
      <div data-testid="live-event-injection-panel" style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Live Event Injection</div>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.65)" }}>
          Connect a run (latest scaling / performance run) to enable injection. Scenario files remain supported via the worker CLI.
        </div>
      </div>
    );
  }

  return (
    <div data-testid="live-event-injection-panel" style={cardStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Live Event Injection</div>
      <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 14 }}>
        Persists an InfoEvent for run <span className="font-mono">{runId.slice(0, 8)}…</span> and reruns <code>decide</code> for the
        selected asset variant (deterministic, demo-friendly). Crowd panels refresh after submit.
        {runVariantId ? (
          <>
            {" "}
            Active variant: <span className="font-mono">{runVariantId.slice(0, 8)}…</span>.
          </>
        ) : null}
      </div>

      <form onSubmit={onSubmit}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setInputMode("form")}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px solid rgba(15, 23, 42, 0.2)",
              background: inputMode === "form" ? "rgba(6, 182, 212, 0.18)" : "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => setInputMode("json")}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px solid rgba(15, 23, 42, 0.2)",
              background: inputMode === "json" ? "rgba(6, 182, 212, 0.18)" : "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            JSON
          </button>
        </div>
        {inputMode === "json" ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Preset Events</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {JSON_EVENT_LIBRARY.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setInputMode("json");
                    setError(null);
                    setJsonPayloadRaw(JSON.stringify(preset.payload, null, 2));
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(15, 23, 42, 0.2)",
                    background: "white",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Paste full event payload JSON</div>
            <textarea
              style={{ ...inputStyle, minHeight: 220, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              placeholder='{"sourceType":"social","sourceName":"r-wallstreetbets-demo","title":"...","sentiment":-0.7,"confidence":0.7,"urgency":0.7,"relevance":0.8,"reach":0.85,"credibility":0.5,"step":2}'
              value={jsonPayloadRaw}
              onChange={(ev) => setJsonPayloadRaw(ev.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  const formPayload = buildFormPayload();
                  if (!formPayload.ok) {
                    setError(formPayload.message);
                    return;
                  }
                  setError(null);
                  setJsonPayloadRaw(JSON.stringify(formPayload.body, null, 2));
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(15, 23, 42, 0.2)",
                  background: "white",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Load current form into JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  const raw = jsonPayloadRaw.trim();
                  if (!raw) {
                    setError("JSON payload is empty");
                    return;
                  }
                  try {
                    const parsed = JSON.parse(raw);
                    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
                      setError("JSON payload must be a JSON object");
                      return;
                    }
                    setError(null);
                    setJsonPayloadRaw(JSON.stringify(parsed, null, 2));
                  } catch {
                    setError("JSON payload is invalid");
                  }
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(15, 23, 42, 0.2)",
                  background: "white",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Pretty format
              </button>
              <button
                type="button"
                onClick={() => {
                  setJsonPayloadRaw("");
                  setError(null);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(15, 23, 42, 0.2)",
                  background: "white",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}
        {inputMode === "form" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>Simulation source (presets prefill; you can still edit everything)</div>
            <select
              style={inputStyle}
              value={simulationSource}
              onChange={(ev) => {
                const next = ev.target.value as SimulationSource;
                setSimulationSource(next);
                applyPresetToState(next, (p) => {
                  setSourceType(p.sourceType);
                  setSourceName(p.sourceName);
                  setTitle(p.title);
                  setSentiment(p.sentiment);
                  setConfidence(p.confidence);
                  setUrgency(p.urgency);
                  setRelevance(p.relevance);
                  setReach(p.reach);
                  setCredibility(p.credibility);
                  setStep(p.step);
                  setTargetArchetypesRaw(p.targetArchetypesRaw);
                  setSensitivityOverridesRaw(p.sensitivityOverridesRaw);
                  setArchetypeSentimentScaleRaw(p.archetypeSentimentScaleRaw);
                  setDefaultArchetypeSentimentScale(p.defaultArchetypeSentimentScale);
                });
              }}
            >
              <option value="custom">custom</option>
              <option value="x">x — panic / velocity</option>
              <option value="facebook">facebook — community drift</option>
              <option value="reddit">reddit — contrarian split</option>
              <option value="sec">sec — filing</option>
              <option value="newswire">newswire</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>assetSymbol (from dashboard filter)</div>
            <input style={{ ...inputStyle, background: "rgba(15,23,42,0.04)" }} readOnly value={assetSymbol.trim() || "—"} />
          </div>
          <div>
            <div style={labelStyle}>sourceType</div>
            <select
              style={inputStyle}
              value={sourceType}
              onChange={(ev) => setSourceType(ev.target.value as typeof sourceType)}
            >
              <option value="news">news</option>
              <option value="social">social</option>
              <option value="macro">macro</option>
              <option value="rumor">rumor</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>sourceName</div>
            <input style={inputStyle} value={sourceName} onChange={(ev) => setSourceName(ev.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>title</div>
            <input style={inputStyle} value={title} onChange={(ev) => setTitle(ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>sentiment (−1…1)</div>
            <input style={inputStyle} value={sentiment} onChange={(ev) => setSentiment(ev.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div style={labelStyle}>confidence (0…1)</div>
            <input style={inputStyle} value={confidence} onChange={(ev) => setConfidence(ev.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div style={labelStyle}>urgency (0…1)</div>
            <input style={inputStyle} value={urgency} onChange={(ev) => setUrgency(ev.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div style={labelStyle}>relevance (0…1)</div>
            <input style={inputStyle} value={relevance} onChange={(ev) => setRelevance(ev.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div style={labelStyle}>reach (0…1)</div>
            <input style={inputStyle} value={reach} onChange={(ev) => setReach(ev.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div style={labelStyle}>credibility (0…1)</div>
            <input style={inputStyle} value={credibility} onChange={(ev) => setCredibility(ev.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div style={labelStyle}>step</div>
            <input style={inputStyle} value={step} onChange={(ev) => setStep(ev.target.value)} inputMode="numeric" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>targetArchetypes (optional, comma-separated)</div>
            <input
              style={inputStyle}
              placeholder="e.g. momentum, value"
              value={targetArchetypesRaw}
              onChange={(ev) => setTargetArchetypesRaw(ev.target.value)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>sensitivityOverrides (optional JSON — channels info / event only)</div>
            <textarea
              style={{ ...inputStyle, minHeight: 56, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              placeholder='{"info":1.15,"event":1.05}'
              value={sensitivityOverridesRaw}
              onChange={(ev) => setSensitivityOverridesRaw(ev.target.value)}
            />
          </div>
          <div>
            <div style={labelStyle}>defaultArchetypeSentimentScale (optional)</div>
            <input
              style={inputStyle}
              placeholder="e.g. 0.9 — omit for 1"
              value={defaultArchetypeSentimentScale}
              onChange={(ev) => setDefaultArchetypeSentimentScale(ev.target.value)}
              inputMode="decimal"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>archetypeSentimentScale (optional JSON — archetype id → multiplier)</div>
            <textarea
              style={{ ...inputStyle, minHeight: 72, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              placeholder='{"news_reactor":1.3,"info_skeptic":0.4}'
              value={archetypeSentimentScaleRaw}
              onChange={(ev) => setArchetypeSentimentScaleRaw(ev.target.value)}
            />
          </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || mutating}
          data-testid="live-event-inject-submit"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(6, 182, 212, 0.35)",
            background: submitting ? "rgba(6, 182, 212, 0.08)" : "rgba(6, 182, 212, 0.18)",
            fontWeight: 600,
            fontSize: 13,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Injecting & recalculating…" : "Inject event & recalculate"}
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button
            type="button"
            disabled={submitting || mutating}
            onClick={() => {
              if (!runId) {
                setError("runId is required");
                return;
              }
              if (!runVariantId) {
                setError("runVariantId is required to remove last event");
                return;
              }
              const url = `${API_BASE}/simulation/events/last?runId=${encodeURIComponent(runId)}&runVariantId=${encodeURIComponent(
                runVariantId,
              )}&assetSymbol=${encodeURIComponent(assetSymbol.trim())}`;
              void runMutation(url, "Removed last event");
            }}
            style={{
              padding: "7px 11px",
              borderRadius: 8,
              border: "1px solid rgba(180, 83, 9, 0.35)",
              background: "rgba(245, 158, 11, 0.15)",
              fontWeight: 600,
              fontSize: 12,
              cursor: submitting || mutating ? "not-allowed" : "pointer",
            }}
          >
            Remove Last Event
          </button>
          <button
            type="button"
            disabled={submitting || mutating}
            onClick={() => {
              if (!runId) {
                setError("runId is required");
                return;
              }
              if (!runVariantId) {
                setError("runVariantId is required to reset simulation");
                return;
              }
              const url = `${API_BASE}/simulation/events?runId=${encodeURIComponent(runId)}&runVariantId=${encodeURIComponent(
                runVariantId,
              )}&assetSymbol=${encodeURIComponent(assetSymbol.trim())}`;
              void runMutation(url, "Simulation reset");
            }}
            style={{
              padding: "7px 11px",
              borderRadius: 8,
              border: "1px solid rgba(220, 38, 38, 0.35)",
              background: "rgba(220, 38, 38, 0.12)",
              fontWeight: 600,
              fontSize: 12,
              cursor: submitting || mutating ? "not-allowed" : "pointer",
            }}
          >
            Reset Simulation
          </button>
        </div>
      </form>

      {error ? (
        <div data-testid="live-event-inject-error" style={{ marginTop: 12, fontSize: 12, color: "#dc2626" }}>
          {error}
        </div>
      ) : null}
      {actionMessage ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(15, 23, 42, 0.8)" }}>{actionMessage}</div>
      ) : null}

      {lastSuccess ? (
        <div
          data-testid="live-event-inject-success"
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.25)",
            fontSize: 12,
            color: "rgba(15, 23, 42, 0.88)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Injection succeeded</div>
          <div>
            Event id: <span className="font-mono">{lastSuccess.injectedEventId}</span>
          </div>
          <div>
            Run: <span className="font-mono">{lastSuccess.affectedRunId}</span> · variant{" "}
            <span className="font-mono">{lastSuccess.runVariantId.slice(0, 8)}…</span>
          </div>
          <div>
            Recalculation: <strong>{lastSuccess.recalculationStatus}</strong>
            {lastSuccess.recalculationDetail ? ` — ${lastSuccess.recalculationDetail}` : ""}
          </div>
          {lastSuccess.affectedArchetypesSummary.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              Archetypes in scope: {lastSuccess.affectedArchetypesSummary.join(", ")}
            </div>
          ) : null}
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(15, 23, 42, 0.72)" }}>
            {lastSuccess.simulationPlatform ? (
              <div>
                Simulation platform: <strong>{lastSuccess.simulationPlatform}</strong>
              </div>
            ) : null}
            <div>
              Target archetypes (payload): <strong>{lastSuccess.targetArchetypeCount ?? 0}</strong> · Per-archetype
              scales: <strong>{lastSuccess.archetypeScaleCount ?? 0}</strong>
            </div>
            <div>
              Mixed interpretation:{" "}
              <strong>{lastSuccess.mixedInterpretationActive ? "yes" : "no"}</strong>
              {lastSuccess.interpretationSummary ? ` — ${lastSuccess.interpretationSummary}` : ""}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Recent Injected Events</div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>No live injections for this run yet.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((r) => (
              <li
                key={r.id}
                data-testid={`live-injected-row-${r.id}`}
                style={{
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                }}
              >
                <div style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11, marginBottom: 2 }}>
                  {new Date(r.createdAt).toLocaleString()} · step {r.step} · {r.sourceType} · sentiment {r.sentiment.toFixed(2)}
                </div>
                <div style={{ fontWeight: 500 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>{r.assetSymbol}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
