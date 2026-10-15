# E3 Energy · Latrobe showcase

Bilingual project presentation with a matching name-and-password login, server-side sessions, and private visitor records. Supports **Cloudflare Pages Advanced Mode** and **Cloudflare Workers**, with a **Cloudflare D1** database. No npm dependencies are required.

## Cloudflare Workers setup

If Cloudflare shows **Create an app** with a **Deploy command**, you are using the Workers workflow. This is also supported:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root (leave blank or use `/`)
- Do not add `--assets dist` to the deploy command.

`wrangler.json` explicitly identifies `dist/_worker.js` as the **server entrypoint**. This application embeds its HTML and images in that module, so Workers needs no static assets directory. No server code is uploaded as public assets. Do not add an empty `.assetsignore` to bypass the error about uploading `_worker.js` as an asset.

After the first successful upload, configure the same runtime secrets and D1 schema as below in the **Worker** settings. `keep_vars` preserves dashboard variables; encrypted secrets are also retained. A successful code upload alone does not configure the database or passwords.

The checked-in configuration now binds `DB` to the existing `e3showcase-visitors` database and retains the `latrobe-investers.e3energy.com.au` custom domain. The production database has all three migrations applied and the required runtime secrets are installed. For later migrations, use `npx wrangler d1 migrations apply DB --remote`; do not rerun the initial schema files on this database. For deployment to another Cloudflare account, replace the account ID, D1 database ID and custom domain with your own values.

This fixes a Workers build that fails with **Uploading a Pages _worker.js file as an asset**. It does not require switching to Pages. If you prefer Pages, use the separate Pages setup below.

## Cloudflare Pages setup

1. Connect this GitHub repository in **Workers & Pages → Create → Pages → Connect to Git**.
2. Select branch **main**, framework preset **None**, build command **`npm run build`**, build output directory **`dist`**, and leave the root directory blank. Use Node 22 or newer (set `NODE_VERSION=22` if needed).
3. In **Storage & databases → D1**, create a database named **`e3showcase-visitors`**. Apply all three SQL files in order using Wrangler:

   ```sh
   npx wrangler d1 execute e3showcase-visitors --remote --file=drizzle/0000_access_log.sql
   npx wrangler d1 execute e3showcase-visitors --remote --file=drizzle/0001_login_location.sql
   npx wrangler d1 execute e3showcase-visitors --remote --file=drizzle/0002_login_notifications.sql
   ```

   Alternatively, run the contents of those three files, in order, in the database's **Console**. Apply them once. Existing installations with the original visits/events/attempts tables need `0001_login_location.sql` and `0002_login_notifications.sql`. If location tracking is already installed, apply only `0002_login_notifications.sql`.
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

## Login email notifications (Resend)

Every successful **visitor** login can send a plain-text email to **percival@wiseway.ai**, with **jerry.lu@wiseway.ai** copied (CC). Failed passwords, administrator logins and page views do not trigger emails. The notification includes the self-declared name, login time in Australia/Melbourne and UTC, IP address, approximate city/region/country and visitor timezone. Passwords, session cookies and API keys are never included. The recipient and CC address are fixed on the server and cannot be changed through the login form.

To enable:

1. In [Resend](https://resend.com/domains), verify a domain you control and select a sender on that domain. An example format is `E3 Showcase <notifications@your-verified-domain.com>`; replace this with your actual verified sender.
2. Create a Resend API key with sending access for that domain.
3. In Cloudflare Pages → Settings → Variables and Secrets, add:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Your Resend API key, stored as a **Secret** |
   | `LOGIN_NOTIFICATION_FROM` | Your verified sender address, optionally with a display name |

4. Apply `drizzle/0002_login_notifications.sql` once if the database already has the first two migrations, then **redeploy** Pages.
5. Log in as a visitor and check both your inbox and `/admin`. The dashboard and CSV show the notification status. `Accepted by Resend` confirms provider acceptance, not inbox delivery. If the email does not arrive, check Resend delivery events and your mailbox's spam/quarantine filters.

Cloudflare sends the notification in the background via `ctx.waitUntil`, so provider delays do not delay visitor access. Transient network/server errors receive one retry with the same Resend idempotency key. Each request has an eight-second timeout. Permanent errors or missing mail configuration do not block login; the database retains `failed` or `not_configured` status. There is no scheduled resend queue: failed or older notifications are not automatically replayed. No real email has been sent or inbox delivery verified by the repository's mock-provider tests.

Keep these settings in production only unless you want preview logins to send real emails. `npm run dev` intentionally uses no mail credentials and sends no emails. The standalone `npm start` alternative reads the two settings from the environment.

References: [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [Cloudflare background tasks](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).

## Local development and checks

Requires Node 22.13+ with built-in `node:sqlite`.

```sh
npm test
npm run dev
```

Preview: `http://127.0.0.1:8787`. Preview credentials are `e3open` for visitors and `preview-admin-only` for administrators. Preview uses an in-memory database that resets on restart.

For a persistent local database, set the three variables in `.env.example` in your shell, set `PUBLIC_ORIGIN` if needed, and run `npm start`. Data is stored in ignored `data/visitors.sqlite`; schema migrations apply automatically. This loopback Node alternative records the socket peer IP and does not infer public visitor locations. Cloudflare Pages or Workers is the intended hosting platform.

## Build and source layout

- `gate.html`, `admin-gate.html`, `admin.html`: editable login and owner views.
- `report.html`: presentation source.
- `worker/index.js`: authentication, routing and database logic.
- `worker/assets.js`: embedded presentation images and invoice evidence.
- `drizzle/*.sql`: D1 schema migrations.
- `scripts/build.mjs`: combines the source into `dist/_worker.js` with an all-paths `_routes.json`.

For Pages, deploy **only `dist` using Pages Git integration**. For Workers, deploy the module using `wrangler.json` as described above. Do not use GitHub Pages, a static-only host, or the repository root as the public output: login validation and D1 require the server-side Worker. Protected HTML and images are embedded in the Worker rather than copied into public static assets. Unknown source paths return 404. Never commit runtime secrets, databases or exported visitor logs. The repository itself contains the presentation source; its GitHub visibility is independent of the deployed website's login gate.

Financial figures and assumptions are unchanged. See `content-notes.json` and the presentation notes.

## Cloudflare references

- [Pages Advanced Mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)
- [Cloudflare request geolocation](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties)
