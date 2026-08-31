import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  getMessageDrafts,
  addMessageDraft,
  deleteMessageDraft,
  type MessageDraft,
} from "@/lib/local-store";
import { logActivity } from "@/lib/local-store";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  X,
  Inbox,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageDraft[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "sent">("all");

  useEffect(() => {
    setMessages(getMessageDrafts());
  }, []);

  const refresh = useCallback(() => {
    setMessages(getMessageDrafts());
  }, []);

  const handleSaveDraft = useCallback(() => {
    if (!to.trim() || !body.trim()) return;
    addMessageDraft({ to, body, status: "draft" });
    logActivity("message", `Draft message to ${to}`, "message-square");
    setTo("");
    setBody("");
    setShowNew(false);
    refresh();
  }, [to, body, refresh]);

  const handleSend = useCallback(() => {
    if (!to.trim() || !body.trim()) return;
    addMessageDraft({ to, body, status: "sent" });
    logActivity("message", `Sent message to ${to}`, "send");
    setTo("");
    setBody("");
    setShowNew(false);
    refresh();
  }, [to, body, refresh]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMessageDraft(id);
      logActivity("message", "Deleted message", "trash");
      refresh();
    },
    [refresh]
  );

  const filtered = filter === "all" ? messages : messages.filter((m) => m.status === filter);
  const draftCount = messages.filter((m) => m.status === "draft").length;
  const sentCount = messages.filter((m) => m.status === "sent").length;

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">
                {draftCount} drafts · {sentCount} sent
              </p>
            </div>
            <Button
              onClick={() => {
                setTo("");
                setBody("");
                setShowNew(!showNew);
              }}
              className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80"
            >
              {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showNew ? "Cancel" : "New Message"}
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
                <MessageSquare className="h-4 w-4 text-[#00d4ff]" />
                <span className="text-sm font-medium text-[#e8e8f8]">New Message</span>
              </div>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="To: name or number..."
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:outline-none focus:border-[#00d4ff]/40 resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveDraft} variant="outline" className="border-[#252540] text-[#e8e8f8] hover:bg-[#1e1e38]">
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

        {/* Messages List */}
        <div className="space-y-2">
          {filtered.map((msg, i) => (
            <motion.div key={msg.id} initial="hidden" animate="visible" variants={fadeUp} custom={i + 2}>
              <Card className="nova-glass nova-glass-hover p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.status === "sent" ? "bg-[#10b981]/15" : "bg-[#f59e0b]/15"
                }`}>
                  <MessageSquare className="w-5 h-5" style={{ color: msg.status === "sent" ? "#10b981" : "#f59e0b" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#e8e8f8]">To: {msg.to}</p>
                    <Badge className={`text-[10px] border-0 ${
                      msg.status === "sent"
                        ? "bg-[#10b981]/15 text-[#10b981]"
                        : "bg-[#f59e0b]/15 text-[#f59e0b]"
                    }`}>
                      {msg.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#6e6e8a] leading-relaxed">{msg.body}</p>
                  <p className="text-[10px] text-[#6e6e8a]/60 mt-2">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="p-1.5 text-[#6e6e8a] hover:text-[#f43f5e] rounded-lg hover:bg-[#1e1e38] shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Card>
            </motion.div>
          ))}
        </div>

        {messages.length === 0 && !showNew && (
          <div className="text-center py-20">
            <Inbox className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">No messages yet. Send your first one!</p>
          </div>
        )}
      </div>
    </main>
  );
}
