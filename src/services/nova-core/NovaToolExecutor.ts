/**
 * Nova Core — tool executor.
 * Delegates execution to the existing agent ToolRegistry/ToolExecutor so no
 * functionality is duplicated. Core adds: permission enforcement, observation
 * records, and post-execution verification.
 */

import { toolRegistry } from "@/services/agent/ToolRegistry";
import { toolExecutor } from "@/services/agent/ToolExecutor";
import { registerAllTools } from "@/services/agent/register-tools";
import { permissionsService } from "@/services/permissions/PermissionsService";
import { novaObserver } from "./NovaObserver";
import { novaEventBus } from "./NovaEventBus";
import type { NovaActionRecord } from "./NovaTypes";

// Ensure the existing agent tools are registered exactly once.
let registered = false;
function ensureTools(): void {
  if (registered) return;
  registerAllTools();
  registered = true;
}

/** Permission required per tool prefix (matches PermissionsService ids). */
function permissionForTool(tool: string): string | null {
  if (tool.startsWith("memory.")) return "memory_saving";
  if (tool.startsWith("calendar.")) return "calendar";
  if (tool.startsWith("email.")) return "email";
  if (tool.startsWith("device.") || tool.startsWith("smarthome.")) return "smart_home";
  if (tool.startsWith("browser.")) return "browser_research";
  if (tool.startsWith("file.")) return "local_storage";
  return null;
}

class NovaToolExecutor {
  /**
   * Execute a tool with permission enforcement and observation.
   * Returns an action record — success is never assumed.
   */
  async execute(
    tool: string,
    args: Record<string, unknown>,
    ctx: { userId: string; requestId: string }
  ): Promise<NovaActionRecord> {
    ensureTools();

    const started = Date.now();
    novaEventBus.emit("tool.started", { requestId: ctx.requestId, tool });

    // Permission gate — the AI can never bypass this.
    const permission = permissionForTool(tool);
    if (permission) {
      try {
        permissionsService.require(permission as Parameters<typeof permissionsService.require>[0]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Permission required: ${permission}`;
        const obs = {
          requestId: ctx.requestId,
          tool,
          args,
          success: false,
          verified: false,
          durationMs: Date.now() - started,
          error: message,
        };
        novaObserver.record(obs);
        return {
          tool,
          args,
          success: false,
          verified: false,
          durationMs: obs.durationMs,
          error: message,
        };
      }
    }

    const definition = toolRegistry.get(tool);
    if (!definition) {
      const message = `Unknown tool: ${tool}`;
      novaObserver.record({
        requestId: ctx.requestId,
        tool,
        args,
        success: false,
        verified: false,
        durationMs: Date.now() - started,
        error: message,
      });
      return {
        tool,
        args,
        success: false,
        verified: false,
        durationMs: Date.now() - started,
        error: message,
      };
    }

    try {
      const result = await toolExecutor.execute(tool, args, {
        userId: ctx.userId,
        source: "chat",
      });

      const { verified, reason } = novaObserver.verify(tool, {
        success: result.success,
        data: result.data,
        message: result.message,
        error: result.error?.message,
      });
      const obs = {
        requestId: ctx.requestId,
        tool,
        args,
        success: result.success,
        verified,
        durationMs: Date.now() - started,          error: result.success ? undefined : (result.error?.message ?? result.message),
        data: result.data,
      };
      novaObserver.record(obs);

      return {
        tool,
        args,
        success: result.success,
        verified,
        durationMs: obs.durationMs,
        error: verified ? undefined : reason ?? obs.error,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool execution failed";
      novaObserver.record({
        requestId: ctx.requestId,
        tool,
        args,
        success: false,
        verified: false,
        durationMs: Date.now() - started,
        error: message,
      });
      return {
        tool,
        args,
        success: false,
        verified: false,
        durationMs: Date.now() - started,
        error: message,
      };
    }
  }

  /** List available tools for the AI tool-use path. */
  availableTools(): Array<{ name: string; description: string; category: string; riskLevel: string }> {
    ensureTools();
    return toolRegistry.list().map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
    }));
  }
}

export const novaToolExecutor = new NovaToolExecutor();
