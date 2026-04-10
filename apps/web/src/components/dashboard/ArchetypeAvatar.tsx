"use client";

type PersonaTone =
  | "optimist"
  | "pessimist"
  | "trend"
  | "contrarian"
  | "conservative"
  | "balanced"
  | "quant"
  | "event"
  | "macro"
  | "volatility"
  | "default";

type ArchetypePersona = {
  tone: PersonaTone;
  title: string;
  blurb: string;
  ringClass: string;
  bgClass: string;
  fgClass: string;
  glyphVariant?: number;
};

function normalizeArchetypeName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

export function getArchetypePersona(name: string): ArchetypePersona {
  const n = normalizeArchetypeName(name);
  const hash = Array.from(n).reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0);
  const variant = Math.abs(hash) % 4;

  if (n.includes("optimist") || n.includes("bull")) {
    return {
      tone: "optimist",
      title: "Optimist",
      blurb: "Believes markets trend upward over time",
      ringClass: "ring-emerald-500/45",
      bgClass: "bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-cyan-500/20",
      fgClass: "text-emerald-200",
    };
  }
  if (n.includes("pessimist") || n.includes("bear")) {
    return {
      tone: "pessimist",
      title: "Pessimist",
      blurb: "Expects downside risk and protects capital",
      ringClass: "ring-rose-500/45",
      bgClass: "bg-gradient-to-br from-rose-500/30 via-orange-500/20 to-red-500/15",
      fgClass: "text-rose-200",
    };
  }
  if (n.includes("trend follower") || n.includes("trend")) {
    return {
      tone: "trend",
      title: "Trend Follower",
      blurb: "Follows momentum and price direction",
      ringClass: "ring-sky-500/45",
      bgClass: "bg-gradient-to-br from-sky-500/30 via-blue-500/20 to-indigo-500/15",
      fgClass: "text-sky-200",
    };
  }
  if (n.includes("quant")) {
    return {
      tone: "quant",
      title: "Quant",
      blurb: "Model-driven and pattern-sensitive execution.",
      ringClass: "ring-blue-500/45",
      bgClass: "bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-cyan-500/15",
      fgClass: "text-blue-200",
      glyphVariant: variant,
    };
  }
  if (n.includes("event") || n.includes("news")) {
    return {
      tone: "event",
      title: "Event-driven",
      blurb: "Reacts quickly to catalysts and headlines.",
      ringClass: "ring-amber-500/45",
      bgClass: "bg-gradient-to-br from-amber-500/30 via-orange-500/20 to-yellow-500/15",
      fgClass: "text-amber-100",
      glyphVariant: variant,
    };
  }
  if (n.includes("macro") || n.includes("regime") || n.includes("allocator")) {
    return {
      tone: "macro",
      title: "Macro",
      blurb: "Weights macro regime and longer-cycle conditions.",
      ringClass: "ring-cyan-500/40",
      bgClass: "bg-gradient-to-br from-cyan-500/25 via-sky-500/20 to-teal-500/15",
      fgClass: "text-cyan-100",
      glyphVariant: variant,
    };
  }
  if (n.includes("volatility") || n.includes("scalper")) {
    return {
      tone: "volatility",
      title: "Volatility",
      blurb: "Focuses on speed, swings, and volatility response.",
      ringClass: "ring-fuchsia-500/40",
      bgClass: "bg-gradient-to-br from-fuchsia-500/30 via-pink-500/20 to-violet-500/15",
      fgClass: "text-fuchsia-100",
      glyphVariant: variant,
    };
  }
  if (n.includes("contrarian")) {
    return {
      tone: "contrarian",
      title: "Contrarian",
      blurb: "Acts opposite to crowd sentiment",
      ringClass: "ring-violet-500/45",
      bgClass: "bg-gradient-to-br from-violet-500/30 via-purple-500/20 to-fuchsia-500/15",
      fgClass: "text-violet-200",
      glyphVariant: variant,
    };
  }
  if (n.includes("conservative")) {
    return {
      tone: "conservative",
      title: "Conservative",
      blurb: "Defense-first with risk-control bias.",
      ringClass: "ring-slate-400/50",
      bgClass: "bg-gradient-to-br from-slate-500/25 via-zinc-500/20 to-slate-700/25",
      fgClass: "text-slate-200",
      glyphVariant: variant,
    };
  }
  if (n.includes("balanced") || n.includes("neutral")) {
    return {
      tone: "balanced",
      title: "Balanced",
      blurb: "Balances upside and downside pressures.",
      ringClass: "ring-cyan-500/40",
      bgClass: "bg-gradient-to-br from-cyan-500/20 via-slate-500/20 to-emerald-500/15",
      fgClass: "text-cyan-100",
      glyphVariant: variant,
    };
  }

  const fallbackPalettes = [
    {
      ringClass: "ring-sky-500/40",
      bgClass: "bg-gradient-to-br from-sky-500/25 via-blue-500/20 to-indigo-500/20",
      fgClass: "text-sky-100",
    },
    {
      ringClass: "ring-emerald-500/40",
      bgClass: "bg-gradient-to-br from-emerald-500/25 via-teal-500/20 to-cyan-500/20",
      fgClass: "text-emerald-100",
    },
    {
      ringClass: "ring-rose-500/40",
      bgClass: "bg-gradient-to-br from-rose-500/25 via-orange-500/20 to-red-500/20",
      fgClass: "text-rose-100",
    },
    {
      ringClass: "ring-violet-500/40",
      bgClass: "bg-gradient-to-br from-violet-500/25 via-purple-500/20 to-indigo-500/20",
      fgClass: "text-violet-100",
    },
  ];
  const palette = fallbackPalettes[Math.abs(hash) % fallbackPalettes.length]!;

  return {
    tone: "default",
    title: "Archetype",
    blurb: "Distinct crowd behavior profile.",
    ringClass: palette.ringClass,
    bgClass: palette.bgClass,
    fgClass: palette.fgClass,
    glyphVariant: variant,
  };
}

