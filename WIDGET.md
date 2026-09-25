# Guided Questions

An AI-driven question and answer conversation for a Workshop module. The widget shows one question at a time, collects the answer, and gives the full thread back. The module around it runs the AI and decides when to reset. The widget does not call the Ontology or any other Foundry API.

Earlier questions stay on screen, quieter than the current one. People can scroll back and edit them. Saving an edit sends the same event as answering the current question.

## Parameters

| id | type | required | what to bind |
|---|---|---|---|
| `questions` | string array | yes | The AI’s latest question list. It may be incomplete, reordered, or missing older questions. The widget keeps its own history. |
| `answers` | string (JSON) | yes | Output, also read back after a remount. A JSON list of `{ "question", "answer" }` in the order questions were first asked. |
| `lastResponse` | timestamp | yes | Set this every time the AI function finishes, including when it adds no question. The widget compares the raw value with the value it saw when it started waiting. |
| `thinkingMessages` | string array | no | Lines for the thinking screen. Omit it, or pass an empty list, to use the built-in lines. |
| `isComplete` | boolean | no | When true after the thread is answered, the widget shows a summary instead of waiting for another question. |
| `resetToken` | string | no | Change this to reset the widget. The value on first load does not reset anything. |

Example `answers` value:

```json
[
  { "question": "What are you hoping this project will achieve?", "answer": "A pilot our ops team can run in May." },
  { "question": "Who is this for, and what are they trying to get done?", "answer": "Dispatchers closing the day." }
]
```

Example `questions` value:

```json
[
  "Who is this for, and what are they trying to get done?",
  "What are you hoping this project will achieve?"
]
```

The new question does not need to be last. Questions already asked can be missing.

Example `thinkingMessages`:

```json
["Reading that through…", "Deciding what is still missing…"]
```

Example `lastResponse`: `2026-09-25T09:41:12.184Z`

## Events

| id | display name | parameter updates | when it fires |
|---|---|---|---|
| `answersSubmitted` | Answers submitted | `answers` | The user submits the current question, saves a changed earlier answer, presses Try again, or the widget automatically retries (at most twice per wait). |

It does not fire on load, on a remount, when parameters refresh, or when `resetToken` changes.

## Wire it to the AI

1. Bind `questions`, `answers`, `lastResponse`, and `isComplete` to Workshop variables.
2. On `answersSubmitted`, run the AI function with the `answers` variable.
3. When the function finishes, set `lastResponse` to a new timestamp and set `questions` to the list it returned. Set `isComplete` to true when the conversation is over and there is no further question.
4. Prefer writing `lastResponse` and `questions` in the same Workshop update. If they land separately, keep the gap under a second. The widget waits **1 second** after `lastResponse` changes before it decides no new question arrived. A new question during that second cancels the retry.
5. If `lastResponse` does not change for **30 seconds**, the widget stops waiting and offers Try again. That button emits `answersSubmitted` again.
6. If a response arrives and the list contains no new question, the widget re-emits `answersSubmitted` with the same answers, up to **2** times, then shows the same Try again message.

`isComplete: true` with no new question ends the wait and shows the summary. A new question still wins over `isComplete`.

## Reset

Reset only comes from the module. The widget has no reset control.

In **one** variable update:

1. Set `answers` to `[]`.
2. Set `questions` to a single opening question (or to whatever the fresh start should be).
3. Set `isComplete` to false.
4. Set `resetToken` to a new string that is different from the previous one.

The widget clears its memory, stops thinking, and does not emit. It then treats `questions` as a brand-new list.

The token that is already set when the widget loads must not change on a remount, or a remount would wipe the thread. Changing the token is the reset. Loading the page is not.

If `answers` is not cleared in that same update, the widget looks reset until Workshop unmounts it. The next mount rebuilds from `answers` first, and the old thread comes back.

## Behaviour notes

- The current question is the earliest one in the widget’s history that has no answer yet.
- History order is the order questions were first seen, not the order of the latest `questions` array.
- Two strings that differ only by surrounding or repeated spaces are the same question. Different capitalisation is a different question.
- While the thinking screen is up, earlier answers can be read and cannot be edited. That avoids overlapping AI runs.
- If the widget remounts with every known question already answered and `isComplete` is not true, it shows the thinking screen and does not emit. It is still waiting for the AI.
- Empty or missing `questions`, with no history yet, is a quiet waiting state. Malformed `answers` JSON pauses the widget on a short explanation instead of crashing.
- Answer with Enter. Shift+Enter adds a line. Empty answers are not sent.

## Limitations

- The widget cannot tell two genuinely different questions apart when their text matches after whitespace is collapsed.
- Automatic retries send the same `answers` payload again. The AI function should tolerate that.
- `answers` is JSON text, not a structured parameter, because the widget parameter types do not include an object list.
- The widget will not reset itself, and it will not write `questions`, `lastResponse`, or `isComplete`.
