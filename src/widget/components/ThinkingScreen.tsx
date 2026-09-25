import { useEffect, useState } from "react";
import { THINKING_MESSAGE_MS } from "../logic/constants";

export function ThinkingScreen({ messages }: { messages: readonly string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [messages]);

  useEffect(() => {
    if (messages.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, THINKING_MESSAGE_MS);
    return () => window.clearInterval(id);
  }, [messages]);

  const message = messages[index] ?? messages[0] ?? "";

  return (
    <section className="gq-hero gq-thinking" aria-busy="true">
      <span className="gq-thinking-mark" aria-hidden="true" />
      <h1 className="gq-question gq-thinking-text" key={message}>
        {message}
      </h1>
    </section>
  );
}
