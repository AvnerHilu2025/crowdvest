"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ASSETS = ["SPY"]; // keep minimal for now; later we can load dynamically

export function AssetPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const current = sp.get("assetSymbol") || "SPY";

  function setParam(next: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("assetSymbol", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: "rgba(15, 23, 42, 0.92)" }}>
        Asset
      </label>
      <select
        style={{
          borderRadius: 8,
          border: "1px solid rgba(15, 23, 42, 0.15)",
          background: "#fff",
          padding: "6px 10px",
          fontSize: 14,
        }}
        value={current}
        onChange={(e) => setParam(e.target.value)}
      >
        {ASSETS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
