import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function HeroActionLink({
  to,
  href,
  children,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
}): JSX.Element | null {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-ghost">
        {children}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} className="btn btn-ghost">
        {children}
      </Link>
    );
  }

  return null;
}
