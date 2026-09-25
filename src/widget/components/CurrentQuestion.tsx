import { useEffect, useId, useRef, useState } from "react";
import { AnswerForm } from "./AnswerForm";

interface CurrentQuestionProps {
  question: string;
  position: number;
  onSubmit: (answer: string) => void;
}

export function CurrentQuestion({ question, position, onSubmit }: CurrentQuestionProps) {
  const headingId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, [question]);

  return (
    <section className="gq-hero" aria-labelledby={headingId} data-screen="asking">
      <p className="gq-kicker-inline">Question {position}</p>
      <h1 id={headingId} className="gq-question">
        {question}
      </h1>
      <AnswerForm
        label="Your answer"
        value={draft}
        onChange={setDraft}
        onSubmit={() => onSubmit(draft)}
        submitLabel="Submit"
        inputRef={inputRef}
      />
    </section>
  );
}
