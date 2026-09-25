/** How long to wait for `questions` after `lastResponse` changes, before retrying. */
export const GRACE_PERIOD_MS = 1000;

/** Automatic re-emits of `answersSubmitted` when a response brings no new question. */
export const MAX_AUTO_RETRIES = 2;

/**
 * Backstop when `lastResponse` never changes after a submission.
 * Compared with a local timer only. The AI response itself is detected by
 * comparing `lastResponse` values, not by reading the clock.
 */
export const RESPONSE_TIMEOUT_MS = 30_000;

/** How long each thinking message stays on screen. */
export const THINKING_MESSAGE_MS = 2500;

export const DEFAULT_THINKING_MESSAGES: readonly string[] = [
  "Reviewing your answer…",
  "Considering what to ask next…",
  "Connecting the dots…",
  "Looking for the thread that matters…",
  "Weighing what you've shared…",
  "Shaping the next question…",
  "Checking what's still unclear…",
  "Finding a useful angle…",
];
