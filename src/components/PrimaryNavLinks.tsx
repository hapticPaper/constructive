import clsx from 'clsx';
import { Link, useLocation } from 'react-router-dom';

import { isPrimaryNavItemActive, PRIMARY_NAV_ITEMS } from '../lib/nav';

export function PrimaryNavLinks({
  linkClassName,
}: {
  linkClassName: string;
}): JSX.Element {
  const location = useLocation();

  return (
    <>
      {PRIMARY_NAV_ITEMS.map((item) => {
        const active = isPrimaryNavItemActive(item, location.pathname);

        return (
          <Link
            key={item.to}
            to={item.to}
            className={clsx(linkClassName, active && 'active')}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
