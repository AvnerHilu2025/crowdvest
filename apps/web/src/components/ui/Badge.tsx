import React from "react";
import { ui } from "./ui-styles";

type Tone = "green" | "red" | "amber" | "gray" | "blue";

const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
  green: { bg: "#E9F8EE", fg: "#137A2A", border: "#BFECCD" },
  red: { bg: "#FDEBEC", fg: "#B4232C", border: "#F8C7CA" },
  amber: { bg: "#FFF3DF", fg: "#8A4B00", border: "#FFD7A3" },
  gray: { bg: "#F3F5F7", fg: "#3E4C59", border: "#E2E8F0" },
  blue: { bg: "#E8F6FF", fg: "#075985", border: "#B9E6FF" },
};

export function Badge(props: { tone?: Tone; children: React.ReactNode }) {
  const tone = props.tone ?? "gray";
  const t = tones[tone];
  return (
    <span style={{ ...ui.badge, background: t.bg, color: t.fg, borderColor: t.border }}>
      {props.children}
    </span>
  );
}
