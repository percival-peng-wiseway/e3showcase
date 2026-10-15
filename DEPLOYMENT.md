# Investment platform deployment — 15 October 2026

- Repository: https://github.com/percival-peng-wiseway/e3showcase
- Branch: `invest_version`
- Live site: https://invest.e3energy.com.au
- Worker: `e3-invest-platform`
- Worker URL: https://e3-invest-platform.percival-0ae.workers.dev
- D1 binding: `DB`
- D1 name: `e3-invest-platform-visitors`
- D1 ID: `1338f7fd-e656-4e78-acc7-cb3508ba8cf7`
- Initial source deployment version: `82baf0ed-6574-460d-b693-8b8af355820f`

All three migrations are applied. Viewer/admin passwords from the supplied private owner handoff and a unique random session secret are installed as Cloudflare Secrets. Secrets are excluded from Git. The current simple viewer login and existing owner login were preserved; the supplied package's alternative gate was not used.

The original `main` branch and its `e3showcase` Worker, custom domain and visitor database are separate from this deployment.

## Verification

- Local checks: 40 platform/content/access checks, 29 login/location/persistence checks, 18 mocked email checks, and the build artifact validator.
- Both live `/health` endpoints returned 200 with `ok: true`.
- Normal browser: supplied viewer password opens the fund; the complete Latrobe project opens without another sign-in; the Fund link returns successfully; supplied administrator password opens the dashboard; live IP, approximate location and fund/project chapter records load; CSV downloads; logout returns to the login gate.
- Default Python HTTP traffic was rejected by Cloudflare with 403/1010. A proposed client identifier change was rejected by automatic review and was not executed. Verification continued through ordinary browser operations without modifying Cloudflare protections.
- No real notification emails were sent during these checks. Synthetic browser login records are labelled TEST and cleaned after verification.

## Login notifications

Requested primary recipient: `percival@wiseway.ai`; CC: `jerry@e3energy.com.au`. Both are fixed in server code. The independent Resend key is prepared with Sending access restricted to `wiseway.ai`; creation and installation are awaiting confirmation. No test email is requested. Do not report inbox delivery as verified.

For later updates, check out `invest_version`, run `npm test`, apply any new D1 migrations using Wrangler, and deploy using the tracked configuration. Do not change the production source branch to `main` or use the existing Latrobe database ID.
