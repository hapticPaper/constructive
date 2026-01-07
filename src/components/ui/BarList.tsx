import type { CSSProperties } from 'react';

export type BarListItem = {
  key: string;
  label: string;
  count: number;
  rate: number;
  // Defaults to `var(--brand)`.
  color?: string;
};

function clampRate(rate: number): number {
  return Math.max(0, Math.min(1, rate));
}

function formatPercent(rate: number): string {
  const pct = Math.round(rate * 100);
  return `${pct}%`;
}

export function BarList({
  items,
  style,
}: {
  items: BarListItem[];
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {items.map((item) => {
        const clampedRate = clampRate(item.rate);
        const fillWidth = clampedRate * 100;
        const fillColor = item.color ?? 'var(--brand)';

        return (
          <div key={item.key}>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ fontWeight: 650 }}>{item.label}</span>
              <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatPercent(clampedRate)} · {item.count.toLocaleString()}
              </span>
            </div>
            <div
              // Decorative bar; the numeric value is conveyed in the text row above.
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
