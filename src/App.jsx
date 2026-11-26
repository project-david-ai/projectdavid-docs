import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import 'katex/dist/katex.min.css';

import DocsLayout from './docsLayout';
import DocPage from './pages/common/DocPage.jsx';
import DocsHub from './pages/common/DocsHub.jsx';
import OpenApiReferencePage from './pages/common/OpenApiReferencePage.jsx';

import { trackPageView } from './lib/tracker';

import './ApiReferenceLayout.css';

function AnalyticsWatcher() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

  return null;
}

function ApiReferenceLayout() {
  return (
    <div className="api-workspace">
      <header className="api-workspace__header">
        <div className="api-workspace__identity">

          <Link to="/docs" className="api-workspace__brand">
  <img
    src="/projectdavid-emblem.svg"
    alt=""
    className="api-workspace__emblem"
    width={24}
    height={24}
  />
  <span>Project David</span>
</Link>
          <span className="api-workspace__separator">/</span>

          <span className="api-workspace__label">
            API reference
          </span>
        </div>

        <Link to="/docs" className="api-workspace__back">
          <ArrowLeft size={14} />
          <span>Documentation</span>
        </Link>
      </header>

      <main className="api-workspace__content">
        <OpenApiReferencePage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AnalyticsWatcher />

      <Routes>
        <Route
          path="/"
          element={<Navigate to="/docs" replace />}
        />

        <Route
          path="/docs/api-reference"
          element={<ApiReferenceLayout />}
        />

        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsHub />} />
          <Route path=":slug" element={<DocPage />} />
        </Route>
      </Routes>
    </Router>
  );
}