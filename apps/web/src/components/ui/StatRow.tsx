import React from "react";
import { ui } from "./ui-styles";

export function StatRow(props: {
  label: React.ReactNode;
  value: React.ReactNode;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div style={{ ...ui.row, ...(props.last ? ui.rowLast : {}) }}>
      <div style={ui.label}>{props.label}</div>
      <div style={{ ...ui.value, fontFamily: props.mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined }}>
        {props.value}
      </div>
    </div>
  );
}
