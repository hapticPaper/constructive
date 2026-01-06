import { Link, useLocation } from 'react-router-dom';

import {
  getAnalysisUsage,
  getUserTier,
  isGoogleAuthEnabled,
  signInWithGoogle,
  signOut,
} from '../lib/freemium';
import { PrimaryNavLinks } from './PrimaryNavLinks';
import { Button } from './ui/Button';
import { Pill } from './ui/Pill';

export function NavBar(): JSX.Element {
  const usage = getAnalysisUsage();
  const tier = getUserTier();
  const location = useLocation();
  const isOverview = location.pathname === '/';

  return (
    <header className="nav">
      <div className="app-container nav-inner">
        <div className="nav-left">
          <Link to="/" className="brand">
            Constructive
          </Link>
          {isOverview && (
            <nav className="nav-links">
              <PrimaryNavLinks linkClassName="nav-link" />
            </nav>
          )}
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
