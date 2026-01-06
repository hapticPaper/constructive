import { Outlet } from 'react-router-dom';

import { Breadcrumbs } from './Breadcrumbs';
import { SideNav } from './SideNav';

export function SidebarLayout(): JSX.Element {
  return (
    <div className="app-container">
      <div className="app-content">
        <SideNav />
        <main className="main">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
