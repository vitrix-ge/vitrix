// After `ng build --base-href /vitrix/`: prepares dist/vitrix/browser for GitHub Pages.
//
// GitHub Pages serves plain files, and this is a single-page app, so every public address gets its
// own copy of index.html (a real HTTP 200 page, not the 404 fallback) with its own <title>,
// description and Open Graph / Twitter tags — that is what Google, Facebook, Messenger, LinkedIn
// etc. read when a link is shared. Also writes 404.html (deep links), sitemap.xml and robots.txt.
//
//   node scripts/publish-pages.mjs [siteUrl]     (default https://vitrix-ge.github.io/vitrix)
//
// Course pages come from the live course list (vitrix-api) when it answers within a few seconds,
// otherwise from the built-in list in src/app/site-data.ts.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist/vitrix/browser');
const site = (process.argv[2] ?? 'https://vitrix-ge.github.io/vitrix').replace(/\/$/, '');
const API = 'https://vitrix-api.onrender.com';

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Build first: npx ng build --base-href /vitrix/');
  process.exit(1);
}

// ---------------------------------------------------------------- Georgian texts (site default)

const KA = Object.fromEntries(
  [
    ...readFileSync(join(root, 'src/app/content/ka.ts'), 'utf8').matchAll(
      /^ {2}("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),$/gm,
    ),
  ].map((m) => [JSON.parse(m[1]), JSON.parse(m[2])]),
);
const ka = (en) => KA[en] ?? en;

const DEFAULT_DESCRIPTION =
  'VITRIX — გადაუდებელი მედიცინის სასწავლო ინსტიტუტი თბილისში: ACLS, ATLS, PHTLS, BLS, კრიტიკული მედიცინა და სიმულაციური სწავლება სტუდენტებისა და კლინიცისტებისთვის.';

/** Public pages: address (no leading slash) → title (English key from app.routes.ts) + description. */
const PAGES = [
  { path: '', title: null, description: DEFAULT_DESCRIPTION, priority: '1.0' },
  {
    path: 'courses',
    title: 'Courses',
    description:
      'გადაუდებელი მედიცინის კურსები: ACLS, ATLS, PHTLS, BLS, კრიტიკული მედიცინა და სიმულაცია. ნახეთ პროგრამები და შეიტანეთ განაცხადი ონლაინ.',
    priority: '0.9',
  },
  {
    path: 'about',
    title: 'About',
    description:
      'VITRIX — ინსტიტუტი, რომელიც კლინიცისტებს კრიტიკული წუთებისთვის ამზადებს: გადაუდებელი მედიცინა, სიმულაცია და გუნდური მუშაობა.',
  },
  {
    path: 'simulation',
    title: 'Simulation',
    description:
      'სიმულაციური სწავლება VITRIX-ში: რეალისტური სცენარები, გუნდური როლები და დებრიფინგი უსაფრთხო გარემოში.',
  },
  {
    path: 'faculty',
    title: 'Faculty',
    description: 'VITRIX-ის პედაგოგები — გადაუდებელი და კრიტიკული მედიცინის პრაქტიკოსი ექიმები.',
  },
  {
    path: 'partners',
    title: 'Partners',
    description: 'VITRIX-ის პარტნიორები: კლინიკები, უნივერსიტეტები და პროფესიული ორგანიზაციები.',
  },
  {
    path: 'faq',
    title: 'Questions & answers',
    description:
      'ხშირად დასმული კითხვები VITRIX-ის კურსებზე, განაცხადზე, სერტიფიკატებსა და ონლაინ გაკვეთილებზე.',
  },
  {
    path: 'contact',
    title: 'Contact',
    description:
      'დაგვიკავშირდით კურსის, გუნდური ჯავშნის ან თანამშრომლობის შესახებ. VITRIX, თბილისი.',
  },
  {
    path: 'certificates',
    title: 'Certificates',
    description: 'შეამოწმეთ VITRIX-ის სერტიფიკატი მისი კოდით.',
    priority: '0.3',
  },
  {
    path: 'privacy',
    title: 'Privacy',
    description: 'როგორ ინახავს და იცავს VITRIX თქვენს მონაცემებს.',
    priority: '0.2',
  },
  // Real pages but not worth listing in the sitemap:
  { path: 'login', title: 'Log in', description: DEFAULT_DESCRIPTION, sitemap: false },
  { path: 'apply', title: 'Apply', description: DEFAULT_DESCRIPTION, sitemap: false },
];

// ---------------------------------------------------------------- courses

function builtInCourses() {
  const source = readFileSync(join(root, 'src/app/site-data.ts'), 'utf8');
  const block = source.slice(source.indexOf('export const COURSES'));
  return [
    ...block.matchAll(
      /id: '([^']+)',\s*code: '([^']+)',\s*name: '([^']+)',\s*image: '([^']+)',\s*summary:\s*'([^']+)'/g,
    ),
  ].map(([, slug, code, name, image, summary]) => ({
    slug,
    code,
    title: { en: name, ka: '' },
    summary: { en: summary, ka: '' },
    imageUrl: image,
  }));
}

