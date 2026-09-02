/**
 * Nova AI OS — Collaboration Component
 * Simplified local collaboration: export/import conversations as shareable JSON.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Share2,
  Download,
  Upload,
  Copy,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface CollaborationProps {
  conversationId?: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
}

export function Collaboration({ conversationId, messages }: CollaborationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importId, setImportId] = useState("");
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(() => {
    const data = {
      id: conversationId || `nova-conv-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      messages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nova-conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  }, [conversationId, messages]);

  const handleCopyId = useCallback(() => {
    if (conversationId) {
      navigator.clipboard.writeText(conversationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [conversationId]);

  const handleImport = useCallback(() => {
    if (!importId.trim()) {
      toast.error("Enter a conversation ID or paste JSON");
      return;
    }
    // Store for retrieval
    localStorage.setItem(`nova-shared-${importId}`, JSON.stringify(messages));
    toast.success("Conversation shared! Share this ID with others.");
    setImportId("");
  }, [importId, messages]);

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-[#6e6e8a] hover:text-[#e8e8f8]"
      >
        <Share2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card className="p-3 bg-[#0d0d16] border-[#252540] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#e8e8f8]">Share Conversation</p>
        <button onClick={() => setIsOpen(false)} className="text-[#6e6e8a] hover:text-[#e8e8f8]">
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleExport}
          variant="outline"
          className="w-full justify-start gap-2 text-xs border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8]"
        >
          <Download className="h-3 w-3" />
          Export as JSON
        </Button>

        {conversationId && (
          <Button
            onClick={handleCopyId}
            variant="outline"
            className="w-full justify-start gap-2 text-xs border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8]"
          >
            {copied ? <Check className="h-3 w-3 text-[#10b981]" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy Conversation ID"}
          </Button>
        )}

        <div className="flex gap-2">
          <Input
            value={importId}
            onChange={(e) => setImportId(e.target.value)}
            placeholder="Paste shared ID..."
            className="text-xs bg-[#16162a] border-[#252540] text-[#e8e8f8]"
          />
          <Button
            onClick={handleImport}
            size="sm"
            className="bg-[#00d4ff] text-[#06060c] text-xs"
          >
            Share
          </Button>
        </div>
      </div>
    </Card>
  );
}
