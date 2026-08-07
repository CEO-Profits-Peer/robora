// Vereinfachtes SM-2: leichtgewichtig statt lehrbuchgenau, reicht für den persönlichen Gebrauch.

type SrState = { repetitions: number; ease_factor: number; interval_days: number };

export function nextReview(card: SrState, correct: boolean): SrState & { due_at: string } {
  let next: SrState;

  if (!correct) {
    next = { repetitions: 0, ease_factor: Math.max(1.3, card.ease_factor - 0.2), interval_days: 1 };
  } else {
    const repetitions = card.repetitions + 1;
    const ease_factor = Math.min(2.8, card.ease_factor + 0.1);
    let interval_days: number;
    if (repetitions === 1) interval_days = 1;
    else if (repetitions === 2) interval_days = 6;
    else interval_days = Math.round(card.interval_days * card.ease_factor);
    next = { repetitions, ease_factor, interval_days };
  }

  const due_at = new Date(Date.now() + next.interval_days * 24 * 60 * 60 * 1000).toISOString();
  return { ...next, due_at };
}
