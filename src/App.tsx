import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ChannelPage } from './pages/ChannelPage';
import { JobsPage } from './pages/JobsPage';
import { LibraryPage } from './pages/LibraryPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { VideoAnalyticsPage } from './pages/VideoAnalyticsPage';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<OnboardingPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/channel/:platform/:channelId" element={<ChannelPage />} />
        <Route path="/video/:platform/:videoId" element={<VideoAnalyticsPage />} />
      </Route>
    </Routes>
  );
}
