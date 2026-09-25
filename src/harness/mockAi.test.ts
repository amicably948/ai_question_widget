import { describe, expect, it } from "vitest";
import { PERFECT_AI, planAiResponse, type AiConfig } from "./mockAi";

const bank = ["Who is it for?", "What is success?"];

function config(overrides: Partial<AiConfig> = {}): AiConfig {
  return { ...PERFECT_AI, completeAfter: 5, ...overrides };
}

describe("planAiResponse", () => {
  it("appends the next bank question when chaos is off", () => {
    const plan = planAiResponse({
      canonical: ["Opening"],
      answerCount: 1,
      config: config(),
      bank,
      random: () => 0,
    });
    expect(plan.isComplete).toBe(false);
    expect(plan.questions).toEqual(["Opening", "Who is it for?"]);
    expect(plan.canonical).toEqual(["Opening", "Who is it for?"]);
  });

  it("can drop earlier questions and insert the new one at the start", () => {
    const plan = planAiResponse({
      canonical: ["Opening", "Who is it for?"],
      answerCount: 2,
      config: config({ dropProbability: 1, randomInsert: true }),
      bank,
      random: () => 0,
    });
    expect(plan.questions).toEqual(["What is success?"]);
    expect(plan.canonical).toEqual(["Opening", "Who is it for?", "What is success?"]);
  });

  it("can return no new question", () => {
    const plan = planAiResponse({
      canonical: ["Opening"],
      answerCount: 1,
      config: config({ noNewQuestionProbability: 1, shuffle: true }),
      bank,
      random: () => 0,
    });
    expect(plan.questions).toEqual(["Opening"]);
    expect(plan.isComplete).toBe(false);
    expect(plan.canonical).toEqual(["Opening"]);
  });

  it("completes after the configured number of answers without adding a question", () => {
    const plan = planAiResponse({
      canonical: ["Opening", "Who is it for?"],
      answerCount: 4,
      config: config({ completeAfter: 4 }),
      bank,
      random: () => 0,
    });
    expect(plan.isComplete).toBe(true);
    expect(plan.questions).toEqual(["Opening", "Who is it for?"]);
  });
});
