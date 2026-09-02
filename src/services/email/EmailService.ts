/**
 * Nova Email Layer — EmailService
 * Unified email service with provider abstraction.
 * Supports Gmail (OAuth), Outlook (OAuth), and local drafts.
 * All external operations require authenticated providers.
 */

import type {
  EmailMessage,
  EmailProvider,
  EmailProviderType,
  EmailAddress,
  EmailStatus,
  Integration,
} from "./EmailTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const DRAFTS_KEY = "nova_email_drafts";
const INTEGRATIONS_KEY = "nova_email_integrations";
const SENT_KEY = "nova_email_sent";

function loadDrafts(): EmailMessage[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveDrafts(drafts: EmailMessage[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(-200)));
  } catch { /* ignore */ }
}

function loadSent(): EmailMessage[] {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveSent(sent: EmailMessage[]): void {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent.slice(-500)));
  } catch { /* ignore */ }
}

function loadIntegrations(): Integration[] {
  try {
    const raw = localStorage.getItem(INTEGRATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveIntegrations(integrations: Integration[]): void {
  try {
    localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(integrations));
  } catch { /* ignore */ }
}

// ─── Idempotency ────────────────────────────────────────────────────────────

function generateOperationId(): string {
  return `op_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
}

// ─── Gmail Provider (OAuth) ────────────────────────────────────────────────

class GmailProvider implements EmailProvider {
  name = "Gmail";
  type: EmailProviderType = "gmail";
  private accessToken: string | null = null;

  isAvailable(): boolean {
    return typeof fetch !== "undefined";
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getCapabilities() {
    return {
      search: this.isAuthenticated(),
      read: this.isAuthenticated(),
      compose: this.isAuthenticated(),
      send: this.isAuthenticated(),
      delete: this.isAuthenticated(),
      labels: this.isAuthenticated(),
      threads: this.isAuthenticated(),
      attachments: this.isAuthenticated(),
    };
  }

  async search(query: string, maxResults = 10): Promise<EmailMessage[]> {
    if (!this.isAuthenticated()) {
      throw new Error("Gmail not authenticated. Connect Gmail in Settings → Integrations.");
    }

    try {
      const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

      const data = await response.json();
      const messages: EmailMessage[] = [];

      for (const msg of data.messages || []) {
        const detail = await this.read(msg.id);
        if (detail) messages.push(detail);
      }

      return messages;
    } catch (err) {
      throw new Error(`Gmail search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  async read(messageId: string): Promise<EmailMessage | null> {
    if (!this.isAuthenticated()) return null;

    try {
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const headers = data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: Record<string, string>) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      // Extract body
      let body = "";
      const parts = data.payload?.parts || [data.payload];
      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          body = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          break;
        }
      }

      return {
        id: data.id,
        threadId: data.threadId,
        from: this.parseAddress(getHeader("From")),
        to: [this.parseAddress(getHeader("To"))],
        subject: getHeader("Subject"),
        body,
        status: "sent" as EmailStatus,
        provider: "gmail",
        providerMessageId: data.id,
        labels: data.labelIds || [],
        isRead: !(data.labelIds || []).includes("UNREAD"),
        receivedAt: parseInt(data.internalDate || "0", 10),
        createdAt: parseInt(data.internalDate || "0", 10),
        updatedAt: parseInt(data.internalDate || "0", 10),
      };
    } catch {
      return null;
    }
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    if (!this.isAuthenticated()) return [];

    try {
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const messages: EmailMessage[] = [];

      for (const msg of data.messages || []) {
        const detail = await this.read(msg.id);
        if (detail) messages.push(detail);
      }

      return messages;
    } catch {
      return [];
    }
  }

  async draft(message: Partial<EmailMessage>): Promise<EmailMessage> {
    return this.createLocalDraft(message, "gmail");
  }

  async send(message: EmailMessage): Promise<EmailMessage> {
    if (!this.isAuthenticated()) {
      throw new Error("Gmail not authenticated. Connect Gmail in Settings → Integrations.");
    }

    // Build RFC 2822 email
    const boundary = `boundary_${crypto.randomUUID()}`;
    const rawEmail = [
      `From: ${message.from.email}`,
      `To: ${message.to.map((t) => t.email).join(", ")}`,
      message.cc?.length ? `Cc: ${message.cc.map((c) => c.email).join(", ")}` : "",
      `Subject: ${message.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      "",
      message.body,
      "",
      message.bodyHtml
        ? [
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            "",
            message.bodyHtml,
            "",
          ].join("\n")
        : "",
      `--${boundary}--`,
    ]
      .filter(Boolean)
      .join("\r\n");

    try {
      const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: btoa(rawEmail).replace(/\+/g, "-").replace(/\//g, "_"),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gmail send failed: ${response.status} ${error}`);
      }

      const result = await response.json();

      return {
        ...message,
        id: result.id || message.id,
        status: "sent",
        providerMessageId: result.id,
        sentAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (err) {
      return {
        ...message,
        status: "failed",
        updatedAt: Date.now(),
      };
    }
  }

  async delete(messageId: string): Promise<boolean> {
    if (!this.isAuthenticated()) return false;

    try {
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getLabels(): Promise<string[]> {
    if (!this.isAuthenticated()) return [];

    try {
      const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/labels",
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) return [];
      const data = await response.json();
      return (data.labels || []).map((l: Record<string, string>) => l.name);
    } catch {
      return [];
    }
  }

  private parseAddress(raw: string): EmailAddress {
    const match = raw.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim().replace(/"/g, ""), email: match[2] };
    }
    return { email: raw };
  }

  private createLocalDraft(
    message: Partial<EmailMessage>,
    provider: string
  ): EmailMessage {
    const now = Date.now();
    return {
      id: `draft_${now}_${crypto.randomUUID().substring(0, 6)}`,
      from: message.from || { email: "", name: "" },
      to: message.to || [],
      subject: message.subject || "",
      body: message.body || "",
      bodyHtml: message.bodyHtml,
      status: "draft",
      provider,
      operationId: generateOperationId(),
      createdAt: now,
      updatedAt: now,
    };
  }
}

