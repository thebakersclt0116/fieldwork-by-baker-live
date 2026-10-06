import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const live = Boolean(process.env.BAKER_TEST_ORIGIN);
const fixtureEmail = 'audit-ui-fixture@example.com';
const csv = 'Entry ID,Date,Start time,End time,Total hours,Activity category,Fieldwork type,Organization,Supervisor,Description of activity,Notes,Hour type,Supervision format,Supervision minutes,Observation minutes,Status,Custom evidence\r\nentry-a,2026-09-12,08:30,10:15,1.75,Unrestricted,Supervised Fieldwork,Sample Organization,Sample Supervisor,"Analyzed sample data, with a comma.\nSecond narrative line.",Full supplementary note,Independent,,0,0,Approved,EXACT CUSTOM EVIDENCE\r\nentry-b,2026-09-13,08:30,08:55,0.42,Restricted,Supervised Fieldwork,Sample Organization,Sample Supervisor,Observed a simulated activity,Original context,Supervised,Individual,25,25,Pending,Keep this too';
const oneCsv = csv.split('\r\n').slice(0, 2).join('\r\n');
let testOwner = fixtureEmail;
test.beforeEach(async ({ page, request }) => {
  let user, token;
  if (live) {
    testOwner = `baker-migration-qa-${randomUUID()}@example.com`;
    // A real public signup issues a normal server-signed 3-day trial. No access bypass, owner/Emily impersonation or secret probes.
    const response = await request.post('/api/free-signup', { data: { name: 'Baker Migration QA', email: testOwner, password: randomUUID() + randomUUID() } });
    expect(response.ok(), 'Normal trial signup must succeed; live test does not bypass authentication').toBeTruthy();
    const payload = await response.json(); user = { ...payload.user, initials: 'QA', subscription: 'none' }; token = payload.token;
    expect(typeof token).toBe('string');
  } else {
    testOwner = fixtureEmail;
    user = { name: 'Sample Candidate', email: testOwner, initials: 'SC', role: 'free', subscription: 'none', trialEndsAt: Math.floor(Date.now() / 1000) + 86400 };
    token = 'isolated-ui-fixture-not-a-production-session';
    await page.route('**/api/health*', route => route.fulfill({ json: { aiGatewayAuthAvailable: true, secureSessionSigningAvailable: true, stripeMode: 'test', stripeCheckoutConfigured: true } }));
  }
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('authUser', JSON.stringify(user)); localStorage.setItem('bakerSessionToken', token); localStorage.setItem('theme', 'dark');
  }, { user, token });
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Every entry. The original details. A record you can keep.' })).toBeVisible();
});
async function upload(page, contents = csv) {
  await page.locator('input[type=file][accept]').setInputFiles({ name: 'synthetic-detailed-export.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) });
  await expect(page.getByRole('button', { name: 'Build entry-by-entry review' })).toBeEnabled();
  await page.getByRole('button', { name: 'Build entry-by-entry review' }).click();
  await expect(page.getByRole('heading', { name: '3. Review & reconcile before adding hours' })).toBeVisible();
}
async function approveImport(page) {
  await page.getByLabel('I reviewed the source rows, scope, flags and totals.', { exact: false }).check();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Import selected entries', exact: true }).click();
}
test('full source import, signed normal trial on live, audit ledger and exact original ZIP recovery', async ({ page }) => {
  await upload(page);
  await page.locator('summary').filter({ hasText: 'Source row 2' }).click();
  await expect(page.locator('p').filter({ hasText: 'Full supplementary note' }).first()).toBeVisible();
  await approveImport(page);
  await expect.poll(async () => page.evaluate(email => JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`) || '[]').length, testOwner)).toBe(2);
  await page.goto('/audit-history');
  await expect(page.getByRole('heading', { name: 'Entry-by-entry audit ledger' })).toBeVisible();
  const entrySummary = page.locator('summary').filter({ hasText: '2026-09-12 · 1.75 h' });
  await entrySummary.click();
  await expect(page.locator('p').filter({ hasText: 'Full supplementary note' }).first()).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: '2026-09-12 · 1.75 h' })).toContainText('PENDING');
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download full audit ZIP' }).click();
  const zip = await zipPromise, bytes = await fs.readFile(await zip.path());
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  expect(bytes.includes(Buffer.from(csv))).toBeTruthy();
  expect(bytes.includes(Buffer.from('entry-ledger.html'))).toBeTruthy();
  expect(bytes.includes(Buffer.from('manifest.json'))).toBeTruthy();
  expect(bytes.includes(Buffer.from('EXACT CUSTOM EVIDENCE'))).toBeTruthy();
  await fs.mkdir('audit-test-artifacts', { recursive: true });
  await zip.saveAs('audit-test-artifacts/synthetic-audit-example.zip');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'audit-test-artifacts/audit-ledger-mobile-dark.png', fullPage: true });
  await page.goto('/import'); await upload(page);
  await expect(page.getByText('Exact duplicates: 2.', { exact: false })).toBeVisible();
  await page.getByLabel('I reviewed the source rows, scope, flags and totals.', { exact: false }).check();
  await expect(page.getByRole('button', { name: 'Import selected entries', exact: true })).toBeDisabled();
});
test('monthly replacement requires exact reconciliation and archives the old record', async ({ page }) => {
  await page.evaluate(email => localStorage.setItem(`fieldworkByBaker:v1:${email}:entries`, JSON.stringify([{ id: 'old-summary', userId: email, date: '2026-09-01', startTime: '', endTime: '', duration: 1.75, fieldworkType: 'SUPERVISED', activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN', supervisorId: 's', supervisorName: 'Sample Supervisor', organizationName: 'Sample Organization', setting: '', notes: 'Monthly aggregate', aiRationale: 'Monthly aggregate', status: 'PENDING', createdAt: '2026-09-01', updatedAt: '2026-09-01' }])), testOwner);
  await page.reload(); await upload(page, oneCsv);
  await expect(page.getByRole('heading', { name: 'Double-counting protection' })).toBeVisible();
  await page.getByLabel('Preserve these summaries in the audit journal', { exact: false }).check(); await approveImport(page);
  await expect.poll(async () => page.evaluate(email => JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`) || '[]').some(e => e.id === 'old-summary'), testOwner)).toBe(false);
  await page.goto('/audit-history');
  await expect(page.locator('summary').filter({ hasText: '1 original rows' })).toBeVisible();
});
test('partial source cannot replace an unmatched monthly total', async ({ page }) => {
  await page.evaluate(email => localStorage.setItem(`fieldworkByBaker:v1:${email}:entries`, JSON.stringify([{ id: 'old-summary', userId: email, date: '2026-09-01', startTime: '', endTime: '', duration: 70.42, fieldworkType: 'SUPERVISED', activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNKNOWN', supervisorId: 's', supervisorName: 'Sample Supervisor', organizationName: 'Sample Organization', setting: '', notes: 'Monthly aggregate', aiRationale: 'Monthly aggregate', status: 'PENDING', createdAt: '2026-09-01', updatedAt: '2026-09-01' }])), testOwner);
  await page.reload(); await upload(page, oneCsv);
  await page.getByLabel('Preserve these summaries in the audit journal', { exact: false }).check(); await approveImport(page);
  await expect(page.getByRole('status')).toContainText('does not reconcile');
  const data = await page.evaluate(email => JSON.parse(localStorage.getItem(`fieldworkByBaker:v1:${email}:entries`) || '[]'), testOwner);
  expect(data.length).toBe(1); expect(data[0].duration).toBe(70.42);
});
test('the extension reads details but never secret controls, save buttons, delete or foreign links', async ({ page }) => {
  test.skip(live, 'DOM fixture test is isolated, never replaces a live user page.');
  await page.setContent('<main><a href="/hours/123/edit">Edit hour</a><a href="/hours/123/delete">Delete</a><a href="/profile/edit">Edit profile</a><a href="https://invalid.example/hours/456/edit">Edit</a><a href="/hours/456/edit?token=private">Edit</a><form><label>Date<input name="date" value="2026-09-12"></label><label>Start time<input name="start" value="08:30"></label><label>End time<input name="end" value="10:15"></label><label>Description of activity<textarea>Full original description\nSecond line.</textarea></label><label>Unrestricted<input name="unrestricted" placeholder="1.75" value=""></label><input type="hidden" name="csrf" value="SECRET_MUST_NOT_APPEAR"><input type="password" value="PRIVATE_PASSWORD"><button type="submit">Save</button></form></main>');
  const result = await page.evaluate(async () => {
    const mod = await import('/audit-bridge/background.js');
    let submissions = 0; document.querySelector('form').addEventListener('submit', e => { e.preventDefault(); submissions++; });
    return { scan: mod.scanHistoryDocument(), detail: mod.readDetailDocument(), submissions };
  });
  expect(result.scan.links.length).toBe(1); expect(result.detail.ok).toBeTruthy(); expect(result.submissions).toBe(0);
  expect(result.detail.record['Description of activity']).toContain('Second line.');
  expect(result.detail.record.Unrestricted).toBe('1.75');
  expect(result.detail.record.__originalControls.find(c => c.name === 'unrestricted').usedPlaceholder).toBe(true);
  expect(JSON.stringify(result)).not.toContain('SECRET_MUST_NOT_APPEAR'); expect(JSON.stringify(result)).not.toContain('PRIVATE_PASSWORD');
});
