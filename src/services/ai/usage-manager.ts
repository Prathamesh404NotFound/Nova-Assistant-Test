export interface UsageStats {
  requestsToday: number;
  requestsThisMinute: number;
  estimatedTokens: number;
  lastResetDate: string;
  lastResetMinute: number;
}

class UsageManager {
  private stats: UsageStats;
  private readonly MAX_REQUESTS_PER_MINUTE = 25;
  private readonly MAX_REQUESTS_PER_DAY = 600;

  constructor() {
    const today = new Date().toISOString().split("T")[0];
    const currentMin = Math.floor(Date.now() / 60000);

    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("nova_usage_stats") : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastResetDate === today) {
          this.stats = {
            ...parsed,
            requestsThisMinute: parsed.lastResetMinute === currentMin ? parsed.requestsThisMinute : 0,
            lastResetMinute: currentMin,
          };
        } else {
          this.stats = this.initStats(today, currentMin);
        }
      } catch {
        this.stats = this.initStats(today, currentMin);
      }
    } else {
      this.stats = this.initStats(today, currentMin);
    }
  }

  private initStats(today: string, currentMin: number): UsageStats {
    return {
      requestsToday: 0,
      requestsThisMinute: 0,
      estimatedTokens: 0,
      lastResetDate: today,
      lastResetMinute: currentMin,
    };
  }

  private persist() {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("nova_usage_stats", JSON.stringify(this.stats));
      } catch {
        /* ignore */
      }
    }
  }

  private updateWindow() {
    const today = new Date().toISOString().split("T")[0];
    const currentMin = Math.floor(Date.now() / 60000);

    if (this.stats.lastResetDate !== today) {
      this.stats.requestsToday = 0;
      this.stats.lastResetDate = today;
    }

    if (this.stats.lastResetMinute !== currentMin) {
      this.stats.requestsThisMinute = 0;
      this.stats.lastResetMinute = currentMin;
    }
  }

  canUseGemini(): boolean {
    this.updateWindow();
    if (this.stats.requestsThisMinute >= this.MAX_REQUESTS_PER_MINUTE) return false;
    if (this.stats.requestsToday >= this.MAX_REQUESTS_PER_DAY) return false;
    return true;
  }

  trackGeminiUsage(estimatedTokens = 150) {
    this.updateWindow();
    this.stats.requestsToday += 1;
    this.stats.requestsThisMinute += 1;
    this.stats.estimatedTokens += estimatedTokens;
    this.persist();
  }

  getStats(): UsageStats {
    this.updateWindow();
    return { ...this.stats };
  }
}

export const usageManager = new UsageManager();
