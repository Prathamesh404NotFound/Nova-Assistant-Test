/**
 * Nova AI OS — Memory Search & Control
 * Searchable memory with source references, expiration dates,
 * correction, deletion, and opt-in/opt-out controls.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Brain,
  Clock,
  Edit3,
  Trash2,
  X,
  Tag,
  AlertTriangle,
  Plus,
  Eye,
  EyeOff,
  Filter,
  Calendar,
} from "lucide-react";

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  source: "chat" | "manual" | "task" | "calendar" | "email";
  createdAt: number;
  updatedAt?: number;
  expiresAt?: number;
  isActive: boolean;
  tags: string[];
  sourceRef?: string;
}

const STORAGE_KEY = "nova_memories";

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadMemories(): MemoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMemories(memories: MemoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatExpiry(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days}d`;
}

const CATEGORIES = [
  "General",
  "Person",
  "Preference",
  "Fact",
  "Task",
  "Event",
  "Note",
  "Contact",
  "Deadline",
  "Reminder",
];

const SOURCES: { value: MemoryEntry["source"]; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "manual", label: "Manual" },
  { value: "task", label: "Task" },
  { value: "calendar", label: "Calendar" },
  { value: "email", label: "Email" },
];

export default function MemorySearchControl() {
  const [memories, setMemories] = useState<MemoryEntry[]>(loadMemories);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("General");
  const [editExpiry, setEditExpiry] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newExpiry, setNewExpiry] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    saveMemories(memories);
  }, [memories]);

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      // Active filter
      if (!showInactive && !m.isActive) return false;
      // Search
      if (query) {
        const lower = query.toLowerCase();
        if (
          !m.content.toLowerCase().includes(lower) &&
          !m.category.toLowerCase().includes(lower) &&
          !m.tags.some((t) => t.toLowerCase().includes(lower))
        ) {
          return false;
        }
      }
      // Category
      if (filterCategory !== "all" && m.category !== filterCategory) return false;
      // Source
      if (filterSource !== "all" && m.source !== filterSource) return false;
      return true;
    });
  }, [memories, query, filterCategory, filterSource, showInactive]);

  const stats = useMemo(() => {
    const active = memories.filter((m) => m.isActive).length;
    const expired = memories.filter((m) => m.expiresAt && m.expiresAt <= Date.now()).length;
    return { total: memories.length, active, expired };
  }, [memories]);

  const createMemory = useCallback(() => {
    if (!newContent.trim()) return;
    const entry: MemoryEntry = {
      id: generateId(),
      content: newContent.trim(),
      category: newCategory,
      source: "manual",
      createdAt: Date.now(),
      isActive: true,
      tags: newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      expiresAt: newExpiry ? Date.now() + parseInt(newExpiry) * 86400000 : undefined,
    };
    setMemories((prev) => [entry, ...prev]);
    setNewContent("");
    setNewCategory("General");
    setNewExpiry("");
    setNewTags("");
    setShowCreate(false);
  }, [newContent, newCategory, newExpiry, newTags]);

  const deleteMemory = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const toggleActive = useCallback((id: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isActive: !m.isActive } : m))
    );
  }, []);

  const startEdit = useCallback((m: MemoryEntry) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category);
    setEditExpiry(m.expiresAt ? String(Math.ceil((m.expiresAt - Date.now()) / 86400000)) : "");
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId || !editContent.trim()) return;
    setMemories((prev) =>
      prev.map((m) =>
        m.id === editingId
          ? {
              ...m,
              content: editContent.trim(),
              category: editCategory,
              updatedAt: Date.now(),
              expiresAt: editExpiry
                ? Date.now() + parseInt(editExpiry) * 86400000
                : undefined,
            }
          : m
      )
    );
    setEditingId(null);
  }, [editingId, editContent, editCategory, editExpiry]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Memory Search & Control</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {stats.active} active · {stats.total} total · {stats.expired} expired
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Memory
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories by content, category, or tags..."
            className="w-full bg-[#0a1425] border border-[#1a2f4a] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg px-2 py-2 text-[10px] text-slate-300 outline-none"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg px-2 py-2 text-[10px] text-slate-300 outline-none"
        >
          <option value="all">All Sources</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-1 px-2 py-2 text-[10px] rounded-lg border transition-colors ${
            showInactive
              ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
              : "bg-[#0a1425] border-[#1a2f4a] text-slate-500"
          }`}
          aria-label={showInactive ? "Hide inactive memories" : "Show inactive memories"}
        >
          {showInactive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Inactive
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Memory content..."
            rows={3}
            className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50 resize-none"
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              placeholder="Expire in days (optional)"
              min="1"
              className="w-40 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
            />
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createMemory}
              disabled={!newContent.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Memory list */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {query ? "No memories match your search" : "No memories stored yet"}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            {query
              ? "Try different keywords or adjust filters"
              : "Memories are created from chat conversations and manual entries"}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((memory) => (
          <div
            key={memory.id}
            className={`bg-[#0a1425] border rounded-lg p-3 transition-colors ${
              memory.isActive ? "border-[#1a2f4a]" : "border-[#1a2f4a]/50 opacity-60"
            }`}
          >
            {editingId === memory.id ? (
              /* Edit mode */
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full bg-[#0f2137] border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none resize-none"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    placeholder="Expiry (days)"
                    min="1"
                    className="w-28 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
                  />
                  <button
                    onClick={saveEdit}
                    className="px-2.5 py-1 text-[10px] font-medium bg-cyan-500 text-black rounded-md hover:bg-cyan-400 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-200 leading-relaxed flex-1">
                    {memory.content}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(memory)}
                      className="p-1 text-slate-600 hover:text-cyan-400 transition-colors"
                      aria-label="Edit memory"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => toggleActive(memory.id)}
                      className="p-1 text-slate-600 hover:text-amber-400 transition-colors"
                      aria-label={memory.isActive ? "Deactivate memory" : "Activate memory"}
                    >
                      {memory.isActive ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteMemory(memory.id)}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                    {memory.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">
                    from {memory.source}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">
                    {formatRelativeTime(memory.createdAt)}
                  </span>
                  {memory.expiresAt && (
                    <span
                      className={`text-[10px] font-mono flex items-center gap-0.5 ${
                        memory.expiresAt <= Date.now() ? "text-red-400" : "text-amber-400"
                      }`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {formatExpiry(memory.expiresAt)}
                    </span>
                  )}
                  {memory.sourceRef && (
                    <span className="text-[10px] font-mono text-slate-600">
                      ref: {memory.sourceRef}
                    </span>
                  )}
                  {!memory.isActive && (
                    <span className="text-[10px] font-mono text-slate-600 italic">inactive</span>
                  )}
                </div>

                {/* Tags */}
                {memory.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Tag className="h-2.5 w-2.5 text-slate-600" />
                    {memory.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-mono text-slate-500 bg-[#0f2137] px-1 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
