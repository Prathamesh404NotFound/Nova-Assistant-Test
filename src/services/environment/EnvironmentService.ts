/**
 * Nova Environment Layer — EnvironmentService facade.
 * One entry point for the environment capabilities so tools, HUD, and Nova
 * Core never touch the underlying services directly.
 */

import { desktopService, appService, screenService } from "./DesktopService";
import { fileSystemService } from "./FileSystemService";
import { systemService } from "./SystemService";
import type { EnvironmentCapabilities, SystemStatus } from "./EnvironmentTypes";

class EnvironmentServiceImpl {
  readonly desktop = desktopService;
  readonly apps = appService;
  readonly screen = screenService;
  readonly files = fileSystemService;
  readonly system = systemService;

  async capabilities(): Promise<EnvironmentCapabilities> {
    return desktopService.capabilities();
  }

  async systemStatus(): Promise<SystemStatus> {
    return systemService.getStatus();
  }

  async systemSummary(): Promise<string> {
    return systemService.getSummary();
  }
}

export const environmentService = new EnvironmentServiceImpl();
