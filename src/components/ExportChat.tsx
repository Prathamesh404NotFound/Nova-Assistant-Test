/**
 * Nova AI OS — Export Chat History
 * Export conversations as PDF or Markdown.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileText, FileDown, X } from "lucide-react";
import { toast } from "sonner";

interface ExportChatProps {
  messages: Array<{ role: string; content: string; timestamp: number; source?: string }>;
  conversationTitle?: string;
}

export function ExportChat({ messages, conversationTitle = "Nova Chat" }: ExportChatProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportMarkdown = () => {
    const header = `# ${conversationTitle}\n\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    const content = messages
      .map((msg) => {
        const role = msg.role === "user" ? "**You**" : "**Nova**";
        const source = msg.source ? ` *(${msg.source})*` : "";
        return `### ${role}${source}\n\n${msg.content}\n`;
      })
      .join("\n---\n\n");

    const blob = new Blob([header + content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversationTitle.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as Markdown");
    setIsOpen(false);
  };

  const exportPDF = () => {
    // Create a simple HTML version for print/PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${conversationTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .message { margin: 16px 0; padding: 12px; border-radius: 8px; }
    .user { background: #e3f2fd; margin-left: 20%; }
    .assistant { background: #f5f5f5; margin-right: 20%; }
    .role { font-weight: bold; margin-bottom: 4px; }
    .content { white-space: pre-wrap; }
    .meta { font-size: 12px; color: #666; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>${conversationTitle}</h1>
  <p style="color: #666;">Exported on ${new Date().toLocaleString()}</p>
  <hr>
  ${messages
    .map(
      (msg) => `
  <div class="message ${msg.role}">
    <div class="role">${msg.role === "user" ? "You" : "Nova"}</div>
    <div class="content">${msg.content}</div>
    <div class="meta">${new Date(msg.timestamp).toLocaleTimeString()}${msg.source ? ` · ${msg.source}` : ""}</div>
  </div>`
    )
    .join("\n")}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => {
        win.print();
      };
    }
    toast.success("PDF export opened in new tab");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-[#6e6e8a] hover:text-[#e8e8f8]"
        disabled={messages.length === 0}
      >
        <Download className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card className="p-3 bg-[#0d0d16] border-[#252540] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#e8e8f8]">Export Chat</p>
        <button onClick={() => setIsOpen(false)} className="text-[#6e6e8a] hover:text-[#e8e8f8]">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        <Button
          onClick={exportMarkdown}
          variant="outline"
          className="w-full justify-start gap-2 text-xs border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8]"
        >
          <FileText className="h-3 w-3" />
          Export as Markdown
        </Button>
        <Button
          onClick={exportPDF}
          variant="outline"
          className="w-full justify-start gap-2 text-xs border-[#252540] text-[#6e6e8a] hover:text-[#e8e8f8]"
        >
          <FileDown className="h-3 w-3" />
          Export as PDF
        </Button>
      </div>
    </Card>
  );
}
