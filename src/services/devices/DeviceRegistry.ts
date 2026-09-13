/**
 * Nova Device Registry — canonical desktop-device directory.
 *
 * Devices live in the cloud (Firebase RTDB) at:
 *   devices/{deviceId}              — public identity + authorization state
 *   devices/{deviceId}/commands     — command queue the agent consumes
 *   devices/{deviceId}/results      — execution results the agent publishes
 *
 * The web UI reads `devices` to show Connected Devices in Settings and
 * routes desktop.* tool calls through the agent's command queue. A device
 * only executes commands while `authorized: true`.
 */

import { ref, push, set, get, onValue, remove } from "firebase/database";
import { db, isRealtimeDatabaseReady } from "@/services/firebase/FirebaseService";

export interface NovaDevice {
  deviceId: string;
  deviceName: string;
  platform: string;          // "windows" | "macos" | "linux"
  agentVersion: string;
  authorized: boolean;
  revoked: boolean;
  lastSeen: number;
  capabilities: string[];    // e.g. ["screen.capture", "app.launch", "keyboard.type"]
}

export interface AgentCommand {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  issuedAt: number;
  issuedBy: string;          // uid of requester
}

export interface AgentCommandResult {
  commandId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
  completedAt: number;
}

const ROOT = "devices";

function requireDb() {
  if (!db || !isRealtimeDatabaseReady()) {
    throw Object.assign(new Error("Firebase Realtime Database is not configured"), {
      code: "FIREBASE_NOT_CONFIGURED",
    });
  }
  return db;
}

// ── Registry (web UI reads / writes authorization) ─────────────────────────

export async function listDevices(): Promise<NovaDevice[]> {
  try {
    const snap = await get(ref(requireDb(), ROOT));
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, NovaDevice>;
    return Object.values(val).filter(Boolean).sort((a, b) => b.lastSeen - a.lastSeen);
  } catch {
    return [];
  }
}

export function onDevicesChange(
  cb: (devices: NovaDevice[]) => void,
  onError?: (err: unknown) => void
): () => void {
  try {
    return onValue(
      ref(requireDb(), ROOT),
      (snap) => {
        if (!snap.exists()) { cb([]); return; }
        const val = snap.val() as Record<string, NovaDevice>;
        cb(Object.values(val).filter(Boolean).sort((a, b) => b.lastSeen - a.lastSeen));
      },
      (err) => onError?.(err)
    );
  } catch (err) {
    onError?.(err);
    return () => {};
  }
}

export async function setDeviceAuthorization(deviceId: string, authorized: boolean): Promise<void> {
  await set(ref(requireDb(), `${ROOT}/${deviceId}/authorized`), authorized);
}

export async function revokeDevice(deviceId: string): Promise<void> {
  // Revocation is sticky: the agent sees it and stops polling; commands are purged.
  await set(ref(requireDb(), `${ROOT}/${deviceId}/revoked`), true);
  await set(ref(requireDb(), `${ROOT}/${deviceId}/authorized`), false);
  await remove(ref(requireDb(), `${ROOT}/${deviceId}/commands`));
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await remove(ref(requireDb(), `${ROOT}/${deviceId}`));
}

// ── Pairing (web generates a short-lived code the agent exchanges) ─────────

export interface PairingCode {
  code: string;
  issuedBy: string;
  createdAt: number;
  expiresAt: number;
}

const PAIRING_TTL_MS = 5 * 60_000;

/**
 * Publish a 6-digit pairing code under `pairingCodes/{code}`. The agent
 * exchanges the code for registration; the code is removed by the agent on
 * use, and the web prunes expired ones on next read.
 */
export async function createPairingCode(userId: string): Promise<PairingCode> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const pairing: PairingCode = {
    code,
    issuedBy: userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + PAIRING_TTL_MS,
  };
  await set(ref(requireDb(), `pairingCodes/${code}`), pairing);
  return pairing;
}

export async function listActivePairingCodes(): Promise<PairingCode[]> {
  try {
    const snap = await get(ref(requireDb(), "pairingCodes"));
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, PairingCode>;
    const now = Date.now();
    const active: PairingCode[] = [];
    for (const [key, p] of Object.entries(val)) {
      if (!p || p.expiresAt < now) {
        remove(ref(requireDb(), `pairingCodes/${key}`)).catch(() => {});
      } else {
        active.push(p);
      }
    }
    return active;
  } catch {
    return [];
  }
}

// ── Command channel (web → agent) ───────────────────────────────────────────

/** Issue a command to a device. Resolves the command id. */
export async function issueCommand(
  deviceId: string,
  tool: string,
  args: Record<string, unknown>,
  issuedBy: string
): Promise<string> {
  const cmdRef = push(ref(requireDb(), `${ROOT}/${deviceId}/commands`));
  const id = cmdRef.key;
  if (!id) throw new Error("Failed to allocate command id");
  const command: AgentCommand = {
    id,
    tool,
    args,
    issuedAt: Date.now(),
    issuedBy,
  };
  await set(cmdRef, command);
  return id;
}

/** Wait for a command result (agent publishes to results/{commandId}). */
export function waitForCommandResult(
  deviceId: string,
  commandId: string,
  timeoutMs = 15_000
): Promise<AgentCommandResult | null> {
  return new Promise((resolve) => {
    const resultRef = ref(requireDb(), `${ROOT}/${deviceId}/results/${commandId}`);
    let unsubscribe: (() => void) | null = null;
    const timer = setTimeout(() => {
      unsubscribe?.();
      resolve(null);
    }, timeoutMs);

    unsubscribe = onValue(
      resultRef,
      (snap) => {
        if (!snap.exists()) return;
        clearTimeout(timer);
        unsubscribe?.();
        resolve(snap.val() as AgentCommandResult);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/** One-shot: issue + await result + clean up the result node. */
export async function executeDeviceCommand(
  deviceId: string,
  tool: string,
  args: Record<string, unknown>,
  issuedBy: string,
  timeoutMs = 15_000
): Promise<AgentCommandResult | null> {
  const commandId = await issueCommand(deviceId, tool, args, issuedBy);
  const result = await waitForCommandResult(deviceId, commandId, timeoutMs);
  // Best-effort cleanup so queues don't grow unbounded.
  if (result) {
    remove(ref(requireDb(), `${ROOT}/${deviceId}/results/${commandId}`)).catch(() => {});
    remove(ref(requireDb(), `${ROOT}/${deviceId}/commands/${commandId}`)).catch(() => {});
  }
  return result;
}
