/**
 * Nova Permissions Service
 *
 * Central, localStorage-backed permission registry used by the Settings
 * permission panel. Features across Nova (voice, memory, agents, automations)
 * check `isGranted()` before acting. All state stays on-device.
 */

export type PermissionId =
  | "microphone"
  | "notifications"
  | "memory_saving"
  | "local_storage"
  | "voice_synthesis"
  | "external_actions"
  | "automations"
  | "calendar"
  | "email"
  | "browser_research";

export interface PermissionDef {
  id: PermissionId;
  label: string;
  description: string;
  /** When true, granting also requests the real browser permission. */
  browserPermission?: "microphone" | "notifications";
}

export const REQUIRED_PERMISSIONS: PermissionDef[] = [
  {
    id: "microphone",
    label: "Microphone",
    description: "Voice input for talking to Nova (Web Speech API).",
    browserPermission: "microphone",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Proactive alerts and reminders via the Notification API.",
    browserPermission: "notifications",
  },
  {
    id: "memory_saving",
    label: "Memory Saving",
    description: "Save facts, preferences and 'remember that…' statements to your memory panels.",
  },
  {
    id: "local_storage",
    label: "Local Data Storage",
    description: "Store memories, tasks and settings locally in this browser.",
  },
  {
    id: "voice_synthesis",
    label: "Voice Synthesis",
    description: "Speak responses aloud through the TTS engine.",
  },
  {
    id: "external_actions",
    label: "External Actions",
    description: "Allow Nova agents to perform external actions after confirmation.",
  },
  {
    id: "automations",
    label: "Automations",
    description: "Run scheduled and triggered automations in the background.",
  },
  {
    id: "calendar",
    label: "Calendar Access",
    description: "Read and organize your calendar events.",
  },
  {
    id: "email",
    label: "Email Access",
    description: "Compose, summarize and draft email on your behalf.",
  },
  {
    id: "browser_research",
    label: "Browser Research",
    description: "Search the web and fetch pages when doing research.",
  },
];

const STORAGE_KEY = "nova_permissions_v1";

type PermissionMap = Record<PermissionId, boolean>;

function defaultPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const p of REQUIRED_PERMISSIONS) {
    // Memory saving & local storage are on by default (backward compatible);
    // microphone / notifications start off until granted.
    map[p.id] = p.id === "memory_saving" || p.id === "local_storage";
  }
  return map;
}

function load(): PermissionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PermissionMap>;
      return { ...defaultPermissions(), ...parsed };
    }
  } catch { /* ignore */ }
  return defaultPermissions();
}

function save(map: PermissionMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/** Request a real browser permission; resolves true when granted. */
async function requestBrowserPermission(kind: "microphone" | "notifications"): Promise<boolean> {
  try {
    if (kind === "notifications") {
      if (!("Notification" in window)) return false;
      if (Notification.permission === "granted") return true;
      const result = await Notification.requestPermission();
      return result === "granted";
    }
    if (kind === "microphone") {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

class PermissionsService {
  private map: PermissionMap = load();

  isGranted(id: PermissionId): boolean {
    return !!this.map[id];
  }

  areAllGranted(ids: PermissionId[]): boolean {
    return ids.every((id) => this.isGranted(id));
  }

  set(id: PermissionId, granted: boolean): void {
    this.map[id] = granted;
    save(this.map);
  }

  /** Grant a permission; also requests the underlying browser permission if any. */
  async grant(id: PermissionId): Promise<boolean> {
    const def = REQUIRED_PERMISSIONS.find((p) => p.id === id);
    if (def?.browserPermission) {
      const ok = await requestBrowserPermission(def.browserPermission);
      // Record user intent even if the browser prompt was dismissed/blocked.
      this.set(id, ok || this.map[id] === true ? true : ok);
      return ok;
    }
    this.set(id, true);
    return true;
  }

  revoke(id: PermissionId): void {
    this.set(id, false);
  }

  /** Grant every required permission (requests browser perms where applicable). */
  async grantAll(): Promise<{ granted: PermissionId[]; failed: PermissionId[] }> {
    const granted: PermissionId[] = [];
    const failed: PermissionId[] = [];
    for (const def of REQUIRED_PERMISSIONS) {
      const ok = await this.grant(def.id);
      (ok ? granted : failed).push(def.id);
    }
    return { granted, failed };
  }

  getAll(): Array<PermissionDef & { granted: boolean }> {
    return REQUIRED_PERMISSIONS.map((def) => ({ ...def, granted: !!this.map[def.id] }));
  }
}

export const permissionsService = new PermissionsService();
