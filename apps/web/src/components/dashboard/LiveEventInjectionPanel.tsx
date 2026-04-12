"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
};

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

export function LiveEventInjectionPanel(props: { runId: string | null; assetSymbol: string }) {
  const { runId, assetSymbol } = props;
  const router = useRouter();
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
  const [targetArchetypesRaw, setTargetArchetypesRaw] = useState("");
  const [sensitivityOverridesRaw, setSensitivityOverridesRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

    let sensitivityOverrides: Record<string, number> | undefined;
    const rawOv = sensitivityOverridesRaw.trim();
    if (rawOv) {
      try {
        const parsed = JSON.parse(rawOv) as unknown;
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("sensitivityOverrides must be a JSON object, e.g. {\"news\":1.2}");
          return;
        }
        sensitivityOverrides = parsed as Record<string, number>;
      } catch {
        setError("sensitivityOverrides: invalid JSON");
        return;
      }
    }

    const body = {
      runId,
      assetSymbol: sym,
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
    };

    setSubmitting(true);
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
      await loadRecent();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
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
      </div>

      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
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
            <div style={labelStyle}>sensitivityOverrides (optional JSON object)</div>
            <textarea
              style={{ ...inputStyle, minHeight: 56, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              placeholder='{"news":1.15}'
              value={sensitivityOverridesRaw}
              onChange={(ev) => setSensitivityOverridesRaw(ev.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
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
      </form>

      {error ? (
        <div data-testid="live-event-inject-error" style={{ marginTop: 12, fontSize: 12, color: "#dc2626" }}>
          {error}
        </div>
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
