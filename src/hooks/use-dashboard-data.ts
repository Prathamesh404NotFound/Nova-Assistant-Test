import { useState, useEffect, useCallback } from "react";
import {
  getConversations,
  getEvents,
  getEmailDrafts,
  getMessageDrafts,
  getAutomations,
  getFiles,
  getActivities,
  getSmartDevices,
} from "@/lib/local-store";

/**
 * Canonical data source for all dashboard counters, sidebar badges,
 * and the intelligence feed. Every consumer reads from this hook
 * instead of hard-coding numbers or duplicating localStorage reads.
 */
export interface DashboardCounts {
  conversations: number;
  tasks: number;
  calendarEvents: number;
  emailDrafts: number;
  messageDrafts: number;
  automations: number;
  activeAutomations: number;
  files: number;
  activities: number;
  activeDevices: number;
  totalDevices: number;
}

export interface AgentState {
  id: string;
  name: string;
  status: "active" | "standby" | "error";
  color: string;
  lastActivity?: string;
}

const CANONICAL_AGENTS: AgentState[] = [
  { id: "browser", name: "Browser Agent", status: "active", color: "#00d4ff" },
  { id: "coding", name: "Coding Agent", status: "active", color: "#8b5cf6" },
  { id: "email", name: "Email Agent", status: "active", color: "#10b981" },
  { id: "home", name: "Home Agent", status: "standby", color: "#f59e0b" },
  { id: "task", name: "Task Agent", status: "active", color: "#10b981" },
  { id: "memory", name: "Memory Agent", status: "standby", color: "#8b5cf6" },
  { id: "chat", name: "Chat Agent", status: "active", color: "#00d4ff" },
];

export interface IntelligenceItem {
  id: string;
  text: string;
  type: "info" | "warn" | "success" | "tip";
  source: string;
  timestamp: number;
}

/**
 * Derives the live intelligence feed from actual persisted data.
 * No seed/demo data — everything comes from real records.
 */
function buildIntelligenceFeed(counts: DashboardCounts): IntelligenceItem[] {
  const items: IntelligenceItem[] = [];
  const now = Date.now();

  // Tasks from automations
  if (counts.activeAutomations > 0) {
    items.push({
      id: "auto-count",
      text: `${counts.activeAutomations} automation${counts.activeAutomations > 1 ? "s" : ""} running`,
      type: "success",
      source: "Automations",
      timestamp: now,
    });
  }

  // Calendar events today
  if (counts.calendarEvents > 0) {
    items.push({
      id: "cal-count",
      text: `${counts.calendarEvents} calendar event${counts.calendarEvents > 1 ? "s" : ""} scheduled`,
      type: "info",
      source: "Calendar",
      timestamp: now - 1000,
    });
  }

  // Email drafts
  if (counts.emailDrafts > 0) {
    items.push({
      id: "email-count",
      text: `${counts.emailDrafts} email draft${counts.emailDrafts > 1 ? "s" : ""} pending`,
      type: "tip",
      source: "Email",
      timestamp: now - 2000,
    });
  }

  // Active devices
  if (counts.activeDevices > 0) {
    items.push({
      id: "device-count",
      text: `${counts.activeDevices} of ${counts.totalDevices} smart devices active`,
      type: "info",
      source: "Smart Home",
      timestamp: now - 3000,
    });
  }

  // Messages
  if (counts.messageDrafts > 0) {
    items.push({
      id: "msg-count",
      text: `${counts.messageDrafts} message draft${counts.messageDrafts > 1 ? "s" : ""}`,
      type: "tip",
      source: "Messages",
      timestamp: now - 4000,
    });
  }

  // Files
  if (counts.files > 0) {
    items.push({
      id: "file-count",
      text: `${counts.files} file${counts.files > 1 ? "s" : ""} stored locally`,
      type: "info",
      source: "Files",
      timestamp: now - 5000,
    });
  }

  // Conversations
  if (counts.conversations > 0) {
    items.push({
      id: "conv-count",
      text: `${counts.conversations} conversation${counts.conversations > 1 ? "s" : ""} in history`,
      type: "info",
      source: "Chat",
      timestamp: now - 6000,
    });
  }

  // Activity
  if (counts.activities > 0) {
    items.push({
      id: "act-count",
      text: `${counts.activities} events logged in activity`,
      type: "info",
      source: "Activity",
      timestamp: now - 7000,
    });
  }

  // If nothing at all
  if (items.length === 0) {
    items.push({
      id: "empty",
      text: "Nova is ready. Start by chatting or creating a task.",
      type: "tip",
      source: "System",
      timestamp: now,
    });
  }

  return items;
}

function readCounts(): DashboardCounts {
  const conversations = getConversations();
  const events = getEvents();
  const emailDrafts = getEmailDrafts();
  const messageDrafts = getMessageDrafts();
  const automations = getAutomations();
  const files = getFiles();
  const activities = getActivities();
  const devices = getSmartDevices();

  return {
    conversations: conversations.length,
    tasks: 0, // Tasks use RTDB when authenticated, 0 when not
    calendarEvents: events.length,
    emailDrafts: emailDrafts.length,
    messageDrafts: messageDrafts.length,
    automations: automations.length,
    activeAutomations: automations.filter((a) => a.enabled).length,
    files: files.length,
    activities: activities.length,
    activeDevices: devices.filter((d) => d.isOn).length,
    totalDevices: devices.length,
  };
}

export function useDashboardData() {
  const [counts, setCounts] = useState<DashboardCounts>(readCounts);
  const [agents] = useState<AgentState[]>(CANONICAL_AGENTS);
  const [intelligence, setIntelligence] = useState<IntelligenceItem[]>([]);

  const refresh = useCallback(() => {
    const newCounts = readCounts();
    setCounts(newCounts);
    setIntelligence(buildIntelligenceFeed(newCounts));
  }, []);

  useEffect(() => {
    refresh();
    // Re-read on storage events (cross-tab sync)
    const handler = () => refresh();
    window.addEventListener("storage", handler);
    // Also poll every 2s for same-tab changes
    const interval = setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, [refresh]);

  return { counts, agents, intelligence, refresh };
}
