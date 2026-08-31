export interface ToolDefinition {
  name: string;
  description: string;
  local: boolean;
  requiresGemini: boolean;
  requiresApproval: boolean;
}

export const TOOLS: Record<string, ToolDefinition> = {
  create_task: {
    name: "create_task",
    description: "Create a new task locally in Nova OS",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  read_tasks: {
    name: "read_tasks",
    description: "List or query active tasks",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  manage_memory: {
    name: "manage_memory",
    description: "Store, retrieve, or update personal memories",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  get_time: {
    name: "get_time",
    description: "Get current system time",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  get_date: {
    name: "get_date",
    description: "Get current system date",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  calculate: {
    name: "calculate",
    description: "Perform basic mathematical calculations",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  navigate: {
    name: "navigate",
    description: "Navigate to an internal application view",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  device_command: {
    name: "device_command",
    description: "Execute local device commands (stop, cancel, mute)",
    local: true,
    requiresGemini: false,
    requiresApproval: false,
  },
  send_email: {
    name: "send_email",
    description: "Send an email on user behalf",
    local: false,
    requiresGemini: true,
    requiresApproval: true,
  },
  complex_reasoning: {
    name: "complex_reasoning",
    description: "Delegate to Gemini model for advanced multi-step reasoning",
    local: false,
    requiresGemini: true,
    requiresApproval: false,
  },
};

export class ToolRegistry {
  static getTool(name: string): ToolDefinition | undefined {
    return TOOLS[name];
  }

  static isLocal(name: string): boolean {
    return TOOLS[name]?.local ?? false;
  }

  static listTools(): ToolDefinition[] {
    return Object.values(TOOLS);
  }
}
