import clsx from 'clsx';
import { NavLink, useLocation } from 'react-router-dom';

function isLibraryPath(pathname: string): boolean {
  return (
    pathname.startsWith('/library') ||
    pathname.startsWith('/channel') ||
    pathname.startsWith('/video')
  );
}

export function SideNav(): JSX.Element {
  const location = useLocation();
  const libraryActive = isLibraryPath(location.pathname);

  return (
    <aside className="sidebar" aria-label="Primary">
      <nav className="sidebar-nav">
        <NavLink
          end
          to="/"
          className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
        >
          Overview
        </NavLink>
        <NavLink
          to="/library"
          className={({ isActive }) =>
            clsx('sidebar-link', (isActive || libraryActive) && 'active')
          }
        >
          Library
        </NavLink>
        <NavLink
          to="/jobs"
          className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
        >
          Jobs
        </NavLink>
      </nav>
    </aside>
  );
}
