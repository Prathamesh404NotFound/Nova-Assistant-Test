/**
 * Nova Web Layer — Types
 * Types for browser, search, and web content services.
 */

// ─── Search ─────────────────────────────────────────────────────────────────

export interface SearchQuery {
  query: string;
  type: "web" | "news" | "images";
  maxResults?: number;
  language?: string;
  region?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
  imageUrl?: string;
  relevance?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTimeMs: number;
  provider: string;
}

// ─── Browser ────────────────────────────────────────────────────────────────

export type BrowserAction =
  | "open"
  | "navigate"
  | "back"
  | "forward"
  | "reload"
  | "extract"
  | "find"
  | "screenshot"
  | "download";

export interface BrowserSession {
  id: string;
  currentUrl: string;
  title: string;
  history: string[];
  historyIndex: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface PageContent {
  url: string;
  title: string;
  text: string;
  html: string;
  links: PageLink[];
  images: PageImage[];
  meta: Record<string, string>;
  extractedAt: number;
  fetchTimeMs: number;
}

export interface PageLink {
  text: string;
  url: string;
  isExternal: boolean;
}

export interface PageImage {
  alt: string;
  url: string;
  width?: number;
  height?: number;
}

export interface BrowserObservation {
  url: string;
  title: string;
  content: string;
  links: PageLink[];
  elements: UIPageElement[];
}

export interface UIPageElement {
  tag: string;
  text: string;
  href?: string;
  type?: string;
  name?: string;
  id?: string;
  className?: string;
}

// ─── Research ───────────────────────────────────────────────────────────────

export interface ResearchSource {
  url: string;
  title: string;
  content: string;
  reliability: number;
  fetchedAt: number;
}

export interface ResearchReport {
  topic: string;
  sources: ResearchSource[];
  summary: string;
  keyFindings: string[];
  citations: string[];
  completedAt: number;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export interface WebProvider {
  name: string;
  isAvailable(): boolean;
  search(query: SearchQuery): Promise<SearchResponse>;
}

export interface BrowserProvider {
  name: string;
  isAvailable(): boolean;
  open(url: string): Promise<BrowserSession>;
  extract(url: string): Promise<PageContent>;
  find(url: string, selector: string): Promise<UIPageElement[]>;
}
