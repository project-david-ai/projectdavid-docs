// src/App.jsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import 'katex/dist/katex.min.css';   // ✅ REQUIRED FOR SYMBOLIC RENDERING

import DocsLayout from './docsLayout';
import DocPage from './pages/common/DocPage.jsx';
import DocsHub from './pages/common/DocsHub.jsx';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Root → Docs hub */}
        <Route path="/" element={<Navigate to="/docs" replace />} />

        {/* /docs hierarchy ------------------------------------------------ */}
        <Route path="/docs" element={<DocsLayout />}>

          {/* Hub (cards) - Renders at /docs */}
          <Route index element={<DocsHub />} />

          {/* Consolidated dynamic route */}
          <Route path=":slug" element={<DocPage />} />

        </Route>
      </Routes>
    </Router>
  );
}