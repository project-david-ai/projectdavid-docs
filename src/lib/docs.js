/* ──────────────────────────────────────────────────────────────
   src/lib/docs.js
   – collect markdown / tex / tla / svg pages
   – expose `pages` map + grouped nav list
   – supports explicit slug, nav_order, nav_exclude
   – supports hiddenCategories for bulk category hiding
   ──────────────────────────────────────────────────────────── */

const categoryDisplayNames = {
  'overview'              : 'OVERVIEW',
  'core'                  : 'PROJECT DAVID CORE',
  'projectdavid-platform' : 'PROJECT DAVID PLATFORM',
  'sdk'                   : 'SDK',
  'fine-tuning'           : 'SOVEREIGN FORGE',
  'endpoints'             : 'API ENDPOINTS',
  'providers'             : 'PROVIDERS',
  'infrastructure'        : 'INFRASTRUCTURE',
  'api-infra'             : 'API INFRASTRUCTURE',
  'architecture'          : 'ARCHITECTURE',
};

const categoryOrder = {
  'overview'              : 1,
  'core'                  : 2,
  'projectdavid-platform' : 3,
  'sdk'                   : 4,
  'fine-tuning'           : 5,
  'endpoints'             : 6,
  'providers'             : 7,
  'infrastructure'        : 8,
  'api-infra'             : 9,
  'architecture'          : 10,
};

const hiddenCategories = new Set(['algorithms']);

/* ---------- tiny front-matter parser (keeps bundle slim) ---------- */
function simpleMatter(raw) {
  // Strip SVG comment wrapper if present
  raw = raw.replace(/^<!--\s*\n/, '').replace(/\n-->\s*/, '\n');

  const fm = /^\s*---[ \t]*\r?\n([\s\S]+?)\r?\n---[ \t]*(\r?\n|$)/;
  const m  = fm.exec(raw);
  if (!m) return { data: {}, content: raw };

  const data = {};
  m[1].split('\n').forEach(line => {
    const stripped = line.replace(/\r$/, '');
    const i = stripped.indexOf(':');
    if (i > -1) {
      data[stripped.slice(0, i).trim()] = stripped.slice(i + 1).trim();
    }
  });

  return { data, content: raw.slice(m[0].length) };
}

/* ---------- 1. grab every .md, .tex, .tla, .svg file (eager) ---------- */
const docModules = import.meta.glob(
  '../pages/**/*.{md,tex,tla,svg}',
  { as: 'raw', eager: true }
);

/* ---------- helper: strip extension safely ---------- */
function stripExtension(filename) {
  return filename.replace(/\.(md|tex|tla|svg)$/i, '');
}

/* ---------- 2. build main { slug: { frontmatter, content, path } } map ---------- */
export const pages = Object.entries(docModules).reduce((acc, [path, raw]) => {
  const { data, content } = simpleMatter(raw);

  const filename = path.split('/').pop();
  const slug = (data.slug || stripExtension(filename)).trim();

  acc[slug] = {
    frontmatter: data,
    content,
    path,
  };

  return acc;
}, {});

/* ---------- 3. sidebar / grouped nav items ---------- */
export const groupedNavItems = {};

Object.entries(docModules).forEach(([path, raw]) => {
  const { data } = simpleMatter(raw);

  // Per-page exclusion
  if (data.nav_exclude === 'true') return;

  const filename = path.split('/').pop();
  const slug = (data.slug || stripExtension(filename)).trim();

  const parts = path.split('/');
  const category = data.category || parts[parts.length - 2];

  // Category-level exclusion
  if (hiddenCategories.has(category)) return;

  if (!groupedNavItems[category]) {
    groupedNavItems[category] = [];
  }

  groupedNavItems[category].push({
    slug,
    route: `/docs/${slug}`,
    nav_order: data.nav_order !== undefined ? Number(data.nav_order) : undefined,
    label:
      data.title
        ? data.title.replace(/<[^>]+>/g, '')
        : slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase()),
  });
});

/* ---------- 4. sort each category by nav_order, then alphabetically ---------- */
Object.values(groupedNavItems).forEach(arr =>
  arr.sort((a, b) => {
    const orderA = a.nav_order !== undefined ? a.nav_order : 999;
    const orderB = b.nav_order !== undefined ? b.nav_order : 999;

    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  })
);

/* ---------- 5. export category keys in explicit order ---------- */
export const sortedGroupKeys = Object.keys(groupedNavItems).sort((a, b) => {
  const orderA = categoryOrder[a] ?? 999;
  const orderB = categoryOrder[b] ?? 999;
  return orderA - orderB;
});

export { categoryDisplayNames };