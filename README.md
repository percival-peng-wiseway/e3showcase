# E3 Australian C&I Investment Platform

Cloudflare Worker deployment from the `invest_version` branch of `percival-peng-wiseway/e3showcase`.

- Website: https://invest.e3energy.com.au
- Worker: https://e3-invest-platform.percival-0ae.workers.dev
- `/`: complete 12-chapter fund presentation.
- `/projects/latrobe`: complete 12-chapter Latrobe demonstration project, using the same session.
- `/admin`: separate administrator sign-in, visitor records and CSV export.

The viewer and owner login pages are reused from the existing Latrobe site. Viewers enter only a name and shared password. Passwords are stored as Cloudflare Secrets; the credentials were unified with the existing Latrobe site after owner confirmation. No passwords or private owner instructions are included in this repository.

The platform records self-declared names, UTC login times, Cloudflare IP/approximate location, viewed fund/project chapters and estimated visible time. The dashboard uses Australia/Melbourne time. Viewer sessions cannot access records or CSV files. Session cookies are signed, Secure and HttpOnly, expire after four hours, and use a signing secret unique to this deployment. Native login forms retain same-origin referrer information for browser compatibility.

## Development and deployment

Requires Node >=22.13 with built-in SQLite. No application dependencies are needed.

```sh
npm test
npm run dev
npm run start
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

`npm run dev` uses synthetic data; `npm run start` requires the environment settings in `.env.example`. The build places all investor content and images inside `dist/_worker.js`. Never deploy the Worker output as public static assets or upload the source ZIP to a public downloads directory.

The checked-in Wrangler configuration binds `DB` to `e3-invest-platform-visitors` and retains the `invest.e3energy.com.au` custom domain. This database is separate from the existing Latrobe site. Migrations are tracked by Wrangler and must not be rerun as raw SQL.

Runtime secrets: `VIEWER_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET` (random, 32+ characters), and optionally `RESEND_API_KEY` plus `LOGIN_NOTIFICATION_FROM`. Use separate viewer/admin passwords. Never commit runtime secrets. Existing values are preserved on redeploy through `keep_vars`.

## Login notifications

The email provider secrets are installed. Visitor logins send a plain-text notification to `percival@wiseway.ai`, CC `jerry.lu@wiseway.ai`. Recipients are fixed in server code. Notifications include the name, login time, IP and approximate location. Owner sign-ins and page navigation do not send notifications. Provider acceptance is stored separately from inbox delivery; delivery is not implied by configuration. Missing notification settings do not prevent sign-in. The restricted provider key must allow sending only from the verified `wiseway.ai` domain.

Investor content is taken from the supplied complete platform server package. `fund.html`, `latrobe.html`, `fund-notes.json` and `content-notes.json` retain its investment assumptions; deployment does not independently verify or change them.
