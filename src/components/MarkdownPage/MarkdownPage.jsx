import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import mermaid from 'mermaid';

import CodePanel from '../CodePanel/CodePanel';
import LatexPage from '../LatexPage/LatexPage';
import LifecycleBar from '../LifecycleBar/LifecycleBar';
import './markdown.css';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  flowchart: { useMaxWidth: true, htmlLabels: true },
});

function MermaidBlock({ chart }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      mermaid
        .render('mermaid-' + Math.random().toString(36).slice(2), chart)
        .then(({ svg }) => { ref.current.innerHTML = svg; });
    }
  }, [chart]);
  return <div className="mermaid" ref={ref} />;
}

export default function MarkdownPage({ content, category, path, status, lifecycleStep }) {
  const { hash } = useLocation();
  const isTex = path?.toLowerCase().endsWith('.tex');
  const isTla = path?.toLowerCase().endsWith('.tla');
  const isSvg = path?.toLowerCase().endsWith('.svg');

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace('#', '');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, [hash, content]);

  if (isTex) {
    return (
      <div className={`markdown-body ${category ? `markdown-${category}` : ''}`}>
        <LatexPage content={content} status={status} />
      </div>
    );
  }

  if (isTla) {
    return (
      <div className={`markdown-body ${category ? `markdown-${category}` : ''}`}>
        <CodePanel snippet={content} language="tla" />
      </div>
    );
  }

  if (isSvg) {
    return (
      <div
        className={`markdown-body ${category ? `markdown-${category}` : ''}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className={`markdown-body ${category ? `markdown-${category}` : ''}`}>
      {lifecycleStep && <LifecycleBar currentStep={lifecycleStep} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          code({ node, inline, className = '', children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'plaintext';
            const isBlock = !inline && String(children).includes('\n');

            if (!isBlock) {
              return <code className={className} {...props}>{children}</code>;
            }

            if (language === 'mermaid') {
              return <MermaidBlock chart={String(children).replace(/\n$/, '')} />;
            }

            return <CodePanel snippet={String(children).replace(/\n$/, '')} language={language} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}