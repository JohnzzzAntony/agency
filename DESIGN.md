# DESIGN.md: wavespace.agency inner-page layouts

## Source
- URL: https://www.wavespace.agency (inner pages only)
- Capture date: 2026-10-04
- Evidence: Firecrawl `map` (160 URLs) + `rawHtml` scrapes of `/case-studies/better-ai`, `/case-studies`, `/services`, `/services/web-design`, `/about`, saved in `.firecrawl/`. Only the DOM structure was used. No wavespace copy, images or logos were copied.
- Scope: Layout only. Colours, type and spacing tokens are DuooNex's own, from `:root` in `assets/css/style.css`. Content and media come from `data/projects.json` and `assets/images/projects/`.

## Which pages changed
| Page | Status |
|---|---|
| Case-study detail (`/case-studies/<slug>/`) | Rebuilt to the wavespace detail layout |
| Case-study listing (`/case-studies/`) | Rebuilt: split hero, filter pills with counts, stacked large cards |
| Services index (`/services/`) | Split hero, service groups paired with artwork, new "industry expertise" grid |
| Service detail pages | Already matched wavespace's section order. Not changed |
| "Selected work" block (~60 pages) | Same card layout, now showing products only |

## Page patterns

### Case-study detail
1. **Hero**: breadcrumb → H1 (name + muted category) → 2-column grid `1fr / 2.6fr`. The left column holds 3 stacked stats (feature areas, screens/films, stack) with hairline rules. The right column holds the lead image.
2. **Media slot**: 1 item = full width 16:9. 2 items = a pair at 4:3. 3+ items = one full-width item, then pairs. Portrait captures (ratio < 0.8) get a phone frame on a mist panel.
3. **Labelled rows** repeat the wavespace `tag_title | body` pattern. Each row is a 2-column grid `1fr / 2.6fr` with a top hairline. A sticky uppercase label sits on the left. The H2, body and bullets sit on the right, followed by a media slot.
   Row order: Overview (+ meta: category, technology, live site), Journey, Engineering, Process (4 bordered cards), Scope.
4. **More work**: one large horizontal card above a 2-up grid of vertical cards.
5. Contact section (unchanged).

### Case-study listing
Split hero (copy left, product screenshot right) → filter pills with counts → a stacked list of large horizontal cards. Each card shows the category, name, summary and tags, then the stack stat and CTA, with the image on the right.

### Services index
Split hero → logo marquee → service groups. Each group is a 2-column layout of copy + 2-col link list beside sticky artwork, and the side flips on alternate groups. Next comes a "Products built across industries" 3-col image card grid, then the existing sections.

## Components (classes in `assets/css/style.css`, section "Inner-page layouts")
- `.csx-fig` (`--wide`, `--half`, `--phone`, `--contain`): media frame, 6px radius, `--bg-3` placeholder
- `.csx-hero__grid`, `.csx-stats`, `.csx-stat`: case-study hero
- `.csx-row`, `.csx-row__grid`, `.csx-tag`, `.csx-body`, `.csx-meta`: labelled rows
- `.csx-media`, `.csx-media__pair`: media slots
- `.csx-process`, `.csx-process__card`: 4-step hairline grid
- `.csx-card`, `.csx-list`, `.csx-more__grid`: large project cards
- `.hero-split`, `.svc-group--media`, `.svc-group__art`, `.ind-grid`, `.ind-card`

Responsive: at ≤1024px every split collapses to 1 column, labels stop being sticky and process cards go 2-up. At ≤720px pairs, cards and grids go 1-up and card images move above the copy.

## Agent build instructions
- Never hand-edit portfolio markup. Edit `data/projects.json` (and add images to `assets/images/projects/`), then run `node tools/portfolio.cjs`, `npm run verify` and `npm test`.
- `tools/portfolio.cjs` is idempotent. It regenerates product case-study `<main>`, the listing, the services index, every "Selected work" block, `llms.txt` and `sitemap.xml`.
- Retired projects go in `RETIRED` inside the script, which removes them from the data and adds a 301 in `data/project-redirects.json`.

## Rerun inputs
workflow: firecrawl-website-design-clone
source_url: https://www.wavespace.agency
target_stack: static HTML + Node CMS (existing)
output: DESIGN.md
