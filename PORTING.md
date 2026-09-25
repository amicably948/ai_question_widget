# Porting `src/widget/` into a Foundry widget set

The widget is isolated from the harness. Move `src/widget/` into the widget set and delete `src/harness/`, `src/main.tsx`, and the harness tests. Then make the changes below. Nothing in `src/widget/` imports the harness.

## 1. Swap the bridge hook

`src/widget/context.tsx` is the mock. Replace `useWidgetContext` with Foundry’s typed hook and delete `WidgetProvider`.

```ts
import { useFoundryWidgetContext } from "@osdk/widget.client-react";
import type WidgetConfig from "./widget.config";

export const useWidgetContext = useFoundryWidgetContext.withTypes<typeof WidgetConfig>();
```

Update the import in `GuidedQuestions.tsx`. The call shape stays `parameters.values.<id>` and `emitEvent(eventId, { parameterUpdates })`.

Confirm the installed SDK’s parameter state names. This mock uses `parameters.state === "loading"` and `"loaded"`, which matches the `parameters.state` field used by current custom widgets. If a version uses a different loaded value, map it in one place and keep the loading, invalid, empty, and ready screens.

Mount the widget from the set’s entry with `FoundryWidget`, and pass an OSDK client only if the set’s template requires it. This widget does not call the Ontology.

## 2. Adjust `widget.config.ts` to the real format

The file already uses the real ids and types. Wrap it the way the template expects:

```ts
import { defineConfig } from "@osdk/widget.client";

export default defineConfig({
  // same id, name, description, type, parameters, and events
});
```

Typical template differences:

- Default-export the config, often as `guidedQuestions.config.ts` or `main.config.ts`.
- The Vite plugin only discovers the config if the entry imports it (`import "./widget.config"` is enough).
- Drop any field `defineConfig` rejects. This mock does not add extras beyond `displayName`, `type`, `subType`, and `parameterUpdateIds`.
- `parameterUpdateIds` for `answersSubmitted` must stay `["answers"]`.

`answers` stays a **string**. Foundry custom widgets do not support structs or arrays of objects, so a list of `{ question, answer }` cannot be a parameter of its own. The string is JSON. Workshop builders see an example in `WIDGET.md`.

## 3. Remove the harness-only event argument

Calls look like this today:

```ts
emitEvent("answersSubmitted", { parameterUpdates: { answers } }, { source });
```

The real signature is two arguments. Delete the third (`{ source }`) and the `EmitMeta` type. `source` is only how the mock event log tells a person from an automatic retry. Retry behaviour itself does not depend on it.

## 4. Theme, size, and the document shell

The widget fills its parent (`.gq { height: 100% }`) and scrolls inside. Foundry runs the widget in an iframe, so add this to the widget stylesheet if the template does not already:

```css
html, body, #root { height: 100%; margin: 0; }
```

Colours follow `prefers-color-scheme`, and `html[data-theme="light"|"dark"]` overrides that. The harness sets `data-theme`. Foundry does not have to. Leaving the media query is enough for Workshop light and dark mode. `color-scheme` is set on `.gq` so the textarea matches.

There is no external font and no image request.

## 5. What you should not have to change

- `src/widget/logic/` has no React. The question tracker and the thinking/retry session can move as-is. Grace period, retry cap, and timeout are the constants at the top of `src/widget/logic/constants.ts`.
- Timers are cleared on unmount and on reset. The custom-widget runtime allows `setTimeout` / `setInterval`.
- Do not add `localStorage`, `sessionStorage`, `IndexedDB`, or `fetch`. The runtime blocks them, and this widget does not use them.
- Loading, malformed `answers`, a missing `questions` list, and an empty list already have screens. Keep those branches when wiring the real parameter objects; read every value defensively the way `src/widget/logic/parse.ts` does.
- `lastResponse` is compared as a raw string. Do not parse it as a date. If a future SDK hands the timestamp over as something other than a string, normalise it once in `readLastResponse` without involving the clock.

## 6. Workshop wiring after the move

The host still owns the AI and the reset. `WIDGET.md` is the note for the person building the module: bind the parameters, run the AI from `answersSubmitted`, write `questions` and `lastResponse` together when you can, and change `resetToken` in the same update that clears `answers`.
