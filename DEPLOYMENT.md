# Cloudflare Pages handoff

The current source targets Cloudflare Pages, not the earlier Sites hosting workflow.

Follow the complete setup in [README.md](README.md#cloudflare-pages-setup).

- Repository: https://github.com/percival-peng-wiseway/e3showcase
- Production branch: `main`
- Framework: `None`
- Build: `npm run build`
- Output: `dist`
- D1 binding: `DB`
- Apply `drizzle/0000_access_log.sql`, then `drizzle/0001_login_location.sql` once.
- Runtime secrets: `VIEWER_PASSWORD=e3open`, a separate `ADMIN_PASSWORD`, and a random `SESSION_SECRET` of 32+ characters.
- Redeploy after adding bindings and secrets.
- Owner dashboard: `/admin`.

The local preview and functional tests use synthetic visitor records. Production deployment and actual Cloudflare IP/geolocation capture must be checked after the user deploys. No Cloudflare account settings or production database have been changed by preparing this repository.

After deployment, test a fresh browser: wrong password, blank name, successful name + e3open login, inaccessible protected images before login, owner-only records/CSV, and the actual recorded IP/location. Location can be unavailable or approximate and may reflect a VPN/network gateway. Revisit the owner dashboard after another deployment to confirm records remain in the bound D1 database.
