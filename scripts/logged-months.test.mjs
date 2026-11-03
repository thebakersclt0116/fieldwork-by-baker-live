import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { entriesForMonth, isTrackedMonth, loggedHoursLabel, loggedMonths } from '../src/lib/loggedMonths.ts';
import { summarizeMonth } from '../src/lib/monthlyProgress.ts';

const entry = (id, date, duration, overrides = {}) => ({
  id, date, duration, userId: 'monthly-history@example.invalid',
  startTime: '09:00', endTime: '10:00', fieldworkType: 'SUPERVISED',
  activityType: 'UNRESTRICTED_OTHER', activityCategory: 'UNRESTRICTED',
  supervisorId: 'fictional-supervisor', supervisorName: 'Fictional Supervisor',
  organizationName: 'Fictional Organization', setting: 'Clinic',
  notes: 'Reviewed de-identified assessment data.', status: 'PENDING',
  createdAt: '2026-10-28T13:00:00.000Z', updatedAt: '2026-10-28T13:00:00.000Z',
  ...overrides,
});

test('historical months sort newest first across years without mixing same-named months', () => {
  const records = [
    entry('old-december', '2025-12-08', 2),
    entry('september', '2026-09-14', 3),
    entry('new-january', '2027-01-02', 4),
    entry('december-late', '2026-12-28', 5),
    entry('december-early', '2026-12-01', 1),
  ];
  const before = structuredClone(records);
  assert.deepEqual(loggedMonths(records).map(({ month, totalHours }) => ({ month, totalHours })), [
    { month: '2027-01', totalHours: 4 },
    { month: '2026-12', totalHours: 6 },
    { month: '2026-09', totalHours: 3 },
    { month: '2025-12', totalHours: 2 },
  ]);
  assert.deepEqual(records, before, 'Reading history must not reorder or modify stored records.');
});

test('first-day and last-day calendar records stay in their saved month in every tested timezone', () => {
  const helperUrl = new URL('../src/lib/loggedMonths.ts', import.meta.url).href;
  const labelsUrl = new URL('../src/lib/monthlyProgress.ts', import.meta.url).href;
  const source = `
    import { loggedMonths } from ${JSON.stringify(helperUrl)};
    import { monthLabel } from ${JSON.stringify(labelsUrl)};
    const records = [
      { id: 'first-day', date: '2026-09-01', startTime: '00:01', duration: 2, status: 'PENDING' },
      { id: 'previous-day', date: '2026-08-31', startTime: '23:30', duration: 0.5, status: 'PENDING' }
    ];
    console.log(JSON.stringify(loggedMonths(records).map(group => ({
      month: group.month, label: monthLabel(group.month),
      ids: group.entries.map(record => record.id), total: group.totalHours
    }))));
  `;
  const expected = [
    { month: '2026-09', label: 'September 2026', ids: ['first-day'], total: 2 },
    { month: '2026-08', label: 'August 2026', ids: ['previous-day'], total: 0.5 },
  ];
  for (const timezone of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', source], {
      env: { ...process.env, TZ: timezone }, encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 0, `${timezone}: ${result.stderr || result.error || 'process failed'}`);
    assert.deepEqual(JSON.parse(result.stdout), expected, timezone);
  }
});

test('a month page contains only its entries, sorted by saved date and time with stable ties', () => {
  const records = [
    entry('september-a', '2026-09-05', 1, { startTime: '08:00' }),
    entry('august', '2026-08-31', 2),
    entry('september-c', '2026-09-30', 3, { startTime: '13:00' }),
    entry('other-year', '2025-09-30', 4),
    entry('september-b', '2026-09-30', 2, { startTime: '13:00' }),
    entry('september-earlier-time', '2026-09-30', 1, { startTime: '09:00' }),
    entry('october', '2026-10-01', 5),
  ];
  assert.deepEqual(entriesForMonth(records, '2026-09').map(record => record.id), [
    'september-b', 'september-c', 'september-earlier-time', 'september-a',
  ]);
  assert.equal(entriesForMonth(records, '2025-09').length, 1);
  assert.deepEqual(entriesForMonth(records, '2026-07'), []);
});

