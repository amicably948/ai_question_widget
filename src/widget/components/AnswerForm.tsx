import { useId, useState, type KeyboardEvent, type Ref } from "react";

interface AnswerFormProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  placeholder?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
}

export function AnswerForm({
  label,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  placeholder = "Write your answer",
  inputRef,
}: AnswerFormProps) {
  const inputId = useId();
  const hintId = useId();
  const [showEmpty, setShowEmpty] = useState(false);
  const empty = value.trim() === "";

  function submit() {
    if (empty) {
      setShowEmpty(true);
      return;
    }
    setShowEmpty(false);
    onSubmit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    const native = event.nativeEvent;
    if (native.isComposing || native.keyCode === 229) return;
    event.preventDefault();
    submit();
  }

  return (
    <form
      className="gq-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="gq-label" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        className="gq-input"
        rows={3}
        value={value}
        placeholder={placeholder}
        aria-invalid={showEmpty && empty}
        aria-describedby={hintId}
        onChange={(event) => {
          onChange(event.target.value);
          if (event.target.value.trim() !== "") setShowEmpty(false);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="gq-form-row">
        <p id={hintId} className={showEmpty && empty ? "gq-hint gq-hint-warn" : "gq-hint"}>
          {showEmpty && empty
            ? "Write an answer to continue."
            : "Enter to send, Shift+Enter for a new line."}
        </p>
        <div className="gq-actions">
          {onCancel ? (
            <button type="button" className="gq-button gq-button-quiet" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="gq-button">
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
