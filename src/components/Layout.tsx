import { Outlet } from 'react-router-dom';

import { NavBar } from './NavBar';

export function Layout(): JSX.Element {
  return (
    <div className="app-shell">
      <NavBar />
      <Outlet />
    </div>
  );
}
