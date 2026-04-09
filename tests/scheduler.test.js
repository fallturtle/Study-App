const test = require('node:test');
const assert = require('node:assert/strict');
const { dueCards, updateCardReview } = require('../app/scheduler.js');

test('dueCards returns card due in past', () => {
  const card = { id: '1', interval: 1, dueDate: '2026-04-01T00:00:00.000Z', repetition: 0 };
  assert.equal(dueCards([card], new Date('2026-04-08T00:00:00.000Z')).length, 1);
});

test('updateCardReview increases repetition for Good', () => {
  const card = { id: '1', interval: 1, dueDate: '2026-04-01T00:00:00.000Z', repetition: 0 };
  const updated = updateCardReview(card, 'Good', new Date('2026-04-08T00:00:00.000Z'));
  assert.ok(updated.interval > 1);
  assert.equal(updated.repetition, 1);
});
