import { Outlet } from 'react-router-dom';

export function PageLayout(): JSX.Element {
  return (
    <div className="app-container app-page">
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
