'use strict';
// Rebuilds portfolio markup from data/projects.json using the inner-page layouts
// documented in DESIGN.md: case-study detail pages, the case-study listing,
// the services index and the shared "Selected work" block. Safe to re-run.
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const ROOT = path.resolve(__dirname, '..');
const {files} = require('../lib/pages');

const RETIRED = {kodezi: 'finora', 'off-white': 'invitara', tournated: 'mechaura', callai: 'nexora'};
const FEATURED = ['nexora', 'finora', 'invitara', 'mechaura'];
const IMG = '/assets/images/projects/';

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(ROOT, file), text);
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isVideo = file => /\.mp4$/i.test(file);

// ---------- Data ----------
let projects = JSON.parse(read('data/projects.json'));
projects = projects.filter(p => !RETIRED[p.slug]);
write('data/projects.json', JSON.stringify(projects, null, 2) + '\n');
const redirects = JSON.parse(read('data/project-redirects.json'));
for (const [from, to] of Object.entries(RETIRED)) redirects[`/case-studies/${from}/`] = `/case-studies/${to}/`;
write('data/project-redirects.json', JSON.stringify(redirects, null, 2) + '\n');
const bySlug = Object.fromEntries(projects.map(p => [p.slug, p]));

// Image dimensions (WebP header) decide between landscape and phone frames.
function ratio(file) {
  if (isVideo(file)) return 16 / 9;
  const b = fs.readFileSync(path.join(ROOT, 'assets/images/projects', file));
  const type = b.toString('ascii', 12, 16);
  let w, h;
  if (type === 'VP8X') { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); }
  else if (type === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
  else { const bits = b.readUInt32LE(21); w = (bits & 0x3fff) + 1; h = ((bits >> 14) & 0x3fff) + 1; }
  return w / h;
}
const items = p => p.media.map((file, i) => ({file, alt: p.alt[i] || p.name, video: isVideo(file), phone: ratio(file) < .8, index: i}));
const images = p => items(p).filter(m => !m.video);
const poster = p => IMG + images(p)[0].file;

// ---------- Fragments ----------
function figure(p, m, size, eager) {
  const cls = ['csx-fig', m.phone ? 'csx-fig--phone' : 'csx-fig--' + size, m.video ? 'csx-fig--contain' : ''].filter(Boolean).join(' ');
  const label = `${m.index + 1} of ${p.media.length}`;
  if (m.video) {
    const captions = p.media.includes(m.file.replace(/\.mp4$/, '.en.vtt')) || fs.existsSync(path.join(ROOT, 'assets/images/projects', m.file.replace(/\.mp4$/, '.en.vtt')))
      ? `<track kind="captions" src="${IMG}${m.file.replace(/\.mp4$/, '.en.vtt')}" srclang="en" label="English">` : '';
    return `<figure class="${cls}" data-project-slide aria-label="${label}"><video controls playsinline preload="none" poster="${poster(p)}" aria-label="${esc(m.alt)}"><source src="${IMG}${m.file}" type="video/mp4">${captions}<a href="${IMG}${m.file}">${esc(m.alt)}</a></video></figure>`;
  }
  return `<figure class="${cls}" data-project-slide aria-label="${label}"><a href="${IMG}${m.file}" target="_blank" rel="noopener"><img src="${IMG}${m.file}" alt="${esc(m.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a></figure>`;
}
// One media slot: 1 item = full width, 2 = pair, 3+ = full width followed by pairs.
function mediaBlock(p, list) {
  if (!list.length) return '';
  const out = [];
  let rest = list;
  if (list.length !== 2) { out.push(figure(p, list[0], 'wide')); rest = list.slice(1); }
  for (let i = 0; i < rest.length; i += 2) {
    const pair = rest.slice(i, i + 2);
    out.push(pair.length === 2 ? `<div class="csx-media__pair">${pair.map(m => figure(p, m, 'half')).join('')}</div>` : figure(p, pair[0], 'wide'));
  }
  return `<div class="csx-media reveal">${out.join('')}</div>`;
}
function row(tag, inner, media = '') {
  return `<section class="csx-row"><div class="container"><div class="csx-row__grid reveal"><div class="csx-tag">${esc(tag)}</div><div class="csx-body">${inner}</div></div>${media}</div></section>`;
}
const bullets = list => `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const words = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);

function card(p, large) {
  const tags = p.tags.split('|').filter(t => t !== 'B2B/B2C');
  return `<a class="csx-card" href="/case-studies/${p.slug}/" data-tags="${esc(p.tags + '|' + p.stack)}">` +
    `<div class="csx-card__body"><div class="csx-card__cat">${esc(p.category)}</div><div class="csx-card__title">${esc(p.name)}</div><p class="csx-card__desc">${esc(p.summary)}</p>` +
    (large ? `<div class="csx-card__tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : '') +
    `<div class="csx-card__foot"><div class="csx-card__stat"><div class="v">${esc(p.stack)}</div><small>${p.features.length} working feature areas</small></div><span class="btn btn--indigo btn--sm">Read case study<span class="arw" aria-hidden="true">→</span></span></div></div>` +
    `<div class="csx-card__media"><img src="${poster(p)}" alt="${esc(images(p)[0].alt)}" loading="lazy" decoding="async"></div></a>`;
}

