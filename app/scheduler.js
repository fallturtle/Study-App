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

module.exports = { updateCardReview, dueCards };
