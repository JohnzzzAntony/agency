# DuooNex — static website + hosted CMS

The application backend has been replaced with **Pages CMS**, a hosted editor connected to GitHub. The deployed website is ordinary HTML, CSS, JavaScript and images. There is no application server, database, admin password, writable volume or Docker service to maintain.

Node.js runs only during builds (locally or on the hosting provider). Visitors receive prebuilt static files. The optional local preview command is a read-only development file server, not a production backend.

## Finish the one-time account setup

1. Open **https://app.pagescms.org/** and sign in with your GitHub account.
2. Install/authorize the Pages CMS GitHub App for **JohnzzzAntony/agency**. This account authorization must be completed by the repository owner; it cannot be included in the code.
3. Select the repository and the **main** branch. The committed `.pages.yml` supplies the editor configuration.
4. Configure one static hosting option below. Saving content commits to GitHub; the hosting build then updates the live site.

The website's `/admin/` page links to the hosted editor. The previous local preview password no longer applies. The local admin dashboard, private drafts and enquiry inbox are retired; editing, authentication and revision history now use the hosted CMS/GitHub workflow.

## Editing all 80 pages

Open **Website pages**, find a page by title/path, then expand a section. Text/headings, image pickers, links, metadata, form labels, navigation and footer copies are editable. Image uploads are stored in `assets/images/` in GitHub. The original frontend stack, section structure and styles are preserved.

Keep the existing section and field lists intact. IDs and template fingerprints are hidden/read-only; they connect each field to the original layout. The build rejects missing fields, invalid URLs and template mismatches rather than publishing misplaced content. Styled headings have separate text runs to preserve their original spans.

**Save commits your edit**. With automatic deployment enabled, it becomes live after a successful build. This is not the old local draft/publish flow. For staged changes, edit on a separate GitHub branch, review the build artifact, and merge when ready. Revert a Git commit to restore an earlier version. Navigation/footer copies remain separately editable on each page.

## GitHub Pages hosting

The included workflow builds and tests on pushes to `main` and on pull requests. Deployment stays off until explicitly enabled, so adding this code alone does not publish a new public site.

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, set:
   - `ENABLE_PAGES_DEPLOYMENT` = `true`
   - `SITE_URL` = the exact URL shown in GitHub's Pages settings (normally `https://johnzzzantony.github.io/agency/`).
3. Run **Build and publish static website** from Actions, or push a change.

Use the actual live address shown by your hosting provider. No purchased domain is required. The build creates canonical URLs and a sitemap when a site URL is configured. `SITE_URL` overrides the Website settings value; leave the Actions variable unset if you prefer to manage the URL through the CMS.

## Other static hosting

Connect this GitHub repository to a static hosting provider. Use Node.js 24, build command **`npm run build`**, and output/publish directory **`dist`**. `netlify.toml` already specifies these values for Netlify. Configure the real website URL in CMS Website settings or through `SITE_URL` in the build environment. GitHub Pages deployment can remain disabled.

For manual hosting, run `npm ci` then `npm run build` and upload **only `dist/`**. Do not upload the entire repository. Images and links use relative paths, so root domains and project subfolders both work.

## Contact forms

Without a hosted form endpoint, submitting the form opens an email draft addressed to the email in **Website settings**. It clearly asks the visitor to send that draft; it does not claim the message was submitted.

For direct submissions, create a hosted form (for example Formspree) and paste its HTTPS endpoint into **Website settings → Hosted contact form endpoint**. The provider must accept cross-origin JSON POST requests. Its dashboard/email handles enquiries; the website no longer stores a private inbox. No form-service account has been created or activated by this migration.

## Build and preview locally

```sh
npm ci
npm test
npm run build
```

Open `dist/index.html` directly in your browser, or run `npm run preview` for the optional local HTTP preview at http://127.0.0.1:3000/. You can upload this same `dist/` directory to any static host. No ongoing Node process is needed in production.

`npm run init-content` seeds missing editable records from source HTML; it never overwrites existing records. Do not run it as part of hosting builds. If a developer changes an HTML template's structure, migrate that page's stored content and fingerprint deliberately so existing edits are preserved.

## Migration and verification

Content is stored in `content/pages/*.json`; shared deployment/form settings are in `content/settings.json`. The old `data/site-content.json` prototype is unused. Any previous local `data/runtime/` files remain untouched and ignored by Git; export/migrate them separately if they contain edits or enquiries. No old runtime records were present in this workspace during this migration.

Tests cover all 80 page mappings, preserved markup, edited text/images/SEO, unsafe URLs, relative assets, build output isolation and generated sitemap. The hosted CMS login and live deployment require the account setup above; they cannot be validated without your GitHub authorization.

Official setup references: [Pages CMS quick start](https://pagescms.org/docs/quick-start/), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
