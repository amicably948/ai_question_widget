import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createQuestionSession, type MountParams, type SessionSnapshot } from "./logic/session";
import type { EmitMeta } from "./widget.config";

export interface QuestionSessionApi {
  snapshot: SessionSnapshot;
  submit: (answer: string) => void;
  saveEdit: (question: string, answer: string) => void;
  tryAgain: () => void;
}

const INITIAL_SNAPSHOT: SessionSnapshot = {
  ready: false,
  phase: "empty",
  history: [],
  retriesUsed: 0,
};

export function useQuestionSession(
  params: MountParams,
  onEmit: (answers: string, source: EmitMeta["source"]) => void,
): QuestionSessionApi {
  const onEmitRef = useRef(onEmit);
  onEmitRef.current = onEmit;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [session] = useState(() =>
    createQuestionSession({
      onEmit: (answers, source) => {
        onEmitRef.current(answers, source);
      },
    }),
  );

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    () => INITIAL_SNAPSHOT,
  );

  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    session.mount(paramsRef.current);
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      session.destroy();
    };
  }, [session]);

  useLayoutEffect(() => {
    if (!mountedRef.current) return;
    session.update(params);
  }, [session, params]);

  return {
    snapshot,
    submit: session.submit,
    saveEdit: session.saveEdit,
    tryAgain: session.tryAgain,
  };
}
