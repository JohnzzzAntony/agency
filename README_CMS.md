# DuooNex website manager

The existing HTML, CSS and browser JavaScript remain the frontend. The Node backend renders published edits into all 80 existing pages before sending HTML, including SEO metadata. No client-side content fetch is needed. All existing main pages, service pages, locations, case studies, blog posts and the legacy portfolio page are indexed automatically. Sitemap and robots endpoints are generated using the request domain.

## Local startup

Install Node.js 24, then run from the project directory in PowerShell:

```powershell
npm ci
$env:CMS_ADMIN_TOKEN = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
# Store the generated value securely; use it as the admin password.
$env:CMS_ADMIN_TOKEN
npm start
```

Website: http://localhost:3000/ · Admin: http://localhost:3000/admin/

Use your generated secret to sign in. The server refuses to start without a secret of at least 32 characters. No default credential ships. Sessions expire after eight hours and on restart. Passwords are never stored in browser storage. Changing the secret and restarting invalidates sessions.

## Editing

1. Select a page. Search by title or URL.
2. Filter fields by section or type. Edit headings, paragraphs, buttons, links, navigation, footer, contact details, form labels/options, pricing values, accessibility labels, images or SEO fields. Nested text runs are separate fields so styled headings and icons retain their layout. Navigation/footer copies are editable on each page.
3. Image fields include existing `<img>` elements and CSS background artwork. Choose an image from the media library or upload PNG, JPEG, WebP or GIF (8 MB maximum). Uploads use generated filenames. Add alt text through the corresponding detail field when applicable.
4. Save draft. Preview draft and click a content element to locate its editor field. Preview does not send enquiries. Drafts are visible only to signed-in administrators.
5. Publish page. Visitors and search engines receive the updated HTML immediately. Changes survive restarts.

Version history keeps 20 prior published versions per page. Restore a version or the original content as a draft, then publish. Concurrent edits are rejected instead of silently overwriting someone else's changes. Code changes to a source template trigger a fingerprint check; export a backup and reset that page before applying new edits. The original HTML files are never overwritten by the CMS.

The enquiry inbox stores real website form submissions. No email delivery service is configured. Read and delete enquiries in the admin panel.

## Production deployment

Use a persistent Node.js server or Docker host with HTTPS. GitHub Pages and static-only hosting cannot run this backend. Run one application instance per data volume; this JSON store is designed for a single agency website, not multiple concurrent application replicas.

Configure:

| Variable | Value |
| --- | --- |
| `CMS_ADMIN_TOKEN` | Random secret, 32+ characters; configure through host secret settings |
| `NODE_ENV` | `production` (Secure session cookies require HTTPS) |
| `CMS_DATA_DIR` | Absolute persistent directory, e.g. `/data` |
| `PORT` | Provider port or `3000` |

Build command: `npm ci --omit=dev`. Start command: `npm start`. Health endpoint: `/api/health`. Terminate HTTPS at the hosting proxy and preserve the original Host header. Local HTTP testing uses non-production mode. `.env.example` documents variables; environment files are not automatically loaded.

Docker example (set the secret in your shell first):

```sh
docker build -t duoonex .
docker volume create duoonex-data
docker run -d --name duoonex --restart unless-stopped -p 127.0.0.1:3000:3000 --env CMS_ADMIN_TOKEN -v duoonex-data:/data duoonex
```

Place an HTTPS reverse proxy in front of port 3000. The container runs as the unprivileged `node` user. A bind-mounted directory must be writable by that user. Do not deploy multiple replicas against the same directory.

## Backups and restore

Back up the entire `CMS_DATA_DIR` directory (content database and `uploads/`) while the application is stopped, or use a consistent volume snapshot. The admin Export content backup action downloads the JSON database; it does not include image binaries. Protect backups because they contain enquiries.

To restore, stop the server, restore `cms.json` and `uploads/` to `CMS_DATA_DIR`, restore ownership, then start it. Keep a copy of the matching source code revision because field IDs follow the source templates. The old prototype `data/site-content.json` is no longer used; the new CMS starts from the actual existing website content.

## Verification

`npm test` checks full-page field coverage, preserved markup, safe rendering, protected writes, draft/publish visibility, image uploads, restart persistence, private-file blocking, concurrent edit protection and enquiry storage. No deployment has been made by creating this code; configure your host and persistent storage before going live.
