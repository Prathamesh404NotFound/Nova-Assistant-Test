/**
 * Nova Web Layer — BrowserService
 * Real browser automation for web content extraction, navigation, and interaction.
 * Uses fetch for content retrieval and DOM parsing for extraction.
 */

import type {
  BrowserSession,
  BrowserObservation,
  PageContent,
  PageLink,
  UIPageElement,
} from "./WebTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const SESSION_KEY = "nova_browser_sessions";
const MAX_SESSIONS = 10;

function loadSessions(): BrowserSession[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveSessions(sessions: BrowserSession[]): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
  } catch { /* ignore */ }
}

// ─── HTML Parsing ───────────────────────────────────────────────────────────

function extractTextFromHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractLinks(html: string, baseUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  try {
    const base = new URL(baseUrl);

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, "").trim();

      if (!text || !href || href.startsWith("#") || href.startsWith("javascript:")) continue;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, base).toString();
      } catch {
        fullUrl = href;
      }

      const isExternal = !fullUrl.includes(base.hostname);

      links.push({ text: text.substring(0, 200), url: fullUrl, isExternal });
    }
  } catch { /* ignore URL parse errors */ }

  return links;
}

function extractImages(html: string, baseUrl: string): { alt: string; url: string }[] {
  const images: { alt: string; url: string }[] = [];
  const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || "";

    if (!src || src.startsWith("data:")) continue;

    try {
      const fullUrl = new URL(src, baseUrl).toString();
      images.push({ alt, url: fullUrl });
    } catch {
      images.push({ alt, url: src });
    }
  }

  return images;
}

function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaRegex = /<meta[^>]*(?:name|property)=["']([^"']*)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  let match;

  while ((match = metaRegex.exec(html)) !== null) {
    meta[match[1]] = match[2];
  }

  // Also try reversed attribute order
  const metaRegex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']([^"']*)["'][^>]*>/gi;
  while ((match = metaRegex2.exec(html)) !== null) {
    if (!meta[match[2]]) {
      meta[match[2]] = match[1];
    }
  }

  return meta;
}

function extractUIElements(html: string): UIPageElement[] {
  const elements: UIPageElement[] = [];

  // Extract interactive elements
  const elementRegex = /<(button|input|select|textarea|a)[^>]*(?:id=["']([^"']*)["'])?[^>]*(?:class=["']([^"']*)["'])?[^>]*(?:type=["']([^"']*)["'])?[^>]*(?:name=["']([^"']*)["'])?[^>]*(?:href=["']([^"']*)["'])?[^>]*>([^<]*)<\/(?:button|a)>/gi;
  let match;

  while ((match = elementRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    elements.push({
      tag,
      id: match[2] || undefined,
      className: match[3] || undefined,
      type: match[4] || undefined,
      name: match[5] || undefined,
      href: match[6] || undefined,
      text: match[7].trim().substring(0, 200),
    });
  }

  // Extract inputs
  const inputRegex = /<input[^>]*(?:type=["']([^"']*)["'])?[^>]*(?:name=["']([^"']*)["'])?[^>]*(?:id=["']([^"']*)["'])?[^>]*(?:placeholder=["']([^"']*)["'])?[^>]*>/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    elements.push({
      tag: "input",
      type: match[1] || "text",
      name: match[2] || undefined,
      id: match[3] || undefined,
      text: match[4] || "",
    });
  }

  return elements;
}

// ─── Browser Service ────────────────────────────────────────────────────────

class BrowserServiceImpl {
  private sessions: BrowserSession[] = loadSessions();

