// src/components/SearchBar/SearchBar.jsx
import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { pages } from '../../lib/docs';
import './SearchBar.css';

// ---------------------------------------------------------------------------
// Build search index once at module load — not on every render
// ---------------------------------------------------------------------------
const DOCS = Object.values(pages)
  .filter(p => p.frontmatter?.nav_exclude !== 'true' && p.frontmatter?.slug)
  .map(p => ({
    slug:     p.frontmatter.slug,
    title:    p.frontmatter.title || p.frontmatter.slug,
    category: p.frontmatter.category || '',
    // Strip common markdown syntax, cap at 4000 chars for perf
    content:  (p.content || '').replace(/[#*`_\[\]>]/g, '').slice(0, 4000),
  }));

const fuse = new Fuse(DOCS, {
  keys: [
    { name: 'title',   weight: 0.65 },
    { name: 'content', weight: 0.35 },
  ],
  threshold:        0.35,
  minMatchCharLength: 2,
  includeMatches:   true,
});

// ---------------------------------------------------------------------------
// Extract a short snippet around the first match in content
// ---------------------------------------------------------------------------
function getSnippet(content, matches) {
  const hit = matches?.find(m => m.key === 'content');
  if (hit?.indices?.[0]) {
    const [start] = hit.indices[0];
    const from = Math.max(0, start - 25);
    const to   = Math.min(content.length, start + 90);
    return (from > 0 ? '...' : '') + content.slice(from, to).trim() + '...';
  }
  return content.slice(0, 110).trim() + (content.length > 110 ? '...' : '');
}

function categoryLabel(cat) {
  return (cat || '').replace(/-/g, ' ').toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SearchBar({ onNavigate }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [cursor,  setCursor]  = useState(-1);
  const [open,    setOpen]    = useState(false);

  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);
  const navigate    = useNavigate();

  // Re-search whenever query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const hits = fuse.search(query, { limit: 8 });
    setResults(hits);
    setOpen(hits.length > 0);
    setCursor(-1);
  }, [query]);

  function go(slug) {
    navigate(`/docs/${slug}`);
    setQuery('');
    setResults([]);
    setOpen(false);
    onNavigate?.();
  }

  function handleKey(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      if (cursor >= 0 && results[cursor]) go(results[cursor].item.slug);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (
        !dropdownRef.current?.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="search-wrap">
      <div className="search-input-row">
        <Search size={13} className="search-icon" />
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search docs..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            className="search-clear"
            aria-label="Clear search"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <ul ref={dropdownRef} className="search-results" role="listbox">
          {results.map(({ item, matches }, i) => (
            <li
              key={item.slug}
              role="option"
              aria-selected={i === cursor}
              className={`search-result${i === cursor ? ' search-result--active' : ''}`}
              onMouseDown={() => go(item.slug)}
              onMouseEnter={() => setCursor(i)}
            >
              <div className="search-result-top">
                <span className="search-result-title">{item.title}</span>
                {item.category && (
                  <span className="search-result-cat">
                    {categoryLabel(item.category)}
                  </span>
                )}
              </div>
              <p className="search-result-snippet">
                {getSnippet(item.content, matches)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}