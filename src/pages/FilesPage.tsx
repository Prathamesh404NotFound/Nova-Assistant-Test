import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getFiles,
  saveFile,
  deleteFile,
  type LocalFile,
} from "@/lib/local-store";
import { logActivity } from "@/lib/local-store";
import {
  Files,
  Upload,
  Trash2,
  File,
  FileText,
  Image,
  Download,
  X,
  Eye,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("text") || type.includes("json") || type.includes("javascript")) return FileText;
  return File;
}

export default function FilesPage() {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [preview, setPreview] = useState<LocalFile | null>(null);
  const [newTextName, setNewTextName] = useState("");
  const [newTextContent, setNewTextContent] = useState("");
  const [showNewText, setShowNewText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFiles(getFiles());
  }, []);

  const refresh = useCallback(() => {
    setFiles(getFiles());
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;

      for (const file of Array.from(selected)) {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          saveFile({
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            content,
          });
          logActivity("files", `Uploaded file: ${file.name}`, "upload");
          refresh();
        };
        reader.readAsDataURL(file);
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [refresh]
  );

  const handleCreateText = useCallback(() => {
    if (!newTextName.trim()) return;
    const name = newTextName.endsWith(".txt") ? newTextName.trim() : `${newTextName.trim()}.txt`;
    saveFile({
      name,
      type: "text/plain",
      size: new Blob([newTextContent]).size,
      content: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(newTextContent)))}`,
    });
    logActivity("files", `Created file: ${name}`, "file-text");
    setNewTextName("");
    setNewTextContent("");
    setShowNewText(false);
    refresh();
  }, [newTextName, newTextContent, refresh]);

  const handleDelete = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id);
      deleteFile(id);
      if (file) logActivity("files", `Deleted file: ${file.name}`, "trash");
      if (preview?.id === id) setPreview(null);
      refresh();
    },
    [files, preview, refresh]
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <main className="min-h-screen bg-[#06060c] px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Files</h1>
              <p className="text-sm text-[#6e6e8a] mt-1">
                {files.length} files · {formatSize(totalSize)} total
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowNewText(!showNewText)}
                variant="outline"
                className="border-[#252540] text-[#e8e8f8] hover:bg-[#1e1e38]"
              >
                <FileText className="h-4 w-4 mr-1" />
                New Text
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80"
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUpload}
                className="hidden"
              />
            </div>
          </div>
        </motion.div>

        {/* New Text File */}
        {showNewText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="nova-glass p-4 space-y-3">
              <Input
                value={newTextName}
                onChange={(e) => setNewTextName(e.target.value)}
                placeholder="File name..."
                className="bg-[#16162a] border-[#252540] text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:border-[#00d4ff]/40"
              />
              <textarea
                value={newTextContent}
                onChange={(e) => setNewTextContent(e.target.value)}
                placeholder="File content..."
                rows={6}
                className="w-full bg-[#16162a] border border-[#252540] rounded-lg px-3 py-2 text-sm text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:outline-none focus:border-[#00d4ff]/40 resize-none font-mono"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateText} className="bg-[#00d4ff] text-[#06060c]">
                  Create File
                </Button>
                <Button
                  onClick={() => setShowNewText(false)}
                  variant="ghost"
                  className="text-[#6e6e8a]"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* File Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file, i) => {
            const Icon = getFileIcon(file.type);
            const isImage = file.type.startsWith("image/");
            return (
              <motion.div
                key={file.id}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i}
              >
                <Card className="nova-glass nova-glass-hover p-4 flex flex-col gap-3">
                  {/* Preview / Icon */}
                  {isImage && file.content ? (
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-[#16162a]">
                      <img
                        src={file.content}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#16162a] flex items-center justify-center">
                      <Icon className="w-6 h-6 text-[#00d4ff]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#e8e8f8] truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-[10px] bg-[#16162a] text-[#6e6e8a] border-0">
                        {formatSize(file.size)}
                      </Badge>
                      <p className="text-[10px] text-[#6e6e8a]">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#6e6e8a] hover:text-[#00d4ff] h-8"
                      onClick={() => setPreview(file)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#6e6e8a] hover:text-[#10b981] h-8"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = file.content;
                        a.download = file.name;
                        a.click();
                        logActivity("files", `Downloaded: ${file.name}`, "download");
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#6e6e8a] hover:text-[#f43f5e] h-8"
                      onClick={() => handleDelete(file.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {files.length === 0 && (
          <div className="text-center py-20">
            <Files className="h-12 w-12 text-[#252540] mx-auto mb-4" />
            <p className="text-[#6e6e8a] text-sm">No files yet. Upload or create one!</p>
          </div>
        )}

        {/* Preview Modal */}
        {preview && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0d0d16] border border-[#252540] rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#252540]">
                <p className="text-sm font-medium text-[#e8e8f8] truncate">{preview.name}</p>
                <button
                  onClick={() => setPreview(null)}
                  className="text-[#6e6e8a] hover:text-[#e8e8f8]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {preview.type.startsWith("image/") ? (
                  <img
                    src={preview.content}
                    alt={preview.name}
                    className="max-w-full rounded-lg"
                  />
                ) : preview.type.includes("text") || preview.type.includes("json") || preview.type.includes("javascript") ? (
                  <pre className="text-xs text-[#e8e8f8] font-mono whitespace-pre-wrap break-words">
                    {(() => {
                      try {
                        if (preview.content.startsWith("data:text")) {
                          return decodeURIComponent(
                            atob(preview.content.split(",")[1])
                          );
                        }
                        return preview.content;
                      } catch {
                        return preview.content;
                      }
                    })()}
                  </pre>
                ) : (
                  <p className="text-sm text-[#6e6e8a]">
                    Preview not available for this file type ({preview.type}).
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </main>
  );
}
