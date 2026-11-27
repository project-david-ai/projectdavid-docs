import React, { lazy, Suspense, useEffect } from 'react';
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

import { pages, resolveSlug } from './lib/docs';

import { trackPageView } from './lib/tracker';

import './ApiReferenceLayout.css';

const OpenApiReferencePage = lazy(
  () => import('./pages/common/OpenApiReferencePage.jsx')
);

function AnalyticsWatcher() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

  useEffect(() => {
    const slug = resolveSlug(location.pathname.split('/')[2]);
    if (!pages[slug]) return;
    const alternate = document.createElement('link');
    alternate.rel = 'alternate';
    alternate.type = 'text/markdown';
    alternate.href = `/markdown/${slug}.md`;
    document.head.appendChild(alternate);
    return () => alternate.remove();
  }, [location.pathname]);

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
        <Suspense fallback={null}>
          <OpenApiReferencePage />
        </Suspense>
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

          <Route
            path="sdk-lifecycle"
            element={<Navigate to="/docs/sdk-quick-start" replace />}
          />

          <Route path=":slug" element={<DocPage />} />
        </Route>
      </Routes>
    </Router>
  );
}