// ---------- Case-study detail ----------
function caseStudyMain(p, $old) {
  const h1 = $old('main h1').first().html();
  const queue = items(p).slice(1);
  const take = n => queue.splice(0, n);
  const counts = items(p).reduce((a, m) => (a[m.video ? 'v' : 'i']++, a), {i: 0, v: 0});
  const meta = [['Category', esc(p.category)], ['Technology', esc(p.stack)]];
  if (p.url) meta.push(['Live website', `<a class="v" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`]);
  else meta.push(['Delivery', 'Custom web application']);
  const steps = p.steps.map((s, i) => `<article class="csx-process__card"><span class="n">0${i + 1}</span><h3>${['Explore', 'Connect', 'Build', 'Review'][i] || 'Step'}</h3><p>${esc(s)}</p></article>`).join('');
  const others = FEATURED.concat(projects.map(x => x.slug)).filter((s, i, a) => s !== p.slug && a.indexOf(s) === i).slice(0, 3).map(s => bySlug[s]);
  const contact = $old('#contact').toString();
  return `
<section class="page-hero csx-hero">
  <div class="container">
    <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="../../index.html">Home</a> <span aria-hidden="true">/</span> <a href="../../case-studies/index.html">Case Study</a> <span aria-hidden="true">/</span> <span>${esc(p.name)}</span></nav>
    <h1 class="display reveal">${h1}</h1>
    <div class="csx-hero__grid reveal">
      <div class="csx-stats">
        <div class="csx-stat"><div class="v">${p.features.length}</div><p>Working feature areas documented in this build</p></div>
        <div class="csx-stat"><div class="v">${counts.i}${counts.v ? ' + ' + counts.v : ''}</div><p>Original screens${counts.v ? ' and project films' : ''} from the product</p></div>
        <div class="csx-stat"><div class="v">${esc(p.stack)}</div><p>${esc(p.category)}</p></div>
      </div>
      ${figure(p, items(p)[0], 'wide', true)}
    </div>
    ${mediaBlock(p, take(3))}
  </div>
</section>
${row('Overview', `<p>${esc(p.overview)}</p><p>${esc(p.detail)}</p><div class="csx-meta">${meta.map(([k, v]) => `<div><div class="k">${k}</div>${v.startsWith('<a') ? v : `<div class="v">${v}</div>`}</div>`).join('')}</div>`, mediaBlock(p, take(2)))}
${row('Journey', `<h2 class="h2">How ${esc(p.name)} <span class="muted">works</span></h2><p>${esc(p.journey)}</p>${bullets(p.features.slice(0, 4))}`, mediaBlock(p, take(2)))}
${row('Engineering', `<h2 class="h2">Design and <span class="muted">development focus</span></h2><p>${esc(p.engineering)}</p>${bullets(p.features.slice(Math.max(0, p.features.length - 4)))}`, mediaBlock(p, take(3)))}
<section class="csx-row"><div class="container"><div class="csx-row__grid reveal"><div class="csx-tag">Process</div><div class="csx-body"><h2 class="h2">How we delivered <span class="muted">${esc(p.name)}</span></h2><p>The build followed ${words(p.steps.length)} connected stages, from structuring the core workflow to reviewing it on real devices.</p></div></div><div class="csx-process reveal">${steps}</div></div></section>
${row('Scope', `<h2 class="h2">Implementation <span class="muted">and scope</span></h2><p>${esc(p.delivery)}</p><p>${esc(p.next)}</p>`, mediaBlock(p, queue.splice(0)))}
<section class="section section--grey csx-more">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">/ Selected work</p><h2 class="h2">Products we've designed, <span class="muted">built and shipped</span></h2></div><a class="btn btn--indigo" href="../../case-studies/index.html">See all case studies<span class="arw" aria-hidden="true">→</span></a></div>
    <div class="reveal">${card(others[0], true)}<div class="csx-more__grid">${others.slice(1).map(o => card(o, false)).join('')}</div></div>
  </div>
</section>
${contact}
`;
}

