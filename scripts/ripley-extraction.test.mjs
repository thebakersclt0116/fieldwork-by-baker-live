import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'fieldwork-ripley-extraction-'));
after(() => rm(directory, { recursive: true, force: true }));
const dependencyMocks = {
  name: 'isolated-ripley-dependencies',
  setup(builder) {
    builder.onResolve({ filter: /^unpdf$/ }, () => ({ path: 'pdf', namespace: 'ripley-test' }));
    builder.onResolve({ filter: /(?:^|\/)_auth\.js$/ }, () => ({ path: 'auth', namespace: 'ripley-test' }));
    builder.onResolve({ filter: /import-fieldwork-general\.js$/ }, () => ({ path: 'general', namespace: 'ripley-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'ripley-test' }, ({ path }) => ({
      loader: 'js',
      contents: path === 'pdf' ? `
        export const getDocumentProxy = (...args) => globalThis.__ripleyExtraction.document(...args);
        export const extractText = (...args) => globalThis.__ripleyExtraction.text(...args);
        export const extractTextItems = (...args) => globalThis.__ripleyExtraction.items(...args);
      ` : path === 'auth' ? `
        export const requireAccountSession = async () => ({ role: 'paid' });
        export const canUsePaidTools = () => true;
      ` : `
        export default function handler(req, res) {
          globalThis.__ripleyExtraction.delegations.push({ ...req.body });
          return res.status(200).send(JSON.stringify({ delegated: true }));
        }
      `,
    }));
  },
};
await build({
  entryPoints: ['server/import-fieldwork-ripley.ts'], outdir: directory,
  bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' },
  plugins: [dependencyMocks],
});
const { default: handler } = await import(pathToFileURL(join(directory, 'import-fieldwork-ripley.mjs')));
const fileData = Buffer.from('%PDF-1.7\nSynthetic fixture only.\n').toString('base64');

async function exercise({ pageCount = 1, extractionError = false, timeout = false } = {}) {
  const original = {
    state: globalThis.__ripleyExtraction,
    fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    info: console.info, warn: console.warn,
  };
  const state = {
    textCalls: 0, itemCalls: 0, destroyed: 0, networkCalls: 0,
    delegations: [], timeoutDelays: [], clearedTimers: 0,
  };
  const pdf = { numPages: pageCount, loadingTask: { async destroy() { state.destroyed++; } } };
  state.document = async (bytes, options) => {
    assert.equal(Buffer.from(bytes).toString(), '%PDF-1.7\nSynthetic fixture only.\n');
    assert.equal(options.maxImageSize, 16_777_216);
    return pdf;
  };
  state.text = async (document, options) => {
    state.textCalls++;
    assert.equal(document, pdf); assert.deepEqual(options, { mergePages: true });
    if (extractionError) throw new Error('SYNTHETIC_EXTRACTION_FAILURE');
    if (timeout) return new Promise(() => {});
    return { totalPages: pageCount, text: '\u0000  Synthetic merged page one.\n\nSynthetic page two.  \u0000' };
  };
  state.items = async document => {
    state.itemCalls++; assert.equal(document, pdf);
    return { totalPages: pageCount, items: [[
      { str: ' Layout second ', x: 0, y: 10, fontSize: 8 },
      { str: ' Layout first ', x: 0, y: 30, fontSize: 8 },
    ]] };
  };
  const timers = new Set();
  globalThis.__ripleyExtraction = state;
  globalThis.fetch = async () => { state.networkCalls++; throw new Error('NETWORK_FORBIDDEN_IN_EXTRACTION_TEST'); };
  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = original.setTimeout(callback, timeout && delay === 12_000 ? 0 : delay, ...args);
    if (delay === 12_000) { state.timeoutDelays.push(delay); timers.add(timer); }
    return timer;
  };
  globalThis.clearTimeout = timer => {
    if (timers.delete(timer)) state.clearedTimers++;
    return original.clearTimeout(timer);
  };
  console.info = () => {}; console.warn = () => {};
  const response = { code: 0, body: null,
    status(code) { this.code = code; return this; },
    setHeader() { return this; },
    send(body) { this.body = JSON.parse(body); return this; },
  };
  try {
    await handler({ method: 'POST', headers: {}, body: {
      fileName: 'synthetic-not-a-monthly-form.pdf', mimeType: 'application/pdf', fileData,
    } }, response);
    assert.equal(state.networkCalls, 0);
    assert.equal(response.code, 200); assert.deepEqual(response.body, { delegated: true });
    assert.equal(state.delegations.length, 1);
    return state;
  } finally {
    for (const timer of timers) original.clearTimeout(timer);
    if (original.state === undefined) delete globalThis.__ripleyExtraction;
    else globalThis.__ripleyExtraction = original.state;
    globalThis.fetch = original.fetch;
    globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout;
    console.info = original.info; console.warn = original.warn;
  }
}

test('merged-string extraction preserves normalization and positioned text before delegating, then destroys its document once', async () => {
  const state = await exercise();
  assert.equal(state.delegations[0].rawText, 'Layout first\nLayout second\n\nSynthetic merged page one.\n\nSynthetic page two.');
  assert.equal(state.delegations[0].fileData, '');
  assert.equal(state.textCalls, 1); assert.equal(state.itemCalls, 1);
  assert.equal(state.destroyed, 1); assert.deepEqual(state.timeoutDelays, [12_000]);
  assert.equal(state.clearedTimers, 1);
});

test('extraction rejection destroys the document once and delegates the unchanged original PDF', async () => {
  const state = await exercise({ extractionError: true });
  assert.equal(state.destroyed, 1); assert.equal(state.clearedTimers, 1);
  assert.equal(state.delegations[0].fileData, fileData);
  assert.equal(state.delegations[0].rawText, undefined);
});

test('page-limit rejection destroys the document once without attempting either extractor', async () => {
  const state = await exercise({ pageCount: 26 });
  assert.equal(state.destroyed, 1); assert.equal(state.textCalls, 0); assert.equal(state.itemCalls, 0);
  assert.deepEqual(state.timeoutDelays, []);
  assert.equal(state.delegations[0].fileData, fileData); assert.equal(state.delegations[0].rawText, undefined);
});

test('the bounded extraction timeout destroys the document once, clears its timer and delegates the original PDF', async () => {
  const state = await exercise({ timeout: true });
  assert.deepEqual(state.timeoutDelays, [12_000]); assert.equal(state.clearedTimers, 1);
  assert.equal(state.destroyed, 1); assert.equal(state.textCalls, 1); assert.equal(state.itemCalls, 1);
  assert.equal(state.delegations[0].fileData, fileData); assert.equal(state.delegations[0].rawText, undefined);
});
