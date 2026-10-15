# Cloudflare deployment handoff

The current source supports Cloudflare Pages and Cloudflare Workers.

For the Workers **Create an app** workflow, set build command `npm run build` and deploy command `npx wrangler deploy`. The tracked `wrangler.json` points to the server entry `dist/_worker.js` and declares no static assets. Do not pass `--assets dist`. See README Workers setup for D1 binding configuration using your actual database ID.

The Pages settings below remain available if you use **Continue to Pages**.

Follow the complete setup in [README.md](README.md#cloudflare-pages-setup).

- Repository: https://github.com/percival-peng-wiseway/e3showcase
- Production branch: `main`
- Framework: `None`
- Build: `npm run build`
- Output: `dist`
- D1 binding: `DB`
- Apply `drizzle/0000_access_log.sql`, then `drizzle/0001_login_location.sql`, then `drizzle/0002_login_notifications.sql` once.
- Runtime secrets: `VIEWER_PASSWORD=e3open`, a separate `ADMIN_PASSWORD`, and a random `SESSION_SECRET` of 32+ characters.
- Redeploy after adding bindings and secrets.
- Owner dashboard: `/admin`.
- Optional login email alerts to `percival@wiseway.ai`: add `RESEND_API_KEY` (Secret) and `LOGIN_NOTIFICATION_FROM` (verified Resend sender), then redeploy. See the README login email section. Provider acceptance is not inbox delivery; real delivery remains to be verified after configuration.

The local preview and functional tests use synthetic visitor records. Production deployment and actual Cloudflare IP/geolocation capture must be checked after the user deploys. No Cloudflare account settings or production database have been changed by preparing this repository.

After deployment, test a fresh browser: wrong password, blank name, successful name + e3open login, inaccessible protected images before login, owner-only records/CSV, and the actual recorded IP/location. Location can be unavailable or approximate and may reflect a VPN/network gateway. Revisit the owner dashboard after another deployment to confirm records remain in the bound D1 database.
