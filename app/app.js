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

const SUBJECTS = ['Physics', 'Algebra', 'Geometry'];
const STORAGE_KEY = 'cognify-data-v0.1.0';

const tabs = ['notes', 'cards', 'study', 'materials', 'progress'];

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptySubject() {
  return {
    notes: [],
    cards: [],
    materials: [],
    weeklyGoal: { targetMinutes: 120, targetCards: 40 },
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

let state = {
  activeSubject: 'Physics',
  activeTab: 'notes',
  data: loadData(),
  showAnswer: false,
  recorder: null,
  chunks: []
};

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

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
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
  saveData();
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
  saveData();
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
  saveData();
  render();
}

async function uploadMaterial(file) {
  if (!file) return;
  const isAudio = file.type.startsWith('audio/');
  let textContent = '';
  let audioUrl = '';
  if (isAudio) {
    audioUrl = URL.createObjectURL(file);
    textContent = `Audio file: ${file.name}. Transcription pipeline planned for v0.1.2.`;
  } else {
    textContent = await file.text();
  }
  subjectData().materials.unshift({
    id: makeId('mat'),
    name: file.name,
    type: file.type || 'unknown',
    textContent,
    audioUrl,
    createdAt: new Date().toISOString()
  });
  saveData();
  render();
}

function runAi(materialId) {
  const material = subjectData().materials.find((m) => m.id === materialId);
  if (!material || !material.textContent) return;
  subjectData().notes.unshift({
    id: makeId('note'),
    title: `AI Summary: ${material.name}`,
    content: generateSummary(material.textContent),
    createdAt: new Date().toISOString()
  });
  subjectData().cards.unshift(...generateFlashcards(material.textContent));
  saveData();
  render();
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
      textContent: 'Recorded audio. Auto transcription pipeline expands in v0.1.2.',
      createdAt: new Date().toISOString()
    });
    stream.getTracks().forEach((t) => t.stop());
    state.recorder = null;
    saveData();
    render();
  };
  recorder.start();
  state.recorder = recorder;
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
  saveData();
  render();
}

function render() {
  const root = document.getElementById('app');
  const current = subjectData();
  const due = dueCards(current.cards);

  root.innerHTML = `
    <header>
      <h1>Cognify 0.1.0</h1>
      <p>Direct, minimal study workspace for Physics, Algebra, and Geometry.</p>
    </header>
    <div class="row">${SUBJECTS.map((s) => `<button class="${s === state.activeSubject ? 'active' : ''}" data-subject="${s}">${s}</button>`).join('')}</div>
    <div class="row">${tabs.map((t) => `<button class="${t === state.activeTab ? 'active' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
    <section class="panel">${renderTab(state.activeTab, current, due)}</section>
  `;

  root.querySelectorAll('[data-subject]').forEach((btn) => btn.addEventListener('click', () => setSubject(btn.dataset.subject)));
  root.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

  const noteBtn = document.getElementById('saveNote');
  if (noteBtn) noteBtn.addEventListener('click', addNote);

  const cardBtn = document.getElementById('saveCard');
  if (cardBtn) cardBtn.addEventListener('click', addCard);

  root.querySelectorAll('[data-grade]').forEach((btn) => btn.addEventListener('click', () => gradeCard(btn.dataset.grade)));

  const upload = document.getElementById('upload');
  if (upload) upload.addEventListener('change', (e) => uploadMaterial(e.target.files?.[0]));

  root.querySelectorAll('[data-ai]').forEach((btn) => btn.addEventListener('click', () => runAi(btn.dataset.ai)));

  const recordBtn = document.getElementById('record');
  if (recordBtn) recordBtn.addEventListener('click', () => (state.recorder ? stopRecording() : startRecording()));

  const goalsBtn = document.getElementById('saveGoals');
  if (goalsBtn) goalsBtn.addEventListener('click', updateGoals);

  const revealBtn = document.getElementById('reveal');
  if (revealBtn)
    revealBtn.addEventListener('click', () => {
      state.showAnswer = true;
      render();
    });
}

function renderTab(tab, current, due) {
  if (tab === 'notes') {
    return `
      <h2>Notes (${state.activeSubject})</h2>
      <input id="noteTitle" placeholder="Note title" />
      <textarea id="noteBody" placeholder="Write notes..."></textarea>
      <button id="saveNote">Save Note</button>
      <ul>${current.notes.map((n) => `<li><strong>${n.title}</strong><p>${n.content}</p></li>`).join('')}</ul>
    `;
  }

  if (tab === 'cards') {
    return `
      <h2>Cards (${state.activeSubject})</h2>
      <input id="cardQuestion" placeholder="Question" />
      <textarea id="cardAnswer" placeholder="Answer"></textarea>
      <button id="saveCard">Add Card</button>
      <ul>${current.cards.map((c) => `<li><strong>Q:</strong> ${c.question}<br/><strong>A:</strong> ${c.answer}</li>`).join('')}</ul>
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
      <button id="record">${state.recorder ? 'Stop Recording' : 'Record Class'}</button>
      <ul>${current.materials
        .map(
          (m) => `<li><strong>${m.name}</strong> (${m.type}) ${m.audioUrl ? `<audio controls src="${m.audioUrl}"></audio>` : ''}<button data-ai="${m.id}">Generate summary + cards</button></li>`
        )
        .join('')}</ul>
    `;
  }

  return `
    <h2>Progress</h2>
    <label>Target minutes <input id="goalMinutes" type="number" value="${current.weeklyGoal.targetMinutes}"/></label>
    <label>Target cards <input id="goalCards" type="number" value="${current.weeklyGoal.targetCards}"/></label>
    <button id="saveGoals">Save Goals</button>
    <p>Minutes studied: ${current.minutesStudiedThisWeek} / ${current.weeklyGoal.targetMinutes}</p>
    <p>Cards reviewed: ${current.cardsReviewedThisWeek} / ${current.weeklyGoal.targetCards}</p>
  `;
}

render();
