import type { PropsWithChildren } from 'react';

export function Callout({
  title,
  children,
}: PropsWithChildren<{ title?: string }>): JSX.Element {
  return (
    <div className="callout">
      {title ? <div style={{ marginBottom: 6, fontWeight: 650 }}>{title}</div> : null}
      <div className="muted">{children}</div>
    </div>
  );
}
