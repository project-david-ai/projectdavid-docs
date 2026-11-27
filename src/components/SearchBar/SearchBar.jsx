// src/components/SearchBar/SearchBar.jsx
import { useState, useRef, useEffect, useId } from 'react';
import { Search, X } from 'lucide-react';
import { createSearchIndex, formatSearchSnippet } from '../../lib/docSearch.js';
import { useNavigate } from 'react-router-dom';
import { pages, categoryDisplayNames } from '../../lib/docs';
import './SearchBar.css';

const searchIndexes = {
  general: createSearchIndex(pages, 'general'),
  contributing: createSearchIndex(pages, 'contributing'),
};

// Compact metadata leaves room for the document title in a narrow sidebar.
function categoryLabel(cat) {
  return cat === 'operate' ? 'SELF-HOST' : categoryDisplayNames[cat] || cat;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SearchBar({ onNavigate, audience = 'general' }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [cursor,  setCursor]  = useState(-1);
  const [open,    setOpen]    = useState(false);

  const listId = useId();
  const wrapRef = useRef(null);
  const inputRef    = useRef(null);
  const navigate    = useNavigate();

  // Re-search whenever query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const hits = searchIndexes[audience].search(query, { limit: 8 });
    setResults(hits);
    setOpen(query.trim().length >= 2);
    setCursor(-1);
  }, [query, audience]);

  function go(slug) {
    navigate(`/docs/${slug}`);
    setQuery('');
    setResults([]);
    setOpen(false);
    onNavigate?.();
  }

  function handleKey(e) {
    if (!open) {
      if (e.key === 'ArrowDown' && query.trim().length >= 2) {
        e.preventDefault();
        setOpen(true);
        setCursor(results.length ? 0 : -1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => results.length ? Math.max(c - 1, 0) : -1);
    } else if (e.key === 'Enter') {
      if (cursor >= 0 && results[cursor]) go(results[cursor].item.slug);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  }

  useEffect(() => {
    if (open && cursor >= 0) {
      document.getElementById(`${listId}-${cursor}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursor, open, listId]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="search-wrap" ref={wrapRef}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <div className="search-input-row">
        <Search size={13} className="search-icon" />
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          role="combobox"
          aria-label={audience === 'contributing' ? 'Search contributing' : 'Search documentation'}
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={open && results.length > 0 ? listId : undefined}
          aria-activedescendant={open && cursor >= 0 && results[cursor] ? `${listId}-${cursor}` : undefined}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          placeholder={audience === 'contributing' ? 'Search contributing...' : 'Search docs...'}
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
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <span className="sr-only" role="status">
        {open ? (results.length ? `${results.length} results available` : 'No results') : ''}
      </span>
      {open && results.length === 0 && (
        <div className="search-results"><p className="search-result-snippet search-empty">No results</p></div>
      )}
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox" id={listId} aria-label="Documentation results">
          {results.map(({ item }, i) => (
            <li
              key={item.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === cursor}
              className={`search-result${i === cursor ? ' search-result--active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => go(item.slug)}
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
                {formatSearchSnippet(item, query)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
