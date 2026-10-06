#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const originError = 'Use the actual HTTPS origin assigned to the DigitalOcean app, without credentials, a port, path, query, or fragment.';

export function normalizeCloudOrigin(value) {
  if (typeof value !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ondigitalocean\.app\/?$/i.test(value)) {
    throw new Error(originError);
  }
  return new URL(value).origin;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function responseHeaders(rule) {
  if (!hasOnlyKeys(rule, ['source', 'headers']) || !Array.isArray(rule.headers) || !rule.headers.length) {
    throw new Error('Unexpected header rule; review it before converting Vercel routing.');
  }
  const names = new Set();
  const pairs = rule.headers.map((header) => {
    if (!hasOnlyKeys(header, ['key', 'value']) || typeof header.key !== 'string'
      || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(header.key)
      || typeof header.value !== 'string' || /[\r\n\0]/.test(header.value)
      || names.has(header.key.toLowerCase())) {
      throw new Error('Unexpected or duplicate response header; no configuration was changed.');
    }
    names.add(header.key.toLowerCase());
    return [header.key, header.value];
  });
  return Object.fromEntries(pairs);
}

/** Convert only the reviewed Fieldwork SPA routing shape. This does not deploy. */
export function configureCloudRouting(config, rawOrigin) {
  const origin = normalizeCloudOrigin(rawOrigin);
  if (!isObject(config)) throw new Error('The Vercel configuration must be a JSON object.');
  for (const key of ['routes', 'redirects', 'cleanUrls', 'trailingSlash']) {
    if (Object.hasOwn(config, key)) {
      throw new Error(`Existing ${key} require a routing review; no configuration was changed.`);
    }
  }
  if (!Array.isArray(config.rewrites) || config.rewrites.length !== 1
    || !hasOnlyKeys(config.rewrites[0], ['source', 'destination'])
    || config.rewrites[0].source !== '/(.*)' || config.rewrites[0].destination !== '/index.html') {
    throw new Error('Unexpected rewrites; this converter only accepts the reviewed /index.html SPA fallback.');
  }
  if (!Array.isArray(config.headers) || config.headers.length !== 2) {
    throw new Error('Expected the reviewed global security and /assets response header rules.');
  }
  const global = config.headers.find((rule) => rule?.source === '/(.*)');
  const assets = config.headers.find((rule) => rule?.source === '/assets/(.*)');
  if (!global || !assets) throw new Error('Unexpected header sources; review them before converting Vercel routing.');

  const result = { ...config };
  delete result.headers;
  delete result.rewrites;
  result.routes = [
    { src: '^/(.*)$', headers: responseHeaders(global), continue: true },
    { src: '^/assets/(.*)$', headers: responseHeaders(assets), continue: true },
    {
      src: '^/api/cloud(?:/(.*))?$',
      dest: `${origin}/api/cloud/$1`,
      headers: {
        'Cache-Control': 'private, no-store',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        'x-vercel-enable-rewrite-caching': '0',
      },
      // Vercel replaces any client-supplied value. Configure the same encrypted
      // FIELDWORK_ORIGIN_SECRET on Vercel and DigitalOcean before deployment.
      // https://vercel.com/docs/routing/rewrites#restricting-your-origin-to-vercel-traffic
      transforms: [{
        type: 'request.headers',
        op: 'set',
        target: { key: 'x-fieldwork-origin-secret' },
        args: '$FIELDWORK_ORIGIN_SECRET',
        env: ['FIELDWORK_ORIGIN_SECRET'],
      }],
    },
    { handle: 'filesystem' },
    // Existing Vercel functions resolve at the filesystem step. Unknown API
    // routes must fail instead of returning the SPA's HTML with a success code.
    { src: '^/api(?:/.*)?$', status: 404, headers: { 'Cache-Control': 'no-store' } },
    { src: '^/(.*)$', dest: '/index.html' },
  ];
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log('Usage: node scripts/configure-cloud-routing.mjs <actual-DigitalOcean-HTTPS-origin> [--write]');
    console.log('Without --write, prints the proposed configuration. Does not deploy or create resources.');
    console.log('Before deployment, configure matching encrypted FIELDWORK_ORIGIN_SECRET values on Vercel and DigitalOcean.');
    return;
  }
  if (args.length > 2 || (args.length === 2 && args[1] !== '--write')) {
    throw new Error('Expected an actual DigitalOcean origin followed only by the optional --write flag.');
  }
  const configPath = new URL('../vercel.json', import.meta.url);
  const original = await readFile(configPath, 'utf8');
  const proposed = `${JSON.stringify(configureCloudRouting(JSON.parse(original), args[0]), null, 2)}\n`;
  if (args[1] !== '--write') {
    process.stdout.write(proposed);
    return;
  }
  // Avoid overwriting edits made while this command was validating the file.
  if (await readFile(configPath, 'utf8') !== original) throw new Error('vercel.json changed during validation; rerun after reviewing it.');
  await writeFile(configPath, proposed, 'utf8');
  console.log('Updated vercel.json. Review the diff and configure the matching encrypted origin secret before deployment.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Could not configure cloud routing.');
    process.exitCode = 1;
  });
}
