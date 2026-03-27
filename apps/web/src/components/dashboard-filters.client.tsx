"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function setParam(params: URLSearchParams, key: string, val: string | null) {
  if (val === null || val === "") params.delete(key);
  else params.set(key, val);
}

function selectValue(e: React.ChangeEvent<HTMLSelectElement>): string {
  return String(e.currentTarget.value ?? "");
}

export default function DashboardFiltersClient(props: {
  assetSymbol: string;
  topN: string;
  showOnlyUnstable: boolean;
  showLegacy: boolean;
  sortByRisk: boolean;
  /** When set, filter changes use this (e.g. dashboard loading overlay + useTransition). */
  navigateFilters?: (updater: (params: URLSearchParams) => void) => void;
  filtersDisabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const updateUrl = (updater: (params: URLSearchParams) => void) => {
    if (props.navigateFilters) {
      props.navigateFilters(updater);
      return;
    }
    const params = new URLSearchParams(sp.toString());
    updater(params);
    router.push(`${pathname}?${params.toString()}`);
  };

  const disabled = props.filtersDisabled === true;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <label style={{ fontSize: 14, fontWeight: 500 }}>Asset</label>
      <select
        style={{
          border: "1px solid rgba(15, 23, 42, 0.15)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 14,
          opacity: disabled ? 0.65 : 1,
        }}
        value={props.assetSymbol}
        disabled={disabled}
        onChange={(e) => updateUrl((p) => setParam(p, "assetSymbol", selectValue(e)))}
      >
        {["SPY", "QQQ", "IWM"].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <label style={{ fontSize: 14, fontWeight: 500 }}>Top N</label>
      <select
        data-testid="topn-select"
        style={{
          border: "1px solid rgba(15, 23, 42, 0.15)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 14,
          opacity: disabled ? 0.65 : 1,
        }}
        value={props.topN}
        disabled={disabled}
        onChange={(e) => updateUrl((p) => setParam(p, "topN", selectValue(e)))}
      >
        <option value="10">Top 10</option>
        <option value="25">Top 25</option>
        <option value="50">Top 50</option>
        <option value="100">Top 100</option>
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          data-testid="toggle-only-unstable"
          checked={props.showOnlyUnstable}
          disabled={disabled}
          onChange={(e) =>
            updateUrl((p) => setParam(p, "unstableOnly", e.target.checked ? "1" : null))
          }
        />
        Show only unstable/diverging
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          data-testid="toggle-show-legacy"
          checked={props.showLegacy}
          disabled={disabled}
          onChange={(e) =>
            updateUrl((p) => setParam(p, "showLegacy", e.target.checked ? "1" : null))
          }
        />
        Include legacy timing
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          data-testid="toggle-sort-risk"
          checked={props.sortByRisk}
          disabled={disabled}
          onChange={(e) =>
            updateUrl((p) => setParam(p, "sortRisk", e.target.checked ? "1" : "0"))
          }
        />
        Sort by risk
      </label>
    </div>
  );
}
