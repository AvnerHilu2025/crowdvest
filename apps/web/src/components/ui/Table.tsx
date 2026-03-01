import React from "react";
import { ui } from "./ui-styles";

export function Table(props: { headers: string[]; children: React.ReactNode }) {
  return (
    <table style={ui.table}>
      <thead>
        <tr>
          {props.headers.map((h) => (
            <th key={h} style={ui.th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{props.children}</tbody>
    </table>
  );
}
