import React from "react";
import { ui } from "./ui-styles";

export function Section(props: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={ui.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h3 style={ui.sectionTitle}>{props.title}</h3>
        {props.right}
      </div>
      <div style={ui.sectionRule} />
      {props.children}
    </div>
  );
}
