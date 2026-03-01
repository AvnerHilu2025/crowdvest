import React from "react";

export function TableShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 32,
        borderRadius: 10,
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
          padding: "16px 20px",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(15, 23, 42, 0.95)" }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        whiteSpace: "nowrap",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        padding: "8px 12px",
        textAlign: "left",
        fontSize: 12,
        fontWeight: 600,
        color: "rgba(15, 23, 42, 0.7)",
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        borderBottom: "1px solid rgba(15, 23, 42, 0.04)",
        padding: "8px 12px",
        fontSize: 13,
        color: "rgba(15, 23, 42, 0.9)",
      }}
    >
      {children}
    </td>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        marginLeft: 8,
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 6,
        background: "rgba(148, 163, 184, 0.16)",
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 600,
        color: "rgba(15, 23, 42, 0.7)",
      }}
    >
      {children}
    </span>
  );
}
