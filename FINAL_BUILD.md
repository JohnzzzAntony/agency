# DuooNex — final build

Prepared 2 October 2026 for **https://duoonex.com**.

## Delivered

- Updated the 80 existing HTML pages and added six substantive project pages (86 source pages total).
- Six selected products (ecommerce storefronts retired 4 Oct 2026, see DESIGN.md): Nexora, Finora, Invitara, Mechaura International, AssetHub and Jaber Property Manager.
- Thirty original project images and five project videos, presented inside the existing project media area. Finora includes English captions from its original tutorial. Images open at full resolution; galleries support buttons, horizontal scrolling and keyboard navigation.
- Revised UAE-focused service copy, specific service FAQs, twelve practical blog guides, company/contact copy, form instructions and project narratives.
- Unique metadata for indexable pages, duoonex.com canonicals, matching social metadata, Organization/WebSite/WebPage/Service/Article/CreativeWork/FAQ structured data, robots.txt, sitemap.xml and llms.txt.
- Fifty-seven indexable canonical pages. Existing thin international-location pages and the alternate portfolio remain noindex. Twelve illustrative project routes now redirect to selected projects.
- Enquiry copy and privacy wording now reflect the existing working CMS inbox. Email delivery is not configured; administrators read enquiries in the CMS.

## Design preservation

The stylesheet, fonts, colours and logo assets are unchanged. Section order, section classes and IDs remain unchanged on all 80 original pages. New project pages reuse the existing case-study template. Project cards retain the established card layouts; only portfolio content/media and the authorised project selection changed. Gallery controls sit within the original artwork slot and reuse existing button styles.

Copy length was kept practical for the current layout, but the brief’s strict character-percentage target was not applied to new project descriptions, corrected form/privacy text or substantive FAQ/blog rewrites. Responsive checks, rather than padding text to an arbitrary character count, were used to confirm these changes fit. No new marketing sections were introduced.

## Run the finished application

The `dist` folder is the deployable Node application. The release ZIP contains its contents.

1. Extract the ZIP to a new folder.
2. Install Node.js 24 and run `npm ci --omit=dev`.
3. Configure the environment: `CMS_ADMIN_TOKEN` (random secret, at least 32 characters), `SITE_URL=https://duoonex.com`, `NODE_ENV=production`, and a persistent `CMS_DATA_DIR`.
4. Run `npm start` behind HTTPS. The default application port is 3000.
5. Open `/admin/` to edit content and read enquiries. Preserve the data directory between deployments.

For local HTTP preview, leave `NODE_ENV` unset. The supplied `.env.example` documents values; the server does not automatically read an `.env` file. Existing deployment and Docker instructions are in `README_CMS.md`.

`npm run build` validates content and creates a clean `dist` folder. It excludes credentials, enquiry records, runtime data, node_modules and intermediate PNG captures. Optimised WebP screenshots and original MP4 files are included. Do not deploy this application as static-only hosting: the CMS and enquiry inbox require its Node server.

## Verification

- Five automated tests passed: page/CMS coverage, editing/publishing/authentication/media/enquiries, startup configuration, origin/sitemap/redirect/video-range behaviour and origin validation.
- Content validation passed for 86 pages, 57 indexable URLs, ten projects and 35 gallery assets, including internal file links and JSON-LD parsing.
- All indexable titles are 50–60 characters and descriptions are 140–155 characters.
- Eighteen responsive browser checks passed across 1440px, 768px and 390px viewports. Project filtering and gallery navigation passed; no browser script errors or horizontal page overflow were found on those checked pages.
- Native video metadata loaded through the server; HTTP range requests support playback and seeking.
- Git-baseline comparison confirmed unchanged CSS and preserved original section order/classes/IDs and logos.

## Source and scope notes

Project scope comes from the supplied site, the owner’s public repositories, local project documentation and inspected application assets. See `docs/PROJECT_SOURCES.md`, `docs/project-media.json`, `docs/live-project-sources.json` and `data/projects.json` in the working source for provenance.

Repository review is evidence of implementation, not independent production acceptance testing of every portfolio application. Project pages state relevant deployment/integration limits. Client revenue, conversion increases, awards, regulatory certification, offices and search rankings were not invented. The existing contact details were retained.

No deployment, DNS change or Search Console submission was performed. Configure the host, persistent storage and HTTPS before publishing. If migrating an existing CMS database, export it first: changed template fingerprints prevent old field IDs from silently applying to different content.
