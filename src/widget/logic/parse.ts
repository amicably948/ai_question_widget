import { DEFAULT_THINKING_MESSAGES } from "./constants";
import type { AnswerPair } from "./questions";

export type AnswersParse =
  | { ok: true; pairs: AnswerPair[]; unset: boolean }
  | { ok: false; reason: string };

export type QuestionsParse =
  | { ok: true; questions: string[]; unset: boolean; empty: boolean }
  | { ok: false; reason: string };

function isAnswerPair(value: unknown): value is AnswerPair {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.question === "string" && typeof record.answer === "string";
}

/** Blank or missing answers are an empty list. Anything else malformed is invalid. */
export function parseAnswers(raw: unknown): AnswersParse {
  if (raw === undefined || raw === null) {
    return { ok: true, pairs: [], unset: true };
  }
  if (typeof raw !== "string") {
    return { ok: false, reason: "Answers must be a JSON string." };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, pairs: [], unset: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, reason: "Answers are not valid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "Answers must be a JSON list." };
  }

  const pairs: AnswerPair[] = [];
  for (const item of parsed) {
    if (!isAnswerPair(item)) {
      return { ok: false, reason: "Each answer needs a question and an answer." };
    }
    pairs.push({ question: item.question, answer: item.answer });
  }

  return { ok: true, pairs, unset: false };
}

export function parseQuestions(raw: unknown): QuestionsParse {
  if (raw === undefined || raw === null) {
    return { ok: true, questions: [], unset: true, empty: true };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "Questions must be a list of text." };
  }

  const questions: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, reason: "Questions must be a list of text." };
    }
    questions.push(item);
  }

  return { ok: true, questions, unset: false, empty: questions.length === 0 };
}

/** `lastResponse` is compared as a raw string. Non-strings count as "no value". */
export function readLastResponse(raw: unknown): string | null {
  return typeof raw === "string" ? raw : null;
}

export function readResetToken(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

export function readIsComplete(raw: unknown): boolean {
  return raw === true;
}

export function resolveThinkingMessages(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return DEFAULT_THINKING_MESSAGES;
  const messages: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed !== "") messages.push(trimmed);
  }
  return messages.length > 0 ? messages : DEFAULT_THINKING_MESSAGES;
}