function PersonaGlyph({ tone, variant = 0 }: { tone: PersonaTone; variant?: number }) {
  if (tone === "optimist") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M8 31c6-1 9-8 14-8s8 7 18 6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M31 12l9 1-1 9" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "pessimist") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M8 17c6 1 9 8 14 8s8-7 18-6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M31 36l9-1-1-9" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "trend") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M9 33l10-10 7 7 13-13" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M31 17h8v8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "contrarian") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M9 16h12v12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 28L9 16" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M39 32H27V20" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27 20l12 12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "conservative") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M24 8l14 5v10c0 9-7 14-14 17-7-3-14-8-14-17V13l14-5z" stroke="currentColor" strokeWidth="2.6" />
        <path d="M18 24h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "balanced") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M24 11v26M11 24h26" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    );
  }
  if (tone === "quant") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <rect x="10" y="12" width="28" height="24" rx="5" stroke="currentColor" strokeWidth="2.4" />
        <path d={variant % 2 === 0 ? "M14 30l6-7 5 4 8-10" : "M14 27l6-3 6 5 8-8"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "event") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d="M24 9l5 10 11 2-8 8 2 10-10-5-10 5 2-10-8-8 11-2 5-10z" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  }
  if (tone === "macro") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="2.4" />
        <path d="M11 24h26M24 11c4 4 4 22 0 26M24 11c-4 4-4 22 0 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "volatility") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
        <path d={variant % 2 === 0 ? "M8 26c4-8 8 8 12 0s8-8 12 0 8 8 8-3" : "M8 24c4-10 8 10 12 0s8-10 12 0 8 10 8-2"} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
      {variant === 0 ? <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="2.6" /> : null}
      {variant === 1 ? <rect x="12" y="12" width="24" height="24" rx="7" stroke="currentColor" strokeWidth="2.6" /> : null}
      {variant === 2 ? <path d="M24 11l12 13-12 13L12 24l12-13z" stroke="currentColor" strokeWidth="2.6" /> : null}
      {variant === 3 ? <path d="M24 10l14 7v14l-14 7-14-7V17l14-7z" stroke="currentColor" strokeWidth="2.6" /> : null}
      <path d="M18 24h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ArchetypeAvatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const persona = getArchetypePersona(archetype);
  const clamped = Math.max(40, Math.min(56, size));
  return (
    <div
      className={`inline-flex items-center justify-center rounded-2xl ring-1 ${persona.ringClass} ${persona.bgClass} ${persona.fgClass}`}
      style={{ width: clamped, height: clamped }}
      aria-hidden="true"
    >
      <PersonaGlyph tone={persona.tone} variant={persona.glyphVariant} />
    </div>
  );
}
