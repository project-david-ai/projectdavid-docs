// src/components/MarkdownPage/MarkdownPage.jsx

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

import CodePanel from '../CodePanel/CodePanel';
import LatexPage from '../LatexPage/LatexPage';   // ✅ NEW
import './markdown.css';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
  },
});

function MermaidBlock({ chart }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      mermaid
        .render(
          'mermaid-' + Math.random().toString(36).slice(2),
          chart
        )
        .then(({ svg }) => {
          ref.current.innerHTML = svg;
        });
    }
  }, [chart]);

  return <div className="mermaid" ref={ref} />;
}

export default function MarkdownPage({ content, category, path }) {
  /* ---------------------------------------------------------
     Detect document types
     --------------------------------------------------------- */

  const isTex = path?.toLowerCase().endsWith('.tex');
  const isTla = path?.toLowerCase().endsWith('.tla');

  /* ---------------------------------------------------------
     1. Render LaTeX symbolically
     --------------------------------------------------------- */

  if (isTex) {
    return (
      <div className={`markdown-body ${category ? `markdown-${category}` : ''}`}>
        <LatexPage content={content} />
      </div>
    );
  }

  /* ---------------------------------------------------------
     2. Render TLA+ as source
     --------------------------------------------------------- */

  if (isTla) {
    return (
      <div className={`markdown-body ${category ? `markdown-${category}` : ''}`}>
        <CodePanel snippet={content} language="tla" />
      </div>
    );
  }

  /* ---------------------------------------------------------
     3. Standard Markdown rendering
     --------------------------------------------------------- */

  return (
    <div className={`markdown-body ${category ? `markdown-${category}` : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className = '', children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'plaintext';

            const isBlock =
              !inline && String(children).includes('\n');

            if (!isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            if (language === 'mermaid') {
              return (
                <MermaidBlock
                  chart={String(children).replace(/\n$/, '')}
                />
              );
            }

            return (
              <CodePanel
                snippet={String(children).replace(/\n$/, '')}
                language={language}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}