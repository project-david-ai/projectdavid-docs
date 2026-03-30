// src/docsLayout.jsx
import { Outlet } from 'react-router-dom';
import DocsSidebar from './components/SideBar/DocsSidebar';

export default function DocsLayout() {
  return (
    <div className="docs-layout">
      <DocsSidebar />
      <main className="docs-main">
        <Outlet />
      </main>
    </div>
  );
}