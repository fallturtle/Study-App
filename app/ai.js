function looksLikeBinaryNoise(text) {
  const slice = text.slice(0, 4000);
  if (!slice) return true;
  const weirdChars = (slice.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
  return weirdChars / slice.length > 0.2;
}

function cleanupExtractedText(text) {
  return text
    .replace(/%PDF-[^\n]*/g, ' ')
    .replace(/\b(?:obj|endobj|stream|endstream|xref|trailer)\b/gi, ' ')
    .replace(/\/(?:Type|Length|Filter|Subtype|Resources|Metadata|Catalog|Pages|XObject)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractReadableFromBinary(text) {
  const matches = text.match(/[A-Za-z][A-Za-z0-9,.;:()'"!?\-\s]{35,}/g) || [];
  return matches.slice(0, 100).join(' ');
}

function normalizeSourceText(text) {
  const cleaned = cleanupExtractedText(text);
  if (looksLikeBinaryNoise(cleaned)) {
    return cleanupExtractedText(extractReadableFromBinary(cleaned));
  }
  return cleaned;
}

function splitSentences(text) {
  return normalizeSourceText(text)
    .split(/[.!?]\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 24)
    .filter((line) => !/^(obj|stream|endstream|xref|trailer)$/i.test(line));
}

function generateSummary(text) {
  const lines = splitSentences(text).slice(0, 8);
  if (lines.length === 0) {
    return 'No readable study text found. If this is a scanned PDF, paste text notes or upload a text-exported PDF.';
  }
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
}

function generateFlashcards(text) {
  const lines = splitSentences(text).slice(0, 12);
  return lines.map((line, index) => ({
    id: `ai-${Date.now()}-${index}`,
    question: `Explain this concept: ${line.slice(0, 80)}?`,
    answer: line,
    interval: 1,
    dueDate: new Date().toISOString(),
    repetition: 0
  }));
}

module.exports = { generateSummary, generateFlashcards, normalizeSourceText };