// ---------- Shared "Selected work" cards (existing .work layout) ----------
function workCard(p, split) {
  const media = `<div class="work__media"><div class="art art--grey " style="background-image:url('${poster(p)}');background-size:cover;background-position:top center;" role="img" aria-label="${esc(images(p)[0].alt)}"><span class="art__label"></span></div></div>`;
  const body = `<div class="work__body">
<div class="work__cat">${esc(p.category)}</div>
<div class="work__title">${esc(p.name)}</div>
<p class="work__desc">${esc(p.summary)}</p>
<div class="work__foot">
<div class="work__metric">${esc(p.stack)} <small>Project scope</small></div>
<span class="btn btn--ghost btn--sm">View project details<span class="arw" aria-hidden="true">→</span></span>
</div>
</div>`;
  return `<a class="work__card${split ? ' work__card--split' : ''}" href="/case-studies/${p.slug}/" data-tags="${esc(p.tags)}">\n${split ? body + media : media + body}\n</a>`;
}
const workCards = FEATURED.map((s, i) => workCard(bySlug[s], i === 2)).join('\n');

// ---------- Splice helpers ----------
function splices(html, edits) {
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) html = html.slice(0, e.start) + e.text + html.slice(e.end);
  return html;
}
const loc = el => el.sourceCodeLocation;
const inner = (el, text) => ({start: loc(el).startTag.endOffset, end: loc(el).endTag.startOffset, text});
const outer = (el, text) => ({start: loc(el).startOffset, end: loc(el).endOffset, text});

