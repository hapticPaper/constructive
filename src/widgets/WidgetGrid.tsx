import type { PropsWithChildren } from 'react';

export function WidgetGrid({
  columns = 3,
  children,
}: PropsWithChildren<{ columns?: 1 | 2 | 3 }>): JSX.Element {
  return <div className={`grid grid-${columns}`}>{children}</div>;
}
