const DAY_MS = 24 * 60 * 60 * 1000;

const intervals = {
  Again: 1,
  Hard: 2,
  Good: 4,
  Easy: 7
};

function updateCardReview(card, grade, now = new Date()) {
  const base = intervals[grade] ?? 1;
  const nextInterval = grade === 'Again' ? 1 : Math.max(base, Math.round(card.interval * 1.4));
  return {
    ...card,
    interval: nextInterval,
    repetition: grade === 'Again' ? 0 : card.repetition + 1,
    dueDate: new Date(now.getTime() + nextInterval * DAY_MS).toISOString()
  };
}

function dueCards(cards, now = new Date()) {
  return cards.filter((card) => new Date(card.dueDate).getTime() <= now.getTime());
}

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

const SUBJECTS = ['Physics', 'Algebra', 'Geometry'];
const STORAGE_KEY = 'cognify-data-v0.2.0';
const tabs = ['notes', 'cards', 'study', 'materials', 'progress'];

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptySubject() {
  return {
    notes: [],
    cards: [],
    materials: [],
    weeklyGoal: { targetMinutes: 180, targetCards: 60 },
    minutesStudiedThisWeek: 0,
    cardsReviewedThisWeek: 0
  };
}

function defaultData() {
  return {
    Physics: emptySubject(),
    Algebra: emptySubject(),
    Geometry: emptySubject()
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    SUBJECTS.forEach((s) => {
      if (!parsed[s]) parsed[s] = emptySubject();
    });
    return parsed;
  } catch {
    return defaultData();
  }
}

let state = {
  activeSubject: 'Physics',
  activeTab: 'notes',
  data: loadData(),
  showAnswer: false,
  recorder: null,
  chunks: [],
  lastMessage: 'Ready.'
};

function saveData(msg = 'Saved.') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  state.lastMessage = msg;
}

function subjectData() {
  return state.data[state.activeSubject];
}

function setTab(tab) {
  state.activeTab = tab;
  state.showAnswer = false;
  render();
}

function setSubject(subject) {
  state.activeSubject = subject;
  state.showAnswer = false;
  render();
}

function addNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteBody').value.trim();
  if (!title || !content) return;
  subjectData().notes.unshift({ id: makeId('note'), title, content, createdAt: new Date().toISOString() });
  saveData('Note added.');
  render();
}

function deleteNote(noteId) {
  subjectData().notes = subjectData().notes.filter((n) => n.id !== noteId);
  saveData('Note deleted.');
  render();
}

function addCard() {
  const question = document.getElementById('cardQuestion').value.trim();
  const answer = document.getElementById('cardAnswer').value.trim();
  if (!question || !answer) return;
  subjectData().cards.unshift({
    id: makeId('card'),
    question,
    answer,
    interval: 1,
    dueDate: new Date().toISOString(),
    repetition: 0
  });
  saveData('Card added.');
  render();
}

function deleteCard(cardId) {
  subjectData().cards = subjectData().cards.filter((c) => c.id !== cardId);
  saveData('Card deleted.');
  render();
}

function gradeCard(grade) {
  const due = dueCards(subjectData().cards);
  const current = due[0];
  if (!current) return;
  subjectData().cards = subjectData().cards.map((card) => (card.id === current.id ? updateCardReview(card, grade) : card));
  subjectData().cardsReviewedThisWeek += 1;
  subjectData().minutesStudiedThisWeek += 2;
  state.showAnswer = false;
  saveData(`Reviewed card: ${grade}`);
  render();
}

