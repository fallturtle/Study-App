function splitSentences(text) {
  return text
    .split(/[.!?]\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
}

function generateSummary(text) {
  const lines = splitSentences(text).slice(0, 6);
  if (lines.length === 0) {
    return 'No useful text was found. Upload clearer notes or a cleaner transcript.';
  }
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
}

function generateFlashcards(text) {
  const lines = splitSentences(text).slice(0, 8);
  return lines.map((line, index) => ({
    id: `ai-${Date.now()}-${index}`,
    question: `Explain this idea: ${line.slice(0, 80)}?`,
    answer: line,
    interval: 1,
    dueDate: new Date().toISOString(),
    repetition: 0
  }));
}

module.exports = { generateSummary, generateFlashcards };
