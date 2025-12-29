import type { ButtonHTMLAttributes } from 'react';

import clsx from 'clsx';

type Variant = 'primary' | 'ghost';

export function Button({
  className,
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}): JSX.Element {
  return <button {...props} className={clsx('btn', `btn-${variant}`, className)} />;
}
