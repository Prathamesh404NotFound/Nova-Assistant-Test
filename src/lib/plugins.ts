/**
 * Nova AI OS — Plugin System
 * Basic plugin registry for extending Nova's capabilities.
 */

export interface NovaPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  icon?: string;
}

const STORAGE_KEY = "nova-plugins";

// Built-in plugins
const BUILT_IN_PLUGINS: NovaPlugin[] = [
  {
    id: "weather",
    name: "Weather",
    description: "Get current weather information",
    version: "1.0.0",
    author: "Nova",
    enabled: true,
    icon: "🌤️",
  },
  {
    id: "news",
    name: "News",
    description: "Latest news headlines",
    version: "1.0.0",
    author: "Nova",
    enabled: true,
    icon: "📰",
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Advanced calculations",
    version: "1.0.0",
    author: "Nova",
    enabled: true,
    icon: "🔢",
  },
  {
    id: "translator",
    name: "Translator",
    description: "Translate between languages",
    version: "1.0.0",
    author: "Nova",
    enabled: true,
    icon: "🌐",
  },
  {
    id: "reminder",
    name: "Reminders",
    description: "Set and manage reminders",
    version: "1.0.0",
    author: "Nova",
    enabled: true,
    icon: "⏰",
  },
];

class PluginRegistry {
  private plugins: NovaPlugin[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.plugins = JSON.parse(stored);
      } else {
        // Initialize with built-in plugins
        this.plugins = [...BUILT_IN_PLUGINS];
        this.save();
      }
    } catch {
      this.plugins = [...BUILT_IN_PLUGINS];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.plugins));
  }

  getAll(): NovaPlugin[] {
    return [...this.plugins];
  }

  getEnabled(): NovaPlugin[] {
    return this.plugins.filter((p) => p.enabled);
  }

  getById(id: string): NovaPlugin | undefined {
    return this.plugins.find((p) => p.id === id);
  }

  toggle(id: string): void {
    const plugin = this.plugins.find((p) => p.id === id);
    if (plugin) {
      plugin.enabled = !plugin.enabled;
      this.save();
    }
  }

  install(plugin: Omit<NovaPlugin, "enabled">): void {
    const exists = this.plugins.find((p) => p.id === plugin.id);
    if (!exists) {
      this.plugins.push({ ...plugin, enabled: true });
      this.save();
    }
  }

  uninstall(id: string): void {
    this.plugins = this.plugins.filter((p) => p.id !== id);
    this.save();
  }
}

export const pluginRegistry = new PluginRegistry();
