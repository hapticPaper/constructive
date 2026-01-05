import clsx from 'clsx';
import { NavLink, useLocation } from 'react-router-dom';

import { isPrimaryNavItemActive, PRIMARY_NAV_ITEMS } from '../lib/nav';

export function PrimaryNavLinks({
  linkClassName,
}: {
  linkClassName: string;
}): JSX.Element {
  const location = useLocation();

  return (
    <>
      {PRIMARY_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          end={item.end}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              linkClassName,
              isPrimaryNavItemActive(item, location.pathname, isActive) && 'active',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}
