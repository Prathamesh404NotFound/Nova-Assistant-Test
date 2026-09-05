# Nova AI OS

A futuristic web-based AI operating system interface featuring interactive widgets, agents,
smart tools, and dynamic dashboards. Built with React, TypeScript, Vite, Tailwind CSS,
shadcn/ui and Firebase RTDB.

## Expression Engine & Animated Avatar

Nova is now a full expressive performer. Everything is software-only, built on the original sprite registry (`src/config/novaSprites.ts`).

### Implemented features

1. **Memory-Reactive Presence** – Nova's baseline expression follows her mood state; reactions are driven by real conversation events.
2. **Conversational Blush Feedback** – when you correct Nova ("actually…", "no, I said…"), a cyan *recalibration shimmer* sweeps over her face (`shimmer` prop) and she shows a humble expression.
3. **Pacing-Aware Speech Choreography** – voice state drives expressions: curiosity tilt while listening, joy while speaking, focused processing while generating.
4. **Ambient Empathy Halo** – the halo behind her avatar breathes and shifts color to mirror *your* sentiment (calming teal when stressed, warm amber when excited), via the existing emotion engine (`sentimentToEmotion`).
5. **Thinking-in-Progress Thought Particles** – glyph-particles orbit her head during `processing`/`focus`, one per reasoning step.
6. **Time-of-Day Circadian Personality** – her baseline emotion and blink rate follow your local clock (sleepy late night, bright mornings, focused midday) via `circadianBaseline()`.
7. **Attention Beacon** – `expressAttentionBeacon()` raises a brief alert pose instead of a banner.
8. **Emotion Hold-Queue (no whiplash)** – `EmotionHoldQueue` guarantees each expression holds its natural minimum duration and blends over its cue's transition window; higher-priority emotions can preempt the queue.
9. **Celebration Micro-Rituals** – `expressCelebration()` fires a short earned celebration that never repeats the same one twice in a row.
10. **Expression blending** – every emotion transitions smoothly (head tilt + sprite cross-fade) instead of hard-swapping.

### Emotion → Animation Cue & Pacing Map

| Emotion | Sprite | Halo color | Head tilt | Transition | Hold |
|---|---|---|---|---|---|
| Joy | happy | warm amber | 2° | 150ms | 1.5s |
| Surprise | excited | electric cyan | -5° | 80ms | 400ms |
| Curiosity | curious | violet | 9° | 400ms | 1.8s |
| Focus | focused | deep blue | 0° | 300ms | 1.2s + particles |
| Confidence | confident | gold | 0° | 400ms | 1.6s |
| Gentle/Empathy | gentle | soft teal | 0° | 600ms | 2s |
| Alert | alert | amber | -2° | 120ms | 1.5s |
| Sleepy | sleepy | dim slate | 3° | 2.2s | 2.5s |
| Processing | processing | cyan pulse | 0° | 250ms | loop + particles |
| Humble/Recalibration | gentle | rose | 8° | 600ms | 1.8s + shimmer |
| Error/Concern | error | red-orange | -3° | 120ms | 1.6s |
| Proud/Satisfied | happy | gold→teal | -2° | 300ms | 1.3s |

### Usage

```tsx
// Simple: raw sprite (unchanged, backward compatible)
<SpriteNovaAvatar state="idle" size={48} />

// Expressive: perform an emotion with halo, tilt, blink-rate and particles
<SpriteNovaAvatar emotion="curiosity" size={90} glow shimmer />

// Drive from code
import { EmotionHoldQueue, expressCelebration, expressAttentionBeacon } from "@/services/nova/expression-engine";
const queue = new EmotionHoldQueue();
queue.express("joy");
expressCelebration(queue, "big");
```

## Permission Panel

Nova now includes a full permission-management UI in **Settings → Security**.

### What it does

- Lists every permission Nova requires (microphone, notifications, memory saving,
  local storage, voice synthesis, external actions, automations, calendar, email,
  browser research) with a description and a grant/revoke toggle.
- **Grant All** button grants every required permission in one click. For
  microphone and notifications, the real browser permission prompt is triggered.
- Per-permission toggles let you grant or revoke anything individually at any time.
- Permission state is stored locally (`localStorage` key `nova_permissions_v1`)
  so it survives reloads without leaving the device.

### Configuration

No setup is required. To extend the permission list, edit
`src/services/permissions/PermissionsService.ts` — add an entry to
`REQUIRED_PERMISSIONS` and it appears in the Settings panel automatically.
To gate a feature in code, call:

```ts
import { permissionsService } from "@/services/permissions";

if (permissionsService.isGranted("memory_saving")) {
  // proceed
}
```

## Memory Saving

Memories are managed in the **Memory** page and can now be saved directly from chat:
any message starting with **"remember …"** (e.g. "Remember that my meeting is Friday")
is saved to your memory panel automatically, categorized as a note/preference/person.
Memory saving requires the `memory_saving` permission (enabled by default).

## Nova Labs

Six novel assistant features live in `src/services/nova/labs.ts` (localStorage-persisted, device-local, no new dependencies):

1. **Time-Debt Auditor** — every chat task is logged with an estimated manual-duration; the Dashboard shows how much time Nova has reclaimed.
2. **Assumption Ledger** — Nova surfaces assumptions as dismissible chips under her reply; rejecting one tunes future behavior.
3. **Proactive Friction Detector** — scans your activity log for repeated manual patterns and surfaces one suggestion per day on the Dashboard (dismissing a rule lowers its weight).
4. **Future-Self Letters** — say *"mail my future self …"* in chat; the letter is scheduled and delivered on the Dashboard two weeks later, styled "from your past self."
5. **Session Storyboard** — `buildSessionStoryboard()` compresses recent activity into a 6-panel reflective summary.
6. **Ephemeral Whisper Mode** — the ghost toggle in the chat input sends a message that is processed but never persisted anywhere (no history, memory, or activity logs), with an on-screen zero-retention notice.

Dashboard → **Nova Labs Insights** shows the time-reclaimed rollup, today's friction suggestion, and any due letters.

## Scripts

```bash
bun install      # install dependencies
bun run dev      # start dev server
bun run build    # production build
bun run lint     # typecheck
```

## Changelog (latest)

- Added `ExpressionEngine` (`src/services/nova/expression-engine.ts`): Emotion Hold-Queue, 12-emotion cue map, circadian baseline, sentiment→emotion bridge, attention beacon, celebration micro-rituals.
- Upgraded `SpriteNovaAvatar`: emotion prop, color-shifting breathing halo, head tilt, circadian blink rate, orbiting thought particles, cyan recalibration shimmer.
- Chat now drives expressions from voice state, user sentiment and corrections (humble recalibration + shimmer).
- Added `PermissionsService` and a Settings → Security permission panel with Grant All.
- Chat now saves "remember …" messages to the memory panel (permission-gated).
- Hardened Memory page add/delete against Firebase failures and signed-out state.
- Added **Nova Labs** (`src/services/nova/labs.ts`): Time-Debt Auditor, Assumption Ledger, Friction Detector, Future-Self Letters, Session Storyboard, and Ephemeral Whisper mode — wired into Chat and a new Dashboard Insights card.
