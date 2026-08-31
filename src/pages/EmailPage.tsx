import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  getEmailDrafts,
  addEmailDraft,
  updateEmailDraft,
  deleteEmailDraft,
  type EmailDraft,
} from "@/lib/local-store";
import { logActivity } from "@/lib/local-store";
import {
  Mail,
  Plus,
  Trash2,
  Send,
  Edit3,
  X,
  Inbox,
  FileText,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function EmailPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "sent">("all");

  useEffect(() => {
    setDrafts(getEmailDrafts());
  }, []);

  const refresh = useCallback(() => {
    setDrafts(getEmailDrafts());
  }, []);

  const resetForm = () => {
    setTo("");
    setSubject("");
    setBody("");
    setEditingId(null);
    setShowNew(false);
  };

  const handleSaveDraft = useCallback(() => {
    if (!to.trim() || !subject.trim()) return;
    if (editingId) {
      updateEmailDraft(editingId, { to, subject, body, status: "draft" });
      logActivity("email", `Updated draft: ${subject}`, "mail");
    } else {
      addEmailDraft({ to, subject, body, status: "draft" });
      logActivity("email", `Created draft: ${subject}`, "mail");
    }
    resetForm();
    refresh();
  }, [to, subject, body, editingId, refresh]);

  const handleSend = useCallback(() => {
    if (!to.trim() || !subject.trim()) return;
    if (editingId) {
      updateEmailDraft(editingId, { to, subject, body, status: "sent" });
    } else {
      addEmailDraft({ to, subject, body, status: "sent" });
    }
    logActivity("email", `Sent email to ${to}: ${subject}`, "send");
    resetForm();
    refresh();
  }, [to, subject, body, editingId, refresh]);

  const handleEdit = useCallback((draft: EmailDraft) => {
    setTo(draft.to);
    setSubject(draft.subject);
    setBody(draft.body);
    setEditingId(draft.id);
    setShowNew(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const draft = drafts.find((d) => d.id === id);
      deleteEmailDraft(id);
      if (draft) logActivity("email", `Deleted draft: ${draft.subject}`, "mail");
      refresh();
    },
    [drafts, refresh]
  );

  const filtered = filter === "all" ? drafts : drafts.filter((d) => d.status === filter);
  const draftCount = drafts.filter((d) => d.status === "draft").length;
  const sentCount = drafts.filter((d) => d.status === "sent").length;

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Email</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">
                {draftCount} drafts · {sentCount} sent
              </p>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowNew(!showNew);
              }}
              className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80"
            >
              {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showNew ? "Cancel" : "Compose"}
            </Button>
          </div>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <div className="flex gap-2">
            {(["all", "draft", "sent"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-[#00d4ff]/15 text-[#00d4ff]"
                    : "bg-[#16162a] text-[#6e6e8a] hover:text-[#e8e8f8]"
                }`}
              >
                {f === "all" ? "All" : f === "draft" ? `Drafts (${draftCount})` : `Sent (${sentCount})`}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Compose Form */}
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="nova-glass p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-[#00d4ff]" />
                <span className="text-sm font-medium text-[#e8e8f8]">
                  {editingId ? "Edit Draft" : "New Email"}
                </span>
              </div>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="To: email@example.com"
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject..."
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email..."
                rows={8}
                className="w-full bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:outline-none focus:border-[#00d4ff]/40 resize-none font-mono"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveDraft} variant="outline" className="border-[#252540] text-[#e8e8f8] hover:bg-[#1e1e38]">
                  <FileText className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button onClick={handleSend} className="bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold">
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Email List */}
        <div className="space-y-2">
          {filtered.map((draft, i) => (
            <motion.div key={draft.id} initial="hidden" animate="visible" variants={fadeUp} custom={i + 2}>
              <Card className="nova-glass nova-glass-hover p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  draft.status === "sent" ? "bg-[#10b981]/15" : "bg-[#f59e0b]/15"
                }`}>
                  {draft.status === "sent" ? (
                    <Send className="w-5 h-5 text-[#10b981]" />
                  ) : (
                    <Edit3 className="w-5 h-5 text-[#f59e0b]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#e8e8f8] truncate">{draft.subject}</p>
                    <Badge className={`text-[10px] border-0 ${
                      draft.status === "sent"
                        ? "bg-[#10b981]/15 text-[#10b981]"
                        : "bg-[#f59e0b]/15 text-[#f59e0b]"
                    }`}>
                      {draft.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6e6e8a]">To: {draft.to}</p>
                  <p className="text-xs text-[#6e6e8a] truncate mt-1">{draft.body || "(no content)"}</p>
                  <p className="text-[10px] text-[#6e6e8a]/60 mt-1">
                    {new Date(draft.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {draft.status === "draft" && (
                    <button onClick={() => handleEdit(draft)} className="p-1.5 text-[#6e6e8a] hover:text-[#00d4ff] rounded-lg hover:bg-[#1e1e38]">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(draft.id)} className="p-1.5 text-[#6e6e8a] hover:text-[#f43f5e] rounded-lg hover:bg-[#1e1e38]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {drafts.length === 0 && !showNew && (
          <div className="text-center py-20">
            <Inbox className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">No emails yet. Compose your first one!</p>
          </div>
        )}
      </div>
    </main>
  );
}
