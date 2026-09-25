import { GRACE_PERIOD_MS, MAX_AUTO_RETRIES, RESPONSE_TIMEOUT_MS } from "./constants";
import {
  answerCurrent,
  currentQuestion,
  editAnswer,
  freshHistory,
  rebuildHistory,
  serializeAnswers,
  mergeHistory,
  type AnswerPair,
  type HistoryEntry,
} from "./questions";

/**
 * Visible phases. `retrying` uses the same thinking screen as `thinking`.
 *
 *   empty ──questions──▶ asking
 *   asking ──submit/edit──▶ thinking ──lastResponse + new question──▶ asking
 *   thinking ──lastResponse + isComplete──▶ complete
 *   thinking ──lastResponse, no question, grace, retries left──▶ retrying
 *   retrying ──(same checks as thinking)──▶ asking | complete | retrying | no-response
 *   thinking/retrying ──timeout, or retries exhausted──▶ no-response
 *   no-response ──Try again──▶ thinking
 *   complete ──edit──▶ thinking
 *   any ──resetToken changes──▶ fresh history from `questions` only (no emit)
 *
 * Remount when every known question is answered and `isComplete` is false
 * starts at `thinking` and does not emit.
 */
export type Phase = "empty" | "asking" | "thinking" | "retrying" | "no-response" | "complete";

export interface SessionParams {
  questions: readonly string[];
  lastResponse: string | null;
  isComplete: boolean;
  resetToken: string | undefined;
}

export interface MountParams extends SessionParams {
  pairs: readonly AnswerPair[];
}

export interface SessionSnapshot {
  ready: boolean;
  phase: Phase;
  history: readonly HistoryEntry[];
  retriesUsed: number;
}

export interface QuestionSession {
  mount: (params: MountParams) => void;
  update: (params: SessionParams) => void;
  submit: (answer: string) => void;
  saveEdit: (question: string, answer: string) => void;
  tryAgain: () => void;
  destroy: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SessionSnapshot;
}

export interface SessionOptions {
  onEmit: (answers: string, source: "user" | "retry") => void;
  gracePeriodMs?: number;
  maxAutoRetries?: number;
  responseTimeoutMs?: number;
}

const EMPTY_HISTORY: readonly HistoryEntry[] = [];

