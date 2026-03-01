"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from "recharts";

export type StepAgreementPoint = {
  step: number;
  agreementPct: number;
};

type AgreementTimelineProps = {
  stepAgreement: StepAgreementPoint[];
};

export function AgreementTimeline({ stepAgreement }: AgreementTimelineProps) {
  if (stepAgreement.length === 0) return null;

  const steps = stepAgreement.map((s) => s.step);
  const minStep = Math.min(...steps);
  const maxStep = Math.max(...steps);

  return (
    <div data-testid="step-agreement-chart" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
        Step-level agreement
      </div>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={stepAgreement}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
            <XAxis
              dataKey="step"
              type="number"
              domain={[minStep, maxStep]}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Agreement"]}
              labelFormatter={(label) => `Step ${label}`}
            />
            <ReferenceArea
              x1={minStep}
              x2={maxStep}
              y1={0}
              y2={0.6}
              fill="#fef2f2"
              fillOpacity={0.4}
              strokeOpacity={0}
            />
            <ReferenceArea
              x1={minStep}
              x2={maxStep}
              y1={0.6}
              y2={0.9}
              fill="#fefce8"
              fillOpacity={0.3}
              strokeOpacity={0}
            />
            <ReferenceArea
              x1={minStep}
              x2={maxStep}
              y1={0.9}
              y2={1}
              fill="#dcfce7"
              fillOpacity={0.3}
              strokeOpacity={0}
            />
            <Line
              type="monotone"
              dataKey="agreementPct"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              name="Agreement"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          fontSize: 10,
          color: "rgba(15, 23, 42, 0.55)",
        }}
      >
        <span>≥90%: strong</span>
        <span>60–90%: moderate</span>
        <span>&lt;60%: divergence</span>
      </div>
    </div>
  );
}
