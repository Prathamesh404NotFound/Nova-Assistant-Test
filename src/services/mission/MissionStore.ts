/**
 * Nova Mission Engine — Persistence Store
 * Stores missions in localStorage so they survive app restarts.
 * Only active/paused missions are persisted; completed ones are archived.
 */

import type { Mission, MissionEvent } from "./MissionTypes";

const MISSIONS_KEY = "nova_missions";
const EVENTS_KEY = "nova_mission_events";
const MAX_PERSISTED_MISSIONS = 50;
const MAX_EVENTS = 200;

// ─── Mission Storage ─────────────────────────────────────────────────────────

function loadMissions(): Mission[] {
  try {
    const raw = localStorage.getItem(MISSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveMissions(missions: Mission[]): void {
  try {
    // Only persist active, paused, or awaiting missions
    const active = missions.filter((m) =>
      ["PLANNING", "RUNNING", "WAITING", "AWAITING_APPROVAL", "PAUSED"].includes(m.status)
    );
    // Keep at most MAX_PERSISTED_MISSIONS
    const toStore = active.slice(-MAX_PERSISTED_MISSIONS);
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(toStore));
  } catch { /* ignore */ }
}

export const missionStore = {
  /** Get all active (non-completed) missions. */
  getActive(): Mission[] {
    return loadMissions();
  },

  /** Get a specific mission by id. */
  get(id: string): Mission | undefined {
    return loadMissions().find((m) => m.id === id);
  },

  /** Save or update a mission. */
  save(mission: Mission): void {
    const missions = loadMissions();
    const idx = missions.findIndex((m) => m.id === mission.id);
    if (idx >= 0) {
      missions[idx] = mission;
    } else {
      missions.push(mission);
    }
    saveMissions(missions);
  },

  /** Remove a mission from active storage (completed/failed/cancelled). */
  remove(id: string): void {
    const missions = loadMissions().filter((m) => m.id !== id);
    saveMissions(missions);
  },

  /** Get count of active missions. */
  activeCount(): number {
    return loadMissions().length;
  },

  /** Recover any missions that were interrupted (RUNNING → PAUSED). */
  recoverInterrupted(): Mission[] {
    const missions = loadMissions();
    let changed = false;
    for (const m of missions) {
      if (m.status === "RUNNING" || m.status === "PLANNING" || m.status === "WAITING") {
        m.status = "PAUSED";
        changed = true;
      }
    }
    if (changed) saveMissions(missions);
    return missions.filter((m) => m.status === "PAUSED");
  },
};

// ─── Event Log ───────────────────────────────────────────────────────────────

function loadEvents(): MissionEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveEvents(events: MissionEvent[]): void {
  try {
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

export const missionEventLog = {
  /** Log an event. */
  log(event: MissionEvent): void {
    const events = loadEvents();
    events.push(event);
    saveEvents(events);
  },

  /** Get events for a specific mission. */
  getForMission(missionId: string): MissionEvent[] {
    return loadEvents().filter((e) => e.missionId === missionId);
  },

  /** Get recent events across all missions. */
  getRecent(limit = 20): MissionEvent[] {
    return loadEvents().slice(-limit);
  },
};
