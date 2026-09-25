import { GRACE_PERIOD_MS, RESPONSE_TIMEOUT_MS } from "../widget/logic/constants";
import { parameterIds, type ParameterValues } from "../widget/widget.config";
import type { LogEntry } from "./Harness";
import { PERFECT_AI, WORST_AI, type AiConfig } from "./mockAi";

const FRAMES = [
  { id: "narrow", label: "Narrow", width: 340, height: 680 },
  { id: "medium", label: "Medium", width: 460, height: 720 },
  { id: "wide", label: "Wide", width: 820, height: 720 },
  { id: "short", label: "Short", width: 640, height: 360 },
] as const;

interface ControlPanelProps {
  values: ParameterValues;
  loadState: "loading" | "loaded";
  aiConfig: AiConfig;
  messageDraft: string;
  theme: "light" | "dark";
  log: readonly LogEntry[];
  onReset: () => void;
  onRemount: () => void;
  onToggleLoading: () => void;
  onToggleComplete: () => void;
  onMessageDraft: (value: string) => void;
  onFrame: (width: number, height: number) => void;
  onTheme: (theme: "light" | "dark") => void;
  onAiConfig: (config: AiConfig) => void;
  onInject: (partial: Partial<ParameterValues>, message: string) => void;
  onClearLog: () => void;
}

export function ControlPanel(props: ControlPanelProps) {
  const { aiConfig, onAiConfig } = props;

  function patch(partial: Partial<AiConfig>) {
    onAiConfig({ ...aiConfig, ...partial });
  }

  return (
    <aside className="panel">
      <header className="panel-header">
        <h1>Workshop harness</h1>
        <p>Fake host for the Guided Questions widget. The widget only sees parameters and events.</p>
      </header>

      <section className="panel-section">
        <h2>Session</h2>
        <div className="button-row">
          <button type="button" onClick={props.onReset}>
            Reset
          </button>
          <button type="button" onClick={props.onRemount}>
            Remount
          </button>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={props.loadState === "loading"}
            onChange={props.onToggleLoading}
          />
          Parameters loading
        </label>
        <label className="check">
          <input type="checkbox" checked={props.values.isComplete === true} onChange={props.onToggleComplete} />
          isComplete
        </label>
        <label className="field">
          Thinking messages
          <textarea
            rows={4}
            value={props.messageDraft}
            placeholder={"One message per line\nLeave empty for the defaults"}
            onChange={(event) => props.onMessageDraft(event.target.value)}
          />
        </label>
      </section>

      <section className="panel-section">
        <h2>Frame</h2>
        <div className="button-row">
          {FRAMES.map((frame) => (
            <button key={frame.id} type="button" onClick={() => props.onFrame(frame.width, frame.height)}>
              {frame.label}
            </button>
          ))}
        </div>
        <p className="hint">Drag the frame’s corner to resize freely.</p>
        <div className="button-row">
          <button type="button" onClick={() => props.onTheme("light")} aria-pressed={props.theme === "light"}>
            Light
          </button>
          <button type="button" onClick={() => props.onTheme("dark")} aria-pressed={props.theme === "dark"}>
            Dark
          </button>
        </div>
      </section>

      <section className="panel-section">
        <h2>Mock AI</h2>
        <div className="button-row">
          <button type="button" onClick={() => onAiConfig(PERFECT_AI)}>
            Perfect AI
          </button>
          <button type="button" onClick={() => onAiConfig(WORST_AI)}>
            Worst case
          </button>
        </div>
        <p className="hint">
          Grace period is {GRACE_PERIOD_MS} ms. Response timeout is {RESPONSE_TIMEOUT_MS / 1000}s. Worst
          case turns every chaos control on, including never responding.
        </p>
        <Slider
          label="Response delay"
          min={0}
          max={5000}
          step={50}
          value={aiConfig.delayMs}
          suffix="ms"
          onChange={(delayMs) => patch({ delayMs })}
        />
        <Slider
          label="Complete after answers"
          min={1}
          max={13}
          step={1}
          value={aiConfig.completeAfter}
          onChange={(completeAfter) => patch({ completeAfter })}
        />
        <Slider
          label="Drop earlier questions"
          min={0}
          max={100}
          step={5}
          value={Math.round(aiConfig.dropProbability * 100)}
          suffix="%"
          onChange={(percent) => patch({ dropProbability: percent / 100 })}
        />
        <Slider
          label="No new question"
          min={0}
          max={100}
          step={5}
          value={Math.round(aiConfig.noNewQuestionProbability * 100)}
          suffix="%"
          onChange={(percent) => patch({ noNewQuestionProbability: percent / 100 })}
        />
        <Slider
          label="lastResponse leads questions by"
          min={0}
          max={3000}
          step={50}
          value={aiConfig.gapMs}
          suffix="ms"
          onChange={(gapMs) => patch({ gapMs })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={aiConfig.shuffle}
            onChange={(event) => patch({ shuffle: event.target.checked })}
          />
          Shuffle the array
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={aiConfig.randomInsert}
            onChange={(event) => patch({ randomInsert: event.target.checked })}
          />
          Insert the new question at a random index
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={aiConfig.splitUpdate}
            onChange={(event) => patch({ splitUpdate: event.target.checked })}
          />
          Update lastResponse before questions
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={aiConfig.neverRespond}
            onChange={(event) => patch({ neverRespond: event.target.checked })}
          />
          Never respond
        </label>
      </section>

      <section className="panel-section">
        <h2>Bad input</h2>
        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              props.onInject({ answers: "{not json" }, "Injected malformed answers JSON.")
            }
          >
            Malformed answers
          </button>
          <button
            type="button"
            onClick={() =>
              props.onInject(
                { questions: undefined },
                "Questions unset. Anything already in the thread stays until you remount with empty answers.",
              )
            }
          >
            Questions unset
          </button>
          <button
            type="button"
            onClick={() =>
              props.onInject(
                { questions: [] },
                "Questions set to []. Seen questions stay put. Remount with empty answers to show the quiet empty screen.",
              )
            }
          >
            Empty questions
          </button>
        </div>
      </section>

      <section className="panel-section">
        <h2>Parameters</h2>
        <dl className="raw-list">
          {parameterIds.map((id) => {
            const value = props.values[id];
            return (
              <div key={id}>
                <dt>{id}</dt>
                <dd>
                  <pre>{value === undefined ? "unset" : JSON.stringify(value, null, 2)}</pre>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="panel-section">
        <div className="section-title">
          <h2>Events</h2>
          <button type="button" className="texty" onClick={props.onClearLog}>
            Clear
          </button>
        </div>
        {props.log.length === 0 ? (
          <p className="hint">No events yet.</p>
        ) : (
          <ol className="log">
            {props.log.map((entry) => (
              <li key={entry.id}>
                <div className="log-top">
                  <time dateTime={entry.at}>{entry.at.slice(11, 23)}</time>
                  <strong>{entry.eventId}</strong>
                  <span className={entry.source === "retry" ? "badge badge-retry" : "badge"}>
                    {entry.source === "retry" ? "Retry" : "User"}
                  </span>
                </div>
                <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const text = suffix ? `${value}${suffix}` : String(value);
  return (
    <label className="field">
      <span className="slider-label">
        {label}
        <span>{text}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
