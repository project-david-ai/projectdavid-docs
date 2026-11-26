/* ──────────────────────────────────────────────────────────────
   src/lib/docs.js
   – collect markdown / tex / tla / svg pages
   – expose pages map + grouped nav list
   – supports explicit slug, nav_order, nav_exclude
   – supports hiddenCategories for bulk category hiding
   – excludes mothballed documentation at build time
   ──────────────────────────────────────────────────────────── */

const categoryDisplayNames = {
  'overview'              : 'OVERVIEW',
  'commercial'            : 'COMMERCIAL',
  'core'                  : 'PROJECT DAVID CORE',
  'projectdavid-platform' : 'PROJECT DAVID PLATFORM',
  'sdk'                   : 'SDK',
  'fine-tuning'           : 'SOVEREIGN FORGE',
  'admin'                 : 'ADMIN',
  'endpoints'             : 'API ENDPOINTS',
  'providers'             : 'PROVIDERS',
  'infrastructure'        : 'INFRASTRUCTURE',
  'api-infra'             : 'API INFRASTRUCTURE',
  'architecture'          : 'ARCHITECTURE',
};

const categoryOrder = {
  'overview'              : 1,
  'commercial'            : 2,
  'core'                  : 3,
  'projectdavid-platform' : 4,
  'sdk'                   : 5,
  'fine-tuning'           : 6,
  'admin'                 : 7,
  'endpoints'             : 8,
  'providers'             : 9,
  'infrastructure'        : 10,
  'api-infra'             : 11,
  'architecture'          : 12,
};

const hiddenCategories = new Set(['algorithms']);

/* ---------- Front-matter parser ---------- */

function simpleMatter(raw) {
  // Strip SVG comment wrapper if present.
  raw = raw.replace(/^<!--\s*\n/, '').replace(/\n-->\s*/, '\n');

  const fm = /^\s*---[ \t]*\r?\n([\s\S]+?)\r?\n---[ \t]*(\r?\n|$)/;
  const m = fm.exec(raw);

  if (!m) return { data: {}, content: raw };

  const data = {};

  m[1].split('\n').forEach(line => {
    const stripped = line.replace(/\r$/, '');
    const i = stripped.indexOf(':');

    if (i > -1) {
      data[stripped.slice(0, i).trim()] =
        stripped.slice(i + 1).trim();
    }
  });

  return {
    data,
    content: raw.slice(m[0].length),
  };
}

/* ---------- 1. Discover active documentation ---------- */

/*
 * Sovereign Forge and model administration are mothballed.
 *
 * Negative glob patterns exclude these directories from the
 * application bundle while preserving their source files in Git.
 *
 * Explicit raw imports ensure consistent behaviour across
 * Vite development and production builds.
 */

const docModules = import.meta.glob(
  [
    '../pages/**/*.{md,tex,tla}',
    '!../pages/fine-tuning/**',
    '!../pages/admin/**',
  ],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
);

const svgModules = import.meta.glob(
  [
    '../pages/**/*.svg',
    '!../pages/fine-tuning/**',
    '!../pages/admin/**',
  ],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
);

const allModules = {
  ...docModules,
  ...svgModules,
};

/* ---------- Filename helper ---------- */

function stripExtension(filename) {
  return filename.replace(/\.(md|tex|tla|svg)$/i, '');
}

/* ---------- 2. Build document registry ---------- */

export const pages = Object.entries(allModules).reduce(
  (acc, [path, raw]) => {
    const { data, content } = simpleMatter(raw);

    const filename = path.split('/').pop();
    const slug = (data.slug || stripExtension(filename)).trim();

    acc[slug] = {
      frontmatter: data,
      content,
      path,
    };

    return acc;
  },
  {}
);

/* ---------- 3. Build grouped navigation ---------- */

export const groupedNavItems = {};

Object.entries(allModules).forEach(([path, raw]) => {
  const { data } = simpleMatter(raw);

  // Per-page navigation exclusion.
  if (data.nav_exclude === 'true') return;

  const filename = path.split('/').pop();
  const slug = (data.slug || stripExtension(filename)).trim();

  const parts = path.split('/');
  const category = data.category || parts[parts.length - 2];

  // Category-level navigation exclusion.
  if (hiddenCategories.has(category)) return;

  if (!groupedNavItems[category]) {
    groupedNavItems[category] = [];
  }

  groupedNavItems[category].push({
    slug,
    route: `/docs/${slug}`,

    nav_order:
      data.nav_order !== undefined
        ? Number(data.nav_order)
        : undefined,

    label:
      data.title
        ? data.title.replace(/<[^>]+>/g, '')
        : slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase()),
  });
});

/* ---------- 4. Sort documents within each category ---------- */

Object.values(groupedNavItems).forEach(items =>
  items.sort((a, b) => {
    const orderA = a.nav_order !== undefined ? a.nav_order : 999;
    const orderB = b.nav_order !== undefined ? b.nav_order : 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.label.localeCompare(b.label);
  })
);

/* ---------- 5. Sort navigation categories ---------- */

export const sortedGroupKeys = Object.keys(groupedNavItems).sort(
  (a, b) => {
    const orderA = categoryOrder[a] ?? 999;
    const orderB = categoryOrder[b] ?? 999;

    return orderA - orderB;
  }
);

export { categoryDisplayNames };