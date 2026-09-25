import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRACE_PERIOD_MS, MAX_AUTO_RETRIES, RESPONSE_TIMEOUT_MS } from "./constants";
import { createQuestionSession, type MountParams, type QuestionSession } from "./session";

interface Emit {
  answers: string;
  source: "user" | "retry";
}

function params(overrides: Partial<MountParams> = {}): MountParams {
  return {
    questions: ["What is the goal?"],
    pairs: [],
    lastResponse: "t0",
    isComplete: false,
    resetToken: "init",
    ...overrides,
  };
}

describe("question session", () => {
  let emits: Emit[];
  let session: QuestionSession;

  beforeEach(() => {
    vi.useFakeTimers();
    emits = [];
    session = createQuestionSession({
      onEmit: (answers, source) => {
        emits.push({ answers, source });
      },
    });
  });

  afterEach(() => {
    session.destroy();
    vi.useRealTimers();
  });

  function mount(overrides: Partial<MountParams> = {}) {
    const initial = params(overrides);
    session.mount(initial);
    return initial;
  }

  it("does not emit for an initial lastResponse or a later change while asking", () => {
    mount();
    expect(session.getSnapshot().phase).toBe("asking");
    session.update(params({ lastResponse: "t1" }));
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS + GRACE_PERIOD_MS);
    expect(emits).toEqual([]);
    expect(session.getSnapshot().phase).toBe("asking");
  });

  it("shows a new question wherever it sits in the array", () => {
    const initial = mount();
    session.submit("Ship the beta");
    expect(emits).toHaveLength(1);
    expect(emits[0]?.source).toBe("user");
    expect(JSON.parse(emits[0]?.answers ?? "[]")).toEqual([
      { question: "What is the goal?", answer: "Ship the beta" },
    ]);
    expect(session.getSnapshot().phase).toBe("thinking");

    session.update({
      ...initial,
      questions: ["Who is it for?", "What is the goal?"],
      lastResponse: "t1",
    });
    expect(session.getSnapshot().phase).toBe("asking");
    expect(session.getSnapshot().history.map((entry) => entry.question)).toEqual([
      "What is the goal?",
      "Who is it for?",
    ]);
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS);
    expect(emits).toHaveLength(1);
  });

  it("waits out a grace period when lastResponse moves before questions", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update({ ...initial, lastResponse: "t1" });
    expect(session.getSnapshot().phase).toBe("thinking");

    vi.advanceTimersByTime(GRACE_PERIOD_MS - 1);
    expect(emits.filter((emit) => emit.source === "retry")).toHaveLength(0);

    session.update({
      ...initial,
      lastResponse: "t1",
      questions: ["What is the goal?", "Who is it for?"],
    });
    expect(session.getSnapshot().phase).toBe("asking");
    vi.advanceTimersByTime(GRACE_PERIOD_MS + RESPONSE_TIMEOUT_MS);
    expect(emits.filter((emit) => emit.source === "retry")).toHaveLength(0);
  });

  it("shows a question that arrives before lastResponse without retrying", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update({
      ...initial,
      questions: ["What is the goal?", "Who is it for?"],
    });
    expect(session.getSnapshot().phase).toBe("asking");
    session.update({
      ...initial,
      lastResponse: "t9",
      questions: ["What is the goal?", "Who is it for?"],
    });
    vi.advanceTimersByTime(GRACE_PERIOD_MS + 500);
    expect(emits.filter((emit) => emit.source === "retry")).toHaveLength(0);
  });

  it("retries when the response has no new question, then stops", () => {
    const initial = mount();
    session.submit("Ship it");

    for (let attempt = 1; attempt <= MAX_AUTO_RETRIES; attempt += 1) {
      session.update({ ...initial, lastResponse: `t${attempt}` });
      vi.advanceTimersByTime(GRACE_PERIOD_MS);
      expect(session.getSnapshot().phase).toBe("retrying");
      expect(emits.filter((emit) => emit.source === "retry")).toHaveLength(attempt);
      expect(emits[emits.length - 1]?.answers).toBe(emits[0]?.answers);
    }

    session.update({ ...initial, lastResponse: "t-final" });
    vi.advanceTimersByTime(GRACE_PERIOD_MS);
    expect(session.getSnapshot().phase).toBe("no-response");
    expect(emits.filter((emit) => emit.source === "retry")).toHaveLength(MAX_AUTO_RETRIES);
  });

  it("completes when the response sets isComplete and adds no question", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update({ ...initial, lastResponse: "t1", isComplete: true });
    expect(session.getSnapshot().phase).toBe("complete");
    vi.advanceTimersByTime(GRACE_PERIOD_MS + RESPONSE_TIMEOUT_MS);
    expect(emits).toHaveLength(1);
  });

  it("prefers a new question over isComplete", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update({
      ...initial,
      lastResponse: "t1",
      isComplete: true,
      questions: ["Who is it for?", "What is the goal?"],
    });
    expect(session.getSnapshot().phase).toBe("asking");
    expect(session.getSnapshot().history[1]?.question).toBe("Who is it for?");
  });

  it("times out when lastResponse never changes", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update(initial);
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS - 1);
    expect(session.getSnapshot().phase).toBe("thinking");
    vi.advanceTimersByTime(1);
    expect(session.getSnapshot().phase).toBe("no-response");
    expect(emits).toHaveLength(1);
  });

  it("resets the timeout on each retry", () => {
    const initial = mount();
    session.submit("Ship it");
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS - 1000);
    session.update({ ...initial, lastResponse: "t1" });
    vi.advanceTimersByTime(GRACE_PERIOD_MS);
    expect(session.getSnapshot().phase).toBe("retrying");
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS - 1);
    expect(session.getSnapshot().phase).toBe("retrying");
    vi.advanceTimersByTime(1);
    expect(session.getSnapshot().phase).toBe("no-response");
  });

  it("Try again emits as the user and restores the retry budget", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update({ ...initial, lastResponse: "t1" });
    vi.advanceTimersByTime(GRACE_PERIOD_MS);
    session.update({ ...initial, lastResponse: "t2" });
    vi.advanceTimersByTime(GRACE_PERIOD_MS);
    session.update({ ...initial, lastResponse: "t3" });
    vi.advanceTimersByTime(GRACE_PERIOD_MS);
    expect(session.getSnapshot().phase).toBe("no-response");

    session.tryAgain();
    expect(emits[emits.length - 1]?.source).toBe("user");
    expect(session.getSnapshot().phase).toBe("thinking");
    expect(session.getSnapshot().retriesUsed).toBe(0);

    session.update({ ...initial, lastResponse: "t4" });
    vi.advanceTimersByTime(GRACE_PERIOD_MS);
    expect(session.getSnapshot().phase).toBe("retrying");
  });

  it("does not emit when saving an unchanged answer", () => {
    const initial = mount({
      pairs: [{ question: "What is the goal?", answer: "Ship it" }],
      questions: ["What is the goal?", "Who is it for?"],
    });
    expect(session.getSnapshot().phase).toBe("asking");
    session.saveEdit("What is the goal?", "Ship it");
    expect(emits).toEqual([]);
    session.saveEdit("What is the goal?", "   ");
    expect(emits).toEqual([]);
    session.update(initial);
    expect(emits).toEqual([]);
  });

  it("editing an earlier answer keeps later questions and then thinks", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update({
      ...initial,
      lastResponse: "t1",
      questions: ["What is the goal?", "Who is it for?"],
    });
    session.saveEdit("What is the goal?", "Ship the beta");
    expect(session.getSnapshot().phase).toBe("thinking");
    expect(session.getSnapshot().history.map((entry) => entry.answer)).toEqual([
      "Ship the beta",
      null,
    ]);
    expect(emits[emits.length - 1]?.source).toBe("user");
    expect(JSON.parse(emits[emits.length - 1]?.answers ?? "[]")).toEqual([
      { question: "What is the goal?", answer: "Ship the beta" },
    ]);
  });

  it("ignores an answers echo and does not emit again", () => {
    const initial = mount();
    session.submit("Ship it");
    session.update(initial);
    session.update(initial);
    expect(emits).toHaveLength(1);
    expect(session.getSnapshot().phase).toBe("thinking");
  });

  it("remounts into thinking without emitting when every question is answered", () => {
    mount({
      pairs: [{ question: "What is the goal?", answer: "Ship it" }],
      questions: ["What is the goal?"],
      lastResponse: "t4",
      isComplete: false,
    });
    expect(session.getSnapshot().phase).toBe("thinking");
    expect(emits).toEqual([]);
    expect(session.getSnapshot().history[0]?.answer).toBe("Ship it");
  });

  it("remounts straight to the next question when it is already in the list", () => {
    mount({
      pairs: [{ question: "What is the goal?", answer: "Ship it" }],
      questions: ["Who is it for?", "What is the goal?"],
    });
    expect(session.getSnapshot().phase).toBe("asking");
    expect(session.getSnapshot().history[1]?.question).toBe("Who is it for?");
    expect(emits).toEqual([]);
  });

  it("remounts into the completion state without emitting", () => {
    mount({
      pairs: [{ question: "What is the goal?", answer: "Ship it" }],
      questions: ["What is the goal?"],
      isComplete: true,
    });
    expect(session.getSnapshot().phase).toBe("complete");
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS);
    expect(emits).toEqual([]);
  });

  it("reset clears thinking and does not emit or restore old answers", () => {
    const initial = mount();
    session.submit("Ship it");
    expect(session.getSnapshot().phase).toBe("thinking");
    session.update({
      ...initial,
      resetToken: "next",
      questions: ["Where should we start?"],
    });
    expect(session.getSnapshot().phase).toBe("asking");
    expect(session.getSnapshot().history).toEqual([
      { question: "Where should we start?", answer: null },
    ]);
    expect(emits).toHaveLength(1);
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS + GRACE_PERIOD_MS);
    expect(emits).toHaveLength(1);
    expect(session.getSnapshot().phase).toBe("asking");
  });

  it("does not treat the initial reset token as a reset", () => {
    mount({ resetToken: "kept", pairs: [{ question: "What is the goal?", answer: "Ship it" }] });
    session.update(
      params({
        resetToken: "kept",
        pairs: [],
        questions: ["What is the goal?", "Who is it for?"],
      }),
    );
    expect(session.getSnapshot().history[0]?.answer).toBe("Ship it");
    expect(session.getSnapshot().history[1]?.question).toBe("Who is it for?");
  });

  it("clears timers on destroy", () => {
    mount();
    session.submit("Ship it");
    session.destroy();
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS + GRACE_PERIOD_MS);
    expect(session.getSnapshot().phase).toBe("thinking");
    expect(emits).toHaveLength(1);
  });

  it("moves from complete back to thinking without emitting when isComplete turns off", () => {
    const initial = mount({
      pairs: [{ question: "What is the goal?", answer: "Ship it" }],
      isComplete: true,
    });
    expect(session.getSnapshot().phase).toBe("complete");
    session.update({ ...initial, isComplete: false });
    expect(session.getSnapshot().phase).toBe("thinking");
    expect(emits).toEqual([]);
  });

  it("blocks edits while thinking", () => {
    const initial = mount({
      pairs: [{ question: "What is the goal?", answer: "Ship it" }],
      questions: ["What is the goal?", "Who is it for?"],
    });
    session.saveEdit("What is the goal?", "Changed");
    expect(session.getSnapshot().phase).toBe("thinking");
    session.saveEdit("What is the goal?", "Changed again");
    expect(session.getSnapshot().history[0]?.answer).toBe("Changed");
    expect(emits).toHaveLength(1);
    session.update(initial);
    expect(emits).toHaveLength(1);
  });
});