async function uploadMaterial(file) {
  if (!file) return;
  const isAudio = file.type.startsWith('audio/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let textContent = '';
  let audioUrl = '';

  if (isAudio) {
    audioUrl = URL.createObjectURL(file);
    textContent = `Audio file: ${file.name}. Transcription pipeline is next target (v0.2.1).`;
  } else if (isPdf) {
    const buffer = await file.arrayBuffer();
    const rawText = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    textContent = normalizeSourceText(rawText);

    if (!textContent || textContent.length < 80) {
      textContent =
        'This PDF appears scanned/encoded. Upload a text-exported PDF or paste notes for reliable AI summaries.';
    }
  } else {
    textContent = normalizeSourceText(await file.text());
  }

  subjectData().materials.unshift({
    id: makeId('mat'),
    name: file.name,
    type: file.type || 'unknown',
    textContent,
    audioUrl,
    createdAt: new Date().toISOString()
  });
  saveData('Material uploaded.');
  render();
}

function deleteMaterial(materialId) {
  subjectData().materials = subjectData().materials.filter((m) => m.id !== materialId);
  saveData('Material deleted.');
  render();
}

function runAiFromText(sourceText, label = 'AI Summary') {
  const summary = generateSummary(sourceText);
  const cards = generateFlashcards(sourceText);

  subjectData().notes.unshift({
    id: makeId('note'),
    title: label,
    content: summary,
    createdAt: new Date().toISOString()
  });
  subjectData().cards.unshift(...cards);
  saveData(`AI generated ${cards.length} cards.`);
  render();
}

function runAi(materialId) {
  const material = subjectData().materials.find((m) => m.id === materialId);
  if (!material || !material.textContent) return;
  runAiFromText(material.textContent, `AI Summary: ${material.name}`);
}

function runAiAllMaterials() {
  const combined = subjectData()
    .materials.map((m) => m.textContent || '')
    .join(' ')
    .trim();

  if (!combined) {
    state.lastMessage = 'No text materials available for AI.';
    render();
    return;
  }

  runAiFromText(combined, `AI Summary: ${state.activeSubject} combined materials`);
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Recording is not supported in this browser.');
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  state.chunks = [];
  recorder.ondataavailable = (e) => state.chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(state.chunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(blob);
    subjectData().materials.unshift({
      id: makeId('rec'),
      name: `Class recording ${new Date().toLocaleString()}`,
      type: 'audio/webm',
      audioUrl,
      textContent: 'Recorded audio. Auto transcription pipeline expands in v0.2.1.',
      createdAt: new Date().toISOString()
    });
    stream.getTracks().forEach((t) => t.stop());
    state.recorder = null;
    saveData('Recording saved.');
    render();
  };
  recorder.start();
  state.recorder = recorder;
  state.lastMessage = 'Recording in progress...';
  render();
}

function stopRecording() {
  if (state.recorder) state.recorder.stop();
}

function updateGoals() {
  const minutes = Number(document.getElementById('goalMinutes').value);
  const cards = Number(document.getElementById('goalCards').value);
  subjectData().weeklyGoal.targetMinutes = Number.isFinite(minutes) ? minutes : subjectData().weeklyGoal.targetMinutes;
  subjectData().weeklyGoal.targetCards = Number.isFinite(cards) ? cards : subjectData().weeklyGoal.targetCards;
  saveData('Goals updated.');
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cognify-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  state.lastMessage = 'Backup exported.';
  render();
}

async function importData(file) {
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    SUBJECTS.forEach((s) => {
      if (!incoming[s]) incoming[s] = emptySubject();
    });
    state.data = incoming;
    saveData('Backup imported.');
    render();
  } catch {
    state.lastMessage = 'Import failed: invalid JSON backup.';
    render();
  }
}

