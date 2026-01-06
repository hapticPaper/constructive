import { matchPath } from 'react-router-dom';

export type PrimaryNavItem = {
  to: string;
  label: string;

  /**
   * When `scopes` is not provided, active state is based on `to` with this `end`
   * behavior (default: `true`).
   */
  end?: boolean;

  /**
   * When provided, the nav item is considered active if `pathname` matches any
   * scope with `end: false`.
   */
  scopes?: readonly string[];
};

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { to: '/', label: 'Overview', end: true },
  {
    to: '/library',
    label: 'Library',
    scopes: ['/library', '/channel', '/video'],
  },
  { to: '/jobs', label: 'Jobs', end: true },
];

export function isPrimaryNavItemActive(item: PrimaryNavItem, pathname: string): boolean {
  if (item.scopes) {
    return item.scopes.some(
      (scope) => matchPath({ path: scope, end: false }, pathname) != null,
    );
  }

  return matchPath({ path: item.to, end: item.end ?? true }, pathname) != null;
}
