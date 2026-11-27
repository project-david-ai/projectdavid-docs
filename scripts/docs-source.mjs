import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from '../src/lib/docRegistry.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function loadDocs() {
  const directory = path.join(root, 'src/pages');
  const modules = Object.fromEntries(fs.readdirSync(directory, { recursive: true })
    .filter(file => file.endsWith('.md')).map(file => [
      `../pages/${file.replaceAll('\\', '/')}`, fs.readFileSync(path.join(directory, file), 'utf8'),
    ]));
  return buildRegistry(modules);
}

export function rawAssets(registry = loadDocs()) {
  const assets = {};
  const entries = Object.values(registry.pages).sort((a, b) => a.slug < b.slug ? -1 : 1);
  for (const page of entries) assets[`markdown/${page.slug}.md`] = page.raw;
  assets['markdown/index.json'] = JSON.stringify(entries.map(page => ({
    title: page.label, audience: page.audience, url: `/docs/${page.slug}`,
    markdown: `/markdown/${page.slug}.md`,
  })), null, 2) + '\n';
  assets['llms.txt'] = '# Project David documentation\n\n' +
    '> Guides and references generated from the published documentation sources.\n\n' +
    'HTTP contract: [/openapi.json](/openapi.json)\n\n' +
    'Document index: [/markdown/index.json](/markdown/index.json)\n\n' +
    ['general', 'contributing'].map(audience =>
      `## ${audience === 'general' ? 'Application developers and operators' : 'Contributors'}\n\n` +
      entries.filter(page => page.audience === audience)
        .map(page => `- [${page.label}](/markdown/${page.slug}.md)`).join('\n')).join('\n\n') + '\n';
  return assets;
}

export function rawDocsPlugin() {
  return {
    name: 'projectdavid-raw-docs',
    generateBundle() {
      for (const [fileName, source] of Object.entries(rawAssets())) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (pathname !== '/llms.txt' && !pathname.startsWith('/markdown/')) return next();
        const source = rawAssets()[pathname.slice(1)];
        if (source === undefined) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        response.setHeader('Content-Type', pathname.endsWith('.json')
          ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
        response.end(request.method === 'HEAD' ? undefined : source);
      });
    },
  };
}
