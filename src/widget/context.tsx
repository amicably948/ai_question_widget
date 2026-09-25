import { createContext, useContext, type ReactNode } from "react";
import type { AnswersSubmittedPayload, EmitMeta, ParameterValues } from "./widget.config";

export type ParameterLoadState = "loading" | "loaded";

export interface WidgetParameters {
  state: ParameterLoadState;
  values: ParameterValues;
}

export interface WidgetContextValue {
  parameters: WidgetParameters;
  emitEvent: (
    eventId: "answersSubmitted",
    payload: AnswersSubmittedPayload,
    meta?: EmitMeta,
  ) => void;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

export function WidgetProvider({
  value,
  children,
}: {
  value: WidgetContextValue;
  children: ReactNode;
}) {
  return <WidgetContext.Provider value={value}>{children}</WidgetContext.Provider>;
}

/**
 * Stand-in for Foundry's `useFoundryWidgetContext`.
 * Porting swaps this hook for the real one. See PORTING.md.
 */
export function useWidgetContext(): WidgetContextValue {
  const value = useContext(WidgetContext);
  if (!value) {
    throw new Error("useWidgetContext must be used within a WidgetProvider");
  }
  return value;
}
