import clsx from 'clsx';
import { Link, NavLink, useLocation } from 'react-router-dom';

import {
  getAnalysisUsage,
  getUserTier,
  isGoogleAuthEnabled,
  signInWithGoogle,
  signOut,
} from '../lib/freemium';
import { Button } from './ui/Button';
import { Pill } from './ui/Pill';

export function NavBar(): JSX.Element {
  const location = useLocation();
  const usage = getAnalysisUsage();
  const tier = getUserTier();

  const libraryActive =
    location.pathname.startsWith('/library') ||
    location.pathname.startsWith('/channel') ||
    location.pathname.startsWith('/video');

  return (
    <header className="nav">
      <div className="app-container nav-inner">
        <div className="nav-left">
          <Link to="/" className="brand">
            Constructive
          </Link>
          <nav className="nav-links">
            <NavLink
              end
              to="/"
              className={({ isActive }) => clsx('nav-link', isActive && 'active')}
            >
              Overview
            </NavLink>
            <NavLink
              to="/library"
              className={({ isActive }) =>
                clsx('nav-link', (isActive || libraryActive) && 'active')
              }
            >
              Library
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) => clsx('nav-link', isActive && 'active')}
            >
              Jobs
            </NavLink>
          </nav>
        </div>
        <div className="nav-right">
          <Pill>
            {tier.label}: {usage.used}/{tier.maxPer24Hours} analyses (24h)
          </Pill>
          {tier.kind === 'google' ? (
            <Button variant="ghost" onClick={() => signOut()}>
              Sign out
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!isGoogleAuthEnabled()}
              title={
                isGoogleAuthEnabled()
                  ? undefined
                  : 'Google sign-in is not configured for this build.'
              }
              onClick={() => void signInWithGoogle()}
            >
              Continue with Google
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
