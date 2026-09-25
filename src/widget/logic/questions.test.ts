import { describe, expect, it } from "vitest";
import {
  answerCurrent,
  currentQuestion,
  editAnswer,
  freshHistory,
  mergeHistory,
  rebuildHistory,
  serializeAnswers,
  type HistoryEntry,
} from "./questions";

function answered(question: string, answer: string): HistoryEntry {
  return { question, answer };
}

function open(question: string): HistoryEntry {
  return { question, answer: null };
}

describe("mergeHistory", () => {
  it("appends a new question that arrives at the end", () => {
    const history = [answered("What is the goal?", "Ship it")];
    const next = mergeHistory(history, ["What is the goal?", "Who is it for?"]);
    expect(next).toEqual([
      answered("What is the goal?", "Ship it"),
      open("Who is it for?"),
    ]);
    expect(currentQuestion(next)?.question).toBe("Who is it for?");
  });

  it("appends a new question that arrives at the start", () => {
    const history = [answered("What is the goal?", "Ship it")];
    const next = mergeHistory(history, ["Who is it for?", "What is the goal?"]);
    expect(next.map((entry) => entry.question)).toEqual(["What is the goal?", "Who is it for?"]);
  });

  it("appends a new question that arrives in the middle", () => {
    const history = [answered("Goal?", "Ship"), answered("Deadline?", "Friday")];
    const next = mergeHistory(history, ["Goal?", "Budget?", "Deadline?"]);
    expect(next.map((entry) => entry.question)).toEqual(["Goal?", "Deadline?", "Budget?"]);
  });

  it("keeps questions the AI dropped", () => {
    const history = [answered("Goal?", "Ship"), answered("Deadline?", "Friday")];
    const next = mergeHistory(history, ["Deadline?"]);
    expect(next).toBe(history);
  });

  it("ignores reordering", () => {
    const history = [answered("Goal?", "Ship"), open("Deadline?")];
    const next = mergeHistory(history, ["Deadline?", "Goal?"]);
    expect(next).toBe(history);
  });

  it("treats whitespace variants and duplicates as the same question", () => {
    const history = mergeHistory([], ["  What   is the goal?  ", "What is the goal?"]);
    expect(history).toEqual([open("What is the goal?")]);
    const again = mergeHistory(history, ["What   is the goal?", "  What is the goal?"]);
    expect(again).toBe(history);
  });

  it("adds several new questions in incoming array order", () => {
    const history = [answered("Goal?", "Ship")];
    const next = mergeHistory(history, ["Budget?", "Goal?", "Team?", "Risk?"]);
    expect(next.map((entry) => entry.question)).toEqual(["Goal?", "Budget?", "Team?", "Risk?"]);
    expect(currentQuestion(next)?.question).toBe("Budget?");
  });

  it("skips blank questions", () => {
    const next = mergeHistory([], ["  ", "Goal?"]);
    expect(next).toEqual([open("Goal?")]);
  });
});

describe("edits", () => {
  it("replaces an earlier answer without reordering or dropping later ones", () => {
    const history = [
      answered("Goal?", "Ship"),
      answered("Deadline?", "Friday"),
      open("Budget?"),
    ];
    const next = editAnswer(history, "Goal?", "Ship the beta");
    expect(next).toEqual([
      answered("Goal?", "Ship the beta"),
      answered("Deadline?", "Friday"),
      open("Budget?"),
    ]);
  });

  it("returns the same array when the answer is unchanged or blank-equivalent", () => {
    const history = [answered("Goal?", "Ship"), open("Budget?")];
    expect(editAnswer(history, "  Goal? ", "Ship")).toBe(history);
    expect(editAnswer(history, "Missing?", "Something")).toBe(history);
  });

  it("answers only the earliest unanswered question", () => {
    const history = [answered("Goal?", "Ship"), open("Deadline?"), open("Budget?")];
    const next = answerCurrent(history, "Friday");
    expect(next[1]).toEqual(answered("Deadline?", "Friday"));
    expect(next[2]).toEqual(open("Budget?"));
    expect(currentQuestion(next)?.question).toBe("Budget?");
  });
});

describe("rebuild and reset", () => {
  it("rebuilds from answers first, then merges questions, after a remount", () => {
    const answers = serializeAnswers([
      answered("Goal?", "Ship"),
      answered("Deadline?", "Friday"),
    ]);
    const pairs = JSON.parse(answers) as { question: string; answer: string }[];
    const history = rebuildHistory(pairs, ["  Budget? ", "Goal?", "Deadline?"]);
    expect(history).toEqual([
      answered("Goal?", "Ship"),
      answered("Deadline?", "Friday"),
      open("Budget?"),
    ]);
    expect(currentQuestion(history)?.question).toBe("Budget?");
  });

  it("does not ask a question that was only preserved in answers", () => {
    const history = rebuildHistory(
      [{ question: "Goal?", answer: "Ship" }],
      ["Deadline?"],
    );
    expect(history.map((entry) => entry.question)).toEqual(["Goal?", "Deadline?"]);
    expect(history[0]?.answer).toBe("Ship");
  });

  it("keeps the first position and the latest answer for duplicate answer rows", () => {
    const history = rebuildHistory(
      [
        { question: "Goal?", answer: "Ship" },
        { question: "  Goal?  ", answer: "Ship the beta" },
      ],
      [],
    );
    expect(history).toEqual([answered("Goal?", "Ship the beta")]);
  });

  it("treats a whitespace-only restored answer as unanswered", () => {
    const history = rebuildHistory([{ question: "Goal?", answer: "   " }], []);
    expect(history).toEqual([open("Goal?")]);
  });

  it("reset drops the old history and starts from the supplied questions", () => {
    const stale = [answered("Goal?", "Ship"), answered("Deadline?", "Friday")];
    const fresh = freshHistory(["  What are you hoping to achieve?  "]);
    expect(fresh).toEqual([open("What are you hoping to achieve?")]);
    expect(fresh).not.toEqual(stale);
    expect(serializeAnswers(fresh)).toBe("[]");
  });
});
