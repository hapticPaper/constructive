import { Link, useLocation } from 'react-router-dom';

import { PRIMARY_NAV_ITEMS } from '../lib/nav';

export function Breadcrumbs(): JSX.Element | null {
  const location = useLocation();
  const pathname = location.pathname;

  // Don't show on home
  if (pathname === '/') return null;

  const crumbs: Array<{ label: string; to?: string }> = [
    { label: 'Home', to: '/' },
  ];

  // Find the matching primary nav item
  const navItem = PRIMARY_NAV_ITEMS.find(
    (item) => item.to !== '/' && pathname.startsWith(item.to),
  );

  if (navItem) {
    crumbs.push({ label: navItem.label, to: navItem.to });
  }

  // Add specific page breadcrumbs
  if (pathname.startsWith('/channel/')) {
    if (crumbs[crumbs.length - 1]?.to !== '/library') {
      crumbs.push({ label: 'Library', to: '/library' });
    }
    crumbs.push({ label: 'Channel' });
  } else if (pathname.startsWith('/video/')) {
    if (crumbs[crumbs.length - 1]?.to !== '/library') {
      crumbs.push({ label: 'Library', to: '/library' });
    }
    crumbs.push({ label: 'Video Analytics' });
  }

  // Only show if we have more than just Home
  if (crumbs.length <= 1) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, idx) => (
          <li key={idx}>
            {crumb.to ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
