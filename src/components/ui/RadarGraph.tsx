import type { ReactNode } from 'react';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { radarBucketsWithRates } from '../../content/radar';
import type { RadarCategoryCounts } from '../../content/types';

type ChartDatum = {
  label: string;
  value: number;
  count: number;
  rate: number;
};

function formatPercent(rate: number): string {
  const pct = Math.round(rate * 100);
  return `${pct}%`;
}

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div
      style={{
        background: 'rgba(7, 10, 19, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontWeight: 650 }}>{datum.label}</div>
      <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
        {formatPercent(datum.rate)} · {datum.count.toLocaleString()} comment
        {datum.count === 1 ? '' : 's'}
      </div>
    </div>
  );
}

export function RadarGraph({
  radar,
  totalComments,
  height = 320,
  footer,
}: {
  radar: RadarCategoryCounts;
  totalComments: number;
  height?: number;
  footer?: ReactNode;
}): JSX.Element {
  if (totalComments === 0) {
    return (
      <div>
        <p className="muted" style={{ marginTop: 8 }}>
          No comments analyzed yet.
        </p>
        {footer ? <div style={{ marginTop: 10 }}>{footer}</div> : null}
      </div>
    );
  }

  const data: ChartDatum[] = radarBucketsWithRates(radar, totalComments).map((bucket) => ({
    label: bucket.label,
    value: bucket.rate * 100,
    count: bucket.count,
    rate: bucket.rate,
  }));

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <RadarChart data={data} cx="50%" cy="50%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={5}
              tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Radar
              dataKey="value"
              stroke="#6aa9ff"
              fill="rgba(106,169,255,0.28)"
              fillOpacity={1}
            />
            <Tooltip content={<TooltipContent />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {footer ? <div style={{ marginTop: 10 }}>{footer}</div> : null}
    </div>
  );
}
