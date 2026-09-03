/**
 * Nova Security Layer — Capability Firewall
 * Centralized security for all tool executions.
 * Manages permissions, risk classification, audit logging, and injection defense.
 */

import type {
  RiskLevel,
  PermissionCapability,
  PermissionGrant,
  PermissionGrantType,
  PermissionDecision,
  AuditEntry,
  AuditAction,
  SecurityViolation,
  ToolSecurityMeta,
  ContentBoundary,
  BoundedContent,
  InjectionCheckResult,
} from "./SecurityTypes";

// ─── Default Security Metadata per Tool Category ─────────────────────────────

const CATEGORY_SECURITY: Record<string, ToolSecurityMeta> = {
  memory: {
    riskLevel: "low",
    requiredCapabilities: [],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: true,
    externalSideEffects: false,
  },
  calendar: {
    riskLevel: "medium",
    requiredCapabilities: ["calendar.read", "calendar.write"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: false,
    reversible: true,
    externalSideEffects: true,
  },
  tasks: {
    riskLevel: "low",
    requiredCapabilities: ["task.read", "task.write"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: true,
    externalSideEffects: false,
  },
  email: {
    riskLevel: "high",
    requiredCapabilities: ["email.read", "email.send"],
    confirmationRequired: true,
    requiresScopeValidation: false,
    idempotent: false,
    reversible: false,
    externalSideEffects: true,
  },
  browser: {
    riskLevel: "medium",
    requiredCapabilities: ["browser.read"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: true,
  },
  search: {
    riskLevel: "low",
    requiredCapabilities: ["network.access"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: true,
  },
  files: {
    riskLevel: "high",
    requiredCapabilities: ["file.read", "file.write"],
    confirmationRequired: true,
    requiresScopeValidation: true,
    idempotent: false,
    reversible: false,
    externalSideEffects: false,
  },
  desktop: {
    riskLevel: "critical",
    requiredCapabilities: ["desktop.control"],
    confirmationRequired: true,
    requiresScopeValidation: false,
    idempotent: false,
    reversible: false,
    externalSideEffects: false,
  },
  perception: {
    riskLevel: "medium",
    requiredCapabilities: ["screen.read", "screen.capture"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: false,
  },
  device: {
    riskLevel: "medium",
    requiredCapabilities: ["device.control"],
    confirmationRequired: true,
    requiresScopeValidation: false,
    idempotent: false,
    reversible: true,
    externalSideEffects: true,
  },
  automation: {
    riskLevel: "high",
    requiredCapabilities: ["automation.execute"],
    confirmationRequired: true,
    requiresScopeValidation: false,
    idempotent: false,
    reversible: false,
    externalSideEffects: false,
  },
  notifications: {
    riskLevel: "low",
    requiredCapabilities: ["notification.send"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: false,
  },
  system: {
    riskLevel: "safe",
    requiredCapabilities: [],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: false,
  },
  plugins: {
    riskLevel: "medium",
    requiredCapabilities: ["ai.infer"],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: false,
  },
  navigation: {
    riskLevel: "safe",
    requiredCapabilities: [],
    confirmationRequired: false,
    requiresScopeValidation: false,
    idempotent: true,
    reversible: false,
    externalSideEffects: false,
  },
};

// ─── Tool-Specific Risk Overrides ────────────────────────────────────────────

const TOOL_RISK_OVERRIDES: Record<string, Partial<ToolSecurityMeta>> = {
  "email.send": { riskLevel: "critical", confirmationRequired: true },
  "email.draft": { riskLevel: "high", confirmationRequired: true },
  "file.delete": { riskLevel: "critical", confirmationRequired: true },
  "file.write": { riskLevel: "high" },
  "desktop.type": { riskLevel: "critical", confirmationRequired: true },
  "desktop.click": { riskLevel: "high" },
  "desktop.hotkey": { riskLevel: "high" },
  "desktop.launchApp": { riskLevel: "high" },
  "desktop.closeApp": { riskLevel: "high" },
  "automation.create": { riskLevel: "high", confirmationRequired: true },
  "calendar.delete": { riskLevel: "high", confirmationRequired: true },
  "task.delete": { riskLevel: "high", confirmationRequired: true },
  "memory.delete": { riskLevel: "medium", confirmationRequired: true },
  "device.toggle": { riskLevel: "high", confirmationRequired: true },
  "device.adjust": { riskLevel: "medium" },
  "screen.capture": { riskLevel: "medium" },
  "clipboard.write": { riskLevel: "medium" },
};

// ─── Injection Patterns ──────────────────────────────────────────────────────

const INJECTION_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)/i, flag: "ignore_instructions" },
  { pattern: /you\s+are\s+now\s+(a|an|the)\s+/i, flag: "role_override" },
  { pattern: /act\s+as\s+(?:if\s+)?(?:you\s+are|there\s+are\s+no)\s+/i, flag: "role_override" },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|safety|your)\s+/i, flag: "ignore_instructions" },
  { pattern: /\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b/i, flag: "jailbreak_attempt" },
  { pattern: /system\s*prompt\s*:\s*/i, flag: "system_prompt_leak" },
  { pattern: /\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>/i, flag: "delimiter_injection" },
  { pattern: /pretend\s+(?:you(?:'re| are))?\s*(?:not|without)\s+(?:any\s+)?(?:restrict|filter|rule|limit)/i, flag: "restriction_bypass" },
  { pattern: /send\s+(?:all\s+)?(?:data|files?|info|secrets?|keys?|tokens?)\s+to\s+/i, flag: "data_exfiltration" },
  { pattern: /override\s+(?:safety|security|permission|admin)/i, flag: "privilege_escalation" },
  { pattern: /delete\s+(?:all|everything|every|entire|the\s+whole)/i, flag: "destructive_scope" },
];

// ─── Security Layer Implementation ───────────────────────────────────────────

class SecurityLayerImpl {
  private grants = new Map<PermissionCapability, PermissionGrant[]>();
  private auditLog: AuditEntry[] = [];
  private violations: SecurityViolation[] = [];
  private maxAuditSize = 1000;
  private maxViolationSize = 200;
  private onViolation?: (v: SecurityViolation) => void;
  private onConfirmationNeeded?: (tool: string, risk: RiskLevel, message: string, callback: (approved: boolean) => void) => void;

  // ── Initialization ──

  init(): void {
    this.loadGrants();
  }

  setViolationHandler(handler: (v: SecurityViolation) => void): void {
    this.onViolation = handler;
  }

  setConfirmationHandler(handler: (tool: string, risk: RiskLevel, message: string, callback: (approved: boolean) => void) => void): void {
    this.onConfirmationNeeded = handler;
  }

  // ── Security Metadata ──

  getToolSecurityMeta(toolName: string, category: string): ToolSecurityMeta {
    const base = CATEGORY_SECURITY[category] || CATEGORY_SECURITY.system;
    const override = TOOL_RISK_OVERRIDES[toolName] || {};
    return { ...base, ...override };
  }

  // ── Permission System ──

  checkPermission(toolName: string, category: string, context?: { missionId?: string }): PermissionDecision {
    const meta = this.getToolSecurityMeta(toolName, category);

    // No capabilities needed → always allowed
    if (meta.requiredCapabilities.length === 0) {
      return { allowed: true, grantType: "session" };
    }

    // Check each required capability
    for (const cap of meta.requiredCapabilities) {
      const grant = this.findGrant(cap, context?.missionId);
      if (!grant) {
        return {
          allowed: false,
          reason: `Missing permission: ${cap}`,
          requiresConfirmation: meta.confirmationRequired,
        };
      }
    }

    return { allowed: true, grantType: "session" };
  }

  grantPermission(capability: PermissionCapability, grantType: PermissionGrantType, source: "user" | "system", missionId?: string): PermissionGrant {
    const grant: PermissionGrant = {
      capability,
      grantType,
      grantedAt: Date.now(),
      source,
      missionId,
      expiresAt: grantType === "session" ? Date.now() + 30 * 60 * 1000 : undefined,
    };

    const existing = this.grants.get(capability) || [];
    existing.push(grant);
    this.grants.set(capability, existing);
    this.saveGrants();

    this.audit("permission.grant", true, `Granted ${capability} (${grantType})`, { capability, source: "system" });
    return grant;
  }

  revokePermission(capability: string, grantType?: PermissionGrantType): void {
    if (grantType) {
      const existing = this.grants.get(capability as PermissionCapability) || [];
      this.grants.set(capability as PermissionCapability, existing.filter((g) => g.grantType !== grantType));
    } else {
      this.grants.delete(capability as PermissionCapability);
    }
    this.saveGrants();
    this.audit("permission.revoke", true, `Revoked ${capability}`, { source: "system" });
  }

  revokeAllSessionPermissions(): void {
    for (const [cap, grants] of this.grants) {
      this.grants.set(cap, grants.filter((g) => g.grantType !== "session" && g.grantType !== "once"));
    }
    this.saveGrants();
  }

  revokeAllMissionPermissions(missionId: string): void {
    for (const [cap, grants] of this.grants) {
      this.grants.set(cap, grants.filter((g) => g.missionId !== missionId));
    }
    this.saveGrants();
  }

  getActivePermissions(): Array<{ capability: PermissionCapability; grants: PermissionGrant[] }> {
    const result: Array<{ capability: PermissionCapability; grants: PermissionGrant[] }> = [];
    const now = Date.now();
    for (const [cap, grants] of this.grants) {
      const active = grants.filter((g) => !g.expiresAt || g.expiresAt > now);
      if (active.length > 0) result.push({ capability: cap, grants: active });
    }
    return result;
  }

  private findGrant(capability: PermissionCapability, missionId?: string): PermissionGrant | undefined {
    const now = Date.now();
    const grants = this.grants.get(capability) || [];
    // Priority: once > mission > session > always
    return grants
      .filter((g) => !g.expiresAt || g.expiresAt > now)
      .filter((g) => g.grantType !== "mission" || g.missionId === missionId)
      .sort((a, b) => {
        const order: Record<PermissionGrantType, number> = { once: 0, mission: 1, session: 2, always: 3 };
        return order[a.grantType] - order[b.grantType];
      })[0];
  }

  // ── Audit Logging ──

  audit(
    action: AuditAction,
    success: boolean,
    detail: string,
    meta?: { tool?: string; risk?: RiskLevel; capability?: PermissionCapability; source?: AuditEntry["source"]; userId?: string; operationId?: string }
  ): AuditEntry {
    const entry: AuditEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      action,
      success,
      detail,
      tool: meta?.tool,
      risk: meta?.risk,
      capability: meta?.capability,
      source: meta?.source || "system",
      userId: meta?.userId,
      operationId: meta?.operationId,
      redacted: this.shouldRedact(action),
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditSize);
    }
    return entry;
  }

  getAuditLog(limit = 50): AuditEntry[] {
    return this.auditLog.slice(-limit).reverse();
  }

  getAuditLogByTool(toolName: string, limit = 20): AuditEntry[] {
    return this.auditLog.filter((e) => e.tool === toolName).slice(-limit).reverse();
  }

  private shouldRedact(action: AuditAction): boolean {
    return ["email.send", "data.export", "data.delete", "permission.grant"].includes(action);
  }

  // ── Prompt Injection Defense ──

  checkInjection(text: string): InjectionCheckResult {
    const flags: string[] = [];
    let totalConfidence = 0;

    for (const { pattern, flag } of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        flags.push(flag);
        totalConfidence += 0.3;
      }
    }

    return {
      isSuspicious: flags.length > 0,
      flags,
      confidence: Math.min(totalConfidence, 1.0),
    };
  }

  wrapContent(boundary: ContentBoundary, content: string): BoundedContent {
    return {
      boundary,
      content,
      trusted: boundary === "system" || boundary === "user",
    };
  }

  // ── Scope Validation ──────────────────────────────────────────────────────

  validateDestructiveScope(action: string, args: Record<string, unknown>): { valid: boolean; question?: string } {
    const target = String(args.path || args.folder || args.name || args.query || "").toLowerCase();

    // Detect overly broad destructive commands
    if (/\bdelete\b|\bremove\b|\bclear\b/.test(action)) {
      if (/^(all|everything|every|entire|whole|\*)$/i.test(target)) {
        return {
          valid: false,
          question: "That would affect a large scope. Could you specify exactly what you'd like me to delete?",
        };
      }
      if (!target || target.length < 2) {
        return {
          valid: false,
          question: "What specifically would you like me to delete? I need a specific target.",
        };
      }
    }
    return { valid: true };
  }

  // ── Violations ──

  recordViolation(type: SecurityViolation["type"], severity: SecurityViolation["severity"], detail: string, blockedAction?: string): SecurityViolation {
    const v: SecurityViolation = {
      id: `vln_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type,
      severity,
      detail,
      blockedAction,
    };
    this.violations.push(v);
    if (this.violations.length > this.maxViolationSize) {
      this.violations = this.violations.slice(-this.maxViolationSize);
    }
    this.audit("security.violation", false, `[${severity.toUpperCase()}] ${type}: ${detail}`, {
      tool: blockedAction,
      source: "system",
    });
    this.onViolation?.(v);
    return v;
  }

  getViolations(limit = 20): SecurityViolation[] {
    return this.violations.slice(-limit).reverse();
  }

  // ── Persistence ──

  private loadGrants(): void {
    try {
      const stored = localStorage.getItem("nova_security_grants");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<[PermissionCapability, PermissionGrant[]]>;
        this.grants = new Map(parsed);
      }
    } catch { /* ignore corrupt data */ }
  }

  private saveGrants(): void {
    try {
      localStorage.setItem("nova_security_grants", JSON.stringify(Array.from(this.grants.entries())));
    } catch { /* storage full */ }
  }
}

export const securityLayer = new SecurityLayerImpl();
