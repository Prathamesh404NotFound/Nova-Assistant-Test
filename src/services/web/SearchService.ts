/**
 * Nova Web Layer — SearchService
 * Real web search using DuckDuckGo API (no API key required).
 * Falls back to Google Custom Search if a key is available.
 */

import type { SearchQuery, SearchResponse, SearchResult } from "./WebTypes";

// ─── DuckDuckGo Search ──────────────────────────────────────────────────────

async function duckDuckGoSearch(query: string, maxResults = 10): Promise<SearchResult[]> {
  try {
    // DuckDuckGo instant answer API
    const params = new URLSearchParams({
      q: query,
      format: "json",
      no_html: "1",
      skip_disambig: "1",
    });

    const response = await fetch(
      `https://api.duckduckgo.com/?${params.toString()}`,
      {
        headers: {
          "User-Agent": "NovaAssistant/1.0",
        },
      }
    );

    if (!response.ok) {
      // Fallback: use DuckDuckGo HTML search via lite version
      return await duckDuckGoLiteSearch(query, maxResults);
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    // Abstract (main answer)
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.AbstractText,
        source: data.AbstractSource || "DuckDuckGo",
      });
    }

    // Related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= maxResults) break;
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 80),
            url: topic.FirstURL,
            snippet: topic.Text,
            source: "DuckDuckGo",
          });
        }
        // Handle nested topics
        if (topic.Topics && Array.isArray(topic.Topics)) {
          for (const sub of topic.Topics) {
            if (results.length >= maxResults) break;
            if (sub.Text && sub.FirstURL) {
              results.push({
                title: sub.Text.split(" - ")[0] || sub.Text.substring(0, 80),
                url: sub.FirstURL,
                snippet: sub.Text,
                source: "DuckDuckGo",
              });
            }
          }
        }
      }
    }

    return results.slice(0, maxResults);
  } catch {
    return await duckDuckGoLiteSearch(query, maxResults);
  }
}

/**
 * Fallback: Fetch DuckDuckGo lite HTML and parse results.
 * This is used when the JSON API doesn't return enough results.
 */
async function duckDuckGoLiteSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(
      `https://lite.duckduckgo.com/lite/?${params.toString()}`,
      {
        headers: {
          "User-Agent": "NovaAssistant/1.0",
        },
      }
    );

    if (!response.ok) return [];

    const html = await response.text();
    return parseLiteResults(html, maxResults);
  } catch {
    return [];
  }
}

/**
 * Parse DuckDuckGo lite HTML to extract search results.
 */
function parseLiteResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Match result links and snippets from the lite page
  const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: { url: string; title: string }[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    links.push({ url: match[1], title: match[2].trim() });
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    const link = links[i];
    if (!link.url.startsWith("http")) continue;

    results.push({
      title: link.title || "Untitled",
      url: link.url,
      snippet: snippets[i] || "",
      source: new URL(link.url).hostname,
    });
  }

  return results;
}

// ─── Google Custom Search (optional) ────────────────────────────────────────

async function googleSearch(
  query: string,
  maxResults: number,
  apiKey: string,
  cx: string
): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q: query,
      num: String(Math.min(maxResults, 10)),
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params.toString()}`
    );

    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || []).map((item: Record<string, unknown>) => ({
      title: (item.title as string) || "",
      url: (item.link as string) || "",
      snippet: (item.snippet as string) || "",
      source: (item.displayLink as string) || "",
    }));
  } catch {
    return [];
  }
}

// ─── Search Service ─────────────────────────────────────────────────────────

class SearchServiceImpl {
  /**
   * Search the web using the best available provider.
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const maxResults = query.maxResults || 10;

    // Try Google Custom Search if API key is available
    const googleKey = (import.meta.env.VITE_GOOGLE_SEARCH_API_KEY as string) || "";
    const googleCx = (import.meta.env.VITE_GOOGLE_SEARCH_CX as string) || "";

    let results: SearchResult[] = [];
    let provider = "duckduckgo";

    if (googleKey && googleCx) {
      results = await googleSearch(query.query, maxResults, googleKey, googleCx);
      provider = "google";
    }

    // Fallback to DuckDuckGo
    if (results.length === 0) {
      results = await duckDuckGoSearch(query.query, maxResults);
      provider = "duckduckgo";
    }

    return {
      query: query.query,
      results,
      totalResults: results.length,
      searchTimeMs: Date.now() - startTime,
      provider,
    };
  }

  /**
   * Search for news articles.
   */
  async searchNews(query: string, maxResults = 5): Promise<SearchResponse> {
    return this.search({
      query: `${query} news`,
      type: "news",
      maxResults,
    });
  }

  /**
   * Check if search is available.
   */
  isAvailable(): boolean {
    return typeof fetch !== "undefined";
  }
}

export const searchService = new SearchServiceImpl();
