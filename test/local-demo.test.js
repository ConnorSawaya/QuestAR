import assert from 'node:assert/strict';
import test from 'node:test';

import { generateLocalTopic, isPagesDemoMode } from '../src/local-demo.js';

test('static demo mode recognizes the Pages build mode and github.io hosts', () => {
  assert.equal(isPagesDemoMode('pages', 'localhost:5173'), true);
  assert.equal(isPagesDemoMode('production', 'connorsawaya.github.io'), true);
  assert.equal(isPagesDemoMode('production', 'preview.example.com'), false);
});

test('local topic generation creates six valid, deterministic chemistry orbs', () => {
  const first = generateLocalTopic({ topic: 'Chemistry', difficulty: 'Hard' });
  const second = generateLocalTopic({ topic: 'Chemistry', difficulty: 'Hard' });

  assert.equal(first.orbs.length, 6);
  assert.equal(first.topic, 'Chemistry');
  assert.match(first.summary, /built-in chemistry question pack/i);
  assert.deepEqual(first, second);

  for (const orb of first.orbs) {
    assert.ok(orb.id.startsWith('local-chemistry-wave-0-'));
    assert.ok(orb.title);
    assert.equal(orb.questions.length, 3);
    for (const question of orb.questions) {
      assert.ok(question.prompt.length > 0);
      assert.equal(question.options.length, 3);
      assert.ok(Number.isInteger(question.answer));
      assert.ok(question.answer >= 0 && question.answer < question.options.length);
    }
  }
});

test('custom topics stay playable and identify the general-practice fallback', () => {
  const result = generateLocalTopic({ topic: 'Ancient maritime trade', count: 8, wave: 2 });

  assert.equal(result.orbs.length, 6);
  assert.match(result.summary, /general study strategies/i);
  assert.ok(result.orbs.every((orb) => orb.questions.length === 3));
  assert.ok(result.orbs[0].id.includes('wave-2'));
  assert.match(result.orbs[0].questions[0].prompt, /Ancient maritime trade/);
  assert.throws(() => generateLocalTopic({ topic: '   ' }), /Enter a topic/);
});

test('short local routes give six distinct questions and vary the correct answer position', () => {
  const result = generateLocalTopic({ topic: 'chemistry', count: 2, difficulty: 'Expert' });
  const questions = result.orbs.flatMap((orb) => orb.questions);

  assert.equal(result.orbs.length, 2);
  assert.equal(new Set(questions.map(({ prompt }) => prompt)).size, 6);
  assert.ok(new Set(questions.map(({ answer }) => answer)).size > 1);
  const expectedAnswers = new Map([
    ['What does pH measure?', 'Acidity'],
    ['Which particle has a negative charge?', 'Electron'],
    ['What is H2O?', 'Water'],
    ['A catalyst does what?', 'Speeds a reaction'],
    ['Which bond shares electrons?', 'Covalent'],
    ['What is the center of an atom called?', 'Nucleus'],
  ]);
  for (const question of questions) {
    assert.equal(question.options[question.answer], expectedAnswers.get(question.prompt));
  }
});

test('unknown custom topics use six unique general prompts with the topic named', () => {
  const result = generateLocalTopic({ topic: 'Ancient maritime trade', count: 2 });
  const questions = result.orbs.flatMap((orb) => orb.questions);

  assert.equal(new Set(questions.map(({ prompt }) => prompt)).size, 6);
  assert.ok(questions.every(({ prompt }) => prompt.includes('Ancient maritime trade')));
  assert.match(result.summary, /general study strategies/i);
});
