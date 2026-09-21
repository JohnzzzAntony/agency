# DuooNex CMS

## Run

```bash
npm start
```

Set `CMS_ADMIN_TOKEN` before starting the server. The admin panel sends this token for all writes; unauthenticated write requests are rejected.

Open:

- Website: `http://localhost:3000/`
- Admin panel: `http://localhost:3000/admin`
- API: `http://localhost:3000/api/content`

The backend uses Node's built-in HTTP server. No frontend framework or build step changes. Content is stored in `data/site-content.json`; edits are written atomically. The existing static pages remain the fallback when the API is unavailable.

## Extending pages

Add page records under `pages` in `data/site-content.json`, then add matching `data-cms="pages.<page>.<field>"` attributes to frontend elements. Image fields accept a deployed asset path or an absolute HTTPS URL. Keep `data/` writable in production and place authentication in front of `/admin` before public deployment.
