import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRegistry } from '../src/lib/docRegistry.js';
import { createSearchIndex, documentSections, formatSearchSnippet } from '../src/lib/docSearch.js';

const fixture = (title, category, slug, body, extra = '') =>
  `---\ntitle: ${title}\ncategory: ${category}\nslug: ${slug}\n${extra}---\n${body}`;

const expected = {
  clear_scratchpad: 'sdk-reference-scratchpads',
  rotate_server_credential: 'sdk-reference-mcp',
  get_file_as_base64: 'sdk-reference-files',
};
const references = Object.fromEntries(Object.values(expected).map(slug => [
  `src/pages/sdk/generated/${slug}.md`,
  readFileSync(new URL(`../src/pages/sdk/generated/${slug}.md`, import.meta.url), 'utf8'),
]));
const { pages, getNavigation } = buildRegistry({
  ...references,
  'src/pages/core/private.md': fixture('Core internals', 'core', 'core-internals', '# Internal\ninternal_only_method'),
  'src/pages/sdk/hidden.md': fixture('Hidden capability', 'sdk', 'hidden-tool', '# Hidden capability\ncapability_lookup', 'nav_exclude: true\n'),
  'src/pages/sdk/alias.md': fixture('Alias notice', 'sdk', 'alias-notice', '# Alias notice\nexcluded_lookup', 'nav_exclude: true\nsearch_exclude: true\n'),
  'archive/research/old.md': fixture('Old', 'sdk', 'old', '# Old\narchived_lookup'),
});
const general = createSearchIndex(pages, 'general');
const contributor = createSearchIndex(pages, 'contributing');

for (const [query, slug] of Object.entries(expected)) {
  test(`exact method lookup: ${query}`, () => {
    const hits = general.search(query);
    assert.equal(hits[0]?.item.slug, slug);
    assert.match(formatSearchSnippet(hits[0].item, query), new RegExp(query));
    assert.equal(new Set(hits.map(hit => hit.item.slug)).size, hits.length);
  });
}

test('late exact identifiers and fenced headings remain searchable', () => {
  const { pages } = buildRegistry({ 'src/pages/sdk/long.md': fixture('Long guide', 'sdk', 'long',
    '# Long guide\n' + 'padding text '.repeat(1000) + '\n```python\n# not a section\nlate_identifier()\n```') });
  assert.equal(documentSections(pages.long).length, 1);
  assert.equal(createSearchIndex(pages, 'general').search('late_identifier')[0]?.item.slug, 'long');
});

test('audience isolation and independent navigation/search exclusions', () => {
  assert.equal(general.search('internal_only_method').some(hit => hit.item.slug === 'core-internals'), false);
  assert.equal(contributor.search('internal_only_method')[0]?.item.slug, 'core-internals');
  assert.equal(contributor.search('clear_scratchpad').some(hit => hit.item.slug === expected.clear_scratchpad), false);
  assert.equal(general.search('capability_lookup')[0]?.item.slug, 'hidden-tool');
  assert.equal(general.search('excluded_lookup').some(hit => hit.item.slug === 'alias-notice'), false);
  assert.equal(getNavigation('general').flatMap(group => group.items).some(item => item.slug === 'hidden-tool'), false);
  assert.equal(Object.hasOwn(pages, 'old'), false);
});

test('presentation strips Markdown without destroying SDK identifiers', () => {
  const snippet = formatSearchSnippet({ title: 'Files', heading: 'Files', content:
    '# Files\n**Retrieve** `get_file_as_base64` from [the API](/docs/api-reference).\n```python\nclient.files.get_file_as_base64(file_id)\n```' }, 'get_file_as_base64');
  assert.match(snippet, /get_file_as_base64/);
  assert.doesNotMatch(snippet, /[#`*]|\[the API\]|\/docs\//);
  assert.ok(!snippet.startsWith('Files '));
});

test('search limits and short queries', () => {
  assert.deepEqual(general.search('a'), []);
  assert.ok(general.search('file', { limit: 1 }).length <= 1);
});