let changed = 0;
for (const file of files) {
  const html = read(file);
  const $ = cheerio.load(html, {sourceCodeLocationInfo: true});
  const edits = [];
  const slug = (file.match(/^case-studies\/([^/]+)\/index\.html$/) || [])[1];

  if (slug && bySlug[slug]) {
    edits.push(inner($('main')[0], caseStudyMain(bySlug[slug], $)));
  } else {
    $('.work').not('#work-grid').each((_, el) => {
      edits.push(inner(el, '\n' + workCards + '\n'));
      const h2 = $(el).closest('section').find('.section-head h2')[0];
      if (h2) edits.push(inner(h2, `Products we've designed, <span class="muted">built and shipped</span>`));
    });
  }

  if (file === 'case-studies/index.html') {
    const hero = $('main > section.page-hero .container')[0];
    edits.push(inner(hero, `
      <div class="hero-split">
        <div>
          <h1 class="display reveal">Products we've designed, <span class="muted">built and shipped.</span></h1>
          <p class="lede reveal">Explore ${words(projects.length)} products DuooNex has designed and built: accounting, help desk, invitations, industrial supply, IT asset and property management. Each case study covers the actual scope, with original screens and project films.</p>
          <div class="page-hero__actions reveal"><a class="btn btn--dark" href="https://wa.me/971588102728">Discuss your project<span class="arw" aria-hidden="true">→</span></a><a class="btn btn--ghost" href="../subscription/index.html">Pricing <span class="arw" aria-hidden="true">→</span></a></div>
        </div>
        <div class="reveal"><div class="csx-fig"><img src="${IMG}finora-1.webp" alt="${esc(bySlug.finora.alt[0])}" fetchpriority="high" decoding="async"></div></div>
      </div>
    `));
    const tags = new Map([['all', projects.length]]);
    for (const p of projects) for (const t of new Set([...p.tags.split('|'), p.stack])) tags.set(t, (tags.get(t) || 0) + 1);
    const filterHtml = [...tags].map(([t, n]) => `\n        <button class="filter${t === 'all' ? ' is-active' : ''}" type="button" data-filter="${esc(t)}">${t === 'all' ? 'All case studies' : esc(t)}<sup>${n}</sup></button>`).join('') + '\n      ';
    edits.push(inner($('.filters[data-filter-group="work-grid"]')[0], filterHtml));
    $('script[type="application/ld+json"]').each((_, el) => {
      const data = JSON.parse($(el).text());
      const list = (data['@graph'] || [data]).find(node => node['@type'] === 'ItemList');
      if (!list) return;
      list.itemListElement = projects.map((p, i) => ({'@type': 'ListItem', position: i + 1, name: p.name, url: `https://duoonex.com/case-studies/${p.slug}/`}));
      edits.push(inner(el, JSON.stringify(data).replace(/</g, '\\u003c')));
    });
    const grid = $('#work-grid')[0];
    edits.push(outer(grid, `<div class="csx-list reveal" id="work-grid">\n${projects.map(p => card(p, true)).join('\n')}\n</div>`));
  }

  if (file === 'services/index.html') {
    const hero = $('main > section.page-hero .container')[0];
    const split = $(hero).children('.hero-split').children('div').first();
    const heroInner = split.length ? split.html() : $(hero).html();
    edits.push(inner(hero, `\n<div class="hero-split"><div>${heroInner}</div><div class="reveal"><div class="csx-fig"><img src="${IMG}nexora-1.webp" alt="${esc(bySlug.nexora.alt[0])}" fetchpriority="high" decoding="async"></div></div></div>\n`));
    const art = [
      `<div class="csx-fig"><img src="${IMG}invitara-2.webp" alt="${esc(bySlug.invitara.alt[1])}" loading="lazy" decoding="async"></div>`,
      `<div class="csx-fig"><img src="${IMG}mechaura.webp" alt="${esc(bySlug.mechaura.alt[0])}" loading="lazy" decoding="async"></div>`,
      `<div class="csx-fig csx-fig--phones"><img src="${IMG}nexora-2.webp" alt="${esc(bySlug.nexora.alt[1])}" loading="lazy" decoding="async"><img src="${IMG}invitara-7.webp" alt="${esc(bySlug.invitara.alt[6])}" loading="lazy" decoding="async"></div>`,
      `<div class="csx-fig"><img src="${IMG}invitara-1.webp" alt="${esc(bySlug.invitara.alt[0])}" loading="lazy" decoding="async"></div>`,
      `<div class="csx-fig"><img src="${IMG}finora-3.webp" alt="${esc(bySlug.finora.alt[2])}" loading="lazy" decoding="async"></div>`
    ];
    $('.svc-group').each((i, el) => {
      const content = $(el).find('.svc-group__head, .svc-list').toArray().map(x => $.html(x)).join('\n');
      edits.push(outer(el, `<div class="svc-group svc-group--media${i % 2 ? ' is-flipped' : ''}">\n<div>\n${content}\n</div>\n<div class="svc-group__art reveal">${art[i % art.length]}</div>\n</div>`));
    });
    const industries = [['finora', 'Fintech'], ['nexora', 'Support operations'], ['invitara', 'Events & celebrations'], ['mechaura', 'Industrial supply'], ['assethub', 'IT operations'], ['jaber-property', 'Real estate']]
      .filter(([s]) => bySlug[s])
      .map(([s, label]) => `<a class="ind-card" href="/case-studies/${s}/"><div class="csx-fig"><img src="${poster(bySlug[s])}" alt="${esc(images(bySlug[s])[0].alt)}" loading="lazy" decoding="async"></div><div class="ind-card__body"><strong>${esc(label)}</strong><span>${esc(bySlug[s].name)}</span></div></a>`).join('\n');
    const groupsSection = $('.svc-group').first().closest('section')[0];
    const next = $(groupsSection).next('section.ind-section')[0];
    const block = `\n<section class="section section--mist ind-section">\n<div class="container">\n<div class="section-head reveal"><div><p class="eyebrow">/ Industry expertise</p><h2 class="h2">Products built <span class="muted">across industries</span></h2></div><a class="btn btn--indigo" href="../case-studies/index.html">See all case studies<span class="arw" aria-hidden="true">→</span></a></div>\n<div class="ind-grid reveal">\n${industries}\n</div>\n</div>\n</section>`;
    edits.push(next ? outer(next, block.trim()) : {start: loc(groupsSection).endOffset, end: loc(groupsSection).endOffset, text: block});
  }

  if (!edits.length) continue;
  const out = splices(html, edits);
  if (out !== html) { write(file, out); changed++; }
}

// ---------- Generated SEO files ----------
for (const m of ['../lib/seo', '../data/projects.json', '../data/project-redirects.json']) delete require.cache[require.resolve(m)];
const seo = require('../lib/seo');
const origin = seo.siteOrigin('https://duoonex.com');
write('llms.txt', seo.llms(origin));
const indexable = files.filter(f => seo.indexable(f, read(f)));
write('sitemap.xml', seo.sitemap(indexable, origin));
console.log(`Portfolio: ${projects.length} products, ${changed} pages updated, ${indexable.length} indexable URLs.`);
