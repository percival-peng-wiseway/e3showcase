# E3 Energy · Latrobe showcase

Bilingual project presentation with a matching name-and-password login, server-side sessions, and private visitor records. Prepared for **Cloudflare Pages Advanced Mode** with a **Cloudflare D1** database. No npm dependencies are required.

## Cloudflare Pages setup

1. Connect this GitHub repository in **Workers & Pages → Create → Pages → Connect to Git**.
2. Select branch **main**, framework preset **None**, build command **`npm run build`**, build output directory **`dist`**, and leave the root directory blank. Use Node 22 or newer (set `NODE_VERSION=22` if needed).
3. In **Storage & databases → D1**, create a database named **`e3showcase-visitors`**. Apply both SQL files in order using Wrangler:

   ```sh
   npx wrangler d1 execute e3showcase-visitors --remote --file=drizzle/0000_access_log.sql
   npx wrangler d1 execute e3showcase-visitors --remote --file=drizzle/0001_login_location.sql
   ```

   Alternatively, run the contents of those two files, in order, in the database's **Console**. Apply them once. Existing installations with the original visits/events/attempts tables need only `0001_login_location.sql`.
4. In the Pages project's **Settings → Bindings**, add a **D1 database** binding named **`DB`** pointing to that database.
5. In **Settings → Variables and Secrets**, add these runtime values:

   | Name | Value |
   | --- | --- |
   | `VIEWER_PASSWORD` | `e3open` |
   | `ADMIN_PASSWORD` | Your own separate administrator password; do not use `e3open` |
   | `SESSION_SECRET` | A random secret of at least 32 characters |

   Use the **Secret** type for passwords and the session secret. Generate a session secret locally with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

6. **Redeploy** after adding bindings and secrets. If you use preview deployments, configure their bindings/secrets separately; use a separate D1 database for preview data.

The first automatic build can finish before bindings are configured; it will show “Service is not configured” until step 6. The website deliberately refuses access when required settings are missing.

## Visitor and owner access

- `/`: required self-declared name and access password. Email, organisation and account registration are not required.
- `/admin`: enter your name and the separate `ADMIN_PASSWORD` to view access records.
- `/api/logs.csv`: download the owner-only CSV export.
- `/logout`: clear the current browser session.
- `/health`: report whether runtime bindings and secrets are configured.

Successful logins store the name, UTC login time, IP address, country code, region, city and visitor timezone when supplied by Cloudflare. Cloudflare's `CF-Connecting-IP` (or original IPv6 with Pseudo IPv4) supplies the IP; `request.cf` supplies location. The browser cannot choose the stored IP or location via form fields. There are no third-party location or analytics requests.

**IP location is approximate**, can be unavailable, and may reflect a VPN, corporate gateway or mobile network. It is not a verified street address or identity. Local development has no Cloudflare geolocation and displays unavailable values. Owner records show times in Australia/Melbourne; CSV times are UTC. Counts of distinct names do not establish unique people.

Existing chapter and visible-tab duration tracking is retained. CSV exports up to 20,000 visitor sessions and escapes spreadsheet formula prefixes. Administrator logins are excluded from visitor statistics. Sessions expire after four hours; eight failed attempts per role and IP trigger a 15-minute limit. Sessions use signed Secure/HttpOnly/SameSite cookies. Visitor passwords cannot read logs.

## Local development and checks

Requires Node 22.13+ with built-in `node:sqlite`.

```sh
npm test
npm run dev
```

Preview: `http://127.0.0.1:8787`. Preview credentials are `e3open` for visitors and `preview-admin-only` for administrators. Preview uses an in-memory database that resets on restart.

For a persistent local database, set the three variables in `.env.example` in your shell, set `PUBLIC_ORIGIN` if needed, and run `npm start`. Data is stored in ignored `data/visitors.sqlite`; schema migrations apply automatically. This loopback Node alternative records the socket peer IP and does not infer public visitor locations. Cloudflare Pages is the intended hosting platform.

## Build and source layout

- `gate.html`, `admin-gate.html`, `admin.html`: editable login and owner views.
- `report.html`: presentation source.
- `worker/index.js`: authentication, routing and database logic.
- `worker/assets.js`: embedded presentation images and invoice evidence.
- `drizzle/*.sql`: D1 schema migrations.
- `scripts/build.mjs`: combines the source into `dist/_worker.js` with an all-paths `_routes.json`.

Deploy **only `dist` using Pages Git integration**. Do not use GitHub Pages, a static-only host, or the repository root as the public output: login validation and D1 require the server-side Worker. Protected HTML and images are embedded in the Worker rather than copied into public static assets. Unknown source paths return 404. Never commit runtime secrets, databases or exported visitor logs. The repository itself contains the presentation source; its GitHub visibility is independent of the deployed website's login gate.

Financial figures and assumptions are unchanged. See `content-notes.json` and the presentation notes.

## Cloudflare references

- [Pages Advanced Mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)
- [Cloudflare request geolocation](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties)
