import type { ReactNode } from 'react';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts';

import { radarBucketsWithRates } from '../../content/radar';
import type { RadarCategoryCounts } from '../../content/types';

type ChartDatum = {
  label: string;
  value: number;
  count: number;
  rate: number;
};

const RADAR_SERIES_DATA_KEY = 'value';

function formatPercent(rate: number): string {
  const pct = Math.round(rate * 100);
  return `${pct}%`;
}

function TooltipContent({
  active,
  payload,
}: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const entry = payload.find((item) => item.dataKey === RADAR_SERIES_DATA_KEY);
  if (!entry) return null;
  const raw = entry?.payload as Partial<ChartDatum> | undefined;
  if (
    !raw ||
    typeof raw.label !== 'string' ||
    typeof raw.rate !== 'number' ||
    typeof raw.count !== 'number' ||
    typeof raw.value !== 'number'
  ) {
    return null;
  }
  const datum = raw as ChartDatum;

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
  /**
   * Denominator for rates (should match the `commentCount` used to compute `radar`).
   */
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

  const data: ChartDatum[] = radarBucketsWithRates(radar, totalComments).map(
    (bucket) => ({
      label: bucket.label,
      value: Math.round(bucket.rate * 100),
      count: bucket.count,
      rate: bucket.rate,
    }),
  );

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
              dataKey={RADAR_SERIES_DATA_KEY}
              stroke="#6aa9ff"
              fill="rgba(106,169,255,0.28)"
              fillOpacity={1}
            />
            <Tooltip content={TooltipContent} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {footer ? <div style={{ marginTop: 10 }}>{footer}</div> : null}
    </div>
  );
}
