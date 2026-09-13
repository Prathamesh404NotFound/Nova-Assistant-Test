# Nova Windows Agent

The controlled local "body" of Nova. The web app never gets arbitrary OS
access — desktop actions are issued as **named, allowlisted commands** over an
authenticated Firebase RTDB channel, and this agent executes only what its own
allowlist permits, verifies the effect, and reports structured results.

## Setup

1. **Firebase service account** — Firebase Console → Project settings →
   Service accounts → *Generate new private key*. Save it as
   `service-account.json` in this folder. **Never commit this file.**
2. Install & build:
   ```
   npm install
   npm run build
   ```
3. On the Nova web app, open **Devices → Pair desktop agent** to generate a
   6-digit pairing code (valid for 5 minutes).
4. Start the agent:
   ```
   npm start
   ```
   Enter the pairing code when prompted. The agent registers itself and
   appears as **pending approval** on the Devices page.
5. Approve the device on the Devices page. The agent heartbeat (every 15s)
   marks it online.

## Security model

- **No shell/eval surface.** Every capability is a named handler in
  `src/tools.ts`; there is no generic command execution.
- **Independent allowlist enforcement.** The web layer and the agent each hold
  their own copy of the allowlist; the agent never trusts the sender.
- **Risk gates.** HIGH-risk operations (file deletion) require an explicit
  `confirmed: true` flag that only a user-confirmed web action can set.
- **Revocation is immediate.** A revoked device stops processing commands and
  exits.
- **Filesystem scope.** File tools are restricted to simple filenames inside
  Documents / Desktop / temp; deletion moves files to a recoverable trash
  folder instead of hard-deleting.
- **Payload guards.** Oversized command arguments are rejected; screenshots
  flow agent → web only (never uploaded anywhere else).

## Supported tools

| Tool | Risk | Notes |
|---|---|---|
| `app.launch` / `app.close` / `app.focus` | LOW/MEDIUM | Process visibility verified after launch |
| `app.listWindows` / `app.activeWindow` | SAFE | Win32 enumeration |
| `screen.capture` | SAFE | PNG via PowerShell; temp file removed immediately |
| `mouse.click` / `mouse.move` / `mouse.scroll` | SAFE/LOW | Win32 SendInput |
| `keyboard.type` / `keyboard.press` / `keyboard.hotkey` | SAFE/LOW | SendKeys with escaping |
| `clipboard.read` / `write` / `clear` | MEDIUM/LOW | Base64 round-trip (no quoting issues) |
| `system.info` | SAFE | CPU, memory, disk, uptime |
| `notification.show` | LOW | Windows Toast (balloon-tip fallback) |
| `files.create` / `read` / `list` | SAFE/LOW | Allowlisted directories only |
| `files.delete` | HIGH | Requires confirmation; reversible trash |

## Platform note

On non-Windows platforms the agent registers and reports, but every OS tool
returns `UNSUPPORTED` rather than guessing — the web layer surfaces this
honestly.
