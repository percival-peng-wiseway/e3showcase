import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../dist/_worker.js';
import { database } from './local-db.mjs';

const temp = await mkdtemp(join(tmpdir(), 'e3showcase-test-'));
const path = join(temp, 'visitors.sqlite');
let {db, sqlite} = database(path);
const env = {DB: db, VIEWER_PASSWORD: 'e3open', ADMIN_PASSWORD: 'owner-test-only', SESSION_SECRET: 'test-session-secret-of-at-least-32-characters'};
const origin = 'https://e3.example';
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function request(path, options = {}, cf) {
  const req = new Request(origin + path, options);
  if (cf) Object.defineProperty(req, 'cf', {value: cf});
  return worker.fetch(req, env, {});
}
function login(data, headers = {}, cf) {
  return request('/api/login', {method: 'POST', headers: {origin, 'content-type':'application/x-www-form-urlencoded', ...headers}, body: new URLSearchParams(data)}, cf);
}
const fields = {name:'Jane Investor', password: 'e3open'};
try {
  let r = await request('/');
  const gate = await r.text();
  check(r.headers.get('referrer-policy') === 'same-origin', 'Login gate preserves same-origin form Origin headers for native browser submissions');
  const opaque = await login(fields, {origin:'null'});
  check(opaque.status === 403 && !opaque.headers.get('set-cookie'), 'Opaque Origin is still rejected rather than allowlisted');
  check((await request('/admin')).headers.get('referrer-policy') === 'same-origin', 'Administrator form has the same browser-compatible referrer policy');
  check(!gate.includes('name="email"') && !gate.includes('name="organization"') && gate.includes('name="name"'), 'Gate asks only for name and password');
  for (const name of ['', '   ', '\u0000']) {
    r = await login({...fields, name}, {'cf-connecting-ip':'192.0.2.10'});
    check(r.status === 303 && !r.headers.get('set-cookie'), 'Missing, whitespace and control-only names rejected');
  }
  r = await login({...fields, password:'incorrect'}, {'cf-connecting-ip':'192.0.2.10'});
  check(!r.headers.get('set-cookie'), 'Wrong shared password rejected');
  check((await db.prepare('SELECT count(*) AS n FROM visits').first()).n === 0, 'Failed logins do not create visitor records');
  r = await login(fields, {'cf-connecting-ip':'203.0.113.42', 'x-forwarded-for':'1.2.3.4'}, {country:'AU', region:'Victoria', city:'Melbourne', timezone:'Australia/Melbourne'});
  check(r.status === 303 && r.headers.get('set-cookie'), 'Name and e3open alone allow login');
  const viewer = r.headers.get('set-cookie').split(';')[0];
  let visit = await db.prepare('SELECT * FROM visits WHERE name=?').bind(fields.name).first();
  check(visit.ip_address === '203.0.113.42' && visit.city === 'Melbourne' && visit.region === 'Victoria' && visit.country === 'AU' && visit.timezone === 'Australia/Melbourne', 'Cloudflare IP and geolocation persist together');
  check(visit.email === '' && visit.organization === '' && !!visit.started_at, 'Name-only login stores timestamp without mandatory email or organisation');
  for (const path of ['/report.html','/gate.html','/worker/assets.js','/server/index.js','/_worker.js','/.env','/drizzle/0000_access_log.sql']) {
    check((await request(path)).status === 404, 'Source file path is not public: ' + path);
  }
  check((await request('/api/logs.csv', {headers:{cookie:viewer}})).status === 403, 'Shared password cannot export visitor IPs');
  r = await login({name:'Owner', role:'admin', password:env.ADMIN_PASSWORD});
  const owner = r.headers.get('set-cookie').split(';')[0];
  r = await request('/api/logs', {headers:{cookie:owner}});
  const logs = await r.json();
  check(logs.total === 1 && logs.unique === 1 && logs.rows[0].ip_address === '203.0.113.42', 'Admin can view IP and declared-name counts');
  const csv = await (await request('/api/logs.csv', {headers:{cookie:owner}})).text();
  check(csv.includes('IP address') && csv.includes('203.0.113.42') && csv.includes('Melbourne') && csv.includes('Victoria'), 'CSV exports IP, country, region and city');
  r = await login({name:'Unknown location', password:'e3open'});
  check(!!r.headers.get('set-cookie'), 'Missing geolocation does not prevent login');
  visit = await db.prepare('SELECT * FROM visits WHERE name=?').bind('Unknown location').first();
  check(visit.ip_address === 'unknown' && visit.city === '', 'Unavailable location is stored without fabricated values');
  r = await login({name:'IPv6 visitor', password:'e3open'}, {'cf-connecting-ip':'240.0.0.1','cf-connecting-ipv6':'2001:db8::5'});
  check(!!r.headers.get('set-cookie') && (await db.prepare('SELECT ip_address FROM visits WHERE name=?').bind('IPv6 visitor').first()).ip_address === '2001:db8::5', 'Original IPv6 retained when Pseudo IPv4 is enabled');
  sqlite.close();
  ({db, sqlite} = database(path));
  check((await db.prepare("SELECT * FROM visits WHERE name='Jane Investor'").first()).ip_address === '203.0.113.42', 'Records survive database reopen and migrations are idempotent');
  const legacyPath = join(temp, 'legacy.sqlite');
  const legacy = new DatabaseSync(legacyPath);
  legacy.exec(await readFile(new URL('../drizzle/0000_access_log.sql', import.meta.url),'utf8'));
  legacy.exec("INSERT INTO visits VALUES ('legacy','','Existing viewer','','viewer','2026-01-01','2026-01-01',0)");
  legacy.close();
  const upgraded = database(legacyPath);
  check((await upgraded.db.prepare("SELECT * FROM visits WHERE id='legacy'").first()).ip_address === '', 'Migration preserves existing records');
  upgraded.sqlite.close();
  const badEnv = {...env, ADMIN_PASSWORD: 'e3open'};
  check((await worker.fetch(new Request(origin),badEnv,{})).status === 503, 'Shared visitor and admin passwords fail closed');
  const missingDB = {...env, DB:undefined};
  check((await worker.fetch(new Request(origin),missingDB,{})).status === 503, 'Missing database fails closed');
  console.log(checks + ' login, location, access-control and persistence checks passed.');
} finally {
  sqlite.close();
  await rm(temp, {recursive:true,force:true});
}
