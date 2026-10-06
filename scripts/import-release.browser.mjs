import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const live = Boolean(process.env.BAKER_TEST_ORIGIN);
let owner;
const record = { 'Entry ID': 'qa-release-session', Date: '2026-09-12', 'Start time': '08:30', 'End time': '10:15', 'Total hours': '1.70', 'Activity category': 'Unrestricted', 'Fieldwork type': 'Supervised Fieldwork', Organization: 'Synthetic Organization', Supervisor: 'Synthetic Supervisor', 'Description of activity': 'Original full narrative with original source evidence.', 'Hour type': 'Independent', 'Observation minutes': '25', 'Supervision minutes': '0', 'Individual supervision minutes': '0' };
test.beforeEach(async ({ page, request }) => {
  owner = `baker-release-qa-${randomUUID()}@example.com`;
  let user, token;
  if (live) {
    const response = await request.post('/api/free-signup', { data: { name: 'Baker Release QA', email: owner, password: randomUUID() + randomUUID() } });
    expect(response.ok()).toBeTruthy(); const payload = await response.json(); user = { ...payload.user, initials: 'QA', subscription: 'none' }; token = payload.token;
  } else {
    user = { name: 'Synthetic Candidate', email: owner, role: 'free', initials: 'QA', subscription: 'none', trialEndsAt: Math.floor(Date.now() / 1000) + 86400 };
    token = 'local-isolated-fixture-not-valid-on-production';
    await page.route('**/api/health*', route => route.fulfill({ json: { stripeMode: 'test', stripeCheckoutConfigured: true } }));
  }
  await page.addInitScript(({ user, token }) => { localStorage.setItem('authUser', JSON.stringify(user)); localStorage.setItem('bakerSessionToken', token); localStorage.setItem('theme', 'dark'); }, { user, token });
  await page.goto('/import'); await expect(page.getByRole('heading', { name: 'Every entry. The original details. A record you can keep.' })).toBeVisible();
});
const readRecords = (page) => page.evaluate(email => JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`) || '[]'), owner);
async function load(page, entries = [record]) {
  await page.locator('input[type=file][accept]').setInputFiles({ name: 'synthetic-source.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ entries })) });
  await page.getByRole('button', { name: 'Build entry-by-entry review' }).click();
  await expect(page.getByRole('heading', { name: '3. Review & reconcile before adding hours' })).toBeVisible();
}
async function commit(page) {
  await page.getByLabel('I reviewed the source rows, scope, flags and totals.', { exact: false }).check();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Import selected entries', exact: true }).click();
}
test('a completed save keeps its confirmation visible; navigation is usable on desktop and mobile', async ({ page }) => {
  await load(page); await commit(page);
  await expect(page.getByRole('status')).toContainText('Saved and read-back verified 1 allocations');
  await expect.poll(async () => (await readRecords(page)).length).toBe(1);
  await page.getByRole('link', { name: 'Jump to individual entries' }).click();
  await expect(page.getByRole('heading', { name: 'Entry-by-entry audit ledger' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await fs.mkdir('audit-test-artifacts', { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'audit-test-artifacts/final-import-mobile-dark.png', fullPage: true });
});
test('invalid source rows block a complete import until a partial import is explicitly requested', async ({ page }) => {
  await load(page, [record, { ...record, 'Entry ID': 'invalid', Date: '2026-02-30' }]);
  await page.getByLabel('I reviewed the source rows, scope, flags and totals.', { exact: false }).check();
  await expect(page.getByRole('button', { name: 'Import selected entries', exact: true })).toBeDisabled();
  await expect(page.getByRole('note')).toContainText('Complete-file mode');
  await page.getByLabel('Intentionally import only the selected valid sessions.', { exact: false }).check();
  await commit(page); await expect.poll(async () => (await readRecords(page)).length).toBe(1);
  await page.locator('summary').filter({ hasText: '2 original rows' }).click();
  await expect(page.locator('p').filter({ hasText: 'EXPLICIT PARTIAL IMPORT.' }).first()).toBeVisible();
});
test('selecting an allocation selects or deselects the whole original session', async ({ page }) => {
  await load(page, [{ ...record, 'Total hours': '1.75', 'Activity category': '', 'Restricted hours': '0.75', 'Unrestricted hours': '1', 'Observation minutes': '0' }]);
  const row = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Source row 2' }) });
  await row.locator('summary').first().click();
  const boxes = row.getByRole('checkbox'); await expect(boxes).toHaveCount(2);
  await boxes.nth(0).uncheck(); await expect(boxes.nth(1)).not.toBeChecked();
  await boxes.nth(1).check(); await expect(boxes.nth(0)).toBeChecked();
  await commit(page); await expect.poll(async () => (await readRecords(page)).length).toBe(2);
});
test('narrative-only edits preserve original duration, independent observations and every original source field', async ({ page }) => {
  await load(page); await commit(page); await expect.poll(async () => (await readRecords(page)).length).toBe(1);
  const before = (await readRecords(page))[0];
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit tracked hours', exact: true }).click();
  await page.locator('aside').getByRole('button').filter({ hasText: '2026-09-12' }).click();
  await page.getByLabel('Activity description', { exact: false }).fill('User corrected the narrative while leaving source evidence unchanged.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(async () => (await readRecords(page))[0].notes).toBe('User corrected the narrative while leaving source evidence unchanged.');
  const after = (await readRecords(page))[0];
  expect(after.duration).toBe(1.70); expect(after.observationMinutes).toBe(25); expect(after.supervisionMinutes).toBe(0); expect(after.workPresence).toBe('INDEPENDENT');
  expect(after.migration).toEqual(before.migration); expect(after.revisionHistory[0].snapshot.notes).toBe(record['Description of activity']);
  expect(after.revisionHistory[0].snapshot.individualSupervisionMinutes).toBe(0); expect(after.status).toBe('PENDING');
});
test('multiple files preserve original identities and do not duplicate previously imported source IDs', async ({ page }) => {
  const second = { ...record, 'Entry ID': 'qa-release-second', Date: '2026-09-13' };
  await page.locator('input[type=file][accept]').setInputFiles([record, second].map((entry, i) => ({ name: `month-${i}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ entries: [entry] })) })));
  await page.getByRole('button', { name: 'Build entry-by-entry review' }).click(); await commit(page);
  await expect.poll(async () => (await readRecords(page)).length).toBe(2);
  const entries = await readRecords(page); expect(entries.map(e => e.migration.sourceFile).sort()).toEqual(['month-0.json', 'month-1.json']);
  await load(page, [record]);
  await expect(page.getByText('Exact duplicates: 1.', { exact: false })).toBeVisible();
});
test('simulated storage exhaustion never reports success or destroys prior tracked records', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.endsWith(':entries')) throw new DOMException('Synthetic storage quota exhausted', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await commit(page);
  await expect(page.getByRole('status')).toContainText('storage quota exhausted');
  expect(await readRecords(page)).toEqual([]);
  await expect(page.getByText('synthetic-source.json', { exact: true })).toBeVisible();
});
test('explicit monthly-summary data cannot be imported as fabricated individual sessions', async ({ page }) => {
  await load(page, [{ ...record, summaryDerived: true }]);
  await page.locator('summary').filter({ hasText: 'Source row 2' }).click();
  await expect(page.getByText('This source row is explicitly a monthly summary', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import selected entries', exact: true })).toBeDisabled();
  expect(await readRecords(page)).toEqual([]);
});
