import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import { aliases } from '../src/lib/docRegistry.js';
import { loadDocs, root } from './docs-source.mjs';

const { pages, resolveSlug } = loadDocs();
const parser = unified().use(remarkParse);
const headings = unified().use(remarkParse).use(remarkRehype).use(rehypeSlug);
const anchors = {};
const links = [];
function walk(node, visit) { visit(node); node.children?.forEach(child => walk(child, visit)); }
for (const page of Object.values(pages)) {
  anchors[page.slug] = new Set();
  walk(await headings.run(headings.parse(page.content)), node => {
    if (node.properties?.id) anchors[page.slug].add(node.properties.id);
  });
  walk(parser.parse(page.content), node => {
    if (['link', 'image', 'definition'].includes(node.type)) {
      links.push({ source: page.path, slug: page.slug, target: node.url });
    }
  });
}
for (const [alias, target] of Object.entries(aliases)) assert.ok(pages[target], `Alias ${alias}: missing ${target}`);
// Include literal application links (homepage cards, lifecycle links, etc.).
for (const file of fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter(file => file.endsWith('.jsx'))) {
  const source = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  for (const match of source.matchAll(/["'](\/docs(?:\/[A-Za-z0-9_-]+)?(?:#[^"']*)?)["']/g)) {
    links.push({ source: file, target: match[1] });
  }
}
const failures = [];
for (const { source, slug: current, target } of links) {
  if (/^(?:[a-z]+:|\/\/)/i.test(target)) continue;
  const url = new URL(target, `https://docs.projectdavid.co.uk/docs/${current || ''}`);
  if (url.pathname === '/docs' || url.pathname === '/') continue;
  if (url.pathname.startsWith('/docs/')) {
    const slug = resolveSlug(decodeURIComponent(url.pathname.slice(6)));
    if (!pages[slug]) failures.push(`${source}: missing route ${target}`);
    else if (url.hash && !anchors[slug].has(decodeURIComponent(url.hash.slice(1)))) {
      failures.push(`${source}: missing heading ${target}`);
    }
  } else if (!fs.existsSync(path.join(root, 'public', decodeURIComponent(url.pathname)))) {
    failures.push(`${source}: missing asset ${target}`);
  }
}
assert.deepEqual(failures, [], failures.join('\n'));
console.log(`Validated ${Object.keys(pages).length} unique published slugs, ${links.length} links and ${Object.keys(aliases).length} aliases.`);
