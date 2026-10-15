import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';

// Only the Worker contains protected content. No report or images are public assets.
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [report, fund, gate, adminGate, admin, assets, notifications, runtime] = await Promise.all([
  read('latrobe.html'), read('fund.html'), read('gate.html'), read('admin-gate.html'),
  read('admin.html'), read('worker/assets.js'), read('worker/notifications.js'), read('worker/index.js'),
]);
const errorGate = html => html.replace('<form ', '<div class="error" role="alert">Enter your name and check your password. / 请输入姓名并检查密码。</div><form ');
const pages = { REPORT: report, FUND_PAGE: fund, GATE: gate, GATE_ERROR: errorGate(gate),
  ADMIN_GATE: adminGate, ADMIN_GATE_ERROR: errorGate(adminGate), ADMIN_PAGE: admin };
const declarations = Object.entries(pages).map(([key, value]) => `const ${key}=${JSON.stringify(value)};`).join('\n');
const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(new URL('_worker.js', output), declarations + '\n' + assets + '\n' + notifications + '\n' + runtime);
await writeFile(new URL('_routes.json', output), JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2));
await writeFile(new URL('index.html', output), '<!doctype html><html lang="en"><meta charset="utf-8"><title>E3 Energy</title><p>Server configuration is required. Enable Cloudflare Pages Functions.</p></html>');
console.log('Built Cloudflare Pages Advanced Mode output in dist/');
