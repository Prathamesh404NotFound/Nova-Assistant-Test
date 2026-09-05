# Nova Voice Fix Report

## Root Cause

Nova listened but did not reliably reply or keep conversing because of four defects in the
voice pipeline:

1. **Stale closure killed the voice loop (primary bug).** In `Chat.tsx`,
   `ttsRouter.setCallbacks({ onEnd })` was registered inside a mount-only `useEffect`.
   The `onEnd` closure captured `voiceModeActive = false` from the first render and never
   saw updates. When TTS finished, `if (voiceModeActive)` was always false, so speech
   recognition was never restarted. Nova listened once and then went silent forever.

2. **Cached responses were never spoken.** `use-chat.ts` returned early on a response-cache
   hit without calling `onSpeak`, so repeated questions got on-screen text but no voice.

3. **STT kept listening while Nova processed and spoke.** The recognition session was not
   paused after a final transcript, causing race conditions where Nova could transcribe her
   own spoken answer or overlap AI requests.

4. **STT errors were swallowed.** `onerror` only logged to console; microphone-permission
   denial, unsupported browsers, and audio failures looked like a frozen UI. Fatal errors
   also triggered the auto-restart path, risking restart loops.

## Changes Made

### Voice pipeline fixes

- **`src/hooks/use-offline-stt.ts`** — rewritten with the same public API:
  - `continuous` option is now honored via a ref (previously read once, partially used).
  - Ref-based mutable state (`shouldListenRef`, `startingRef`, `continuousRef`) prevents
    stale closures and duplicate `SpeechRecognition` instances.
  - Fatal errors (`not-allowed`, `service-not-allowed`, `audio-capture`, `not-supported`)
    stop auto-restart and surface a typed `STTError` via a new `onError` callback.
  - `no-speech` and `aborted` are treated as benign; auto-restart is delayed 400 ms to
    prevent rapid restart loops; restart only occurs while a voice session is active.
  - Correct separation of interim vs. final transcripts; empty finals are never forwarded.
  - Full cleanup on unmount (abort recognition, clear restart timers, null out refs).
  - Graceful unsupported-browser handling via `window.SpeechRecognition` /
    `window.webkitSpeechRecognition` with a user-facing error message.
- **`src/types/global.d.ts`** — added missing `onstart` to the `SpeechRecognition`
  type declarations.
- **`src/hooks/use-chat.ts`** — cached responses and error messages now invoke `onSpeak`,
  so voice behavior is identical for fresh, cached, and error responses.
- **`src/pages/Chat.tsx`** — voice loop rebuilt as an explicit state machine:
  - `voiceModeActiveRef` mirrors `voiceModeActive` so the TTS `onEnd` callback reads
    current state, never a stale mount-time value.
  - `startSTTRef` / `stopSTTRef` hold the latest STT controls for callbacks.
  - On a final transcript: STT stops first (no self-hearing), then the message is sent.
  - After TTS completes, STT auto-restarts after 300 ms if voice mode is still active.
  - Toggle button cleanly stops STT and TTS when voice mode is deactivated.
  - New `voiceError` banner with a Retry action for recoverable errors.
  - `sendMessage` is guarded by the existing `isStreaming` check, so one spoken command
    can never produce duplicate AI requests.

### Sprite system (new)

- **`src/assets/nova/nova-{state}.svg`** — 14 original SVG sprites: idle, listening,
  thinking, speaking, happy, excited, curious, focused, confident, gentle, alert, sleepy,
  processing, error. Same base character geometry, per-state expression and accent color.
- **`src/config/novaSprites.ts`** — centralized registry (`NOVA_SPRITES`,
  `NovaSpriteState`, `VOICE_STATE_TO_SPRITE`). No hard-coded asset paths in components.
- **`src/components/nova/SpriteNovaAvatar.tsx`** — reusable `<SpriteNovaAvatar
  state size glow />` component.

### Voice → sprite state mapping

| Voice state | Sprite |
|---|---|
| idle | idle |
| listening | listening |
| processing (AI request) | processing → mapped to `thinking` for the legacy avatar |
| speaking | speaking |
| error | error |

The full 14-state registry (`VOICE_STATE_TO_SPRITE`) exposes all emotional states
(happy, excited, curious, focused, confident, gentle, alert, sleepy) so they can be
rendered anywhere the sprite component is used.

## Voice Architecture

