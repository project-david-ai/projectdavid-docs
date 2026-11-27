import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import powershell from 'highlight.js/lib/languages/powershell';
import plaintext from 'highlight.js/lib/languages/plaintext';

import 'highlight.js/styles/github.css';
import './codepanel.css';

hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('plaintext', plaintext);

const aliases = {
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  curl: 'bash',
  dotenv: 'ini',
  env: 'ini',
  yml: 'yaml',
  js: 'javascript',
  ts: 'typescript',
  ps1: 'powershell',
  text: 'plaintext',
};

const labels = {
  python: 'Python',
  bash: 'Shell',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  curl: 'cURL',
  dotenv: '.env',
  env: '.env',
  yaml: 'YAML',
  yml: 'YAML',
  json: 'JSON',
  ini: 'INI',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  powershell: 'PowerShell',
  plaintext: 'Text',
  tla: 'TLA+',
};

export default function CodePanel({
  snippet = '',
  language = 'python',
  title = '',
  className = '',
}) {
  const timer = useRef(null);
  const [feedback, setFeedback] = useState(null);
  const source = String(snippet ?? '');
  const requested = String(language || 'plaintext').toLowerCase();
  const grammar = aliases[requested] ?? requested;
  const label = title || labels[requested] || labels[grammar] || requested;
  const status = feedback?.source === source ? feedback.status : '';

  const highlighted = useMemo(() => {
    if (!hljs.getLanguage(grammar) || grammar === 'plaintext') return null;
    return hljs.highlight(source, { language: grammar, ignoreIllegals: true }).value;
  }, [source, grammar]);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(source);
      setFeedback({ source, status: 'Copied' });
    } catch {
      setFeedback({ source, status: 'Copy failed' });
    }
    timer.current = setTimeout(() => setFeedback(null), 1600);
  }

  return (
    <div className={`code-panel ${className}`.trim()}>
      <header className="code-header">
        <span className="code-title">{label}</span>
        <button
          type="button"
          className="code-copy"
          onClick={handleCopy}
          aria-label="Copy code"
          title={status || 'Copy code'}
        >
          {status === 'Copied' ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <span className="sr-only" role="status">{status}</span>
      </header>
      <pre className="code-body" tabIndex={0} aria-label={`${label} code`}>
        {highlighted === null ? (
          <code className="hljs">{source}</code>
        ) : (
          <code
            className={`hljs language-${grammar}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        )}
      </pre>
    </div>
  );
}
