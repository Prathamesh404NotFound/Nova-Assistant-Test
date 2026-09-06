/**
 * Nova AI OS — AI Agent Marketplace
 * Discover, install, configure, and run third-party AI agents
 * that extend Nova's capabilities.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Store,
  Search,
  Download,
  Trash2,
  Settings,
  Star,
  Play,
  Pause,
  Shield,
  Zap,
  Clock,
  Users,
  Bot,
  Code,
  Mail,
  Calendar,
  FileText,
  Globe,
  Home,
  MessageSquare,
  Brain,
  CheckCircle2,
  ExternalLink,
  ArrowUpRight,
  Filter,
  TrendingUp,
  Award,
  X,
} from "lucide-react";

// --- Types ---
export type AgentCategory = "productivity" | "communication" | "development" | "data" | "creative" | "automation" | "integration";

export interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAvatar: string;
  category: AgentCategory;
  icon: string;
  rating: number;
  reviewCount: number;
  installCount: number;
  version: string;
  lastUpdated: number;
  tags: string[];
  capabilities: string[];
  permissions: string[];
  configSchema?: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  installed: boolean;
  enabled: boolean;
  configured: boolean;
  config: Record<string, string>;
}

const CATEGORY_LABELS: Record<AgentCategory, { label: string; icon: typeof Bot; color: string }> = {
  productivity: { label: "Productivity", icon: Zap, color: "text-cyan-400" },
  communication: { label: "Communication", icon: MessageSquare, color: "text-emerald-400" },
  development: { label: "Development", icon: Code, color: "text-purple-400" },
  data: { label: "Data & Analytics", icon: FileText, color: "text-amber-400" },
  creative: { label: "Creative", icon: Star, color: "text-pink-400" },
  automation: { label: "Automation", icon: Play, color: "text-blue-400" },
  integration: { label: "Integration", icon: Globe, color: "text-orange-400" },
};

const STORAGE_KEY = "nova_marketplace_agents";

// --- Sample Marketplace Data ---
const MARKETPLACE_AGENTS: MarketplaceAgent[] = [
  {
    id: "agent-email-drafter",
    name: "Email Drafter Pro",
    description: "Draft professional emails with AI. Supports tone adjustment, follow-up detection, and multi-language output.",
    author: "Nova Labs",
    authorAvatar: "🤖",
    category: "communication",
    icon: "✉️",
    rating: 4.8,
    reviewCount: 342,
    installCount: 12500,
    version: "2.1.0",
    lastUpdated: Date.now() - 86400000 * 2,
    tags: ["email", "draft", "writing", "AI"],
    capabilities: ["Draft emails", "Adjust tone", "Multi-language", "Follow-up suggestions"],
    permissions: ["Read emails", "Create drafts"],
    configSchema: [
      { key: "defaultTone", label: "Default Tone", type: "select", required: false, placeholder: "professional" },
      { key: "signature", label: "Email Signature", type: "text", required: false },
    ],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-code-reviewer",
    name: "Code Reviewer",
    description: "Automated code review with security checks, performance analysis, and best-practice suggestions.",
    author: "DevTools Inc",
    authorAvatar: "👨‍💻",
    category: "development",
    icon: "🔍",
    rating: 4.6,
    reviewCount: 891,
    installCount: 28900,
    version: "3.2.1",
    lastUpdated: Date.now() - 86400000 * 5,
    tags: ["code", "review", "security", "performance"],
    capabilities: ["Code analysis", "Security scan", "Performance check", "Best practices"],
    permissions: ["Read files", "Read code"],
    configSchema: [
      { key: "severity", label: "Min Severity", type: "select", required: false, placeholder: "warning" },
      { key: "autoFix", label: "Auto-fix", type: "boolean", required: false },
    ],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-data-summarizer",
    name: "Data Summarizer",
    description: "Summarize documents, PDFs, and long texts into concise bullet points with key insights.",
    author: "Nova Labs",
    authorAvatar: "🤖",
    category: "data",
    icon: "📊",
    rating: 4.5,
    reviewCount: 567,
    installCount: 19200,
    version: "1.8.0",
    lastUpdated: Date.now() - 86400000 * 10,
    tags: ["summary", "document", "analysis", "PDF"],
    capabilities: ["Document summarization", "Key insights", "Bullet points", "PDF parsing"],
    permissions: ["Read files"],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-scheduler",
    name: "Smart Scheduler",
    description: "AI-powered meeting scheduling that finds optimal times, sends invites, and handles rescheduling.",
    author: "TimeMaster",
    authorAvatar: "⏰",
    category: "productivity",
    icon: "📅",
    rating: 4.7,
    reviewCount: 1203,
    installCount: 45000,
    version: "4.0.2",
    lastUpdated: Date.now() - 86400000 * 1,
    tags: ["calendar", "scheduling", "meetings", "AI"],
    capabilities: ["Find optimal times", "Send invites", "Reschedule", "Conflict detection"],
    permissions: ["Read calendar", "Create events", "Send emails"],
    configSchema: [
      { key: "bufferMinutes", label: "Buffer between meetings", type: "number", required: false, placeholder: "15" },
      { key: "workHoursStart", label: "Work hours start", type: "text", required: false, placeholder: "09:00" },
      { key: "workHoursEnd", label: "Work hours end", type: "text", required: false, placeholder: "18:00" },
    ],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-voice-transcriber",
    name: "Voice Transcriber",
    description: "High-accuracy speech-to-text with speaker diarization, punctuation, and multi-language support.",
    author: "AudioAI",
    authorAvatar: "🎙️",
    category: "creative",
    icon: "🎤",
    rating: 4.4,
    reviewCount: 234,
    installCount: 8700,
    version: "1.5.3",
    lastUpdated: Date.now() - 86400000 * 15,
    tags: ["voice", "transcription", "speech", "audio"],
    capabilities: ["Speech-to-text", "Speaker detection", "Punctuation", "Multi-language"],
    permissions: ["Microphone access"],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-home-automator",
    name: "Home Automator",
    description: "Advanced home automation with scene creation, presence detection, energy optimization, and routines.",
    author: "SmartLife",
    authorAvatar: "🏠",
    category: "automation",
    icon: "🏡",
    rating: 4.3,
    reviewCount: 678,
    installCount: 15600,
    version: "2.7.0",
    lastUpdated: Date.now() - 86400000 * 3,
    tags: ["home", "automation", "IoT", "energy"],
    capabilities: ["Scene creation", "Presence detection", "Energy tracking", "Smart routines"],
    permissions: ["Device control", "Location access"],
    configSchema: [
      { key: "homeName", label: "Home Name", type: "text", required: true, placeholder: "My Home" },
      { key: "energySaving", label: "Energy Saving Mode", type: "boolean", required: false },
    ],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-security-auditor",
    name: "Security Auditor",
    description: "Continuous security monitoring with vulnerability scanning, credential checks, and compliance reports.",
    author: "SecureNova",
    authorAvatar: "🛡️",
    category: "integration",
    icon: "🔒",
    rating: 4.9,
    reviewCount: 445,
    installCount: 22100,
    version: "3.0.1",
    lastUpdated: Date.now() - 86400000 * 1,
    tags: ["security", "audit", "compliance", "vulnerability"],
    capabilities: ["Vulnerability scan", "Credential check", "Compliance report", "Real-time monitoring"],
    permissions: ["Read files", "System access", "Network access"],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-writer",
    name: "Content Writer",
    description: "Generate blog posts, articles, social media content, and marketing copy with SEO optimization.",
    author: "ContentAI",
    authorAvatar: "✍️",
    category: "creative",
    icon: "📝",
    rating: 4.6,
    reviewCount: 892,
    installCount: 31400,
    version: "2.3.0",
    lastUpdated: Date.now() - 86400000 * 4,
    tags: ["writing", "content", "blog", "SEO"],
    capabilities: ["Blog posts", "Social media", "Marketing copy", "SEO optimization"],
    permissions: ["AI generation", "Web search"],
    configSchema: [
      { key: "brandVoice", label: "Brand Voice", type: "text", required: false, placeholder: "Professional & friendly" },
      { key: "targetLength", label: "Default Length", type: "select", required: false, placeholder: "medium" },
    ],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-file-manager",
    name: "File Organizer",
    description: "Intelligent file organization with auto-categorization, duplicate detection, and smart renaming.",
    author: "Nova Labs",
    authorAvatar: "🤖",
    category: "productivity",
    icon: "📁",
    rating: 4.2,
    reviewCount: 334,
    installCount: 11200,
    version: "1.4.0",
    lastUpdated: Date.now() - 86400000 * 20,
    tags: ["files", "organize", "rename", "duplicates"],
    capabilities: ["Auto-categorize", "Duplicate detection", "Smart rename", "Cleanup suggestions"],
    permissions: ["Read files", "Modify files"],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-app-builder",
    name: "App Builder",
    description: "Turn a product brief into a structured app plan, UI components, routes, and implementation tasks.",
    author: "Nova Labs",
    authorAvatar: "🧩",
    category: "development",
    icon: "🏗️",
    rating: 4.8,
    reviewCount: 0,
    installCount: 0,
    version: "1.0.0",
    lastUpdated: Date.now(),
    tags: ["app", "ui", "prototype", "full-stack"],
    capabilities: ["Product brief parsing", "UI planning", "Route scaffolding", "Implementation checklist"],
    permissions: ["Read workspace", "Write workspace files"],
    configSchema: [{ key: "stack", label: "Preferred stack", type: "text", required: false, placeholder: "React + TypeScript" }],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-visual-designer",
    name: "Visual Designer",
    description: "Create responsive visual direction, layout specifications, and motion guidance for Nova workspaces.",
    author: "Nova Labs",
    authorAvatar: "🎨",
    category: "creative",
    icon: "✨",
    rating: 4.7,
    reviewCount: 0,
    installCount: 0,
    version: "1.0.0",
    lastUpdated: Date.now(),
    tags: ["design", "motion", "responsive", "prototype"],
    capabilities: ["Design brief", "Responsive layouts", "Motion notes", "Component specs"],
    permissions: ["Read workspace", "Write workspace files"],
    installed: false, enabled: false, configured: false, config: {},
  },
  {
    id: "agent-agentic-runner",
    name: "Agentic Mission Runner",
    description: "Break a goal into verified steps, request permissions when needed, and report progress and failures.",
    author: "Nova Labs",
    authorAvatar: "🧠",
    category: "automation",
    icon: "🛰️",
    rating: 4.9,
    reviewCount: 0,
    installCount: 0,
    version: "1.0.0",
    lastUpdated: Date.now(),
    tags: ["agentic", "missions", "planning", "verification"],
    capabilities: ["Goal decomposition", "Tool orchestration", "Permission prompts", "Step verification"],
    permissions: ["External actions", "Automations"],
    installed: false, enabled: false, configured: false, config: {},
  },
];

function loadInstalled(): Record<string, MarketplaceAgent> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveInstalled(agents: Record<string, MarketplaceAgent>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function AgentMarketplace() {
  const [installedMap, setInstalledMap] = useState<Record<string, MarketplaceAgent>>(loadInstalled);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | "all">("all");
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<"rating" | "installs" | "newest">("rating");
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);

  useEffect(() => { saveInstalled(installedMap); }, [installedMap]);

  const agents = useMemo(() => {
    let list = MARKETPLACE_AGENTS.map((a) => {
      const installed = installedMap[a.id];
      return installed ? { ...a, ...installed } : a;
    });

    if (showInstalledOnly) list = list.filter((a) => a.installed);
    if (selectedCategory !== "all") list = list.filter((a) => a.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "installs") return b.installCount - a.installCount;
      return b.lastUpdated - a.lastUpdated;
    });

    return list;
  }, [installedMap, searchQuery, selectedCategory, sortBy, showInstalledOnly]);

  const installedCount = Object.values(installedMap).filter((a) => a.installed).length;

  const installAgent = useCallback((agent: MarketplaceAgent) => {
    setInstalledMap((prev) => ({
      ...prev,
      [agent.id]: { ...agent, installed: true, enabled: true, configured: !agent.configSchema || agent.configSchema.length === 0 },
    }));
  }, []);

  const uninstallAgent = useCallback((agentId: string) => {
    setInstalledMap((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
    if (selectedAgent?.id === agentId) setSelectedAgent(null);
  }, [selectedAgent]);

  const toggleEnabled = useCallback((agentId: string) => {
    setInstalledMap((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], enabled: !prev[agentId]?.enabled },
    }));
  }, []);

  const openConfig = useCallback((agent: MarketplaceAgent) => {
    setConfiguringAgent(agent.id);
    setConfigValues(agent.config || {});
  }, []);

  const saveConfig = useCallback(() => {
    if (!configuringAgent) return;
    setInstalledMap((prev) => ({
      ...prev,
      [configuringAgent]: { ...prev[configuringAgent], config: configValues, configured: true },
    }));
    setConfiguringAgent(null);
  }, [configuringAgent, configValues]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Agent Marketplace</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {installedCount} installed · {MARKETPLACE_AGENTS.length} available
          </p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="w-full bg-[#0a1425] border border-[#1a2f4a] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
        </div>
        <button
          onClick={() => setShowInstalledOnly(!showInstalledOnly)}
          className={`px-3 py-2 text-[10px] font-mono rounded-lg transition-colors ${
            showInstalledOnly ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" : "bg-[#0a1425] border border-[#1a2f4a] text-slate-500"
          }`}
        >
          Installed ({installedCount})
        </button>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg px-2 py-2 text-[10px] text-slate-300 outline-none">
          <option value="rating">Top Rated</option>
          <option value="installs">Most Popular</option>
          <option value="newest">Recently Updated</option>
        </select>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setSelectedCategory("all")}
          className={`px-2.5 py-1 text-[10px] font-mono rounded-full transition-colors ${
            selectedCategory === "all" ? "bg-cyan-500/15 text-cyan-400" : "bg-[#0a1425] text-slate-500 hover:text-slate-300"
          }`}>All</button>
        {(Object.entries(CATEGORY_LABELS) as [AgentCategory, { label: string; icon: typeof Bot; color: string }][]).map(([key, cat]) => (
          <button key={key} onClick={() => setSelectedCategory(key)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono rounded-full transition-colors ${
              selectedCategory === key ? "bg-cyan-500/15 text-cyan-400" : "bg-[#0a1425] text-slate-500 hover:text-slate-300"
            }`}>
            <cat.icon className={`h-3 w-3 ${cat.color}`} />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent grid */}
        <div className="lg:col-span-2">
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No agents found</p>
              <p className="text-[10px] text-slate-600 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => {
                const cat = CATEGORY_LABELS[agent.category];
                return (
                  <div key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`bg-[#0a1425] border rounded-lg p-4 cursor-pointer transition-all hover:border-[#2a4a6a] ${
                      selectedAgent?.id === agent.id ? "border-cyan-500/30" : "border-[#1a2f4a]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{agent.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-slate-200 truncate">{agent.name}</h3>
                          {agent.installed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{agent.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-[10px] font-mono text-slate-300">{agent.rating}</span>
                        <span className="text-[9px] text-slate-600">({agent.reviewCount})</span>
                      </div>
                      <span className="text-[10px] text-slate-600">{formatNumber(agent.installCount)} installs</span>
                      <span className={`text-[10px] font-mono ${cat.color}`}>{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {agent.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[9px] font-mono text-slate-600 bg-[#0f2137] px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#1a2f4a]/50">
                      {agent.installed ? (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); toggleEnabled(agent.id); }}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded ${agent.enabled ? "bg-emerald-400/15 text-emerald-400" : "bg-slate-600/15 text-slate-400"}`}>
                            {agent.enabled ? "Enabled" : "Disabled"}
                          </button>
                          {agent.configSchema && agent.configSchema.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); openConfig(agent); }}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300">Configure</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); uninstallAgent(agent.id); }}
                            className="ml-auto text-[10px] text-red-400 hover:text-red-300">Uninstall</button>
                        </>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); installAgent(agent); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-cyan-500 text-black rounded-md hover:bg-cyan-400 transition-colors">
                          <Download className="h-3 w-3" /> Install
                        </button>
                      )}
                      <span className="text-[9px] text-slate-600 ml-auto">v{agent.version} · {formatRelativeTime(agent.lastUpdated)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-4 sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {selectedAgent ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedAgent.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{selectedAgent.name}</h3>
                  <p className="text-[10px] text-slate-500">by {selectedAgent.author} · v{selectedAgent.version}</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedAgent.description}</p>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /><span className="text-xs font-mono text-slate-200">{selectedAgent.rating}</span></div>
                <span className="text-[10px] text-slate-500">{selectedAgent.reviewCount} reviews</span>
                <span className="text-[10px] text-slate-500">{formatNumber(selectedAgent.installCount)} installs</span>
              </div>

              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Capabilities</p>
                <div className="space-y-1">
                  {selectedAgent.capabilities.map((cap) => (
                    <div key={cap} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />{cap}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Permissions Required</p>
                <div className="space-y-1">
                  {selectedAgent.permissions.map((perm) => (
                    <div key={perm} className="flex items-center gap-1.5 text-[10px] text-amber-400">
                      <Shield className="h-3 w-3 shrink-0" />{perm}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedAgent.tags.map((tag) => (
                    <span key={tag} className="text-[9px] font-mono text-slate-400 bg-[#0f2137] px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[#1a2f4a]/50">
                {selectedAgent.installed ? (
                  <div className="flex gap-2">
                    <button onClick={() => toggleEnabled(selectedAgent.id)}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        selectedAgent.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-600/15 text-slate-400"
                      }`}>
                      {selectedAgent.enabled ? "Disable" : "Enable"}
                    </button>
                    {selectedAgent.configSchema && selectedAgent.configSchema.length > 0 && (
                      <button onClick={() => openConfig(selectedAgent)}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition-colors">
                        <Settings className="h-3 w-3" /> Configure
                      </button>
                    )}
                    <button onClick={() => uninstallAgent(selectedAgent.id)}
                      className="px-3 py-2 text-xs font-medium bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition-colors">
                      Uninstall
                    </button>
                  </div>
                ) : (
                  <button onClick={() => installAgent(selectedAgent)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors">
                    <Download className="h-3.5 w-3.5" /> Install Agent
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Store className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Select an agent to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Config modal */}
      {configuringAgent && (() => {
        const agent = MARKETPLACE_AGENTS.find((a) => a.id === configuringAgent);
        if (!agent?.configSchema) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0b1929] border border-[#1a2f4a] rounded-xl p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Configure {agent.name}</h3>
                <button onClick={() => setConfiguringAgent(null)} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
              </div>
              {agent.configSchema.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <input type={field.type === "boolean" ? "checkbox" : field.type === "number" ? "number" : "text"}
                    checked={field.type === "boolean" ? configValues[field.key] === "true" : undefined}
                    value={field.type === "boolean" ? "" : configValues[field.key] || ""}
                    onChange={(e) => setConfigValues((prev) => ({
                      ...prev,
                      [field.key]: field.type === "boolean" ? (e.target as HTMLInputElement).checked ? "true" : "false" : e.target.value,
                    }))}
                    placeholder={field.placeholder}
                    className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={saveConfig} className="flex-1 px-3 py-2 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors">Save</button>
                <button onClick={() => setConfiguringAgent(null)} className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default AgentMarketplace;
