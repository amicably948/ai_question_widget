# Guided Questions

A local mockup of a Palantir Foundry Workshop widget. It runs the question-and-answer UX, and the awkward parts of the logic, without Foundry. The widget never talks to a network and never uses browser storage. A fake Workshop module hosts it.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm test
npm run build
```

## Layout

- `src/widget/` is the widget. It is written so it can move into a Foundry widget set. It does not import `src/harness/`.
- `src/harness/` is the fake Workshop module: parameter state, the frame, and a deliberately unreliable mock AI.

The widget reads `parameters.values.<id>` and sends answers with `emitEvent("answersSubmitted", { parameterUpdates: { answers } })`. A third `meta` argument (`user` or `retry`) exists only so the harness can label the event log. Foundry's real `emitEvent` does not take it. See `PORTING.md`.

## Contract choices

Foundry custom widgets cannot carry a list of objects, so `answers` is a JSON string:

```json
[{ "question": "What are you hoping this project will achieve?", "answer": "Ship the beta" }]
```

Timing lives in `src/widget/logic/constants.ts`:

- Grace period after `lastResponse` changes, before a retry: **1 second**
- Automatic retries when that response has no new question: **2**
- Timeout if `lastResponse` never changes: **30 seconds**
- Thinking-message rotation: **2.5 seconds**

Question identity is the text with ends trimmed and internal whitespace collapsed. Comparison is case-sensitive. Order in the `questions` array is ignored.

On reset, the widget throws away its history and starts from `questions` only. It does not re-read `answers` until the next mount. A reset that forgets to clear `answers` looks fine until something remounts the widget.

## Manual test script

Start from **Perfect AI**. The frame starts on an opening question. Watch the event log and the raw parameters as you go.

1. **Submit.** Type an answer. Enter sends it. Shift+Enter inserts a line. Submit does the same as Enter. A blank or whitespace-only answer stays put and asks you to write something. The log shows one `answersSubmitted` from the user, then the thinking screen.
2. **Next question.** After the delay, a new question appears, the field is focused, and a screen reader announcement fires (`New question. …` in the live region).
3. **Edit.** Scroll to an earlier card, choose Edit, change the text, and Save. The log gets another user event and the thinking screen returns. Save without changing the text: the card closes and the log does not grow. Cancel or Escape discards the edit.
4. **Thinking messages.** Leave the textarea empty and watch the default lines rotate. Put two lines in the textarea and submit again; those lines are used instead. With “reduce motion” enabled in the OS, the text still changes but does not animate.
5. **Dropped, shuffled, or relocated questions.** Turn on “Drop earlier questions” (try 100%), Shuffle, and random insert. Submit. The thread above the card still has every question you already answered, and the new one is asked wherever it sat in the array.
6. **No new question, then give up.** Set “No new question” to 100%. Submit. The log shows two **Retry** events, about a second apart, then “No new question came back.” Try again sends a **User** event and the two retries are available again.
7. **`lastResponse` before `questions`.** Turn on “Update lastResponse before questions”. Set the gap to **400 ms** (under the 1s grace period), turn “No new question” back to 0, and submit. The new question appears and there is no retry. Set the gap to **1500 ms** and submit again. A retry can fire before the question lands; the question still shows up when it arrives.
8. **Timeout.** Turn on “Never respond” and submit. After 30 seconds the same gentle message and Try again button appear. No automatic retry is logged.
9. **Remount mid-thinking.** Submit, and press Remount before the AI replies. The answer is still in the thread, the thinking screen is back, and the log did not gain an event from the remount. Let the AI finish: the next question appears.
10. **Reset during thinking.** Submit, then press Reset before the reply. The opening question returns, answers are `[]`, `resetToken` changed, and Reset itself added no event. A late AI reply should not arrive; the harness cancels it.
11. **Complete.** With Perfect AI, answer until “Complete after answers” is reached (default 4). The summary lists the whole thread. Edit one. That emits and thinks; if the AI marks the thread complete again, the summary returns.
12. **Parameter states.** Toggle “Parameters loading” for the loading screen. “Malformed answers” shows the unreadable-answers screen and does not throw. “Questions unset” keeps any question already on screen and shows a short note; then set answers to `[]` in your head by pressing Reset, inject unset or empty again, and press Remount to see “Waiting for questions.” or “No questions yet.”
13. **Frame and theme.** Try Narrow, Medium, Wide, and Short, then drag the frame corner. Toggle Light and Dark. Tab to the field, the buttons, and Edit. Focus rings stay visible.
14. **Worst case.** The Worst case preset turns every chaos control on, including Never respond, so the widget waits until the timeout. Turn Never respond off to watch the other failures together.

`isComplete` can also be toggled from the panel. While a question is still unanswered, the question stays. After everything is answered, turning it on shows the summary and turning it off returns to thinking without emitting.
