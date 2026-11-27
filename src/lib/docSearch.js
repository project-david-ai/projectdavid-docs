import Fuse from 'fuse.js';

// Fence-aware sections retain complete content and exact SDK identifiers.
export function documentSections(page) {
  const sections = [];
  let heading = page.label;
  let lines = [];
  let fence = null;
  const flush = () => {
    if (lines.length) sections.push({ slug: page.slug, title: page.label,
      heading, category: page.group, content: lines.join('\n') });
    lines = [];
  };
  for (const line of page.content.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
    }
    if (!fence && /^#{1,6} /.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, '').replace(/`/g, '');
    }
    lines.push(line);
  }
  flush();
  return sections;
}
// Presentation only: do not alter the searchable source or identifier spelling.
function plainText(content) {
  return content
    .replace(/<!--[^]*?-->/g, '')
    .replace(/^\s*(?:`{3,}|~{3,}).*$/gm, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+] |\d+\. |>\s*)/gm, '')
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/gm, '')
    .replace(/!?\[([^\]\n]+)\]\([^\n)]*\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?)]|$)/g, '$1$2')
    .replace(/(^|\s)__([^\n]+?)__(?=\s|[.,;:!?)]|$)/g, '$1$2')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatSearchSnippet(item, query, maxLength = 120) {
  const heading = plainText(item.heading || '');
  const title = plainText(item.title || '');
  let content = plainText(item.content || '');
  // Do not repeat the document title in its own result snippet.
  if (heading === title && content.startsWith(`${heading} `)) {
    content = content.slice(heading.length).trim();
  }
  const term = query.trim().toLowerCase();
  const match = term ? content.toLowerCase().indexOf(term) : -1;
  const start = match > 25 ? match - 25 : 0;
  const excerpt = content.slice(start, start + maxLength).trim();
  return `${start ? '…' : ''}${excerpt}${start + maxLength < content.length ? '…' : ''}`
    || heading || title;
}

function containsTerm(value, term) {
  // A method identifier should not match the middle of a different identifier.
  if (/^[a-z0-9_]+$/.test(term)) {
    return new RegExp(`(?:^|[^a-z0-9_])${term}(?:$|[^a-z0-9_])`).test(value);
  }
  return value.includes(term);
}

function exactRank(section, term) {
  const title = section.title.toLowerCase();
  const heading = section.heading.toLowerCase();
  if (title === term) return 5;
  if (heading === term) return 4;
  if (containsTerm(heading, term)) return 3;
  if (containsTerm(title, term)) return 2;
  if (containsTerm(section.content.toLowerCase(), term)) return 1;
  return 0;
}

export function createSearchIndex(pages, audience) {
  const sections = Object.values(pages).filter(page => page.audience === audience &&
    page.frontmatter.search_exclude !== 'true').flatMap(documentSections);
  const fuse = new Fuse(sections, {
    keys: [{ name: 'title', weight: 0.3 }, { name: 'heading', weight: 0.5 },
      { name: 'content', weight: 0.2 }],
    threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2, includeMatches: true,
  });
  return {
    search(query, { limit = 8 } = {}) {
      const term = query.trim().toLowerCase();
      if (term.length < 2) return [];
      const fuzzy = fuse.search(term);
      const bySection = new Map(fuzzy.map(hit => [hit.refIndex, hit]));
      // Fuse remains responsible for approximate matches. Literal matches must
      // also be included, even if the fuzzy engine does not return them.
      const literal = sections.flatMap((item, refIndex) => {
        const rank = exactRank(item, term);
        return rank ? [{ ...(bySection.get(refIndex) || { item, refIndex }), rank }] : [];
      });
      const exactSections = new Set(literal.map(hit => hit.refIndex));
      literal.sort((a, b) => b.rank - a.rank);
      const hits = [...literal, ...fuzzy.filter(hit => !exactSections.has(hit.refIndex))];
      const seen = new Set();
      return hits.filter(hit => {
        if (seen.has(hit.item.slug)) return false;
        seen.add(hit.item.slug);
        return true;
      }).slice(0, limit);
    },
  };
}
