export function EmptyState({ unset }: { unset: boolean }) {
  return (
    <section className="gq-hero" data-screen={unset ? "unset" : "empty"}>
      <h1 className="gq-question">{unset ? "Waiting for questions." : "No questions yet."}</h1>
      <p className="gq-lede">
        {unset
          ? "They'll appear here once the list is connected."
          : "The next one will show up in this space."}
      </p>
    </section>
  );
}
