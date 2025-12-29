import type { PropsWithChildren } from 'react';

export function WidgetPanel({
  title,
  children,
}: PropsWithChildren<{ title: string }>): JSX.Element {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
