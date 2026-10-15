import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/_worker.js");
const manifestPath = resolve(projectRoot, "dist/_routes.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
assert.deepEqual(JSON.parse(manifest), {version: 1, include: ['/*'], exclude: []});
const { readdir } = await import('node:fs/promises');
assert.deepEqual((await readdir(resolve(projectRoot, 'dist'))).sort(), ['_routes.json', '_worker.js', 'index.html']);
const fallback = await readFile(resolve(projectRoot, 'dist/index.html'), 'utf8');
assert.ok(!fallback.includes('101,568.70'));

// A data URL forces ESM parsing even though the generated output has no package.json.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);

const workersConfig = JSON.parse(await readFile(resolve(projectRoot, 'wrangler.json'), 'utf8'));
assert.equal(workersConfig.main, 'dist/_worker.js');
assert.equal(workersConfig.assets, undefined, 'Protected Worker code must never be published as static assets');
assert.equal(workersConfig.keep_vars, true);
console.log("Artifact exports default.fetch; Workers deploys it as server code without public static assets");