```
User activates voice mode (mic toggle)
      ↓
STT starts (continuous, interim + final results)
      ↓ final transcript
STT stops (prevents self-hearing)
      ↓
sendMessage(text) → AI pipeline (existing AIRouter/orchestrator, unchanged)
      ↓ response (fresh, cached, or error — all now spoken)
onSpeak(text) → ttsRouter.speak()
      ↓
TTS onEnd fires → checks voiceModeActiveRef (current value)
      ↓
STT auto-restarts after 300 ms → loop continues
```

## Files Changed

- `src/hooks/use-offline-stt.ts` (rewritten)
- `src/hooks/use-chat.ts` (speak on cache hit + error path)
- `src/pages/Chat.tsx` (voice state machine, refs, sprite wiring, error banner)
- `src/types/global.d.ts` (added `onstart` to SpeechRecognition types)
- `src/config/novaSprites.ts` (new)
- `src/components/nova/SpriteNovaAvatar.tsx` (new)
- `src/assets/nova/nova-*.svg` (new, 14 files)
- `SPRITES_LICENSE.md` (new)
- `NOVA_VOICE_FIX_REPORT.md` (this file)

## Testing

- **TypeScript:** `bun tsc --noEmit` — 0 errors.
- **Production build:** `bun run build` — succeeds (✓ built in 15.40s), all sprites
  bundled into `dist/`.
- **SVG validity:** all 14 SVGs parse as valid XML.
- **Manual voice testing:** the browser voice loop (mic → transcript → AI → TTS →
  restart) requires a real browser microphone and was **not executed in this sandbox**.
  Follow the instructions below to run the 7 scenario tests. The state machine and all
  callback paths were verified by code trace and typecheck; do not treat this as
  substitute for on-device voice testing.
- **Browser limitations:** SpeechRecognition requires Chrome/Edge (or another Web Speech
  API provider); Firefox and Safari support varies. Permission denial, missing mic, and
  unsupported browsers now surface explicit UI errors instead of freezing.

### How to run & test voice mode

1. `bun install && bun run dev` (or use the Freebuff preview).
2. Open the Chat page in Chrome/Edge, allow the microphone.
3. Click the mic button to enter voice mode (it turns red/pulsing).
4. Run the scenarios:
   - **Test 1 — Basic command:** say "Hello Nova" → transcript appears in input, message
     is sent, response streams, Nova speaks it.
   - **Test 2 — Follow-up:** "What is the capital of India?" then after the answer,
     "Who is the current prime minister?" — Nova must re-listen automatically.
   - **Test 3 — Multiple turns:** at least 4 consecutive turns without touching the mic.
   - **Test 4 — Interrupt:** click the mic again mid-conversation → STT and TTS stop.
   - **Test 5 — Mic denial:** block the permission → orange error banner appears with
     Retry; voice mode deactivates cleanly.
   - **Test 6 — Empty speech:** stay silent → `no-speech` is ignored, no AI request fires.
   - **Test 7 — Sprite transitions:** watch the header avatar cycle
     idle → listening → thinking → speaking → listening.

## Licensing

All 14 sprites are original artwork created for this project — see
`SPRITES_LICENSE.md`. No third-party or copyrighted assets were added. Existing project
licenses and attributions were not modified.

## Rollback

All changes are confined to the files listed above; none touch auth, storage, routing,
AI providers, or data schemas. To revert:

```
git revert <commit-of-this-change>
```

or, manually: restore `use-offline-stt.ts`, `use-chat.ts`, `Chat.tsx`, and
`global.d.ts` from the previous commit and delete `src/assets/nova/`,
`src/config/novaSprites.ts`, `src/components/nova/SpriteNovaAvatar.tsx`,
`SPRITES_LICENSE.md`, and this report. No data migration or env changes are involved.

## Remaining Limitations

- Real microphone testing must be done in a browser (Chrome/Edge recommended).
- Hindi speech recognition depends on the recognition engine's language support;
  the STT hook currently defaults to `en-US` (configurable via the `lang` option).
- The legacy `NovaAvatar` (procedural SVG) still exists for other pages; the chat page
  now uses the 14-state sprite. Other pages can adopt `SpriteNovaAvatar` incrementally.
- Emotional sprites (happy, excited, curious, etc.) are registered and renderable but are
  not yet auto-selected from response sentiment — the voice loop currently cycles the
  five core states.
