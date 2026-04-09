const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSummary, generateFlashcards } = require('../app/ai.js');

const sample = 'Force equals mass times acceleration. This law explains motion changes under net force. Energy is conserved in a closed system.';

test('generateSummary returns numbered lines', () => {
  const summary = generateSummary(sample);
  assert.match(summary, /1\./);
});

test('generateFlashcards returns cards', () => {
  const cards = generateFlashcards(sample);
  assert.ok(cards.length > 0);
});
