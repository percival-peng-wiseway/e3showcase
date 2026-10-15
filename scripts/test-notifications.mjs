import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
import { database } from './local-db.mjs';

const {db, sqlite} = database(':memory:');
const originalFetch = globalThis.fetch;
const env = {DB:db, VIEWER_PASSWORD:'e3open', ADMIN_PASSWORD:'test-owner-only',
  SESSION_SECRET:'test-session-secret-with-more-than-32-characters',
  RESEND_API_KEY:'test-key-not-a-real-credential', LOGIN_NOTIFICATION_FROM:'E3 <alerts@example.test>'};
const origin = 'https://e3.example';
const queued = [];
const calls = [];
let responder = async () => Response.json({id:'test-provider-id'});
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
const ctx = {waitUntil(promise) { queued.push(promise); }};
async function flush() { await Promise.all(queued.splice(0)); }
async function login(fields = {}, runtime = env) {
  const request = new Request(origin + '/api/login', {method:'POST',
    headers:{origin,'cf-connecting-ip':'203.0.113.10'},
    body:new URLSearchParams({name:'Mail Test Visitor',password:'e3open',...fields})});
  Object.defineProperty(request,'cf',{value:{country:'AU',region:'Victoria',city:'Melbourne',timezone:'Australia/Melbourne'}});
  return worker.fetch(request,runtime,ctx);
}
async function latest(name = 'Mail Test Visitor') {
  return db.prepare('SELECT * FROM visits WHERE name=? ORDER BY rowid DESC LIMIT 1').bind(name).first();
}
globalThis.fetch = async (url, options) => {
  const call = {url, options, payload:JSON.parse(options.body)};
  calls.push(call);
  return responder(call);
};
try {
  let response = await login();
  await flush();
  check(response.status === 303 && response.headers.get('set-cookie') && calls.length === 1, 'Successful visitor login queues one email');
  check(calls[0].url === 'https://api.resend.com/emails' && calls[0].options.headers.authorization === 'Bearer ' + env.RESEND_API_KEY, 'Authenticated server-side Resend request');
  check(calls[0].payload.to[0] === 'percival@wiseway.ai' && calls[0].payload.to.length === 1, 'Notification uses the requested fixed recipient');
  check(calls[0].payload.cc?.length === 1 && calls[0].payload.cc[0] === 'jerry@e3energy.com.au', 'Notification copies only the confirmed CC recipient');
  const text = calls[0].payload.text;
  check(text.includes('Mail Test Visitor') && text.includes('203.0.113.10') && text.includes('Melbourne, Victoria, AU') && text.includes('Australia/Melbourne') && text.includes('(UTC)'), 'Email includes name, IP, location and timestamp in local time and UTC');
  check(!JSON.stringify(calls[0].payload).includes('e3open') && !JSON.stringify(calls[0].payload).includes(env.SESSION_SECRET) && !JSON.stringify(calls[0].payload).includes(env.RESEND_API_KEY), 'Email does not disclose passwords, signing secrets or API keys');
  check((await latest()).notification_status === 'accepted' && (await latest()).notification_email_id === 'test-provider-id', 'Provider acceptance is stored separately from inbox delivery');
  const initial = calls.length;
  await login({password:'wrong'}); await flush();
  await login({name:'Owner',role:'admin',password:env.ADMIN_PASSWORD}); await flush();
  check(calls.length === initial, 'Wrong passwords and admin logins do not send alerts');
  await worker.fetch(new Request(origin),env,ctx); await flush();
  check(calls.length === initial, 'Viewing a page does not send another alert');
  response = await login({name:'No mail configuration'}, {...env, RESEND_API_KEY:''}); await flush();
  check(response.status === 303 && calls.length === initial && (await latest('No mail configuration')).notification_status === 'not_configured', 'Missing email settings preserve login and expose status to the owner');
  response = await login({name:'No sender'}, {...env, LOGIN_NOTIFICATION_FROM:''}); await flush();
  check(response.status === 303 && calls.length === initial, 'Missing sender does not send an invalid provider request');
  let attempts = 0;
  responder = async () => ++attempts === 1 ? new Response('',{status:503}) : Response.json({id:'recovered'});
  await login({name:'Transient failure'}); await flush();
  const retry = calls.slice(-2);
  check(attempts === 2 && retry[0].options.headers['idempotency-key'] === retry[1].options.headers['idempotency-key'] && retry[0].options.body === retry[1].options.body && (await latest('Transient failure')).notification_status === 'accepted', 'Transient provider errors retry the identical payload with the same deduplication key');
  responder = async () => new Response('do not log provider response bodies',{status:403});
  const beforeFailure = calls.length;
  response = await login({name:'Rejected sender'}); await flush();
  check(response.status === 303 && calls.length === beforeFailure + 1 && (await latest('Rejected sender')).notification_error === 'resend_http_403', 'Permanent provider rejection leaves login working and records a safe error code');
  attempts = 0;
  responder = async () => { attempts++; throw Error('Sensitive network error'); };
  response = await login({name:'Network unavailable'}); await flush();
  check(response.status === 303 && attempts === 2 && (await latest('Network unavailable')).notification_status === 'failed', 'Network failures receive only one retry and do not break login');
  let release;
  responder = () => new Promise(resolve => {release = resolve;});
  response = await login({name:'Background notification'});
  check(response.status === 303 && queued.length === 1 && (await latest('Background notification')).notification_status === 'pending', 'Cloudflare returns the login response before the mail provider finishes');
  release(Response.json({id:'background-accepted'})); await flush();
  check((await latest('Background notification')).notification_status === 'accepted', 'Background task updates the stored notification status');
  responder = async () => Response.json({});
  await login({name:'Invalid response'}); await flush();
  check((await latest('Invalid response')).notification_status === 'failed' && (await latest('Invalid response')).notification_error === 'invalid_response', 'Malformed provider success is not reported as accepted');
  responder = async () => Response.json({id:'fixed-recipient'});
  await login({name:'Recipient injection',to:'attacker@example.test',ip_address:'1.2.3.4',city:'Fake City'}); await flush();
  check(calls.at(-1).payload.to[0] === 'percival@wiseway.ai' && !calls.at(-1).payload.text.includes('Fake City') && calls.at(-1).payload.text.includes('203.0.113.10'), 'Visitor form cannot override the recipient or recorded location');
  console.log(checks + ' email notification checks passed (mock provider; no real emails sent).');
} finally {
  globalThis.fetch = originalFetch;
  sqlite.close();
}
