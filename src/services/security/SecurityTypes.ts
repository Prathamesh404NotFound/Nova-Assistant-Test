/**
 * Nova Security Layer — Types
 * Capability firewall, permission system, risk classification, and audit logging.
 */

// ─── Risk Levels ─────────────────────────────────────────────────────────────

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

// ─── Permission Capabilities ─────────────────────────────────────────────────

export type PermissionCapability =
  | "memory.read"
  | "memory.write"
  | "calendar.read"
  | "calendar.write"
  | "task.read"
  | "task.write"
  | "email.read"
  | "email.send"
  | "browser.read"
  | "browser.act"
  | "file.read"
  | "file.write"
  | "screen.read"
  | "screen.capture"
  | "desktop.control"
  | "device.control"
  | "network.access"
  | "notification.send"
  | "automation.execute"
  | "voice.control"
  | "ai.infer";

// ─── Permission Grants ───────────────────────────────────────────────────────

export type PermissionGrantType =
  | "once"            // approve this single invocation
  | "mission"         // approve for the current mission only
  | "session"         // approve for this app session
  | "always";         // persistent grant until revoked

export interface PermissionGrant {
  capability: PermissionCapability;
  grantType: PermissionGrantType;
  grantedAt: number;
  expiresAt?: number;       // undefined = no expiry (for "always")
  missionId?: string;       // scoped to this mission if grantType = "mission"
  source: "user" | "system";
}

// ─── Permission Decision ─────────────────────────────────────────────────────

export type PermissionDecision =
  | { allowed: true; grantType: PermissionGrantType }
  | { allowed: false; reason: string; requiresConfirmation: boolean };

// ─── Audit Log Entry ─────────────────────────────────────────────────────────

export type AuditAction =
  | "tool.execute"
  | "permission.grant"
  | "permission.deny"
  | "permission.revoke"
  | "tool.confirm"
  | "tool.reject"
  | "mission.create"
  | "mission.complete"
  | "mission.fail"
  | "mission.cancel"
  | "emergency.stop"
  | "security.violation"
  | "data.export"
  | "data.delete"
  | "system.error";

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  tool?: string;
  risk?: RiskLevel;
  capability?: PermissionCapability;
  success: boolean;
  detail: string;
  source: "voice" | "chat" | "quick-action" | "system" | "automation";
  userId?: string;
  operationId?: string; // for idempotency tracking
  /** Sensitive data excluded: passwords, tokens, keys, full content */
  redacted?: boolean;
}

// ─── Security Violation ──────────────────────────────────────────────────────

export interface SecurityViolation {
  id: string;
  timestamp: number;
  type:
    | "permission_bypass"
    | "injection_attempt"
    | "rate_limit"
    | "loop_detected"
    | "unauthorized_tool"
    | "data_exfiltration"
    | "scope_violation";
  severity: "warning" | "critical";
  detail: string;
  blockedAction?: string;
}

// ─── Tool Security Metadata ──────────────────────────────────────────────────

export interface ToolSecurityMeta {
  riskLevel: RiskLevel;
  requiredCapabilities: PermissionCapability[];
  confirmationRequired: boolean;
  requiresScopeValidation: boolean; // for "delete my files" type commands
  idempotent: boolean; // safe to retry
  reversible: boolean; // action can be undone
  externalSideEffects: boolean; // contacts outside systems
}

// ─── Prompt Boundary ─────────────────────────────────────────────────────────

export type ContentBoundary =
  | "system"
  | "user"
  | "memory"
  | "tool_result"
  | "web_content"
  | "email_content"
  | "file_content"
  | "screen_content";

export interface BoundedContent {
  boundary: ContentBoundary;
  content: string;
  trusted: boolean; // system/user = true, everything else = false
}

// ─── Prompt Injection Detection ──────────────────────────────────────────────

export interface InjectionCheckResult {
  isSuspicious: boolean;
  flags: string[];
  confidence: number;
}
