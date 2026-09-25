import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GuidedQuestions, WidgetProvider, type EmitMeta, type ParameterValues } from "../widget";
import { ControlPanel } from "./ControlPanel";
import { createMockAi, PERFECT_AI, type AiConfig, type MockAi } from "./mockAi";
import { OPENING_QUESTION } from "./questionBank";
import "./harness.css";

export interface LogEntry {
  id: number;
  at: string;
  eventId: string;
  payload: { answers: string };
  source: EmitMeta["source"];
}

const INITIAL_VALUES: ParameterValues = {
  questions: [OPENING_QUESTION],
  answers: "[]",
  lastResponse: undefined,
  thinkingMessages: undefined,
  isComplete: false,
  resetToken: "init",
};

export function Harness() {
  const [values, setValues] = useState<ParameterValues>(INITIAL_VALUES);
  const [loadState, setLoadState] = useState<"loading" | "loaded">("loaded");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [mountKey, setMountKey] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [aiConfig, setAiConfig] = useState<AiConfig>(PERFECT_AI);
  const [messageDraft, setMessageDraft] = useState("");
  const [note, setNote] = useState("Ready.");
  const [frameSize, setFrameSize] = useState({ width: 460, height: 720 });
  const frameRef = useRef<HTMLDivElement>(null);
  const logId = useRef(0);
  const aiRef = useRef<MockAi | null>(null);
  const configRef = useRef(aiConfig);
  configRef.current = aiConfig;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const ai = createMockAi({
      openingQuestion: OPENING_QUESTION,
      getConfig: () => configRef.current,
      apply: (updates) => {
        setValues((current) => ({ ...current, ...updates }));
      },
    });
    aiRef.current = ai;
    return () => {
      ai.dispose();
      aiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.width = "460px";
    frame.style.height = "720px";
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setFrameSize({ width: Math.round(box.width), height: Math.round(box.height) });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const emitEvent = useCallback(
    (
      eventId: "answersSubmitted",
      payload: { parameterUpdates: { answers: string } },
      meta?: EmitMeta,
    ) => {
      logId.current += 1;
      const entry: LogEntry = {
        id: logId.current,
        at: new Date().toISOString(),
        eventId,
        payload: payload.parameterUpdates,
        source: meta?.source ?? "user",
      };
      setLog((current) => [entry, ...current].slice(0, 40));
      setValues((current) => ({ ...current, ...payload.parameterUpdates }));
      aiRef.current?.notify(payload.parameterUpdates.answers);
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      parameters: { state: loadState, values },
      emitEvent,
    }),
    [loadState, values, emitEvent],
  );

  function applyFrame(width: number, height: number) {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
  }

  function reset() {
    aiRef.current?.reset();
    setValues((current) => ({
      ...current,
      resetToken: crypto.randomUUID(),
      answers: "[]",
      questions: [OPENING_QUESTION],
      isComplete: false,
    }));
    setNote("Reset: new token, cleared answers, and the opening question, in one update.");
  }

  function remount() {
    setMountKey((key) => key + 1);
    setNote("Widget remounted. Internal state was rebuilt from the current answers.");
  }

  function updateMessages(draft: string) {
    setMessageDraft(draft);
    const lines = draft
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    setValues((current) => ({
      ...current,
      thinkingMessages: lines.length > 0 ? lines : undefined,
    }));
  }

  return (
    <div className="harness">
      <div className="stage">
        <div className="frame" ref={frameRef}>
          <div className="frame-bar">
            <span>Widget frame</span>
            <span>
              {frameSize.width} × {frameSize.height}
            </span>
          </div>
          <div className="frame-body">
            <WidgetProvider value={contextValue}>
              <GuidedQuestions key={mountKey} />
            </WidgetProvider>
          </div>
        </div>
        <p className="stage-note">{note}</p>
      </div>
      <ControlPanel
        values={values}
        loadState={loadState}
        aiConfig={aiConfig}
        messageDraft={messageDraft}
        theme={theme}
        log={log}
        onReset={reset}
        onRemount={remount}
        onToggleLoading={() => {
          setLoadState((current) => (current === "loading" ? "loaded" : "loading"));
        }}
        onToggleComplete={() => {
          setValues((current) => ({ ...current, isComplete: current.isComplete !== true }));
        }}
        onMessageDraft={updateMessages}
        onFrame={applyFrame}
        onTheme={setTheme}
        onAiConfig={setAiConfig}
        onInject={(partial, message) => {
          aiRef.current?.cancel();
          setValues((current) => ({ ...current, ...partial }));
          setNote(message);
        }}
        onClearLog={() => setLog([])}
      />
    </div>
  );
}
