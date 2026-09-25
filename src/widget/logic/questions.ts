/**
 * Question identity is the trimmed text with internal whitespace collapsed.
 * Comparison is case-sensitive. Array position is never part of identity.
 */
export function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export interface HistoryEntry {
  /** Whitespace-normalised text from the first time this question was seen. */
  question: string;
  answer: string | null;
}

export interface AnswerPair {
  question: string;
  answer: string;
}

function normalizeStoredAnswer(answer: string): string | null {
  const trimmed = answer.trim();
  return trimmed === "" ? null : trimmed;
}

export function currentQuestion(history: readonly HistoryEntry[]): HistoryEntry | null {
  return history.find((entry) => entry.answer === null) ?? null;
}

/**
 * Append questions that are not already in the history.
 * New questions are added in the order they appear in `incoming`.
 * Dropped or reordered input leaves the existing history untouched.
 */
export function mergeHistory(
  history: readonly HistoryEntry[],
  incoming: readonly string[],
): readonly HistoryEntry[] {
  const seen = new Set(history.map((entry) => entry.question));
  let next: HistoryEntry[] | null = null;

  for (const raw of incoming) {
    const question = normalizeQuestion(raw);
    if (question === "" || seen.has(question)) continue;
    seen.add(question);
    if (next === null) next = history.slice();
    next.push({ question, answer: null });
  }

  return next ?? history;
}

/** Rebuild after a remount: answers win on order, then unseen questions are appended. */
export function historyFromAnswers(pairs: readonly AnswerPair[]): HistoryEntry[] {
  const history: HistoryEntry[] = [];
  const indexByQuestion = new Map<string, number>();

  for (const pair of pairs) {
    const question = normalizeQuestion(pair.question);
    if (question === "") continue;
    const answer = normalizeStoredAnswer(pair.answer);
    const existingIndex = indexByQuestion.get(question);
    if (existingIndex === undefined) {
      indexByQuestion.set(question, history.length);
      history.push({ question, answer });
      continue;
    }
    if (answer === null) continue;
    const existing = history[existingIndex];
    if (!existing) continue;
    history[existingIndex] = { question: existing.question, answer };
  }

  return history;
}

export function rebuildHistory(
  pairs: readonly AnswerPair[],
  questions: readonly string[],
): readonly HistoryEntry[] {
  return mergeHistory(historyFromAnswers(pairs), questions);
}

/** Reset keeps none of the previous history. Questions are a fresh start. */
export function freshHistory(questions: readonly string[]): readonly HistoryEntry[] {
  return mergeHistory([], questions);
}

export function answerCurrent(
  history: readonly HistoryEntry[],
  answer: string,
): readonly HistoryEntry[] {
  const index = history.findIndex((entry) => entry.answer === null);
  if (index < 0) return history;
  const current = history[index];
  if (!current) return history;
  const next = history.slice();
  next[index] = { question: current.question, answer };
  return next;
}

/**
 * Replace one earlier answer. Returns the same array when nothing changes,
 * so callers can avoid emitting an event.
 */
export function editAnswer(
  history: readonly HistoryEntry[],
  question: string,
  answer: string,
): readonly HistoryEntry[] {
  const key = normalizeQuestion(question);
  const index = history.findIndex((entry) => entry.question === key);
  if (index < 0) return history;
  const current = history[index];
  if (!current || current.answer === null || current.answer === answer) return history;
  const next = history.slice();
  next[index] = { question: current.question, answer };
  return next;
}

export function serializeAnswers(history: readonly HistoryEntry[]): string {
  const pairs: AnswerPair[] = [];
  for (const entry of history) {
    if (entry.answer === null) continue;
    pairs.push({ question: entry.question, answer: entry.answer });
  }
  return JSON.stringify(pairs);
}
