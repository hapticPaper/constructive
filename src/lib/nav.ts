import { isLibraryPath } from './routes';

export type PrimaryNavItem = {
  to: string;
  label: string;
  end?: boolean;
  isActive?: (pathname: string, routerIsActive: boolean) => boolean;
};

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { to: '/', label: 'Overview', end: true },
  {
    to: '/library',
    label: 'Library',
    isActive: (pathname, routerIsActive) => routerIsActive || isLibraryPath(pathname),
  },
  { to: '/jobs', label: 'Jobs' },
];

export function isPrimaryNavItemActive(
  item: PrimaryNavItem,
  pathname: string,
  routerIsActive: boolean,
): boolean {
  return item.isActive ? item.isActive(pathname, routerIsActive) : routerIsActive;
}
