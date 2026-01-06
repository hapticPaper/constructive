import { PrimaryNavLinks } from './PrimaryNavLinks';

export function SideNav(): JSX.Element {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <nav className="sidebar-nav">
        <PrimaryNavLinks linkClassName="sidebar-link" />
      </nav>
    </aside>
  );
}
