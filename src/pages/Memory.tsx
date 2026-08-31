import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { addMemory, getMemories, deleteMemory, type RTDBMemory } from "@/lib/rtdb";
import { Plus, Brain, User, Folder, Lightbulb, StickyNote, X, Trash2 } from "lucide-react";

type Category = RTDBMemory["category"];

const catConfig: Record<Category, { label: string; icon: React.ReactNode; color: string }> = {
  fact: { label: "Fact", icon: <Lightbulb className="h-3.5 w-3.5" />, color: "#00d4ff" },
  preference: { label: "Preference", icon: <Brain className="h-3.5 w-3.5" />, color: "#8b5cf6" },
  person: { label: "Person", icon: <User className="h-3.5 w-3.5" />, color: "#10b981" },
  project: { label: "Project", icon: <Folder className="h-3.5 w-3.5" />, color: "#f59e0b" },
  note: { label: "Note", icon: <StickyNote className="h-3.5 w-3.5" />, color: "#f43f5e" },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

export default function MemoryPage() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<RTDBMemory[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("note");
  const [filter, setFilter] = useState<Category | "all">("all");
  const userId = user?.uid ?? "";

  const refresh = useCallback(async () => {
    if (!userId) return;
    const m = await getMemories(userId);
    setMemories(m);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addNew = useCallback(async () => {
    if (!newKey.trim() || !newContent.trim() || !userId) return;
    await addMemory(userId, { category: newCategory, key: newKey.trim(), content: newContent.trim() });
    setNewKey(""); setNewContent(""); setShowNew(false);
    await refresh();
  }, [newKey, newContent, newCategory, userId, refresh]);

  const remove = useCallback(async (id: string) => {
    if (!userId) return;
    await deleteMemory(userId, id);
    await refresh();
  }, [userId, refresh]);

  const filtered = filter === "all" ? memories : memories.filter((m) => m.category === filter);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Memory</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">{memories.length} memories stored</p>
            </div>
            <Button onClick={() => setShowNew(!showNew)} className="bg-[#00d4ff] text-[#06060c]">
              {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showNew ? "Cancel" : "Add Memory"}
            </Button>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <div className="flex flex-wrap gap-2">
            {(["all", "fact", "preference", "person", "project", "note"] as const).map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === cat ? "bg-[#00d4ff]/15 text-[#00d4ff]" : "bg-[#16162a] text-[#6e6e8a] hover:text-[#e8e8f8]"}`}>
                {cat === "all" ? "All" : catConfig[cat].label}
              </button>
            ))}
          </div>
        </motion.div>

        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="nova-glass p-4 space-y-3">
              <div className="flex gap-3">
                <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key (e.g. 'John's birthday')"
                  className="flex-1 bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40" />
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as Category)}
                  className="bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] focus:outline-none">
                  {Object.entries(catConfig).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
                </select>
              </div>
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
                placeholder="What should Nova remember?" rows={3}
                className="w-full bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:outline-none focus:border-[#00d4ff]/40 resize-none" />
              <Button onClick={addNew} className="bg-[#00d4ff] text-[#06060c] w-full">Save Memory</Button>
            </Card>
          </motion.div>
        )}

        <div className="space-y-2">
          {filtered.map((mem, i) => (
            <motion.div key={mem.id} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
              <Card className="nova-glass p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${catConfig[mem.category].color}15` }}>
                  <span style={{ color: catConfig[mem.category].color }}>{catConfig[mem.category].icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#e8e8f8]">{mem.key}</p>
                    <Badge className="text-[10px] border-0" style={{ backgroundColor: `${catConfig[mem.category].color}15`, color: catConfig[mem.category].color }}>
                      {catConfig[mem.category].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#6e6e8a] leading-relaxed">{mem.content}</p>
                </div>
                <button onClick={() => remove(mem.id)} className="text-[#6e6e8a] hover:text-[#f43f5e] shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </Card>
            </motion.div>
          ))}
        </div>

        {memories.length === 0 && (
          <div className="text-center py-20">
            <Brain className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">No memories yet. Nova will remember what you tell it.</p>
          </div>
        )}
      </div>
    </main>
  );
}
