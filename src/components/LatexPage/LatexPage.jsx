// src/components/LatexPage/LatexPage.jsx

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './latexpage.css';

/* ── 1. Math rendering (must run FIRST, before any whitespace changes) ── */
function renderMath(text) {
  // Block math: \[ ... \]
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
    try {
      return `<div class="math-block">${katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return `<span class="katex-error">${expr}</span>`;
    }
  });

  // Inline math: $...$ (non-greedy, single-line only)
  text = text.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
    } catch (e) {
      return `<span class="katex-error">${expr}</span>`;
    }
  });

  return text;
}

/* ── 2. Structure conversion (runs AFTER math so newlines are still intact) ── */
function convertStructure(tex) {
  // Strip LaTeX preamble if present
  tex = tex.replace(/[\s\S]*?\\begin\{document\}/, '');
  tex = tex.replace(/\\end\{document\}[\s\S]*$/, '');
  tex = tex.replace(/\\maketitle/g, '');

  // Verbatim blocks → <pre><code> (must run BEFORE newline processing)
  tex = tex.replace(
    /\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g,
    (_, body) => `<pre><code>${body.trimEnd()}</code></pre>`
  );

  // Headings
  tex = tex
    .replace(/\\section\{(.*?)\}/g,      '<h1>$1</h1>')
    .replace(/\\subsection\*\{(.*?)\}/g, '<h2>$1</h2>')
    .replace(/\\subsection\{(.*?)\}/g,   '<h2>$1</h2>');

  // Lists — parse entire block at once so \item content is cleanly wrapped
  tex = tex.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (_, body) => {
      const items = body
        .split(/\\item/)
        .slice(1)
        .map(s => `<li>${s.trim()}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }
  );

  tex = tex.replace(
    /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g,
    (_, body) => {
      const items = body
        .split(/\\item/)
        .slice(1)
        .map(s => `<li>${s.trim()}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    }
  );

  // Inline text commands
  tex = tex
    .replace(/\\textbf\{(.*?)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{(.*?)\}/g, '<em>$1</em>')
    .replace(/\\emph\{(.*?)\}/g,   '<em>$1</em>')
    .replace(/\\texttt\{(.*?)\}/g, '<code>$1</code>')
    .replace(/\\qed/g,             '<span class="qed">∎</span>');

  // Split on double newlines → logical blocks → wrap non-HTML in <p>
  const blockTags = /^<(h[1-6]|ul|ol|pre|div|p)/;
  return tex
    .split(/\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => blockTags.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, ' ')}</p>`)
    .join('\n');
}

/* ── Component ── */
export default function LatexPage({ content, status }) {
  const html = useMemo(() => {
    const withMath = renderMath(content);
    return convertStructure(withMath);
  }, [content]);

  return (
    <div
      className={`latex-body${status ? ` status-${status}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}