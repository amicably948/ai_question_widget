import type { ParameterValues } from "../widget/widget.config";
import { QUESTION_BANK } from "./questionBank";

export interface AiConfig {
  delayMs: number;
  completeAfter: number;
  dropProbability: number;
  shuffle: boolean;
  randomInsert: boolean;
  noNewQuestionProbability: number;
  splitUpdate: boolean;
  gapMs: number;
  neverRespond: boolean;
}

export const PERFECT_AI: AiConfig = {
  delayMs: 700,
  completeAfter: 4,
  dropProbability: 0,
  shuffle: false,
  randomInsert: false,
  noNewQuestionProbability: 0,
  splitUpdate: false,
  gapMs: 400,
  neverRespond: false,
};

export const WORST_AI: AiConfig = {
  delayMs: 500,
  completeAfter: 12,
  dropProbability: 1,
  shuffle: true,
  randomInsert: true,
  noNewQuestionProbability: 1,
  splitUpdate: true,
  gapMs: 1500,
  neverRespond: true,
};

export interface AiPlan {
  canonical: string[];
  questions: string[];
  isComplete: boolean;
}

export function countAnswers(raw: string): number {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function shuffle(list: string[], random: () => number): string[] {
  const next = list.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = next[index];
    const other = next[swap];
    if (current === undefined || other === undefined) continue;
    next[index] = other;
    next[swap] = current;
  }
  return next;
}

export function nextBankQuestion(
  canonical: readonly string[],
  bank: readonly string[] = QUESTION_BANK,
): string | null {
  for (const question of bank) {
    if (!canonical.includes(question)) return question;
  }
  return null;
}

/**
 * Build the unreliable `questions` array the mock AI writes back.
 * `random` is injected so tests can force each chaos branch.
 */
export function planAiResponse(input: {
  canonical: readonly string[];
  answerCount: number;
  config: AiConfig;
  random?: () => number;
  bank?: readonly string[];
}): AiPlan {
  const random = input.random ?? Math.random;
  const bank = input.bank ?? QUESTION_BANK;
  const { config } = input;
  const skipNew =
    config.noNewQuestionProbability > 0 && random() < config.noNewQuestionProbability;
  const bankExhausted = nextBankQuestion(input.canonical, bank) === null;
  const shouldComplete =
    input.answerCount >= config.completeAfter || (!skipNew && bankExhausted);
  const next = shouldComplete || skipNew ? null : nextBankQuestion(input.canonical, bank);

  let list =
    config.dropProbability > 0
      ? input.canonical.filter(() => random() >= config.dropProbability)
      : input.canonical.slice();

  if (next !== null) {
    if (config.randomInsert) {
      const index = Math.floor(random() * (list.length + 1));
      list.splice(index, 0, next);
    } else {
      list.push(next);
    }
  }

  if (config.shuffle) list = shuffle(list, random);

  return {
    canonical: next === null ? input.canonical.slice() : [...input.canonical, next],
    questions: list,
    isComplete: shouldComplete,
  };
}

export interface MockAi {
  notify: (answersJson: string) => void;
  reset: () => void;
  cancel: () => void;
  dispose: () => void;
}

export function createMockAi(options: {
  openingQuestion: string;
  getConfig: () => AiConfig;
  apply: (updates: Partial<Pick<ParameterValues, "questions" | "lastResponse" | "isComplete">>) => void;
  now?: () => string;
}): MockAi {
  let canonical = [options.openingQuestion];
  let timers: number[] = [];

  function clearTimers(): void {
    for (const id of timers) window.clearTimeout(id);
    timers = [];
  }

  function schedule(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers = timers.filter((timer) => timer !== id);
      fn();
    }, ms);
    timers.push(id);
  }

  return {
    notify(answersJson) {
      clearTimers();
      const config = options.getConfig();
      if (config.neverRespond) return;
      const answerCount = countAnswers(answersJson);
      schedule(() => {
        const latest = options.getConfig();
        if (latest.neverRespond) return;
        const plan = planAiResponse({
          canonical,
          answerCount,
          config: latest,
        });
        canonical = plan.canonical;
        const stamp = (options.now ?? (() => new Date().toISOString()))();
        if (latest.splitUpdate && latest.gapMs > 0) {
          options.apply(
            plan.isComplete
              ? { lastResponse: stamp, isComplete: true }
              : { lastResponse: stamp },
          );
          schedule(() => {
            options.apply({ questions: plan.questions, isComplete: plan.isComplete });
          }, latest.gapMs);
          return;
        }
        options.apply({
          lastResponse: stamp,
          questions: plan.questions,
          isComplete: plan.isComplete,
        });
      }, Math.max(0, config.delayMs));
    },
    reset() {
      clearTimers();
      canonical = [options.openingQuestion];
    },
    cancel: clearTimers,
    dispose: clearTimers,
  };
}
