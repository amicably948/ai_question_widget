import { describe, expect, it } from "vitest";
import { DEFAULT_THINKING_MESSAGES } from "./constants";
import { parseAnswers, parseQuestions, resolveThinkingMessages } from "./parse";

describe("parseAnswers", () => {
  it("treats missing and blank values as no answers", () => {
    expect(parseAnswers(undefined)).toEqual({ ok: true, pairs: [], unset: true });
    expect(parseAnswers(null)).toEqual({ ok: true, pairs: [], unset: true });
    expect(parseAnswers("  ")).toEqual({ ok: true, pairs: [], unset: true });
  });

  it("parses a JSON list of pairs", () => {
    expect(parseAnswers('[{"question":"Goal?","answer":"Ship"}]')).toEqual({
      ok: true,
      pairs: [{ question: "Goal?", answer: "Ship" }],
      unset: false,
    });
  });

  it("rejects malformed JSON and the wrong shape", () => {
    expect(parseAnswers("{not json").ok).toBe(false);
    expect(parseAnswers('{"question":"Goal?"}').ok).toBe(false);
    expect(parseAnswers('["Goal?"]').ok).toBe(false);
    expect(parseAnswers("12").ok).toBe(false);
  });
});

describe("parseQuestions", () => {
  it("distinguishes unset from an empty list", () => {
    expect(parseQuestions(undefined)).toMatchObject({ ok: true, unset: true, empty: true });
    expect(parseQuestions([])).toEqual({ ok: true, questions: [], unset: false, empty: true });
  });

  it("rejects non-lists", () => {
    expect(parseQuestions("Goal?").ok).toBe(false);
    expect(parseQuestions([1, 2]).ok).toBe(false);
  });
});

describe("resolveThinkingMessages", () => {
  it("uses the defaults when unset, empty, or blank", () => {
    expect(resolveThinkingMessages(undefined)).toBe(DEFAULT_THINKING_MESSAGES);
    expect(resolveThinkingMessages([])).toBe(DEFAULT_THINKING_MESSAGES);
    expect(resolveThinkingMessages(["  ", ""])).toBe(DEFAULT_THINKING_MESSAGES);
  });

  it("uses custom messages and drops blanks", () => {
    expect(resolveThinkingMessages([" One ", "", "Two"])).toEqual(["One", "Two"]);
  });
});
