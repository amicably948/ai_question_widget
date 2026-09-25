/**
 * Contract for the Guided Questions widget.
 * Ids and types match the Workshop parameter/event contract.
 * `answers` is a JSON string because Foundry custom widgets cannot carry a
 * list of objects as a parameter. See PORTING.md.
 */
export const widgetConfig = {
  id: "guidedQuestions",
  name: "Guided Questions",
  description:
    "Shows one AI-written question at a time, collects the answer, and hands the full thread back to Workshop.",
  type: "workshop",
  parameters: {
    questions: {
      displayName: "Questions",
      type: "array",
      subType: "string",
    },
    answers: {
      displayName: "Answers",
      type: "string",
    },
    lastResponse: {
      displayName: "Last response",
      type: "timestamp",
    },
    thinkingMessages: {
      displayName: "Thinking messages",
      type: "array",
      subType: "string",
    },
    isComplete: {
      displayName: "Is complete",
      type: "boolean",
    },
    resetToken: {
      displayName: "Reset token",
      type: "string",
    },
  },
  events: {
    answersSubmitted: {
      displayName: "Answers submitted",
      parameterUpdateIds: ["answers"],
    },
  },
} as const;

type StringArrayParam = { readonly type: "array"; readonly subType: "string" };
type ScalarParam = { readonly type: "string" | "boolean" | "timestamp" | "number" | "date" };

type ValueFor<P> = P extends StringArrayParam
  ? string[]
  : P extends { readonly type: "boolean" }
    ? boolean
    : P extends { readonly type: "number" }
      ? number
      : P extends { readonly type: "string" | "timestamp" | "date" }
        ? string
        : P extends ScalarParam
          ? string
          : unknown;

export type ParameterValues = {
  [K in keyof typeof widgetConfig.parameters]:
    | ValueFor<(typeof widgetConfig.parameters)[K]>
    | undefined;
};

export type WidgetEventId = keyof typeof widgetConfig.events;

export const parameterIds = Object.keys(widgetConfig.parameters) as (keyof ParameterValues)[];

export interface EmitMeta {
  source: "user" | "retry";
}

export interface AnswersSubmittedPayload {
  parameterUpdates: {
    answers: string;
  };
}