// ─── Local Draft Provider ───────────────────────────────────────────────────

class LocalDraftProvider implements EmailProvider {
  name = "Local Drafts";
  type: EmailProviderType = "local";

  isAvailable(): boolean {
    return true;
  }

  isAuthenticated(): boolean {
    return true;
  }

  getCapabilities() {
    return {
      search: true,
      read: true,
      compose: true,
      send: false, // Cannot actually send
      delete: true,
      labels: false,
      threads: false,
      attachments: false,
    };
  }

  async search(query: string, maxResults = 10): Promise<EmailMessage[]> {
    const drafts = loadDrafts();
    const q = query.toLowerCase();
    return drafts
      .filter(
        (d) =>
          d.subject.toLowerCase().includes(q) ||
          d.body.toLowerCase().includes(q) ||
          d.to.some((t) => t.email.toLowerCase().includes(q))
      )
      .slice(0, maxResults);
  }

  async read(messageId: string): Promise<EmailMessage | null> {
    const drafts = loadDrafts();
    return drafts.find((d) => d.id === messageId) || null;
  }

  async getThread(_threadId: string): Promise<EmailMessage[]> {
    return [];
  }

  async draft(message: Partial<EmailMessage>): Promise<EmailMessage> {
    const now = Date.now();
    const draft: EmailMessage = {
      id: `draft_${now}_${crypto.randomUUID().substring(0, 6)}`,
      from: message.from || { email: "", name: "" },
      to: message.to || [],
      subject: message.subject || "",
      body: message.body || "",
      bodyHtml: message.bodyHtml,
      status: "draft",
      operationId: generateOperationId(),
      createdAt: now,
      updatedAt: now,
    };

    const drafts = loadDrafts();
    drafts.push(draft);
    saveDrafts(drafts);

    return draft;
  }

  async send(_message: EmailMessage): Promise<EmailMessage> {
    throw new Error(
      "Local drafts cannot send emails. Connect Gmail or Outlook in Settings → Integrations."
    );
  }

  async delete(messageId: string): Promise<boolean> {
    const drafts = loadDrafts();
    const filtered = drafts.filter((d) => d.id !== messageId);
    if (filtered.length === drafts.length) return false;
    saveDrafts(filtered);
    return true;
  }

  async getLabels(): Promise<string[]> {
    return [];
  }
}

// ─── Email Service ──────────────────────────────────────────────────────────

class EmailServiceImpl {
  private providers: Map<EmailProviderType, EmailProvider> = new Map();
  private activeProvider: EmailProvider;
  private localProvider = new LocalDraftProvider();
  private integrations: Integration[] = loadIntegrations();

