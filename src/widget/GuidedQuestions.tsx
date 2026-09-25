import { useMemo, useState } from "react";
import { CompletionScreen } from "./components/CompletionScreen";
import { CurrentQuestion } from "./components/CurrentQuestion";
import { EmptyState } from "./components/EmptyState";
import { HistoryList } from "./components/HistoryList";
import { NoResponseScreen } from "./components/NoResponseScreen";
import { StatusScreen } from "./components/StatusScreen";
import { ThinkingScreen } from "./components/ThinkingScreen";
import { useWidgetContext } from "./context";
import { currentQuestion, type HistoryEntry } from "./logic/questions";
import {
  parseAnswers,
  parseQuestions,
  readIsComplete,
  readLastResponse,
  readResetToken,
  resolveThinkingMessages,
} from "./logic/parse";
import type { Phase } from "./logic/session";
import { useQuestionSession } from "./useQuestionSession";
import type { ParameterValues } from "./widget.config";
import "./widget.css";

export function GuidedQuestions() {
  const { parameters } = useWidgetContext();
  if (parameters.state !== "loaded") return <StatusScreen kind="loading" />;
  return <LoadedConversation values={parameters.values} />;
}

function LoadedConversation({ values }: { values: ParameterValues }) {
  const questionsState = useMemo(() => parseQuestions(values.questions), [values.questions]);
  const answersState = useMemo(() => parseAnswers(values.answers), [values.answers]);
  if (!questionsState.ok) return <StatusScreen kind="invalid-questions" />;
  if (!answersState.ok) return <StatusScreen kind="invalid-answers" />;

  return (
    <Conversation
      questions={questionsState.questions}
      questionsUnset={questionsState.unset}
      pairs={answersState.pairs}
      lastResponse={readLastResponse(values.lastResponse)}
      isComplete={readIsComplete(values.isComplete)}
      resetToken={readResetToken(values.resetToken)}
      thinkingMessages={values.thinkingMessages}
    />
  );
}

interface ConversationProps {
  questions: string[];
  questionsUnset: boolean;
  pairs: { question: string; answer: string }[];
  lastResponse: string | null;
  isComplete: boolean;
  resetToken: string | undefined;
  thinkingMessages: ParameterValues["thinkingMessages"];
}

function Conversation(props: ConversationProps) {
  const { emitEvent } = useWidgetContext();
  const params = useMemo(
    () => ({
      questions: props.questions,
      pairs: props.pairs,
      lastResponse: props.lastResponse,
      isComplete: props.isComplete,
      resetToken: props.resetToken,
    }),
    [props.questions, props.pairs, props.lastResponse, props.isComplete, props.resetToken],
  );
  const messages = useMemo(
    () => resolveThinkingMessages(props.thinkingMessages),
    [props.thinkingMessages],
  );
  const session = useQuestionSession(params, (answers, source) => {
    emitEvent("answersSubmitted", { parameterUpdates: { answers } }, { source });
  });

  if (!session.snapshot.ready) {
    return <div className="gq" data-screen="preparing" />;
  }

  return (
    <ConversationView
      phase={session.snapshot.phase}
      history={session.snapshot.history}
      questionsUnset={props.questionsUnset}
      messages={messages}
      onSubmit={session.submit}
      onSaveEdit={session.saveEdit}
      onTryAgain={session.tryAgain}
    />
  );
}

function ConversationView({
  phase,
  history,
  questionsUnset,
  messages,
  onSubmit,
  onSaveEdit,
  onTryAgain,
}: {
  phase: Phase;
  history: readonly HistoryEntry[];
  questionsUnset: boolean;
  messages: readonly string[];
  onSubmit: (answer: string) => void;
  onSaveEdit: (question: string, answer: string) => void;
  onTryAgain: () => void;
}) {
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [phaseSeen, setPhaseSeen] = useState(phase);
  if (phase !== phaseSeen) {
    setPhaseSeen(phase);
    if (phase === "thinking" || phase === "retrying") setEditingQuestion(null);
  }

  const current = currentQuestion(history);
  const locked = phase === "thinking" || phase === "retrying";
  const position = current ? history.findIndex((entry) => entry.question === current.question) + 1 : 0;

  return (
    <div className="gq" data-phase={phase}>
      <div className="gq-sr" aria-live="polite">
        {liveAnnouncement(phase, current?.question ?? null, questionsUnset)}
      </div>
      <div className="gq-scroll">
        <div className="gq-stack">
          {questionsUnset && phase !== "empty" ? (
            <p className="gq-banner" role="status">
              Questions aren't connected. Showing the thread saved so far.
            </p>
          ) : null}
          <HistoryList
            entries={history}
            editable={!locked}
            editingQuestion={locked ? null : editingQuestion}
            onStartEdit={setEditingQuestion}
            onCancel={() => setEditingQuestion(null)}
            onSave={(question, answer) => {
              onSaveEdit(question, answer);
              setEditingQuestion(null);
            }}
          />
          <Stage
            phase={phase}
            current={current}
            position={position}
            questionsUnset={questionsUnset}
            messages={messages}
            onSubmit={onSubmit}
            onTryAgain={onTryAgain}
          />
        </div>
      </div>
    </div>
  );
}

function Stage({
  phase,
  current,
  position,
  questionsUnset,
  messages,
  onSubmit,
  onTryAgain,
}: {
  phase: Phase;
  current: HistoryEntry | null;
  position: number;
  questionsUnset: boolean;
  messages: readonly string[];
  onSubmit: (answer: string) => void;
  onTryAgain: () => void;
}) {
  if (phase === "asking" && current) {
    return <CurrentQuestion question={current.question} position={position} onSubmit={onSubmit} />;
  }
  if (phase === "thinking" || phase === "retrying") {
    return <ThinkingScreen messages={messages} />;
  }
  if (phase === "complete") return <CompletionScreen />;
  if (phase === "no-response") return <NoResponseScreen onTryAgain={onTryAgain} />;
  return <EmptyState unset={questionsUnset} />;
}

function liveAnnouncement(phase: Phase, question: string | null, questionsUnset: boolean): string {
  if (phase === "asking" && question) return `New question. ${question}`;
  if (phase === "thinking" || phase === "retrying") return "Thinking about what to ask next.";
  if (phase === "complete") return "That's the end of the questions. You can still edit an answer.";
  if (phase === "no-response") return "No new question came back. You can try again.";
  return questionsUnset ? "Waiting for questions." : "No questions yet.";
}