async function liveCourses() {
  try {
    const response = await fetch(`${API}/api/courses`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const list = await response.json();
    return Array.isArray(list) && list.length ? list : null;
  } catch (error) {
    console.warn(`Course server not reachable (${error.message}); using the built-in course list.`);
    return null;
  }
}

const courses = (await liveCourses()) ?? builtInCourses();
const text = (value) => value?.ka || ka(value?.en ?? '') || value?.en || '';

for (const c of courses) {
  PAGES.push({
    path: `courses/${c.slug}`,
    fullTitle: `${c.code} — ${text(c.title)} · VITRIX`,
    description: text(c.summary) || DEFAULT_DESCRIPTION,
    image: c.imageUrl,
    priority: '0.8',
  });
}

// ---------------------------------------------------------------- write the pages

const template = readFileSync(join(dist, 'index.html'), 'utf8');
const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const absolute = (url) => (/^https?:\/\//.test(url) ? url : `${site}/${url.replace(/^\//, '')}`);

function page({ path, title, fullTitle, description, image }) {
  const heading =
    fullTitle ?? (title ? `${ka(title)} · VITRIX` : 'VITRIX — გადაუდებელი მედიცინის ინსტიტუტი');
  const url = path ? `${site}/${path}` : `${site}/`;
  const img = absolute(image ?? 'media/og-image.jpg');
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="VITRIX" />`,
    `<meta property="og:locale" content="ka_GE" />`,
    `<meta property="og:locale:alternate" content="en_US" />`,
    `<meta property="og:title" content="${escape(heading)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${img}" />`,
    ...(image
      ? []
      : [
          '<meta property="og:image:width" content="1200" />',
          '<meta property="og:image:height" content="630" />',
        ]),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(heading)}" />`,
    `<meta name="twitter:description" content="${escape(description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join('\n    ');

  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(heading)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escape(description)}">`,
    )
    .replace('</head>', `    ${tags}\n  </head>`);
  if (!html.includes(escape(description))) {
    throw new Error('index.html has no <meta name="description"> to replace.');
  }
  return html;
}

for (const p of PAGES) {
  const file = p.path ? join(dist, p.path, 'index.html') : join(dist, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(p));
}
// Any other address (e.g. /vitrix/account): GitHub Pages serves 404.html, the app then routes it.
writeFileSync(
  join(dist, '404.html'),
  page(PAGES[0]).replace(
    '<link rel="canonical"',
    '<meta name="robots" content="noindex" />\n    <link rel="canonical"',
  ),
);

// ---------------------------------------------------------------- sitemap.xml, robots.txt

const today = new Date().toISOString().slice(0, 10);
const urls = PAGES.filter((p) => p.sitemap !== false)
  .map(
    (p) =>
      `  <url><loc>${p.path ? `${site}/${p.path}` : `${site}/`}</loc><lastmod>${today}</lastmod><priority>${p.priority ?? '0.6'}</priority></url>`,
  )
  .join('\n');
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nDisallow: ${new URL(site).pathname.replace(/\/$/, '')}/admin\nDisallow: ${new URL(site).pathname.replace(/\/$/, '')}/account\n\nSitemap: ${site}/sitemap.xml\n`,
);

console.log(
  `Wrote ${PAGES.length} pages, 404.html, sitemap.xml and robots.txt for ${site} (${courses.length} courses).`,
);