  constructor() {
    const gmailProvider = new GmailProvider();
    this.providers.set("gmail", gmailProvider);
    this.providers.set("local", this.localProvider);
    this.activeProvider = this.localProvider;

    // Restore Gmail token if available
    const gmailIntegration = this.integrations.find((i) => i.type === "gmail");
    if (gmailIntegration?.status === "connected") {
      const token = localStorage.getItem("nova_gmail_access_token");
      if (token) {
        gmailProvider.setAccessToken(token);
        this.activeProvider = gmailProvider;
      }
    }
  }

  /**
   * Get the active provider.
   */
  getProvider(): EmailProvider {
    return this.activeProvider;
  }

  /**
   * Set the active provider.
   */
  setProvider(type: EmailProviderType): void {
    const provider = this.providers.get(type);
    if (provider) {
      this.activeProvider = provider;
    }
  }

  /**
   * Connect a Gmail account via OAuth.
   */
  async connectGmail(accessToken: string, email: string): Promise<void> {
    const provider = this.providers.get("gmail") as GmailProvider;
    provider.setAccessToken(accessToken);
    this.activeProvider = provider;

    // Store token
    localStorage.setItem("nova_gmail_access_token", accessToken);

    // Update integrations
    const existing = this.integrations.find((i) => i.type === "gmail");
    const integration: Integration = {
      id: existing?.id || `gmail_${Date.now()}`,
      provider: "Gmail",
      type: "gmail",
      status: "connected",
      email,
      permissions: ["read", "compose", "send", "delete", "labels", "threads"],
      lastSyncAt: Date.now(),
      createdAt: existing?.createdAt || Date.now(),
    };

    this.integrations = this.integrations.filter((i) => i.type !== "gmail");
    this.integrations.push(integration);
    saveIntegrations(this.integrations);
  }

  /**
   * Disconnect a provider.
   */
  disconnect(type: EmailProviderType): void {
    if (type === "gmail") {
      localStorage.removeItem("nova_gmail_access_token");
      const provider = this.providers.get("gmail") as GmailProvider;
      provider.setAccessToken("");
    }

    this.integrations = this.integrations.filter((i) => i.type !== type);
    saveIntegrations(this.integrations);

    if (this.activeProvider.type === type) {
      this.activeProvider = this.localProvider;
    }
  }

  /**
   * Get all integrations.
   */
  getIntegrations(): Integration[] {
    return [...this.integrations];
  }

  // ─── Email Operations ───────────────────────────────────────────────────

  async search(query: string, maxResults = 10): Promise<EmailMessage[]> {
    return this.activeProvider.search(query, maxResults);
  }

  async read(messageId: string): Promise<EmailMessage | null> {
    return this.activeProvider.read(messageId);
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    return this.activeProvider.getThread(threadId);
  }

  async draft(message: Partial<EmailMessage>): Promise<EmailMessage> {
    return this.activeProvider.draft(message);
  }

  /**
   * Send an email with idempotency protection.
   * Checks for duplicate operation IDs before sending.
   */
  async send(message: EmailMessage): Promise<EmailMessage> {
    // Idempotency check
    if (message.operationId) {
      const sent = loadSent();
      const existing = sent.find((s) => s.operationId === message.operationId);
      if (existing && existing.status === "sent") {
        return existing; // Already sent, return cached result
      }
    }

    // Mark as sending
    message.status = "sending";
    message.updatedAt = Date.now();

    try {
      const result = await this.activeProvider.send(message);

      // Store sent message
      if (result.status === "sent") {
        const sent = loadSent();
        sent.push(result);
        saveSent(sent);
      }

      return result;
    } catch (err) {
      return {
        ...message,
        status: "failed",
        updatedAt: Date.now(),
      };
    }
  }

  async delete(messageId: string): Promise<boolean> {
    return this.activeProvider.delete(messageId);
  }

  /**
   * List all local drafts.
   */
  listDrafts(): EmailMessage[] {
    return loadDrafts();
  }

  /**
   * List sent emails.
   */
  listSent(): EmailMessage[] {
    return loadSent();
  }

  /**
   * Check if any provider is authenticated.
   */
  isAvailable(): boolean {
    return this.activeProvider.isAuthenticated();
  }

  /**
   * Get provider capabilities.
   */
  getCapabilities() {
    return this.activeProvider.getCapabilities();
  }
}

export const emailService = new EmailServiceImpl();
