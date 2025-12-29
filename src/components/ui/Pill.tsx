import type { PropsWithChildren } from 'react';

import clsx from 'clsx';

export function Pill({
  children,
  className,
}: PropsWithChildren<{ className?: string }>): JSX.Element {
  return <span className={clsx('pill', className)}>{children}</span>;
}