test('malformed month route parameters do not expose an unfiltered entry list', () => {
  const records = [entry('saved', '2026-09-15', 2)];
  for (const value of ['2026-01', '2026-09', '2026-12', '2027-01']) assert.equal(isTrackedMonth(value), true, value);
  for (const value of ['', '2026', '2026-9', '26-09', '2026-00', '2026-13', '2026-09-01', '2026-09/other', '../2026-09', '/dashboard/2026-09', ' 2026-09', '2026-09 ']) {
    assert.equal(isTrackedMonth(value), false, value);
    assert.deepEqual(entriesForMonth(records, value), [], value);
  }
});

test('moving an edited entry into another month recalculates both month summaries', () => {
  const records = [
    entry('moving', '2026-08-31', 2.5),
    entry('august-stays', '2026-08-17', 1.5),
    entry('september-stays', '2026-09-10', 3),
  ];
  assert.deepEqual(loggedMonths(records).map(group => [group.month, group.totalHours]), [
    ['2026-09', 3], ['2026-08', 4],
  ]);
  const revised = records.map(record => record.id === 'moving' ? { ...record, date: '2026-09-01', duration: 4 } : record);
  assert.deepEqual(loggedMonths(revised).map(group => [group.month, group.totalHours]), [
    ['2026-09', 7], ['2026-08', 1.5],
  ]);
  assert.equal(entriesForMonth(revised, '2026-08').some(record => record.id === 'moving'), false);
  assert.equal(entriesForMonth(revised, '2026-09').find(record => record.id === 'moving')?.duration, 4);
});

test('linked allocations contribute their own exact durations and round only the displayed total', () => {
  const sharedSession = { id: 'source-session', sourceEntryId: 'source-session', date: '2026-09-14', startTime: '09:00', endTime: '10:00', duration: 1 };
  const records = ['restricted', 'unrestricted', 'supervised'].map(id => entry(id, '2026-09-14', 1 / 3, {
    startTime: '', endTime: '', allocationSession: sharedSession,
  }));
  const [before] = loggedMonths(records);
  assert.equal(before.totalHours, 1, 'Do not sum the shared one-hour parent three times or round the thirds to 0.33.');
  assert.equal(loggedHoursLabel(before.totalHours), '1');
  const revised = [...records, entry('extra', '2026-09-15', 1 / 3600)];
  const [after] = loggedMonths(revised);
  assert.ok(Math.abs(after.totalHours - (1 + 1 / 3600)) < 1e-12, 'A one-second entry must be retained apart from normal floating-point summation noise.');
  assert.ok(after.totalHours > 1, 'Display rounding must not erase the one-second entry from stored totals.');
  assert.equal(loggedHoursLabel(after.totalHours), '1');
  assert.equal(loggedHoursLabel(1.259), '1.26');
  assert.equal(loggedHoursLabel(120), '120');
});

test('unfinished timers remain visible while monthly logged totals match existing completion rules', () => {
  const records = [
    entry('manual-complete', '2026-09-10', 0.75),
    entry('timer-complete', '2026-09-11', 1.25, { timerSession: { id: 'complete', detailsComplete: true } }),
    entry('draft-timer', '2026-09-12', 1.5, { status: 'DRAFT', timerSession: { id: 'draft', detailsComplete: false } }),
    entry('unfinished-timer', '2026-09-13', 3, { timerSession: { id: 'unfinished', detailsComplete: false } }),
    entry('blank-timer', '2026-09-14', 4, { notes: ' ', timerSession: { id: 'blank', detailsComplete: true } }),
  ];
  const [group] = loggedMonths(records);
  assert.equal(group.entries.length, 5, 'Incomplete rows must remain available for correction.');
  assert.equal(group.totalHours, 2);
  assert.equal(group.incompleteCount, 3);
  assert.equal(group.totalHours, summarizeMonth(records, '2026-09').totalHours);
  const completed = records.map(record => record.id === 'draft-timer'
    ? { ...record, status: 'PENDING', timerSession: { ...record.timerSession, detailsComplete: true } }
    : record);
  const [updated] = loggedMonths(completed);
  assert.equal(updated.totalHours, 3.5);
  assert.equal(updated.incompleteCount, 2);
});

test('empty history invents no current or example month, and moving the last record removes its old month', () => {
  assert.deepEqual(loggedMonths([]), []);
  assert.deepEqual(loggedMonths([entry('invalid-month', '2026-13-01', 2)]), []);
  const one = entry('only', '2026-08-31', 2);
  assert.deepEqual(loggedMonths([one]).map(group => group.month), ['2026-08']);
  assert.deepEqual(loggedMonths([{ ...one, date: '2026-09-01' }]).map(group => group.month), ['2026-09']);
});
