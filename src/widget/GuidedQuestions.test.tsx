import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { WidgetProvider, type WidgetContextValue } from "./context";
import { GuidedQuestions } from "./GuidedQuestions";
import type { ParameterValues } from "./widget.config";

function values(overrides: Partial<ParameterValues> = {}): ParameterValues {
  return {
    questions: ["What are you hoping this project will achieve?"],
    answers: "[]",
    lastResponse: undefined,
    thinkingMessages: undefined,
    isComplete: false,
    resetToken: "init",
    ...overrides,
  };
}

function renderWidget(
  parameters: WidgetContextValue["parameters"],
  emit: WidgetContextValue["emitEvent"] = vi.fn(),
) {
  return render(
    <StrictMode>
      <WidgetProvider value={{ parameters, emitEvent: emit }}>
        <GuidedQuestions />
      </WidgetProvider>
    </StrictMode>,
  );
}

describe("GuidedQuestions", () => {
  it("does not emit on mount and shows the opening question", () => {
    const emit = vi.fn();
    renderWidget({ state: "loaded", values: values() }, emit);
    expect(screen.getByRole("heading", { name: "What are you hoping this project will achieve?" })).toBeInTheDocument();
    expect(emit).not.toHaveBeenCalled();
  });

  it("submits with the button and blocks a blank answer", async () => {
    const user = userEvent.setup();
    const emit = vi.fn();
    renderWidget({ state: "loaded", values: values() }, emit);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(emit).not.toHaveBeenCalled();
    expect(screen.getByText("Write an answer to continue.")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Ship the beta");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(emit).toHaveBeenCalledWith(
      "answersSubmitted",
      {
        parameterUpdates: {
          answers: JSON.stringify([
            { question: "What are you hoping this project will achieve?", answer: "Ship the beta" },
          ]),
        },
      },
      { source: "user" },
    );
    expect(screen.getByRole("heading", { name: "Reviewing your answer…" })).toBeInTheDocument();
  });

  it("submits on Enter and keeps Shift+Enter as a newline", async () => {
    const user = userEvent.setup();
    const emit = vi.fn();
    renderWidget({ state: "loaded", values: values() }, emit);
    const field = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(field, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(emit).not.toHaveBeenCalled();
    expect(field).toHaveValue("Line one\nLine two");
    await user.type(field, "{Enter}");
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("shows loading, invalid answers, unset questions, and an empty list", () => {
    const { rerender } = renderWidget({ state: "loading", values: values() });
    expect(screen.getByRole("heading", { name: "Loading the conversation…" })).toBeInTheDocument();

    rerender(
      <StrictMode>
        <WidgetProvider
          value={{
            parameters: { state: "loaded", values: values({ answers: "{not json" }) },
            emitEvent: vi.fn(),
          }}
        >
          <GuidedQuestions />
        </WidgetProvider>
      </StrictMode>,
    );
    expect(screen.getByRole("heading", { name: "These answers can't be read" })).toBeInTheDocument();

    rerender(
      <StrictMode>
        <WidgetProvider
          value={{
            parameters: { state: "loaded", values: values({ questions: undefined, answers: "[]" }) },
            emitEvent: vi.fn(),
          }}
        >
          <GuidedQuestions />
        </WidgetProvider>
      </StrictMode>,
    );
    expect(screen.getByRole("heading", { name: "Waiting for questions." })).toBeInTheDocument();

    rerender(
      <StrictMode>
        <WidgetProvider
          value={{
            parameters: { state: "loaded", values: values({ questions: [], answers: "[]" }) },
            emitEvent: vi.fn(),
          }}
        >
          <GuidedQuestions />
        </WidgetProvider>
      </StrictMode>,
    );
    expect(screen.getByRole("heading", { name: "No questions yet." })).toBeInTheDocument();
  });
});
