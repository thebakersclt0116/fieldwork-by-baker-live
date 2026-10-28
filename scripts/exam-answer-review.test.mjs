import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'fieldwork-exam-review-'));
after(() => rm(directory, { recursive: true, force: true }));
await build({
  stdin: {
    contents: "export { default as ExamLab, ExamAnswerReview } from './src/pages/ExamLab.tsx'; export { fullBCBAExam, BCBA_EXAM_MINUTES, scoreExam, buildWeakAreaPlan } from './src/data/bcbaExam.ts';",
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(directory, 'exam.mjs'), bundle: true, platform: 'node', format: 'esm',
  mainFields: ['module', 'main'],
  tsconfig: 'tsconfig.app.json',
  plugins: [{
    name: 'isolated-exam-render',
    setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, ({ path }) => ({ path: require.resolve(path), external: true }));
      builder.onResolve({ filter: /(?:^|\/)accountStorage$/ }, () => ({ path: 'storage', namespace: 'exam-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'exam-test' }, () => ({ loader: 'js', contents: 'export const accountStorage = { getItem: key => globalThis.__examReviewStorage?.get(key) ?? null };' }));
    },
  }],
});
const exam = await import(pathToFileURL(join(directory, 'exam.mjs')));
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
const escaped = value => renderToStaticMarkup(createElement('span', null, value)).replace(/^<span>|<\/span>$/g, '');

test('the practice exam retains 185 four-option items, a four-hour clock, and an explanation for every item', () => {
  assert.equal(exam.fullBCBAExam.length, 185);
  assert.equal(exam.fullBCBAExam.filter(question => question.scored).length, 175);
  assert.equal(exam.BCBA_EXAM_MINUTES, 240);
  for (const question of exam.fullBCBAExam) {
    assert.equal(question.options.length, 4);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(question.explanation.trim().length > 0);
  }
});

test('answers and explanations remain absent before submission, including an active saved exam', () => {
  const first = exam.fullBCBAExam[0];
  assert.equal(render(exam.ExamAnswerReview, { answers: { [first.id]: first.answer }, submitted: false }), '');
  const previous = globalThis.__examReviewStorage;
  globalThis.__examReviewStorage = new Map([
    ['fieldworkByBaker:examLab:fullExam:v2', JSON.stringify({ startedAt: Date.now(), answers: { [first.id]: first.answer }, flagged: [], index: 0 })],
  ]);
  try {
    const html = render(exam.ExamLab);
    assert.match(html, /BCBA Full Simulation/);
    assert.doesNotMatch(html, /id="exam-answer-review"|<dt[^>]*>(?:Correct answer|Your answer)<\/dt>|<strong>Explanation:/);
  } finally {
    if (previous === undefined) delete globalThis.__examReviewStorage;
    else globalThis.__examReviewStorage = previous;
  }
});

test('submitted review renders every explanation, correct and incorrect choices, and unanswered/unscored distinctions', () => {
  const [first, second] = exam.fullBCBAExam;
  const wrong = (second.answer + 1) % second.options.length;
  const answers = { [first.id]: first.answer, [second.id]: wrong };
  const html = render(exam.ExamAnswerReview, { answers, submitted: true });
  assert.equal((html.match(/<li>/g) || []).length, 185);
  assert.equal((html.match(/Explanation: /g) || []).length, 185);
  assert.equal((html.match(/Experimental \(unscored\)/g) || []).length, 10);
  assert.match(html, /Question 1 · Correct/);
  assert.match(html, /Question 2 · Incorrect/);
  assert.match(html, /Question 3 · Not answered/);
  assert.ok(html.includes(escaped(`${String.fromCharCode(65 + wrong)}. ${second.options[wrong]}`)));
  for (const question of exam.fullBCBAExam) assert.ok(html.includes(escaped(question.explanation)));
});

test('experimental answers stay outside the score and results still generate a seven-day weak-area plan', () => {
  const scored = exam.fullBCBAExam.filter(question => question.scored);
  const experimental = exam.fullBCBAExam.filter(question => !question.scored);
  const answers = Object.fromEntries([...scored.slice(0, 20), ...experimental].map(question => [question.id, question.answer]));
  const result = exam.scoreExam(answers);
  assert.equal(result.correct, 20); assert.equal(result.total, 175);
  const plan = exam.buildWeakAreaPlan(answers, 45);
  assert.equal(plan.days.length, 7);
  assert.ok(plan.days.every(day => day.minutes === 45 && day.blocks.length === 3));
});
