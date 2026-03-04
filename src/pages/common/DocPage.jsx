// src/pages/common/DocPage.jsx

import { useParams } from 'react-router-dom';
import { pages } from '../../lib/docs.js';

import MarkdownPage         from '../../components/MarkdownPage/MarkdownPage.jsx';
import LatexPage            from '../../components/LatexPage/LatexPage.jsx';
import ApiReferencePage     from './ApiReferencePage.jsx';
import OpenApiReferencePage from './OpenApiReferencePage.jsx';

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
    return <OpenApiReferencePage />;
  }

  if (pageData.frontmatter?.layout === 'api') {
    return <ApiReferencePage pageData={pageData} />;
  }

  const isLatex = pageData.path?.endsWith('.tex') || pageData.path?.endsWith('.tla');

  if (isLatex) {
    return (
      <LatexPage
        content={pageData.content}
      />
    );
  }

  return (
    <MarkdownPage
      content={pageData.content}
      category={pageData.frontmatter?.category}
    />
  );
}