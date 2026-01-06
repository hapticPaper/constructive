import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type HeroActionLinkProps = {
  children: ReactNode;
} & ({ href: string; to?: never } | { to: string; href?: never });

export function HeroActionLink(props: HeroActionLinkProps): JSX.Element {
  if ('href' in props) {
    const { href, children } = props;

    return (
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-ghost">
        {children}
      </a>
    );
  }

  const { to, children } = props;

  return (
    <Link to={to} className="btn btn-ghost">
      {children}
    </Link>
  );
}