function render() {
  const root = document.getElementById('app');
  const current = subjectData();
  const due = dueCards(current.cards);

  root.innerHTML = `
    <header>
      <h1>Cognify 0.2.0</h1>
      <p>Personal study system for Physics, Algebra, and Geometry.</p>
      <p class="status">Status: ${state.lastMessage}</p>
    </header>
    <div class="row">${SUBJECTS.map((s) => `<button class="${s === state.activeSubject ? 'active' : ''}" data-subject="${s}">${s}</button>`).join('')}</div>
    <div class="row">${tabs.map((t) => `<button class="${t === state.activeTab ? 'active' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
    <section class="panel">${renderTab(state.activeTab, current, due)}</section>
  `;

  root.querySelectorAll('[data-subject]').forEach((btn) => btn.addEventListener('click', () => setSubject(btn.dataset.subject)));
  root.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

  bindClick('saveNote', addNote);
  bindClick('saveCard', addCard);
  bindClick('reveal', () => {
    state.showAnswer = true;
    render();
  });
  bindClick('record', () => (state.recorder ? stopRecording() : startRecording()));
  bindClick('saveGoals', updateGoals);
  bindClick('runAiAll', runAiAllMaterials);
  bindClick('exportData', exportData);

  root.querySelectorAll('[data-grade]').forEach((btn) => btn.addEventListener('click', () => gradeCard(btn.dataset.grade)));
  root.querySelectorAll('[data-delete-note]').forEach((btn) => btn.addEventListener('click', () => deleteNote(btn.dataset.deleteNote)));
  root.querySelectorAll('[data-delete-card]').forEach((btn) => btn.addEventListener('click', () => deleteCard(btn.dataset.deleteCard)));
  root.querySelectorAll('[data-delete-material]').forEach((btn) => btn.addEventListener('click', () => deleteMaterial(btn.dataset.deleteMaterial)));
  root.querySelectorAll('[data-ai]').forEach((btn) => btn.addEventListener('click', () => runAi(btn.dataset.ai)));

  const upload = document.getElementById('upload');
  if (upload) upload.addEventListener('change', (e) => uploadMaterial(e.target.files?.[0]));

  const importInput = document.getElementById('importData');
  if (importInput) importInput.addEventListener('change', (e) => importData(e.target.files?.[0]));
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

function renderTab(tab, current, due) {
  if (tab === 'notes') {
    return `
      <h2>Notes (${state.activeSubject})</h2>
      <input id="noteTitle" placeholder="Note title" />
      <textarea id="noteBody" placeholder="Write notes..."></textarea>
      <button id="saveNote">Save Note</button>
      <ul>${current.notes
        .map(
          (n) => `<li><strong>${n.title}</strong><p>${n.content}</p><button data-delete-note="${n.id}">Delete</button></li>`
        )
        .join('')}</ul>
    `;
  }

  if (tab === 'cards') {
    return `
      <h2>Cards (${state.activeSubject})</h2>
      <input id="cardQuestion" placeholder="Question" />
      <textarea id="cardAnswer" placeholder="Answer"></textarea>
      <button id="saveCard">Add Card</button>
      <ul>${current.cards
        .map(
          (c) => `<li><strong>Q:</strong> ${c.question}<br/><strong>A:</strong> ${c.answer}<br/><button data-delete-card="${c.id}">Delete</button></li>`
        )
        .join('')}</ul>
    `;
  }

  if (tab === 'study') {
    const card = due[0];
    if (!card) return '<h2>Study</h2><p>No due cards right now.</p>';
    return `
      <h2>Study</h2>
      <p><strong>Q:</strong> ${card.question}</p>
      ${state.showAnswer ? `<p><strong>A:</strong> ${card.answer}</p>` : '<button id="reveal">Reveal Answer</button>'}
      ${
        state.showAnswer
          ? `<div class="row">
            <button data-grade="Again">Again</button>
            <button data-grade="Hard">Hard</button>
            <button data-grade="Good">Good</button>
            <button data-grade="Easy">Easy</button>
          </div>`
          : ''
      }
    `;
  }

  if (tab === 'materials') {
    return `
      <h2>Materials + AI</h2>
      <input type="file" id="upload" />
      <div class="row">
        <button id="record">${state.recorder ? 'Stop Recording' : 'Record Class'}</button>
        <button id="runAiAll">Generate AI from all materials</button>
      </div>
      <ul>${current.materials
        .map(
          (m) => `<li><strong>${m.name}</strong> (${m.type}) ${m.audioUrl ? `<audio controls src="${m.audioUrl}"></audio>` : ''}<div class="row"><button data-ai="${m.id}">Generate summary + cards</button><button data-delete-material="${m.id}">Delete</button></div></li>`
        )
        .join('')}</ul>
    `;
  }

  const dueCount = due.length;
  return `
    <h2>Progress</h2>
    <label>Target minutes <input id="goalMinutes" type="number" value="${current.weeklyGoal.targetMinutes}"/></label>
    <label>Target cards <input id="goalCards" type="number" value="${current.weeklyGoal.targetCards}"/></label>
    <div class="row">
      <button id="saveGoals">Save Goals</button>
      <button id="exportData">Export Backup</button>
      <label class="inline-upload">Import Backup <input id="importData" type="file" accept="application/json" /></label>
    </div>
    <p>Minutes studied: ${current.minutesStudiedThisWeek} / ${current.weeklyGoal.targetMinutes}</p>
    <p>Cards reviewed: ${current.cardsReviewedThisWeek} / ${current.weeklyGoal.targetCards}</p>
    <p>Due cards today: ${dueCount}</p>
    <p>Total notes: ${current.notes.length} | Total cards: ${current.cards.length} | Materials: ${current.materials.length}</p>
  `;
}

render();
