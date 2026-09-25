import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../logic/questions";
import { AnswerForm } from "./AnswerForm";

interface HistoryListProps {
  entries: readonly HistoryEntry[];
  editable: boolean;
  editingQuestion: string | null;
  onStartEdit: (question: string) => void;
  onCancel: () => void;
  onSave: (question: string, answer: string) => void;
}

export function HistoryList({
  entries,
  editable,
  editingQuestion,
  onStartEdit,
  onCancel,
  onSave,
}: HistoryListProps) {
  const answered = entries.filter((entry) => entry.answer !== null);
  if (answered.length === 0) return null;

  return (
    <section className="gq-history" aria-label="Earlier questions">
      <h2 className="gq-history-label">Earlier</h2>
      <ol className="gq-history-list">
        {answered.map((entry) => (
          <li key={entry.question}>
            <HistoryCard
              entry={entry}
              editable={editable}
              editing={editingQuestion === entry.question}
              onStartEdit={onStartEdit}
              onCancel={onCancel}
              onSave={onSave}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function HistoryCard({
  entry,
  editable,
  editing,
  onStartEdit,
  onCancel,
  onSave,
}: {
  entry: HistoryEntry;
  editable: boolean;
  editing: boolean;
  onStartEdit: (question: string) => void;
  onCancel: () => void;
  onSave: (question: string, answer: string) => void;
}) {
  const [draft, setDraft] = useState(entry.answer ?? "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(entry.answer ?? "");
  }, [editing, entry.answer]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing && entry.answer !== null) {
    return (
      <article className="gq-history-card gq-history-card-editing">
        <h3 className="gq-history-question">{entry.question}</h3>
        <AnswerForm
          label={`Edit answer for ${entry.question}`}
          value={draft}
          onChange={setDraft}
          onSubmit={() => onSave(entry.question, draft)}
          onCancel={onCancel}
          submitLabel="Save"
          inputRef={inputRef}
        />
      </article>
    );
  }

  return (
    <article className="gq-history-card">
      <h3 className="gq-history-question">{entry.question}</h3>
      <p className="gq-history-answer">{entry.answer}</p>
      {editable ? (
        <button type="button" className="gq-text-button" onClick={() => onStartEdit(entry.question)}>
          Edit
        </button>
      ) : null}
    </article>
  );
}
