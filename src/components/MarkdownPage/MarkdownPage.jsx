import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import mermaid from 'mermaid';

import CodePanel from '../CodePanel/CodePanel';
import LatexPage from '../LatexPage/LatexPage';
import LifecycleBar from '../LifecycleBar/LifecycleBar';
import { remarkCodeVariants } from './codeVariants';
import './markdown.css';
import './interfaces.css';
import './reference.css';

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

const InterfaceContext = createContext(null);

function readFence(node) {
  const code = node?.children?.[0];
  if (node?.tagName !== 'pre' || code?.type !== 'element' || code.tagName !== 'code') {
    return null;
  }
  const classes = code.properties?.className ?? [];
  const language = (Array.isArray(classes) ? classes : [classes])
    .find(name => name.startsWith('language-'))
    ?.slice('language-'.length) || 'plaintext';
  const snippet = code.children.map(child => child.value ?? '').join('')
    .replace(/\n$/, '');
  return { language, snippet };
}

function MarkdownDiv({ node, children, ...props }) {
  const { selected, select } = useContext(InterfaceContext);

  if (node?.properties?.dataInterfaceSelector === 'true') {
    return (
      <div className="doc-interface-switch" role="group" aria-label="Example interface">
        {['python', 'curl'].map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={value === selected}
            onClick={() => select(value)}
          >
            {value === 'python' ? 'Python' : 'cURL'}
          </button>
        ))}
      </div>
    );
  }

  if (node?.properties?.dataCodeVariants === 'true') {
    const examples = node.children.map(readFence).filter(Boolean);
    if (examples.length === 2) {
      const active = examples[selected === 'curl' ? 1 : 0];
      return <CodePanel {...active} />;
    }
  }

  return <div {...props}>{children}</div>;
}

function MarkdownPre({ node, children, ...props }) {
  const fence = readFence(node);
  if (!fence) return <pre {...props}>{children}</pre>;
  if (fence.language === 'mermaid') return <MermaidBlock chart={fence.snippet} />;
  return <CodePanel {...fence} />;
}

// Only an unordered, link-only list immediately following a Reference heading
// becomes navigation. Ordinary Markdown lists and links remain unchanged.
function rehypeReferenceNavigation() {
  const meaningful = nodes => (nodes ?? []).filter(
    node => node.type !== 'text' || node.value.trim() !== '',
  );
  const isElement = (node, tag) =>
    node?.type === 'element' && node.tagName === tag;

  function isReferenceItem(node) {
    if (!isElement(node, 'li')) return false;
    let children = meaningful(node.children);
    if (children.length === 1 && isElement(children[0], 'p')) {
      children = meaningful(children[0].children);
    }
    return children.length === 1 && isElement(children[0], 'a') &&
      typeof children[0].properties?.href === 'string';
  }

  return tree => {
    const children = tree.children;
    for (let i = 0; i < children.length; i++) {
      const heading = children[i];
      if (!isElement(heading, 'h2')) continue;
      const label = meaningful(heading.children);
      if (label.length !== 1 || label[0].type !== 'text' ||
          label[0].value.trim() !== 'Reference') continue;

      let next = i + 1;
      while (next < children.length && children[next].type === 'text' &&
             children[next].value.trim() === '') next++;

      const list = children[next];
      if (!isElement(list, 'ul')) continue;
      const items = meaningful(list.children);
      if (!items.length || !items.every(isReferenceItem)) continue;

      children[next] = {
        type: 'element',
        tagName: 'nav',
        properties: {
          className: ['doc-reference-nav'],
          ...(heading.properties?.id
            ? { ariaLabelledBy: heading.properties.id }
            : { ariaLabel: 'Reference' }),
        },
        children: [list],
      };
    }
  };
}

const markdownComponents = { div: MarkdownDiv, pre: MarkdownPre };
const remarkPlugins = [remarkGfm, remarkCodeVariants];
const rehypePlugins = [rehypeSlug, rehypeReferenceNavigation];

export default function MarkdownPage({ content, category, path, status, lifecycleStep }) {
  const { hash } = useLocation();
  const [selected, select] = useState('python');
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
      <InterfaceContext.Provider value={{ selected, select }}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </InterfaceContext.Provider>
    </div>
  );
}