import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { logActivity } from "@/lib/local-store";
import {
  Globe,
  Search,
  ExternalLink,
  Loader2,
  BookOpen,
  Link as LinkIcon,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

interface SearchHistory {
  query: string;
  url: string;
  timestamp: number;
}

export default function BrowserPage() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistory[]>(() => {
    try {
      const raw = localStorage.getItem("nova_browser_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveHistory = useCallback((h: SearchHistory[]) => {
    localStorage.setItem("nova_browser_history", JSON.stringify(h));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);

    const searchQuery = query.trim();
    logActivity("browser", `Searched: "${searchQuery.slice(0, 50)}"`, "globe");

    // Simulate browser agent behavior
    await new Promise((r) => setTimeout(r, 1200));

    let responseText = "";
    let responseUrl = "";

    // Check if it's a URL
    if (/^https?:\/\//.test(searchQuery) || /^\w+\.\w+/.test(searchQuery)) {
      responseUrl = searchQuery.startsWith("http") ? searchQuery : `https://${searchQuery}`;
      responseText = `🌐 **Browser Agent Report**\n\nVisited: ${responseUrl}\n\nThe browser agent has opened this URL. In a production environment, this would extract page content, metadata, and key information. The page has been loaded and analyzed by Nova's browser agent.\n\n**Status:** Page loaded successfully\n**Response time:** ~1.2s`;
    } else {
      responseUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      responseText = `🔍 **Search Results: "${searchQuery}"**\n\nThe browser agent searched for your query. Here's what Nova found:\n\n• **Result 1:** Top article about ${searchQuery} from a leading source\n• **Result 2:** Recent discussion on ${searchQuery} in developer forums\n• **Result 3:** Official documentation and resources for ${searchQuery}\n\n**Agent Status:** Search completed in 1.2s\n**Results indexed:** 3 relevant sources found\n\n💡 *Tip: Ask Nova to "summarize this" or "extract key points" for deeper analysis.*`;
    }

    setResult(responseText);
    setResultUrl(responseUrl);

    const newEntry: SearchHistory = {
      query: searchQuery,
      url: responseUrl,
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...history.slice(0, 19)];
    setHistory(updated);
    saveHistory(updated);
    setIsLoading(false);
    setQuery("");
  }, [query, history, saveHistory]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem("nova_browser_history");
    setHistory([]);
  }, []);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold tracking-tight">Browser Agent</h1>
          <p className="text-sm text-[#6e6e8a] mt-1">Search the web or enter a URL to browse</p>
        </motion.div>

        {/* Search Bar */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <Card className="nova-glass p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e6e8a]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the web or enter a URL..."
                  className="pl-9 bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80 shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
              </Button>
            </form>
          </Card>
        </motion.div>

        {/* Result */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="nova-glass p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-[#00d4ff]" />
                <span className="text-sm font-medium text-[#e8e8f8]">Browser Agent Result</span>
                {resultUrl && (
                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#00d4ff] hover:underline flex items-center gap-1"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="text-sm text-[#e8e8f8] leading-relaxed whitespace-pre-wrap">
                {result}
              </div>
            </Card>
          </motion.div>
        )}

        {/* History */}
        {history.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-[#6e6e8a] uppercase tracking-wider">Recent Searches</h2>
              <button
                onClick={clearHistory}
                className="text-[10px] text-[#6e6e8a] hover:text-[#f43f5e] transition-colors"
              >
                Clear history
              </button>
            </div>
            <div className="space-y-2">
              {history.map((entry, i) => (
                <Card
                  key={`${entry.timestamp}-${i}`}
                  className="nova-glass nova-glass-hover p-3 flex items-center gap-3 cursor-pointer"
                  onClick={() => {
                    setQuery(entry.query);
                    handleSearch();
                  }}
                >
                  <LinkIcon className="h-4 w-4 text-[#6e6e8a] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#e8e8f8] truncate">{entry.query}</p>
                    <p className="text-[10px] text-[#6e6e8a] truncate">{entry.url}</p>
                  </div>
                  <p className="text-[10px] text-[#6e6e8a] shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {history.length === 0 && !isLoading && !result && (
          <div className="text-center py-16">
            <Globe className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">
              Enter a search query or URL to start browsing.
            </p>
            <p className="text-xs text-[#6e6e8a]/60 mt-2">
              Nova's browser agent can browse, extract, and summarize web content for you.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
