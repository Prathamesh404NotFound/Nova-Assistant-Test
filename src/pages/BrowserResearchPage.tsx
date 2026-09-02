/**
 * Nova AI OS — Browser Research Mode
 * Citations, source comparison, structured extraction,
 * safe browsing mode (no navigation/submit), and result history.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Globe,
  Search,
  ExternalLink,
  Shield,
  Clock,
  BookOpen,
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ArrowUpRight,
  Bookmark,
  X,
  Link,
  FileText,
} from "lucide-react";

// --- Types ---
export interface ResearchResult {
  id: string;
  query: string;
  url: string;
  title: string;
  snippet: string;
  domain: string;
  confidence: number;
  timestamp: number;
  extracted?: {
    title: string;
    summary: string;
    keyPoints: string[];
    citations: string[];
    structured?: Record<string, string>;
  };
  bookmarked: boolean;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  resultCount: number;
  timestamp: number;
}

const HISTORY_KEY = "nova_research_history";
const RESULTS_KEY = "nova_research_results";

function generateId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory(): SearchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadResults(): ResearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: SearchHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-200)));
}

function saveResults(results: ResearchResult[]) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results.slice(-500)));
}

// Simulated search for demo
function simulateSearch(query: string): ResearchResult[] {
  const now = Date.now();
  const domains = ["en.wikipedia.org", "docs.google.com", "arxiv.org", "stackoverflow.com", "medium.com"];
  const results: ResearchResult[] = [];

  for (let i = 0; i < 5; i++) {
    const domain = domains[i % domains.length];
    results.push({
      id: generateId(),
      query,
      url: `https://${domain}/search?q=${encodeURIComponent(query)}`,
      title: `${query} — ${domain}`,
      snippet: `Comprehensive information about ${query} from ${domain}. This source covers key aspects including definitions, examples, and related topics.`,
      domain,
      confidence: 0.7 + Math.random() * 0.3,
      timestamp: now,
      bookmarked: false,
    });
  }
  return results;
}

function simulateExtraction(url: string, title: string): ResearchResult["extracted"] {
  return {
    title,
    summary: `This page provides detailed information about the topic. It covers multiple aspects including background, current state, and future implications. The content is well-structured with clear sections.`,
    keyPoints: [
      "Key definition and core concepts",
      "Historical context and evolution",
      "Current applications and use cases",
      "Related topics and further reading",
      "Expert opinions and analysis",
    ],
    citations: [
      "Smith et al. (2024). Overview of modern approaches.",
      "Journal of Research, Vol. 12, pp. 45-67.",
      "Official documentation and guidelines.",
    ],
    structured: {
      Topic: title,
      "Last Updated": new Date().toLocaleDateString(),
      "Source Type": "Web Article",
      "Reading Time": "5 min",
      Reliability: "High",
    },
  };
}

export function BrowserResearchMode() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchResult[]>(loadResults);
  const [history, setHistory] = useState<SearchHistoryEntry[]>(loadHistory);
  const [selectedResult, setSelectedResult] = useState<ResearchResult | null>(null);
  const [safeMode, setSafeMode] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());

  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveResults(results); }, [results]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return results.filter((r) => r.query === query);
  }, [results, query]);

  const bookmarkedResults = useMemo(() => results.filter((r) => r.bookmarked), [results]);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setIsSearching(true);

    setTimeout(() => {
      const newResults = simulateSearch(query.trim());
      setResults((prev) => [...newResults, ...prev]);
      setHistory((prev) => [
        { id: generateId(), query: query.trim(), resultCount: newResults.length, timestamp: Date.now() },
        ...prev,
      ]);
      setIsSearching(false);
    }, 500);
  }, [query]);

  const handleExtract = useCallback((result: ResearchResult) => {
    const extracted = simulateExtraction(result.url, result.title);
    setResults((prev) => prev.map((r) => r.id === result.id ? { ...r, extracted } : r));
    setSelectedResult({ ...result, extracted });
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setResults((prev) => prev.map((r) => r.id === id ? { ...r, bookmarked: !r.bookmarked } : r));
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }, []);

  const compareResults = useMemo(
    () => results.filter((r) => compareSet.has(r.id)),
    [results, compareSet]
  );

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Research Mode</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {results.length} results · {bookmarkedResults.length} bookmarked · {history.length} searches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSafeMode(!safeMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono rounded-md transition-colors ${
              safeMode ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/20" : "bg-slate-600/15 text-slate-400 border border-transparent"
            }`}
          >
            <Shield className="h-3 w-3" />
            {safeMode ? "Safe Mode ON" : "Safe Mode OFF"}
          </button>
        </div>
      </div>

      {/* Safe mode banner */}
      {safeMode && (
        <div className="bg-emerald-400/5 border border-emerald-400/15 rounded-lg px-3 py-2 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <p className="text-[10px] text-emerald-400">
            Safe browsing active — Nova won't navigate away or submit forms on your behalf.
          </p>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Research a topic..."
            className="w-full bg-[#0a1425] border border-[#1a2f4a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className="px-4 py-2.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
        >
          {isSearching ? "..." : "Search"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Results list */}
        <div className="lg:col-span-2 space-y-2">
          {searchResults.length === 0 && !isSearching && history.length > 0 && (
            <div className="text-center py-8">
              <Globe className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Enter a query to research</p>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Searching...</p>
            </div>
          )}

          {searchResults.map((result) => (
            <div
              key={result.id}
              className={`bg-[#0a1425] border rounded-lg p-3 space-y-2 transition-colors ${
                selectedResult?.id === result.id ? "border-cyan-500/30" : "border-[#1a2f4a] hover:border-[#2a4a6a]"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-cyan-400">{result.domain}</span>
                    {result.confidence > 0.9 && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  </div>
                  <h3 className="text-xs font-medium text-slate-200 mt-0.5 truncate">{result.title}</h3>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{result.snippet}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => toggleBookmark(result.id)}
                    className={`p-1 transition-colors ${result.bookmarked ? "text-amber-400" : "text-slate-600 hover:text-amber-400"}`}
                    aria-label={result.bookmarked ? "Remove bookmark" : "Bookmark"}
                  >
                    <Bookmark className="h-3.5 w-3.5" fill={result.bookmarked ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => toggleCompare(result.id)}
                    className={`p-1 transition-colors ${compareSet.has(result.id) ? "text-cyan-400" : "text-slate-600 hover:text-cyan-400"}`}
                    aria-label="Add to comparison"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      handleExtract(result);
                      setSelectedResult(result);
                    }}
                    className="p-1 text-slate-600 hover:text-cyan-400 transition-colors"
                    aria-label="Extract structured data"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-600">
                  {Math.round(result.confidence * 100)}% relevance
                </span>
                {safeMode ? (
                  <span className="flex items-center gap-0.5 text-[9px] font-mono text-emerald-400/60">
                    <Shield className="h-2.5 w-2.5" />
                    read-only
                  </span>
                ) : (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[9px] font-mono text-cyan-400/60 hover:text-cyan-400"
                  >
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    open
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar: Extracted / Compare / History */}
        <div className="space-y-3">
          {/* Extraction panel */}
          {selectedResult?.extracted && (
            <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-200">Extracted Data</h3>
                <button onClick={() => setSelectedResult(null)} className="text-slate-500 hover:text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-300">{selectedResult.extracted.summary}</p>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">Key Points</p>
                <ul className="space-y-1">
                  {selectedResult.extracted.keyPoints.map((p, i) => (
                    <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">Citations</p>
                <ul className="space-y-1">
                  {selectedResult.extracted.citations.map((c, i) => (
                    <li key={i} className="text-[10px] text-slate-400 italic">[{i + 1}] {c}</li>
                  ))}
                </ul>
              </div>
              {selectedResult.extracted.structured && (
                <div>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">Structured</p>
                  <div className="space-y-1">
                    {Object.entries(selectedResult.extracted.structured).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[10px]">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-300 font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compare panel */}
          {compareResults.length >= 2 && (
            <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">Compare ({compareResults.length})</h3>
              {compareResults.map((r) => (
                <div key={r.id} className="px-2 py-1.5 rounded bg-[#0f2137] text-[10px]">
                  <p className="text-slate-200 font-medium truncate">{r.title}</p>
                  <p className="text-slate-500">{r.domain} · {Math.round(r.confidence * 100)}%</p>
                </div>
              ))}
            </div>
          )}

          {/* Search history */}
          <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-200">Search History</h3>
            {history.length === 0 ? (
              <p className="text-[10px] text-slate-500">No searches yet</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {history.slice(0, 20).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0f2137] transition-colors">
                    <Clock className="h-3 w-3 text-slate-600 shrink-0" />
                    <span
                      className="flex-1 text-[10px] text-slate-300 cursor-pointer hover:text-cyan-400 truncate"
                      onClick={() => setQuery(h.query)}
                    >
                      {h.query}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">{h.resultCount}r</span>
                    <button
                      onClick={() => deleteHistoryEntry(h.id)}
                      className="p-0.5 text-slate-600 hover:text-red-400"
                      aria-label="Delete search"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowserResearchMode;
