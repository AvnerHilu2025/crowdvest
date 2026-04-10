"use client";

import Image from "next/image";
import { ArchetypeAvatar } from "./ArchetypeAvatar";

export type PersonaDecision = "BUY" | "SELL" | "HOLD";

export type PersonaCardModel = {
  name: string;
  personalityDescription: string;
  decision: PersonaDecision;
  contributionScore: number;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  quickExplanation: string;
  shareOfCrowdPct: number;
};

const DECISION_STYLE: Record<PersonaDecision, string> = {
  BUY: "text-[#22C55E] tracking-wide",
  SELL: "text-[#EF4444] tracking-wide",
  HOLD: "text-amber-200",
};

const HEADER_STYLE: Record<PersonaDecision, string> = {
  BUY: "bg-[#16A34A]",
  SELL: "bg-[#DC2626]",
  HOLD: "bg-slate-700",
};

const ARCHETYPE_IMAGE_MAP: Record<string, string> = {
  linear_quant: "/personas/linear_quant_male.png",
  nonlinear_quant: "/personas/nonlinear_quant_male.png",
  mean_reversion: "/personas/mean_reversion_male.png",
  momentum_trader: "/personas/momentum_trader_male.png",
  news_reactor: "/personas/news_reactor_female.png",
  info_skeptic: "/personas/info_skeptic_female.png",
  event_sniper: "/personas/event_sniper_male.png",
  late_event_follower: "/personas/late_event_follower_female.png",
  false_event_reactor: "/personas/false_event_reactor_female.png",
  macro_follower: "/personas/macro_follower_male.png",
  regime_contrarian: "/personas/regime_contrarian_male.png",
  stability_seeker: "/personas/stability_seeker_female.png",
  volatility_chaser: "/personas/volatility_chaser_female.png",
  volatility_avoider: "/personas/volatility_avoider_female.png",
  optimist: "/personas/optimist_female.png",
  pessimist: "/personas/pessimist_female.png",
  conviction_buyer: "/personas/conviction_buyer_male.png",
  conviction_seller: "/personas/conviction_seller_male.png",
  high_conviction_buyer: "/personas/conviction_buyer_male.png",
  high_conviction_seller: "/personas/conviction_seller_male.png",
  passive_allocator: "/personas/passive_allocator_male.png",
  conservative_planner: "/personas/conservative_planner_male.png",
  noise_amplifier: "/personas/noise_amplifier_male.png",
  noise_dampener: "/personas/noise_dampener_female.png",
  short_horizon_scalper: "/personas/short_horizon_scalper_male.png",
  long_horizon_allocator: "/personas/long_horizon_allocator_female.png",
  mean_reversion_trader: "/personas/mean_reversion_male.png",
  information_skeptic: "/personas/info_skeptic_female.png",
};

function toSnakeCaseArchetypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function personaImageForArchetype(name: string): string | null {
  if (ARCHETYPE_IMAGE_MAP[name]) return ARCHETYPE_IMAGE_MAP[name]!;
  const snake = toSnakeCaseArchetypeKey(name);
  if (ARCHETYPE_IMAGE_MAP[snake]) return ARCHETYPE_IMAGE_MAP[snake]!;
  return null;
}

export function PersonaCard({
  row,
  onClick,
}: {
  row: PersonaCardModel;
  onClick: () => void;
}) {
  const personaImage = personaImageForArchetype(row.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full rounded-2xl border border-slate-400/80 bg-[#1e3a5f] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/80"
      aria-label={`Open details for ${row.name}`}
    >
      <div className={`-mx-3 -mt-3 mb-3 flex min-h-[52px] items-center justify-between rounded-t-2xl px-3 py-2.5 ${HEADER_STYLE[row.decision]}`}>
        <p className="truncate pr-3 text-xl font-black leading-tight text-white">{row.name}</p>
        <p className="shrink-0 text-xl font-black leading-tight tracking-wide text-white">{row.decision}</p>
      </div>
      <div className="flex min-h-[142px] items-center gap-3">
        {personaImage ? (
          <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl sm:h-[124px] sm:w-[124px]">
            <Image
              src={personaImage}
              alt={`${row.name} persona`}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 124px, 120px"
            />
          </div>
        ) : (
          <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center sm:h-[124px] sm:w-[124px]">
            <ArchetypeAvatar archetype={row.name} size={84} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-relaxed text-slate-200">{row.personalityDescription}</p>
          </div>
          <div className="mt-2 space-y-1">
            <p className="font-mono text-base leading-tight text-slate-200">
              <span className="text-[#22C55E]">B</span> {(row.buyPct * 100).toFixed(0)}{"   "}
              <span className="text-[#EF4444]">S</span> {(row.sellPct * 100).toFixed(0)}{"   "}
              <span className="text-slate-300">H</span> {(row.holdPct * 100).toFixed(0)}
            </p>
            <p className="mb-0 font-mono text-xl leading-tight text-slate-100">
              Contribution {row.contributionScore >= 0 ? "+" : ""}
              {(row.contributionScore * 100).toFixed(1)}pp
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
