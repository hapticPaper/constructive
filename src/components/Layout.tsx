import { Outlet } from 'react-router-dom';

import { NavBar } from './NavBar';
import { SideNav } from './SideNav';

export function Layout(): JSX.Element {
  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container">
        <div className="app-content">
          <SideNav />
          <main className="main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
