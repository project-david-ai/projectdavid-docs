import { buildRegistry } from './docRegistry.js';

const modules = import.meta.glob('../pages/**/*.md', {
  query: '?raw', import: 'default', eager: true,
});

export const { pages, resolveSlug, getDocAudience, getNavigation } = buildRegistry(modules);
export { aliases, categoryDisplayNames } from './docRegistry.js';
