import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { pages } from '../../lib/docs.js';

import MarkdownPage from '../../components/MarkdownPage/MarkdownPage.jsx';
import ApiReferencePage from './ApiReferencePage.jsx';

const OpenApiReferencePage = lazy(
  () => import('./OpenApiReferencePage.jsx')
);

export default function DocPage() {
  const { slug } = useParams();

  if (!slug) {
    return <div>404 - Invalid Page Route</div>;
  }

  const pageData = pages[slug];

  if (!pageData) {
    return <div>404 - Page Not Found for slug: {slug}</div>;
  }

  if (pageData.frontmatter?.layout === 'openapi') {
    return (
      <Suspense fallback={null}>
        <OpenApiReferencePage />
      </Suspense>
    );
  }

  if (pageData.frontmatter?.layout === 'api') {
    return <ApiReferencePage pageData={pageData} />;
  }

  return (
    <MarkdownPage
      content={pageData.content}
      category={pageData.frontmatter?.category}
      status={pageData.frontmatter?.status}
      path={pageData.path}
      lifecycleStep={pageData.frontmatter?.lifecycle_step}
    />
  );
}