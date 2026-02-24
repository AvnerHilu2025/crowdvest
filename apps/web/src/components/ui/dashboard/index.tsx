import React from "react";
import styles from "./DashboardCard.module.css";

export function SectionCard(props: {
  title: string;
  right?: React.ReactNode;
  subtle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.headerLine} />
      <div className={styles.inner}>
        <div className={styles.titleRow}>
          <div>
            <div className={styles.title}>{props.title}</div>
            {props.subtle ? <div className={styles.subtle}>{props.subtle}</div> : null}
          </div>
          {props.right ? <div>{props.right}</div> : null}
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Badge(props: {
  tone?: "success" | "warn" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const tone = props.tone ?? "neutral";
  const toneClass =
    tone === "success"
      ? styles.badgeSuccess
      : tone === "warn"
        ? styles.badgeWarn
        : tone === "danger"
          ? styles.badgeDanger
          : styles.badgeNeutral;

  return <span className={`${styles.badge} ${toneClass}`}>{props.children}</span>;
}

export function MetricRows(props: { children: React.ReactNode }) {
  return <div className={styles.rows}>{props.children}</div>;
}

export function MetricRow(props: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{props.label}</div>
      <div className={`${styles.rowValue} ${props.mono ? styles.mono : ""}`}>
        {props.value}
      </div>
    </div>
  );
}

export function Divider() {
  return <div className={styles.divider} />;
}

export function KpiCard(props: {
  title: string;
  value: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  subtle?: string;
  footer?: React.ReactNode;
}) {
  return (
    <SectionCard title={props.title} subtle={props.subtle} right={props.badge}>
      <>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>{props.value}</div>
          <div className={styles.kpiLabelRow}>
            <div className={styles.kpiLabel}>{props.label}</div>
          </div>
        </div>
        {props.footer ? <div style={{ marginTop: 12 }}>{props.footer}</div> : null}
      </>
    </SectionCard>
  );
}

export function MiniChartPlaceholder() {
  return (
    <div className={styles.miniChart} aria-label="chart placeholder">
      <div className={styles.miniChartLine} />
    </div>
  );
}
