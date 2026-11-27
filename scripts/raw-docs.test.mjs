import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistry } from '../src/lib/docRegistry.js';
import { loadDocs, rawAssets, rawDocsPlugin } from './docs-source.mjs';

const document = (slug, category = 'sdk', flags = '') =>
  `---\ntitle: ${slug}\nslug: ${slug}\ncategory: ${category}\n${flags}---\n# ${slug}\n\n\`clear_scratchpad\`\n`;

const modules = {
  'src/pages/sdk/z.md': document('z'),
  'src/pages/sdk/a.md': document('a'),
  'src/pages/sdk/hidden.md': document('hidden', 'sdk', 'nav_exclude: true\n'),
  'src/pages/core/core.md': document('core', 'core'),
  'src/pages/sdk/draft.md': document('draft', 'sdk', 'draft: true\n'),
  'src/pages/sdk/status.md': document('status', 'sdk', 'status: draft\n'),
  'src/pages/sdk/unpublished.md': document('unpublished', 'sdk', 'published: false\n'),
  'archive/research/old.md': document('old'),
  'src/pages/admin/internal.md': document('internal'),
};

test('raw assets are deterministic and use the publication registry', () => {
  const assets = rawAssets(buildRegistry(modules));

  assert.deepEqual(
    assets,
    rawAssets(
      buildRegistry(
        Object.fromEntries(Object.entries(modules).reverse())
      )
    )
  );

  assert.deepEqual(Object.keys(assets), [
    'markdown/a.md',
    'markdown/core.md',
    'markdown/hidden.md',
    'markdown/z.md',
    'markdown/index.json',
    'llms.txt',
  ]);

  assert.equal(
    assets['markdown/a.md'],
    modules['src/pages/sdk/a.md']
  );

  const entries = JSON.parse(assets['markdown/index.json']);

  assert.deepEqual(
    entries.map(entry => entry.markdown),
    ['a', 'core', 'hidden', 'z'].map(
      slug => `/markdown/${slug}.md`
    )
  );

  assert.equal(
    entries.find(entry => entry.title === 'core').audience,
    'contributing'
  );

  assert.match(assets['llms.txt'], /\/openapi\.json/);
  assert.match(assets['llms.txt'], /\/markdown\/index\.json/);

  for (const entry of entries) {
    assert.ok(assets[entry.markdown.slice(1)]);
    assert.ok(
      assets['llms.txt'].includes(`(${entry.markdown})`)
    );
  }
});

test('production plugin emits every canonical document without duplication', () => {
  const registry = loadDocs();

  assert.ok(Object.keys(registry.pages).length > 0);

  const emitted = {};

  rawDocsPlugin().generateBundle.call({
    emitFile(asset) {
      assert.equal(asset.type, 'asset');
      assert.ok(!Object.hasOwn(emitted, asset.fileName));

      emitted[asset.fileName] = asset.source;
    },
  });

  assert.deepEqual(emitted, rawAssets(registry));

  const entries = JSON.parse(emitted['markdown/index.json']);

  assert.equal(
    entries.length,
    Object.keys(registry.pages).length
  );

  for (const page of Object.values(registry.pages)) {
    assert.equal(
      emitted[`markdown/${page.slug}.md`],
      page.raw
    );
  }
});

test('development middleware serves raw text, JSON, HEAD and missing documents', () => {
  let middleware;

  rawDocsPlugin().configureServer({
    middlewares: {
      use(handler) {
        middleware = handler;
      },
    },
  });

  function request(url, method = 'GET') {
    const result = {
      statusCode: 200,
      headers: {},
      ended: false,
      next: false,
    };

    const response = {
      get statusCode() {
        return result.statusCode;
      },

      set statusCode(value) {
        result.statusCode = value;
      },

      setHeader(name, value) {
        result.headers[name] = value;
      },

      end(body) {
        result.ended = true;
        result.body = body;
      },
    };

    middleware(
      { url, method },
      response,
      () => {
        result.next = true;
      }
    );

    return result;
  }

  const assets = rawAssets();
  const entry = JSON.parse(assets['markdown/index.json'])[0];

  const markdown = request(entry.markdown);

  assert.equal(markdown.statusCode, 200);

  assert.equal(
    markdown.headers['Content-Type'],
    'text/plain; charset=utf-8'
  );

  assert.equal(
    markdown.body,
    assets[entry.markdown.slice(1)]
  );

  const index = request('/markdown/index.json');

  assert.equal(
    index.headers['Content-Type'],
    'application/json; charset=utf-8'
  );

  assert.equal(index.body, assets['markdown/index.json']);
  assert.equal(request('/llms.txt').body, assets['llms.txt']);

  const head = request(entry.markdown, 'HEAD');

  assert.equal(head.statusCode, 200);
  assert.equal(head.ended, true);
  assert.equal(head.body, undefined);

  const missing = request('/markdown/__missing__/not-a-document.md');

  assert.equal(missing.statusCode, 404);
  assert.equal(missing.next, false);
  assert.equal(request('/docs').next, true);
});