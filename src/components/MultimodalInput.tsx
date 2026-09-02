/**
 * Nova AI OS — Multimodal Input
 * Support for images, PDFs, screenshots, audio, and structured data
 * with processing status indicators.
 */

import { useState, useCallback, useRef } from "react";
import {
  Image,
  FileText,
  Mic,
  Paperclip,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Camera,
  File,
} from "lucide-react";

export type MultimodalType = "image" | "pdf" | "audio" | "screenshot" | "text";

export interface MultimodalAttachment {
  id: string;
  name: string;
  type: MultimodalType;
  mimeType: string;
  size: number;
  dataUrl?: string;
  status: "processing" | "ready" | "error";
  extractedText?: string;
  error?: string;
}

function generateId(): string {
  return `mm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getTypeIcon(type: MultimodalType) {
  switch (type) {
    case "image": return Image;
    case "pdf": return FileText;
    case "audio": return Mic;
    case "screenshot": return Camera;
    case "text": return File;
  }
}

function getTypeColor(type: MultimodalType): string {
  switch (type) {
    case "image": return "text-purple-400 bg-purple-400/10";
    case "pdf": return "text-red-400 bg-red-400/10";
    case "audio": return "text-emerald-400 bg-emerald-400/10";
    case "screenshot": return "text-blue-400 bg-blue-400/10";
    case "text": return "text-slate-400 bg-slate-400/10";
  }
}

function classifyFile(file: File): MultimodalType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("audio/")) return "audio";
  return "text";
}

// Simulate multimodal processing
async function processAttachment(attachment: MultimodalAttachment): Promise<MultimodalAttachment> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (attachment.type === "image") {
        resolve({
          ...attachment,
          status: "ready",
          extractedText: "[Image processed: visual content analyzed]",
        });
      } else if (attachment.type === "pdf") {
        resolve({
          ...attachment,
          status: "ready",
          extractedText: "[PDF processed: document content extracted]",
        });
      } else if (attachment.type === "audio") {
        resolve({
          ...attachment,
          status: "ready",
          extractedText: "[Audio processed: speech-to-text ready]",
        });
      } else {
        resolve({ ...attachment, status: "ready" });
      }
    }, 800 + Math.random() * 500);
  });
}

interface MultimodalInputProps {
  attachments: MultimodalAttachment[];
  onAttachmentsChange: (attachments: MultimodalAttachment[]) => void;
}

export function MultimodalInput({ attachments, onAttachmentsChange }: MultimodalInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const newAttachments: MultimodalAttachment[] = [];

      for (const file of Array.from(files)) {
        const attachment: MultimodalAttachment = {
          id: generateId(),
          name: file.name,
          type: classifyFile(file),
          mimeType: file.type,
          size: file.size,
          status: "processing",
        };

        // Read file as data URL for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = () => {
            attachment.dataUrl = reader.result as string;
            onAttachmentsChange([...attachments, ...newAttachments]);
          };
          reader.readAsDataURL(file);
        }

        newAttachments.push(attachment);
      }

      const updated = [...attachments, ...newAttachments];
      onAttachmentsChange(updated);

      // Process each attachment
      let current = updated;
      for (const att of newAttachments) {
        const processed = await processAttachment(att);
        current = current.map((a) => (a.id === processed.id ? processed : a));
        onAttachmentsChange([...current]);
      }
    },
    [attachments, onAttachmentsChange]
  );

  const removeAttachment = useCallback(
    (id: string) => {
      onAttachmentsChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onAttachmentsChange]
  );

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleScreenshot = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ImageCaptureClass = (window as any).ImageCapture;
      const imageCapture = new ImageCaptureClass(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");

      const attachment: MultimodalAttachment = {
        id: generateId(),
        name: `Screenshot ${new Date().toLocaleTimeString()}.png`,
        type: "screenshot",
        mimeType: "image/png",
        size: Math.round(dataUrl.length * 0.75),
        dataUrl,
        status: "ready",
        extractedText: "[Screenshot captured: visual content analyzed]",
      };

      onAttachmentsChange([...attachments, attachment]);
    } catch {
      // User cancelled or API not available
    }
  }, [attachments, onAttachmentsChange]);

  return (
    <div
      className={`relative ${isDragOver ? "ring-2 ring-cyan-400/50 rounded-lg" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,audio/*,.txt,.md,.json,.csv"
        onChange={handleFileChange}
        className="sr-only"
      />

      {/* Attachment toolbar */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleFileSelect}
          className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors rounded-md hover:bg-[#0f2137]"
          aria-label="Attach file"
          title="Attach file (images, PDFs, audio, text)"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          onClick={handleScreenshot}
          className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors rounded-md hover:bg-[#0f2137]"
          aria-label="Take screenshot"
          title="Capture screenshot"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      {/* Attached files list */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map((att) => {
            const Icon = getTypeIcon(att.type);
            return (
              <div
                key={att.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-md text-[10px] border transition-colors ${
                  att.status === "ready"
                    ? "bg-[#0f2137] border-[#1a2f4a]"
                    : att.status === "processing"
                    ? "bg-amber-400/5 border-amber-400/20"
                    : "bg-red-400/5 border-red-400/20"
                }`}
              >
                {/* Thumbnail for images */}
                {att.dataUrl && att.type === "image" ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div className={`p-1 rounded ${getTypeColor(att.type)}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                )}

                <div className="max-w-[120px]">
                  <p className="text-[10px] text-slate-300 truncate">{att.name}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-600">{formatSize(att.size)}</span>
                    {att.status === "processing" && (
                      <Loader2 className="h-2.5 w-2.5 text-amber-400 animate-spin" />
                    )}
                    {att.status === "ready" && (
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                    )}
                    {att.status === "error" && (
                      <AlertCircle className="h-2.5 w-2.5 text-red-400" />
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-cyan-400/5 border-2 border-dashed border-cyan-400/30 rounded-lg flex items-center justify-center z-10">
          <p className="text-xs text-cyan-400">Drop files here</p>
        </div>
      )}
    </div>
  );
}
