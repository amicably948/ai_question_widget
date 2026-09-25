export function NoResponseScreen({ onTryAgain }: { onTryAgain: () => void }) {
  return (
    <section className="gq-hero" data-screen="no-response">
      <h1 className="gq-question">No new question came back.</h1>
      <p className="gq-lede">Your answers are still here. We can try that again.</p>
      <div className="gq-actions">
        <button type="button" className="gq-button" onClick={onTryAgain}>
          Try again
        </button>
      </div>
    </section>
  );
}