export function createQuestionSession(options: SessionOptions): QuestionSession {
  const gracePeriodMs = options.gracePeriodMs ?? GRACE_PERIOD_MS;
  const maxAutoRetries = options.maxAutoRetries ?? MAX_AUTO_RETRIES;
  const responseTimeoutMs = options.responseTimeoutMs ?? RESPONSE_TIMEOUT_MS;

  let params: SessionParams = {
    questions: [],
    lastResponse: null,
    isComplete: false,
    resetToken: undefined,
  };
  let seenResetToken: string | undefined;
  let hasSeenResetToken = false;
  let phase: Phase = "empty";
  let history: readonly HistoryEntry[] = EMPTY_HISTORY;
  let retriesUsed = 0;
  let ready = false;
  let baseline: string | null = null;
  let isCompleteAtWaitStart = false;
  /** Unanswered questions already known when this wait began. They are not a new AI question. */
  let pendingAtWaitStart = new Set<string>();
  let alive = true;

  let timeoutGeneration = 0;
  let graceGeneration = 0;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let graceHandle: ReturnType<typeof setTimeout> | null = null;

  let snapshot: SessionSnapshot = {
    ready: false,
    phase: "empty",
    history: EMPTY_HISTORY,
    retriesUsed: 0,
  };

  const listeners = new Set<() => void>();

  function publish(): void {
    snapshot = { ready, phase, history, retriesUsed };
    for (const listener of listeners) listener();
  }

  function commit(): void {
    if (
      snapshot.ready === ready &&
      snapshot.phase === phase &&
      snapshot.history === history &&
      snapshot.retriesUsed === retriesUsed
    ) {
      return;
    }
    publish();
  }

  function clearTimers(): void {
    timeoutGeneration += 1;
    graceGeneration += 1;
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    if (graceHandle !== null) {
      clearTimeout(graceHandle);
      graceHandle = null;
    }
  }

  function armTimeout(): void {
    const generation = ++timeoutGeneration;
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      if (!alive || generation !== timeoutGeneration) return;
      timeoutHandle = null;
      handleTimeout();
    }, responseTimeoutMs);
  }

  function armGrace(): void {
    if (graceHandle !== null) return;
    const generation = ++graceGeneration;
    graceHandle = setTimeout(() => {
      if (!alive || generation !== graceGeneration) return;
      graceHandle = null;
      handleGrace();
    }, gracePeriodMs);
  }

  function snapshotPending(): Set<string> {
    const pending = new Set<string>();
    for (const entry of history) {
      if (entry.answer === null) pending.add(entry.question);
    }
    return pending;
  }

  function hasArrivedQuestion(): boolean {
    for (const entry of history) {
      if (entry.answer === null && !pendingAtWaitStart.has(entry.question)) return true;
    }
    return false;
  }

  function settleFromHistory(): void {
    if (currentQuestion(history)) {
      phase = "asking";
      return;
    }
    if (params.isComplete) {
      phase = "complete";
      return;
    }
    if (history.length === 0) {
      phase = "empty";
      return;
    }
    beginWait("none");
  }

  function beginWait(source: "user" | "retry" | "none", answers: string | null = null): void {
    clearTimers();
    baseline = params.lastResponse;
    isCompleteAtWaitStart = params.isComplete;
    pendingAtWaitStart = snapshotPending();
    if (source === "user") retriesUsed = 0;
    phase = source === "retry" ? "retrying" : "thinking";
    if (source !== "none" && answers !== null) {
      options.onEmit(answers, source);
    }
    armTimeout();
  }

  function stopWaiting(next: Phase): void {
    clearTimers();
    phase = next;
  }

  function handleTimeout(): void {
    if (phase !== "thinking" && phase !== "retrying") return;
    if (hasArrivedQuestion() || currentQuestion(history)) {
      stopWaiting("asking");
      commit();
      return;
    }
    if (params.isComplete) {
      stopWaiting("complete");
      commit();
      return;
    }
    stopWaiting("no-response");
    commit();
  }

  function handleGrace(): void {
    if (phase !== "thinking" && phase !== "retrying") return;
    if (hasArrivedQuestion() || (currentQuestion(history) && params.isComplete)) {
      stopWaiting("asking");
      commit();
      return;
    }
    if (!currentQuestion(history) && params.isComplete) {
      stopWaiting("complete");
      commit();
      return;
    }
    if (retriesUsed >= maxAutoRetries) {
      stopWaiting(currentQuestion(history) ? "asking" : "no-response");
      commit();
      return;
    }
    retriesUsed += 1;
    beginWait("retry", serializeAnswers(history));
    commit();
  }

  /**
   * A new question that was not already unanswered when the wait began ends
   * the wait immediately, even if `lastResponse` has not moved yet (questions
   * can arrive first, or just after a retry). A change in `lastResponse` is
   * what proves the AI responded when no new question is present.
   *
   * `isComplete` that flips on during the wait ends it. An `isComplete` that
   * was already true does not, until `lastResponse` changes — otherwise the
   * answers echo after an edit would cancel the wait immediately.
   */
  function evaluateWaiting(): void {
    if (phase !== "thinking" && phase !== "retrying") return;

    if (hasArrivedQuestion()) {
      stopWaiting("asking");
      return;
    }

    const responded = params.lastResponse !== baseline;
    const becameComplete = params.isComplete && !isCompleteAtWaitStart;
    const nothingPending = currentQuestion(history) === null;
    if (nothingPending && params.isComplete && (becameComplete || responded)) {
      stopWaiting("complete");
      return;
    }
    if (!responded) return;

    cancelTimeoutOnly();
    armGrace();
  }

  function cancelTimeoutOnly(): void {
    timeoutGeneration += 1;
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function evaluateIdle(): void {
    if (phase === "thinking" || phase === "retrying") return;
    const pending = currentQuestion(history);
    if (pending) {
      phase = "asking";
      return;
    }
    if (params.isComplete) {
      phase = "complete";
      return;
    }
    if (history.length === 0) {
      phase = "empty";
      return;
    }
    if (phase === "no-response") return;
    if (phase === "complete") {
      retriesUsed = 0;
      beginWait("none");
    }
  }

  function applyReset(next: SessionParams): void {
    clearTimers();
    params = next;
    seenResetToken = next.resetToken;
    retriesUsed = 0;
    baseline = next.lastResponse;
    history = freshHistory(next.questions);
    if (currentQuestion(history)) {
      phase = "asking";
      return;
    }
    if (next.isComplete) {
      phase = "complete";
      return;
    }
    if (history.length === 0) {
      phase = "empty";
      return;
    }
    beginWait("none");
  }

  return {
    mount(next) {
      alive = true;
      clearTimers();
      params = {
        questions: next.questions,
        lastResponse: next.lastResponse,
        isComplete: next.isComplete,
        resetToken: next.resetToken,
      };
      seenResetToken = next.resetToken;
      hasSeenResetToken = true;
      retriesUsed = 0;
      history = rebuildHistory(next.pairs, next.questions);
      ready = true;
      settleFromHistory();
      commit();
    },

    update(next) {
      if (!alive || !ready) return;
      if (!hasSeenResetToken) {
        seenResetToken = next.resetToken;
        hasSeenResetToken = true;
      } else if (next.resetToken !== seenResetToken) {
        applyReset(next);
        commit();
        return;
      }

      params = next;
      history = mergeHistory(history, next.questions);
      if (phase === "thinking" || phase === "retrying") evaluateWaiting();
      else evaluateIdle();
      commit();
    },

    submit(raw) {
      if (!alive || phase !== "asking") return;
      const answer = raw.trim();
      if (answer === "") return;
      const nextHistory = answerCurrent(history, answer);
      if (nextHistory === history) return;
      history = nextHistory;
      beginWait("user", serializeAnswers(history));
      commit();
    },

    saveEdit(question, raw) {
      if (!alive || phase === "thinking" || phase === "retrying") return;
      const answer = raw.trim();
      if (answer === "") return;
      const nextHistory = editAnswer(history, question, answer);
      if (nextHistory === history) return;
      history = nextHistory;
      beginWait("user", serializeAnswers(history));
      commit();
    },

    tryAgain() {
      if (!alive || phase !== "no-response") return;
      beginWait("user", serializeAnswers(history));
      commit();
    },

    destroy() {
      alive = false;
      clearTimers();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },
  };
}
