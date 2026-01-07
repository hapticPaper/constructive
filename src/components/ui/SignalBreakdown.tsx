import { radarBucketsWithRates } from '../../content/radar';
import type { RadarCategory, RadarCategoryCounts } from '../../content/types';

function formatPercent(rate: number): string {
  const pct = Math.round(rate * 100);
  return `${pct}%`;
}

const CATEGORY_COLORS: Partial<Record<RadarCategory, string>> = {
  praise: 'var(--positive)',
  criticism: 'var(--negative)',
  toxic: 'var(--danger)',
};

export function SignalBreakdown({
  radar,
  totalComments,
}: {
  radar: RadarCategoryCounts;
  totalComments: number;
}): JSX.Element {
  if (totalComments === 0) {
    return <p className="muted">No comments analyzed yet.</p>;
  }

  const buckets = radarBucketsWithRates(radar, totalComments);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {buckets.map((bucket) => {
        const fillColor = CATEGORY_COLORS[bucket.key] ?? 'var(--brand)';
        const fillWidth = Math.max(0, Math.min(1, bucket.rate)) * 100;

        return (
          <div key={bucket.key}>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ fontWeight: 650 }}>{bucket.label}</span>
              <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatPercent(bucket.rate)} · {bucket.count.toLocaleString()}
              </span>
            </div>
            <div
              aria-hidden="true"
              style={{
                marginTop: 6,
                height: 8,
                borderRadius: 999,
                background: 'rgba(148, 163, 184, 0.22)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${fillWidth}%`,
                  background: fillColor,
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
