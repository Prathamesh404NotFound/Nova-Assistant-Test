/**
 * Nova Agent Architecture — Tool Registry
 * Central registry for all tools the agent can invoke.
 * Tools are registered once, validated before execution, and filterable by category.
 */

import { type NovaTool, type ToolCategory, type ToolSchema } from "./types";

class ToolRegistryImpl {
  private tools = new Map<string, NovaTool>();

  /** Register a tool. Throws if name is already taken. */
  register(tool: NovaTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Get a tool by name, or undefined. */
  get(name: string): NovaTool | undefined {
    return this.tools.get(name);
  }

  /** List all registered tools. */
  list(): NovaTool[] {
    return Array.from(this.tools.values());
  }

  /** List tools filtered by category. */
  listByCategory(category: ToolCategory): NovaTool[] {
    return this.list().filter((t) => t.category === category);
  }

  /** List only available tools. */
  listAvailable(): NovaTool[] {
    return this.list().filter((t) => !t.availability || t.availability());
  }

  /** Get tool names suitable for Gemini function declarations (subset). */
  getToolDeclarations(categories?: ToolCategory[]): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    const tools = categories
      ? this.list().filter((t) => categories.includes(t.category))
      : this.listAvailable();

    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: this.schemaToDeclaration(t.inputSchema),
    }));
  }

  /** Validate that args match the tool's input schema. Returns first error or null. */
  validate(toolName: string, args: Record<string, unknown>): string | null {
    const tool = this.tools.get(toolName);
    if (!tool) return `Unknown tool: ${toolName}`;

    const schema = tool.inputSchema;
    const required = schema.required || [];

    for (const field of required) {
      if (args[field] === undefined || args[field] === null || args[field] === "") {
        return `Missing required field: ${field}`;
      }
    }

    for (const [key, def] of Object.entries(schema.properties)) {
      if (key in args && args[key] !== undefined && args[key] !== null) {
        const val = args[key];
        if (def.type === "string" && typeof val !== "string") {
          return `Field '${key}' must be a string`;
        }
        if (def.type === "number" && typeof val !== "number") {
          return `Field '${key}' must be a number`;
        }
        if (def.type === "boolean" && typeof val !== "boolean") {
          return `Field '${key}' must be a boolean`;
        }
      }
    }

    return null;
  }

  /** Get relevant tools for an intent category. */
  getRelevantTools(intentCategory: string): NovaTool[] {
    const categoryMap: Record<string, ToolCategory[]> = {
      MEMORY_OPERATION: ["memory"],
      TASK_MANAGEMENT: ["tasks"],
      TOOL_EXECUTION: ["device", "automation"],
      NAVIGATION: ["navigation"],
      UTILITY: ["system"],
      CALENDAR: ["calendar"],
      EMAIL: ["email"],
      BROWSER: ["browser"],
      FILE: ["files"],
    };

    const categories = categoryMap[intentCategory] || [];
    return this.listAvailable().filter((t) => categories.includes(t.category));
  }

  /** Convert ToolSchema to Gemini function declaration format. */
  private schemaToDeclaration(schema: ToolSchema): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(schema.properties)) {
      properties[key] = {
        type: def.type,
        description: def.description || "",
      };
    }
    return {
      type: "object",
      properties,
      required: schema.required || [],
    };
  }
}

/** Singleton tool registry instance. */
export const toolRegistry = new ToolRegistryImpl();
