/**
 * Nova Email Layer — Types
 * Email provider abstraction with OAuth support.
 */

// ─── Email Message ──────────────────────────────────────────────────────────

export type EmailStatus = "draft" | "sending" | "sent" | "failed" | "scheduled";

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64
  url?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  status: EmailStatus;
  provider?: string;
  providerMessageId?: string;
  operationId?: string; // For idempotency
  labels?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  receivedAt?: number;
  sentAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export type EmailProviderType = "gmail" | "outlook" | "imap" | "local";

export interface EmailProviderConfig {
  type: EmailProviderType;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  email?: string;
}

export interface EmailProviderCapabilities {
  search: boolean;
  read: boolean;
  compose: boolean;
  send: boolean;
  delete: boolean;
  labels: boolean;
  threads: boolean;
  attachments: boolean;
}

export interface EmailProvider {
  name: string;
  type: EmailProviderType;
  isAvailable(): boolean;
  isAuthenticated(): boolean;
  getCapabilities(): EmailProviderCapabilities;
  search(query: string, maxResults?: number): Promise<EmailMessage[]>;
  read(messageId: string): Promise<EmailMessage | null>;
  getThread(threadId: string): Promise<EmailMessage[]>;
  draft(message: Partial<EmailMessage>): Promise<EmailMessage>;
  send(message: EmailMessage): Promise<EmailMessage>;
  delete(messageId: string): Promise<boolean>;
  getLabels(): Promise<string[]>;
}

// ─── Connection ─────────────────────────────────────────────────────────────

export type IntegrationStatus = "connected" | "disconnected" | "error" | "expired";

export interface Integration {
  id: string;
  provider: string;
  type: EmailProviderType;
  status: IntegrationStatus;
  email?: string;
  permissions: string[];
  lastSyncAt?: number;
  error?: string;
  createdAt: number;
}
