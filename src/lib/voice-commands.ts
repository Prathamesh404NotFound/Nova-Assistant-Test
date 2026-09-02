/**
 * Nova AI OS — Voice Commands Library
 * Pre-defined voice commands for common actions.
 */

export interface VoiceCommand {
  patterns: string[];
  action: string;
  description: string;
  route?: string;
}

export const voiceCommands: VoiceCommand[] = [
  // Navigation
  {
    patterns: ["open dashboard", "go to dashboard", "show dashboard", "go home"],
    action: "navigate",
    route: "/dashboard",
    description: "Open the Dashboard",
  },
  {
    patterns: ["open chat", "go to chat", "show chat", "start chat"],
    action: "navigate",
    route: "/chat",
    description: "Open Chat",
  },
  {
    patterns: ["open tasks", "go to tasks", "show tasks", "my tasks"],
    action: "navigate",
    route: "/tasks",
    description: "Open Tasks",
  },
  {
    patterns: ["open calendar", "go to calendar", "show calendar", "my schedule"],
    action: "navigate",
    route: "/calendar",
    description: "Open Calendar",
  },
  {
    patterns: ["open settings", "go to settings", "show settings"],
    action: "navigate",
    route: "/settings",
    description: "Open Settings",
  },

  // Quick Actions
  {
    patterns: ["what time is it", "current time", "tell me the time", "what's the time"],
    action: "time",
    description: "Get current time",
  },
  {
    patterns: ["what's today", "what date is it", "today's date", "what day is it"],
    action: "date",
    description: "Get current date",
  },

  // Voice Control
  {
    patterns: ["stop listening", "stop", "pause"],
    action: "stop_listening",
    description: "Stop voice listening",
  },
  {
    patterns: ["mute", "mute nova", "silence"],
    action: "mute",
    description: "Mute Nova",
  },
  {
    patterns: ["unmute", "unmute nova", "sound on"],
    action: "unmute",
    description: "Unmute Nova",
  },
];

/**
 * Match a voice transcript against known commands.
 */
export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const lower = transcript.toLowerCase().trim();

  for (const command of voiceCommands) {
    for (const pattern of command.patterns) {
      if (lower.includes(pattern)) {
        return command;
      }
    }
  }

  return null;
}