  /**
   * Open a URL and return a browser session.
   */
  async open(url: string): Promise<BrowserSession> {
    // Normalize URL
    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    const session: BrowserSession = {
      id: crypto.randomUUID(),
      currentUrl: url,
      title: "",
      history: [url],
      historyIndex: 0,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    // Fetch to verify URL is accessible and get title
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "NovaAssistant/1.0" },
      });
      if (response.ok) {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        session.title = titleMatch ? titleMatch[1].trim() : url;
      }
    } catch {
      session.title = url;
    }

    this.sessions.push(session);
    saveSessions(this.sessions);

    return session;
  }

  /**
   * Extract content from a URL.
   */
  async extract(url: string): Promise<PageContent> {
    const startTime = Date.now();

    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "NovaAssistant/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    return {
      url,
      title,
      text: extractTextFromHtml(html),
      html,
      links: extractLinks(html, url),
      images: extractImages(html, url),
      meta: extractMeta(html),
      extractedAt: Date.now(),
      fetchTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Find UI elements on a page by selector/keyword.
   */
  async find(url: string, selector: string): Promise<UIPageElement[]> {
    const content = await this.extract(url);
    const elements = extractUIElements(content.html);

    // Filter by selector (text match, tag match, or class/id match)
    const lowerSelector = selector.toLowerCase();
    return elements.filter(
      (el) =>
        el.text.toLowerCase().includes(lowerSelector) ||
        el.tag.toLowerCase().includes(lowerSelector) ||
        (el.id && el.id.toLowerCase().includes(lowerSelector)) ||
        (el.className && el.className.toLowerCase().includes(lowerSelector)) ||
        (el.name && el.name.toLowerCase().includes(lowerSelector))
    );
  }

  /**
   * Take a snapshot/observation of a page.
   */
  async observe(url: string): Promise<BrowserObservation> {
    const content = await this.extract(url);
    const elements = extractUIElements(content.html);

    return {
      url: content.url,
      title: content.title,
      content: content.text.substring(0, 5000),
      links: content.links.slice(0, 50),
      elements: elements.slice(0, 100),
    };
  }

  /**
   * Navigate to a URL within an existing session.
   */
  async navigate(sessionId: string, url: string): Promise<BrowserSession> {
    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("Session not found");

    // Truncate forward history
    session.history = session.history.slice(0, session.historyIndex + 1);
    session.history.push(url);
    session.historyIndex = session.history.length - 1;
    session.currentUrl = url;
    session.lastAccessedAt = Date.now();

    // Get title
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "NovaAssistant/1.0" },
      });
      if (response.ok) {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        session.title = titleMatch ? titleMatch[1].trim() : url;
      }
    } catch {
      session.title = url;
    }

    saveSessions(this.sessions);
    return session;
  }

  /**
   * Go back in browser history.
   */
  back(sessionId: string): BrowserSession {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("Session not found");
    if (session.historyIndex > 0) {
      session.historyIndex--;
      session.currentUrl = session.history[session.historyIndex];
      session.lastAccessedAt = Date.now();
      saveSessions(this.sessions);
    }
    return session;
  }

  /**
   * Go forward in browser history.
   */
  forward(sessionId: string): BrowserSession {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("Session not found");
    if (session.historyIndex < session.history.length - 1) {
      session.historyIndex++;
      session.currentUrl = session.history[session.historyIndex];
      session.lastAccessedAt = Date.now();
      saveSessions(this.sessions);
    }
    return session;
  }

  /**
   * Get active sessions.
   */
  getSessions(): BrowserSession[] {
    return [...this.sessions];
  }

  /**
   * Close a session.
   */
  close(sessionId: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    saveSessions(this.sessions);
  }

  /**
   * Summarize a web page content.
   */
  async summarize(url: string): Promise<string> {
    const content = await this.extract(url);
    const text = content.text;

    // Extract the first 2000 characters as a summary
    if (text.length <= 2000) return text;

    // Find a natural break point
    const breakIndex = text.indexOf(". ", 1500);
    if (breakIndex > 0) {
      return text.substring(0, breakIndex + 1);
    }

    return text.substring(0, 2000) + "...";
  }

  /**
   * Check if the browser service is available.
   */
  isAvailable(): boolean {
    return typeof fetch !== "undefined";
  }
}

export const browserService = new BrowserServiceImpl();
