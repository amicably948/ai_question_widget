type StatusKind = "loading" | "invalid-answers" | "invalid-questions";

const COPY: Record<StatusKind, { title: string; body: string }> = {
  loading: {
    title: "Loading the conversation…",
    body: "The questions will show up once Workshop has finished passing them in.",
  },
  "invalid-answers": {
    title: "These answers can't be read",
    body: "Answers need to be a JSON list of question and answer pairs. Nothing has been changed.",
  },
  "invalid-questions": {
    title: "These questions can't be read",
    body: "Questions need to be a list of text. Nothing has been sent back.",
  },
};

export function StatusScreen({ kind }: { kind: StatusKind }) {
  const copy = COPY[kind];
  return (
    <div className="gq" data-screen={kind}>
      <div className="gq-scroll">
        <section className="gq-hero gq-status" role="status">
          {kind === "loading" ? <span className="gq-thinking-mark" aria-hidden="true" /> : null}
          <h1 className="gq-question">{copy.title}</h1>
          <p className="gq-lede">{copy.body}</p>
        </section>
      </div>
    </div>
  );
}
