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

The local preview and automated tests use synthetic visitor records. The production setup and live checks completed on 15 October 2026 are recorded below.

After deployment, test a fresh browser: wrong password, blank name, successful name + e3open login, inaccessible protected images before login, owner-only records/CSV, and the actual recorded IP/location. Location can be unavailable or approximate and may reflect a VPN/network gateway. Revisit the owner dashboard after another deployment to confirm records remain in the bound D1 database.

## Verified live setup — 15 October 2026

- Worker: `e3showcase` in the configured Cloudflare account.
- Live URL: https://latrobe-investers.e3energy.com.au
- Worker URL: https://e3showcase.percival-0ae.workers.dev
- D1 `DB` is bound to `e3showcase-visitors` (`c2f6d308-4906-4bb7-b14d-3bc6bf247867`); all three migrations were applied with Wrangler's migration ledger. Do not rerun the raw schema files on this initialized database. Apply future migrations with `wrangler d1 migrations apply DB --remote`.
- Viewer/admin passwords and a random session signing secret are installed as Cloudflare Secrets. Secret values are not stored in the repository.
- Wrangler configuration retains the current custom domain, workers.dev endpoint and D1 binding for future deployments.
- Fourteen live checks passed: gate, failed/successful login, protected report/images, owner dashboard, D1 IP/location record, CSV access and logout. Synthetic verification login records were removed.
- Resend login alerts are enabled. A dedicated `e3showcase-login-alerts` key with Sending access restricted to `wiseway.ai` is stored only in the Cloudflare `RESEND_API_KEY` Secret. The sender is `E3 Showcase <notifications@wiseway.ai>`.
- A clearly labelled test visitor login triggered an email to `percival@wiseway.ai` at 11:39 AEDT on 15 October 2026. Resend reported `delivered`, and the matching email was verified in the recipient Gmail account with the `INBOX` label. The synthetic test login remains labelled TEST in the owner records.
