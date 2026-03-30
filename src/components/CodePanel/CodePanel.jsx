// src/components/CodePanel/CodePanel.jsx

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-regular-svg-icons';

import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';
import plaintext from 'highlight.js/lib/languages/plaintext';

import 'highlight.js/styles/github-dark.css';
import './codepanel.css';

hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('plaintext', plaintext);

export default function CodePanel({
  snippet   = '',
  language  = 'python',
  title     = '',
  className = '',
}) {
  const codeRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) hljs.highlightElement(codeRef.current);
  }, [snippet]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    });
  };

  return (
    <div className={`code-panel ${className}`}>
      <header className="code-header">
        <span className="code-title">{title}</span>

        <div className="code-meta">
          <span className="code-lang">{language}</span>

          <button onClick={handleCopy} className="code-copy">
            <FontAwesomeIcon
              icon={faCopy}
              style={{ width: '16px', height: '16px' }}
            />
            <span className="code-copy__label">
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>
      </header>

      <pre className="code-body">
        <code ref={codeRef} className={`language-${language}`}>
          {snippet.trimEnd()}
        </code>
      </pre>
    </div>
  );
}