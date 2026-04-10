"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ArchetypeAvatar } from "./ArchetypeAvatar";
import { personaImageForArchetype, type PersonaCardModel, type PersonaDecision } from "./PersonaCard";

type SignalRow = {
  label: string;
  value: number;
};

type PersonaDetailModel = PersonaCardModel & {
  topSignals: SignalRow[];
  ageDistribution?: string | null;
  genderMix?: string | null;
  sampleSourceInfluence?: string | null;
};

const DECISION_STYLE: Record<PersonaDecision, string> = {
  BUY: "text-[#22C55E]",
  SELL: "text-[#EF4444]",
  HOLD: "text-slate-200",
};

export function PersonaDetailPanel({
  open,
  onClose,
  persona,
}: {
  open: boolean;
  onClose: () => void;
  persona: PersonaDetailModel | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !persona) return null;
  const personaImage = personaImageForArchetype(persona.name);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Close persona panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-detail-title"
        className="relative z-[91] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-400/70 bg-[#1e3a5f] shadow-2xl sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-slate-300/25 bg-[#1e3a5f] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {personaImage ? (
                <div className="relative h-[128px] w-[128px] shrink-0 overflow-hidden rounded-2xl sm:h-[136px] sm:w-[136px]">
                  <Image
                    src={personaImage}
                    alt={`${persona.name} persona`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 136px, 128px"
                  />
                </div>
              ) : (
                <ArchetypeAvatar archetype={persona.name} size={96} />
              )}
              <div>
                <h3 id="persona-detail-title" className="text-2xl font-black leading-tight text-slate-50">
                  {persona.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-100">{persona.personalityDescription}</p>
                <p className={`mt-2 text-xl font-black leading-none ${DECISION_STYLE[persona.decision]}`}>{persona.decision}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-slate-100 hover:bg-slate-100/10"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-300/20 bg-slate-100/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-200">Current decision</p>
              <p className={`mt-2 text-2xl font-black ${DECISION_STYLE[persona.decision]}`}>{persona.decision}</p>
            </div>
            <div className="rounded-xl border border-slate-300/20 bg-slate-100/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-200">Contribution</p>
              <p className="mt-2 font-mono text-2xl text-slate-50">
                {persona.contributionScore >= 0 ? "+" : ""}
                {(persona.contributionScore * 100).toFixed(1)}pp
              </p>
            </div>
            <div className="rounded-xl border border-slate-300/20 bg-slate-100/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-200">Share of crowd</p>
              <p className="mt-2 font-mono text-2xl text-slate-50">{persona.shareOfCrowdPct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-300/20 bg-slate-100/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-100">Top influencing signals</p>
            {persona.topSignals.length === 0 ? (
              <p className="mt-3 text-base leading-relaxed text-slate-100/90">Signal-level detail is unavailable for this archetype.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-base leading-relaxed text-slate-50">
                {persona.topSignals.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3">
                    <span>{s.label}</span>
                    <span className="font-mono text-sm text-slate-100">
                      {s.value >= 0 ? "+" : ""}
                      {s.value.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-300/20 bg-slate-100/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-100">Demographic representation</p>
            <div className="mt-3 grid gap-3 text-base leading-relaxed text-slate-100 sm:grid-cols-2">
              <p>Age distribution: {persona.ageDistribution ?? "Not available in this run."}</p>
              <p>Gender mix: {persona.genderMix ?? "Not available in this run."}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-300/20 bg-slate-100/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-100">Sample source influence</p>
            <p className="mt-3 text-base leading-relaxed text-slate-100">
              {persona.sampleSourceInfluence ?? "No sample news/social/event influence attached for this archetype."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
