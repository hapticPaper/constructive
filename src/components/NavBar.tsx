import { Link, useLocation } from 'react-router-dom';

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

  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="nav-left">
          <Link to="/" className="brand">
            Constructive
          </Link>
          <nav className="nav-links">
            <Link
              to="/"
              className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
            >
              Onboard
            </Link>
            <Link
              to="/library"
              className={
                location.pathname.startsWith('/library') ? 'nav-link active' : 'nav-link'
              }
            >
              Library
            </Link>
            <Link
              to="/jobs"
              className={
                location.pathname.startsWith('/jobs') ? 'nav-link active' : 'nav-link'
              }
            >
              Jobs
            </Link>
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
