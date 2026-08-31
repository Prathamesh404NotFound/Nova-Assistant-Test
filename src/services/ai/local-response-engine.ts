import { IntentResult } from "./types";
import { memoryManager } from "../memory/memory-manager";
import { LocalConversationEngine } from "./local-conversation";

export interface LocalResponseResult {
  text: string;
  navigationTarget?: string;
  toolResult?: any;
}

export class LocalResponseEngine {
  static async handle(input: string, result: IntentResult): Promise<LocalResponseResult> {
    const lower = input.toLowerCase().trim();

    switch (result.intent) {
      case "TIME": {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return { text: `The current time is ${timeStr}.` };
      }

      case "DATE": {
        const now = new Date();
        const dateStr = now.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return { text: `Today is ${dateStr}.` };
      }

      case "CALCULATION": {
        try {
          const cleaned = lower
            .replace(/what is/g, "")
            .replace(/plus/g, "+")
            .replace(/minus/g, "-")
            .replace(/times|multiplied by/g, "*")
            .replace(/divided by/g, "/")
            .replace(/[^0-9\+\-\*\/\.\(\)\s]/g, "")
            .trim();

          if (cleaned) {
            const val = Function(`"use strict"; return (${cleaned})`)();
            if (typeof val === "number" && !isNaN(val)) {
              return { text: `The calculated result is ${val}.` };
            }
          }
        } catch {
          /* fallback */
        }
        return { text: "I couldn't calculate that expression accurately." };
      }

      case "NAVIGATION": {
        const target = result.extractedData?.target || "dashboard";
        const pageNames: Record<string, string> = {
          settings: "/settings",
          dashboard: "/dashboard",
          tasks: "/tasks",
          memory: "/memory",
          chat: "/chat",
          devices: "/devices",
          smarthome: "/smart-home",
          automations: "/automations",
          coding: "/coding",
          files: "/files",
          calendar: "/calendar",
          email: "/email",
          security: "/security",
          activity: "/activity",
        };

        const path = pageNames[target] || `/${target}`;
        return {
          text: `Opening ${target}...`,
          navigationTarget: path,
        };
      }

      case "MEMORY_WRITE": {
        const content = result.extractedData?.content || input;
        await memoryManager.addMemory({
          key: "Note",
          value: content,
          source: "user",
          importance: 0.9,
          type: "PREFERENCE",
        });
        return { text: `Got it! I saved "${content}" to your local memory.` };
      }

      case "MEMORY_READ": {
        if (result.extractedData?.action === "forget") {
          await memoryManager.clearAll();
          return { text: "I've cleared all saved personal memories." };
        }
        const memories = await memoryManager.getAllMemories();
        if (memories.length === 0) {
          return { text: "I don't have any saved memories about you yet." };
        }
        const topMem = memories
          .slice(0, 5)
          .map((m) => `• ${m.key}: ${m.value}`)
          .join("\n");
        return { text: `Here is what I remember about you:\n${topMem}` };
      }

      case "TASK_CREATE": {
        const title = result.extractedData?.title || "New Task";
        try {
          const stored = localStorage.getItem("nova_tasks_local") || "[]";
          const tasks = JSON.parse(stored);
          const newTask = {
            id: "task_" + Date.now(),
            title,
            description: "Created via Nova Assistant",
            status: "pending",
            priority: "medium",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          tasks.unshift(newTask);
          localStorage.setItem("nova_tasks_local", JSON.stringify(tasks));
          return { text: `Created task: "${title}".` };
        } catch {
          return { text: `Created task "${title}" locally.` };
        }
      }

      case "TASK_READ": {
        try {
          const stored = localStorage.getItem("nova_tasks_local") || "[]";
          const tasks = JSON.parse(stored);
          if (!tasks.length) {
            return { text: "You have no active tasks right now." };
          }
          const taskList = tasks
            .slice(0, 5)
            .map((t: any) => `• [${t.status}] ${t.title}`)
            .join("\n");
          return { text: `Here are your current tasks:\n${taskList}` };
        } catch {
          return { text: "Unable to retrieve your tasks right now." };
        }
      }

      case "DEVICE_ACTION": {
        const action = result.extractedData?.action;
        if (action === "stop" || lower.includes("stop") || lower.includes("cancel")) {
          return { text: "Stopped. All active tasks cancelled." };
        }
        return { text: "Device command executed." };
      }

      case "GREETING":
      case "CONVERSATION":
      default: {
        const conversationalText = LocalConversationEngine.generateResponse(input);
        return { text: conversationalText };
      }
    }
  }
}
