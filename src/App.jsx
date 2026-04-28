// src/App.jsx
import React, { useEffect } from 'react'; // Added useEffect
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation, // Added useLocation
} from 'react-router-dom';

import 'katex/dist/katex.min.css';
import DocsLayout from './docsLayout';
import DocPage from './pages/common/DocPage.jsx';
import DocsHub from './pages/common/DocsHub.jsx';
import { trackPageView } from './lib/tracker'; // Import tracker

// This internal component watches for route changes
function AnalyticsWatcher() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

  return null; // Invisible component
}

export default function App() {
  return (
    <Router>
      <AnalyticsWatcher /> {/* <--- Fires on every navigation */}
      <Routes>
        <Route path="/" element={<Navigate to="/docs" replace />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsHub />} />
          <Route path=":slug" element={<DocPage />} />
        </Route>
      </Routes>
    </Router>
  );
}