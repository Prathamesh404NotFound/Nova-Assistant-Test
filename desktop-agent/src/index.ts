/**
 * Nova Windows Agent — main entry point.
 *
 * Connects to Firebase RTDB with a service-account credential, registers this
 * machine as a device under `devices/{deviceId}`, and consumes the
 * `commands` queue. Only commands whose tool name is in the allowlist and
 * whose risk is accepted are executed; every result is published back with
 * verification evidence.
 *
 * Security properties:
 *  - No generic shell/eval passthrough; only named tool handlers.
 *  - The agent independently enforces its own allowlist (defense in depth —
 *    the web layer has the same list, but the agent never trusts it).
 *  - A revoked device stops processing commands immediately.
 *  - Pairing requires a one-time code entered locally by the user.
 *
 * Setup:
 *   1. Create a Firebase service account (Console → Project settings →
 *      Service accounts) and save the JSON as `service-account.json`
 *      next to this file (NEVER commit it).
 *   2. `npm install && npm run build && npm start`
 *   3. Enter the pairing code shown on the Nova Devices page.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { initializeApp, cert, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import {
  launchApp, closeApp, listWindows, activeWindow, focusWindow,
  captureScreen, mouseAction, typeText, keyPress, hotkey,
  clipboardRead, clipboardWrite, clipboardClear,
  systemInfo, showNotification,
  createFile, readFile, deleteFile, listFiles,
  promptForPairingCode,
  type ToolOutcome,
} from "./tools";

// ─── Allowlist (independent enforcement on the agent side) ─────────────────

type Handler = (args: Record<string, unknown>) => Promise<ToolOutcome>;const TOOL_HANDLERS: Record<string, { handler: Handler; risk: string }> = {
  "app.launch":        { handler: (a) => launchApp(a as { application: string }),        risk: "LOW" },
  "app.close":         { handler: (a) => closeApp(a as { application: string }),         risk: "MEDIUM" },
  "app.listWindows":   { handler: () => listWindows(),                 risk: "SAFE" },
  "app.activeWindow":  { handler: () => activeWindow(),                risk: "SAFE" },
  "app.focus":         { handler: (a) => focusWindow(a as { application?: string; windowId?: string }), risk: "SAFE" },
  "screen.capture":    { handler: () => captureScreen(),               risk: "SAFE" },
  "mouse.click":       { handler: (a) => mouseAction({ ...(a as Record<string, unknown>), action: "click" } as never),  risk: "LOW" },
  "mouse.move":        { handler: (a) => mouseAction({ ...(a as Record<string, unknown>), action: "move" } as never),   risk: "SAFE" },
  "mouse.scroll":      { handler: (a) => mouseAction({ ...(a as Record<string, unknown>), action: "scroll" } as never), risk: "SAFE" },
  "keyboard.type":     { handler: (a) => typeText(a as { text: string; delayMs?: number }),         risk: "LOW" },
  "keyboard.press":    { handler: (a) => keyPress(a as { key: string; modifiers?: string[] }),         risk: "SAFE" },
  "keyboard.hotkey":   { handler: (a) => hotkey(a as { keys: string[] }),           risk: "LOW" },
  "clipboard.read":    { handler: () => clipboardRead(),               risk: "MEDIUM" },
  "clipboard.write":   { handler: (a) => clipboardWrite(a as { text: string }),   risk: "LOW" },
  "clipboard.clear":   { handler: () => clipboardClear(),              risk: "MEDIUM" },
  "system.info":       { handler: () => systemInfo(),                  risk: "SAFE" },
  "notification.show": { handler: (a) => showNotification(a as { title: string; body: string }), risk: "LOW" },
  "files.create":      { handler: (a) => createFile(a as { name: string; content: string }),       risk: "LOW" },
  "files.read":        { handler: (a) => readFile(a as { name: string }),         risk: "SAFE" },
  "files.delete":      { handler: (a) => deleteFile(a as { name: string }),       risk: "HIGH" },
  "files.list":        { handler: (a) => listFiles(a as { dir?: string }),        risk: "SAFE" },
};

const MAX_ARGS_BYTES = 64 * 1024; // reject oversized payloads (screenshots go result→web, not web→agent)

// ─── Firebase setup ─────────────────────────────────────────────────────────

const SA_PATH = path.join(__dirname, "..", "service-account.json");
const STATE_PATH = path.join(__dirname, "..", "agent-state.json");

interface AgentState {
  deviceId: string;
  pairedAt: number;
}

function loadState(): AgentState | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as AgentState;
  } catch {
    return null;
  }
}

function saveState(state: AgentState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

async function main(): Promise<void> {
  if (!fs.existsSync(SA_PATH)) {
    console.error(`
[Nova Agent] service-account.json not found.

Setup:
  1. Firebase Console → Project settings → Service accounts → Generate new private key
  2. Save the JSON as: ${SA_PATH}
  3. Run again. A pairing code will be requested on first start.
`);
    process.exit(1);
  }

  const app: App = initializeApp({ credential: cert(SA_PATH) });
  const db: Database = getDatabase(app);
  console.log("[Nova Agent] Connected to Firebase");

  // ── Device identity / pairing ────────────────────────────────────────────
  let state = loadState();
  const hostname = os.hostname();

  if (!state) {
    console.log(`[Nova Agent] First run on "${hostname}".`);
    const code = await promptForPairingCode();
    if (!/^\d{6}$/.test(code)) {
      console.error("[Nova Agent] Invalid pairing code (expected 6 digits). Exiting.");
      process.exit(1);
    }
    // Exchange the code: the Devices page publishes codes under pairingCodes.
    const codeRef = db.ref(`pairingCodes/${code}`);
    const snap = await codeRef.get();
    const issuedUserId = (snap.val() as { issuedBy?: string } | null)?.issuedBy;
    if (!issuedUserId) {
      console.error("[Nova Agent] Pairing code not found or expired. Generate a new one on the Devices page.");
      process.exit(1);
    }
    await codeRef.remove();

    state = {
      deviceId: `dev_${crypto.randomBytes(8).toString("hex")}`,
      pairedAt: Date.now(),
    };
    saveState(state);

    // Register the device (web approves it on the Devices page).
    await db.ref(`devices/${state.deviceId}`).set({
      deviceId: state.deviceId,
      deviceName: hostname,
      platform: "windows",
      agentVersion: "1.0.0",
      authorized: false,   // user must approve in the Devices page
      revoked: false,
      lastSeen: Date.now(),
      capabilities: Object.keys(TOOL_HANDLERS),
    });
    console.log(`[Nova Agent] Registered as device ${state.deviceId}. Approve it on the Nova Devices page.`);
  }

  const deviceId = state.deviceId;
  const deviceRef = db.ref(`devices/${deviceId}`);
  const commandsRef = db.ref(`devices/${deviceId}/commands`);

  // ── Heartbeat / revocation watch ─────────────────────────────────────────
  const heartbeat = setInterval(() => {
    deviceRef.update({ lastSeen: Date.now() }).catch(() => {});
  }, 15_000);

  let revoked = false;
  deviceRef.child("revoked").on("value", (snap) => {
    if (snap.val() === true) {
      console.error("[Nova Agent] Device revoked — stopping all command processing.");
      revoked = true;
      clearInterval(heartbeat);
      commandsRef.off();
      deviceRef.update({ authorized: false, lastSeen: Date.now() }).catch(() => {});
      setTimeout(() => process.exit(0), 500);
    }
  });

  // On non-revoked start, re-assert registration metadata.
  deviceRef.update({
    lastSeen: Date.now(),
    capabilities: Object.keys(TOOL_HANDLERS),
    platform: process.platform,
    deviceName: hostname,
  }).catch(() => {});

  // ── Command loop ─────────────────────────────────────────────────────────
  console.log("[Nova Agent] Listening for commands…");
  commandsRef.on("child_added", async (snap) => {
    if (revoked) return;
    const cmd = snap.val() as { id: string; tool: string; args?: Record<string, unknown>; issuedAt?: number; issuedBy?: string } | null;
    if (!cmd || typeof cmd.tool !== "string") {
      await snap.ref.remove().catch(() => {});
      return;
    }

    const started = Date.now();
    const entry = TOOL_HANDLERS[cmd.tool];

    // Independent allowlist enforcement — the agent never trusts the sender.
    if (!entry) {
      await publishResult(db, deviceId, cmd.id, {
        commandId: cmd.id, ok: false,
        error: `Tool "${cmd.tool}" is not allowlisted on this agent`,
        durationMs: Date.now() - started, completedAt: Date.now(),
      });
      await snap.ref.remove().catch(() => {});
      return;
    }

    // Payload size guard
    if (JSON.stringify(cmd.args ?? {}).length > MAX_ARGS_BYTES) {
      await publishResult(db, deviceId, cmd.id, {
        commandId: cmd.id, ok: false, error: "Arguments too large",
        durationMs: Date.now() - started, completedAt: Date.now(),
      });
      await snap.ref.remove().catch(() => {});
      return;
    }

    // Risk gate: HIGH-risk commands must have been confirmed on the web side
    // (the web layer sets confirmed=true in args for those). The agent
    // double-checks rather than trusting the UI.
    if (entry.risk === "HIGH" && (cmd.args as { confirmed?: boolean } | undefined)?.confirmed !== true) {
      await publishResult(db, deviceId, cmd.id, {
        commandId: cmd.id, ok: false,
        error: "HIGH-risk command missing explicit confirmation",
        durationMs: Date.now() - started, completedAt: Date.now(),
      });
      await snap.ref.remove().catch(() => {});
      return;
    }

    console.log(`[Nova Agent] Executing ${cmd.tool} (${entry.risk})`);
    let outcome: ToolOutcome;
    try {
      outcome = await entry.handler((cmd.args ?? {}) as Record<string, unknown>);
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : "Unhandled tool error" };
    }

    await publishResult(db, deviceId, cmd.id, {
      commandId: cmd.id,
      ok: outcome.ok,
      data: outcome.data,
      error: outcome.error,
      durationMs: Date.now() - started,
      completedAt: Date.now(),
    });
    await snap.ref.remove().catch(() => {});
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  process.on("SIGINT", () => {
    console.log("\n[Nova Agent] Shutting down…");
    clearInterval(heartbeat);
    deviceRef.update({ lastSeen: Date.now() }).catch(() => {});
    setTimeout(() => process.exit(0), 300);
  });
}

async function publishResult(
  db: Database,
  deviceId: string,
  commandId: string,
  result: Record<string, unknown>
): Promise<void> {
  try {
    await db.ref(`devices/${deviceId}/results/${commandId}`).set(result);
  } catch (err) {
    console.error("[Nova Agent] Failed to publish result:", err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  console.error("[Nova Agent] Fatal:", err);
  process.exit(1);
});
