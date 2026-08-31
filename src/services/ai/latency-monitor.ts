import { LatencyMetrics } from "./types";

class LatencyMonitor {
  private history: LatencyMetrics[] = [];

  record(metrics: LatencyMetrics) {
    this.history.push(metrics);
    if (this.history.length > 50) {
      this.history.shift();
    }
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
      console.log(
        `[Nova Latency] Router: ${metrics.routingMs}ms | Memory: ${metrics.memoryMs}ms | Tool: ${metrics.toolMs}ms | Gemini: ${metrics.geminiMs}ms | Total: ${metrics.totalMs}ms`
      );
    }
  }

  getRecentHistory(): LatencyMetrics[] {
    return [...this.history];
  }

  getLastMetrics(): LatencyMetrics | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}

export const latencyMonitor = new LatencyMonitor();
