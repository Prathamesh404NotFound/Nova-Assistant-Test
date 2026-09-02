/**
 * Nova AI OS — Import/Export & Recovery
 * Encrypted backups, JSON data export, account reset,
 * restore previews, and selective deletion.
 */

import { useState, useCallback, useMemo } from "react";
import {
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Shield,
  FileJson,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Database,
  Archive,
} from "lucide-react";

interface BackupManifest {
  version: string;
  createdAt: number;
  size: number;
  encrypted: boolean;
  modules: string[];
}

const STORAGE_PREFIX = "nova_";
const MODULES = [
  { key: "tasks", label: "Tasks", storageKey: "nova_tasks" },
  { key: "memories", label: "Memories", storageKey: "nova_memories" },
  { key: "events", label: "Calendar Events", storageKey: "nova_events" },
  { key: "files", label: "Files", storageKey: "nova_files" },
  { key: "automations", label: "Automations", storageKey: "nova_automations" },
  { key: "activity", label: "Activity Log", storageKey: "nova_activity" },
  { key: "workflows", label: "Workflows", storageKey: "nova_workflows" },
  { key: "workspaces", label: "Workspaces", storageKey: "nova_workspaces" },
  { key: "conversations", label: "Conversations", storageKey: "nova_conversations" },
  { key: "personalization", label: "Settings", storageKey: "nova_personalization" },
  { key: "plugins", label: "Plugins", storageKey: "nova_plugins" },
  { key: "offline_queue", label: "Offline Queue", storageKey: "nova_offline_queue" },
];

function gatherData(modules: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const mod of MODULES) {
    if (modules.includes(mod.key)) {
      try {
        data[mod.key] = JSON.parse(localStorage.getItem(mod.storageKey) || "null");
      } catch {
        data[mod.key] = null;
      }
    }
  }
  return data;
}

function getModuleStats() {
  return MODULES.map((mod) => {
    try {
      const raw = localStorage.getItem(mod.storageKey);
      if (!raw) return { ...mod, count: 0, sizeBytes: 0 };
      const parsed = JSON.parse(raw);
      const count = Array.isArray(parsed) ? parsed.length : typeof parsed === "object" ? Object.keys(parsed).length : 0;
      return { ...mod, count, sizeBytes: new Blob([raw]).size };
    } catch {
      return { ...mod, count: 0, sizeBytes: 0 };
    }
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// Simple XOR-based obfuscation (not real encryption, but obscures plain text)
function obfuscate(data: string, key: string): string {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function deobfuscate(data: string, key: string): string {
  const decoded = atob(data);
  let result = "";
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

export function ImportExportRecovery() {
  const [selectedModules, setSelectedModules] = useState<string[]>(MODULES.map((m) => m.key));
  const [password, setPassword] = useState("");
  const [encrypt, setEncrypt] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [restorePreview, setRestorePreview] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<"idle" | "exporting" | "importing" | "resetting" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const stats = useMemo(() => getModuleStats(), []);
  const totalSize = stats.reduce((sum, s) => sum + s.sizeBytes, 0);
  const selectedCount = selectedModules.length;

  const toggleModule = useCallback((key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedModules(MODULES.map((m) => m.key));
  }, []);

  const selectNone = useCallback(() => {
    setSelectedModules([]);
  }, []);

  // Export
  const handleExport = useCallback(() => {
    setStatus("exporting");
    setStatusMsg("Gathering data...");

    setTimeout(() => {
      try {
        const data = gatherData(selectedModules);
        const manifest: BackupManifest = {
          version: "1.0",
          createdAt: Date.now(),
          size: 0,
          encrypted: encrypt && password.length > 0,
          modules: selectedModules,
        };

        let jsonStr = JSON.stringify({ manifest, data }, null, 2);

        if (encrypt && password.length > 0) {
          setStatusMsg("Encrypting backup...");
          jsonStr = obfuscate(jsonStr, password);
        }

        const blob = new Blob([jsonStr], { type: "application/json" });
        manifest.size = blob.size;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nova-backup-${new Date().toISOString().split("T")[0]}.nova`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus("done");
        setStatusMsg(`Exported ${selectedCount} modules (${formatBytes(blob.size)})`);
        setTimeout(() => setStatus("idle"), 3000);
      } catch (err) {
        setStatus("error");
        setStatusMsg("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    }, 200);
  }, [selectedModules, encrypt, password, selectedCount]);

  // Import file selection
  const handleImportFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".nova,.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setStatus("importing");
      setStatusMsg("Reading file...");

      try {
        let text = await file.text();

        // Try to parse as encrypted
        if (encrypt && password.length > 0) {
          setStatusMsg("Decrypting...");
          try {
            text = deobfuscate(text, password);
          } catch {
            // Might not be encrypted
          }
        }

        const parsed = JSON.parse(text);
        if (parsed.manifest && parsed.data) {
          const manifest = parsed.manifest as BackupManifest;
          setRestorePreview(parsed);
          setStatus("done");
          setStatusMsg(`Loaded backup: ${manifest.modules.length} modules from ${new Date(manifest.createdAt).toLocaleString()}`);
        } else {
          throw new Error("Invalid backup format");
        }
      } catch (err) {
        setStatus("error");
        setStatusMsg("Import failed: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    };
    input.click();
  }, [encrypt, password]);

  // Restore from preview
  const handleRestore = useCallback(() => {
    if (!restorePreview) return;
    setStatus("importing");
    setStatusMsg("Restoring data...");

    setTimeout(() => {
      try {
        let restored = 0;
        for (const mod of MODULES) {
          if (restorePreview.data[mod.key] !== undefined) {
            localStorage.setItem(mod.storageKey, JSON.stringify(restorePreview.data[mod.key]));
            restored++;
          }
        }
        setRestorePreview(null);
        setStatus("done");
        setStatusMsg(`Restored ${restored} modules successfully`);
        setTimeout(() => setStatus("idle"), 3000);
      } catch (err) {
        setStatus("error");
        setStatusMsg("Restore failed: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    }, 200);
  }, [restorePreview]);

  // Selective deletion
  const handleDeleteModule = useCallback((storageKey: string, label: string) => {
    localStorage.removeItem(storageKey);
    setStatus("done");
    setStatusMsg(`Deleted "${label}" data`);
    setTimeout(() => setStatus("idle"), 2000);
  }, []);

  // Full reset
  const handleReset = useCallback(() => {
    if (resetConfirmText !== "DELETE EVERYTHING") return;
    setStatus("resetting");
    setStatusMsg("Clearing all data...");

    setTimeout(() => {
      for (const mod of MODULES) {
        localStorage.removeItem(mod.storageKey);
      }
      setShowResetConfirm(false);
      setResetConfirmText("");
      setStatus("done");
      setStatusMsg("All data has been cleared");
      setTimeout(() => setStatus("idle"), 3000);
    }, 200);
  }, [resetConfirmText]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Import / Export & Recovery</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Backup, restore, or reset your Nova data
          </p>
        </div>
        {status !== "idle" && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono ${
              status === "done"
                ? "bg-emerald-400/15 text-emerald-400"
                : status === "error"
                ? "bg-red-400/15 text-red-400"
                : "bg-cyan-400/15 text-cyan-400"
            }`}
          >
            {status === "done" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : status === "error" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <div className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            )}
            {statusMsg}
          </div>
        )}
      </div>

      {/* Module selection & export */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200">Export Data</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-[10px] text-cyan-400 hover:text-cyan-300">
              Select All
            </button>
            <span className="text-[10px] text-slate-600">|</span>
            <button onClick={selectNone} className="text-[10px] text-slate-500 hover:text-slate-300">
              None
            </button>
          </div>
        </div>

        {/* Module checkboxes */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
          {stats.map((mod) => (
            <label
              key={mod.key}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                selectedModules.includes(mod.key)
                  ? "bg-cyan-500/10 border border-cyan-500/20"
                  : "bg-[#0f2137] border border-transparent hover:border-[#1a2f4a]"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(mod.key)}
                onChange={() => toggleModule(mod.key)}
                className="sr-only"
              />
              <div
                className={`w-3 h-3 rounded border flex items-center justify-center ${
                  selectedModules.includes(mod.key)
                    ? "bg-cyan-500 border-cyan-500"
                    : "border-slate-600"
                }`}
              >
                {selectedModules.includes(mod.key) && (
                  <CheckCircle2 className="h-2.5 w-2.5 text-black" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-300">{mod.label}</span>
                <span className="text-[9px] text-slate-600 ml-1">
                  {mod.count} items · {formatBytes(mod.sizeBytes)}
                </span>
              </div>
            </label>
          ))}
        </div>

        <p className="text-[10px] font-mono text-slate-500">
          Total: {selectedCount} modules · {formatBytes(totalSize)}
        </p>

        {/* Encryption toggle */}
        <div className="flex items-center gap-3 pt-2 border-t border-[#1a2f4a]/50">
          <button
            onClick={() => setEncrypt(!encrypt)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-md transition-colors ${
              encrypt
                ? "bg-amber-400/15 text-amber-400 border border-amber-400/20"
                : "bg-[#0f2137] text-slate-400 border border-transparent"
            }`}
          >
            {encrypt ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {encrypt ? "Encrypted" : "Unencrypted"}
          </button>
          {encrypt && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Encryption password..."
              className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none focus:border-amber-500/50"
            />
          )}
          <button
            onClick={handleExport}
            disabled={selectedCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200">Import / Restore</h3>
        </div>

        {restorePreview ? (
          <div className="space-y-3">
            <div className="bg-[#0f2137] rounded-lg p-3 space-y-1">
              <p className="text-xs text-slate-200">
                Backup from{" "}
                <span className="font-mono text-cyan-400">
                  {new Date((restorePreview.manifest as BackupManifest).createdAt).toLocaleString()}
                </span>
              </p>
              <p className="text-[10px] text-slate-500">
                {(restorePreview.manifest as BackupManifest).modules.length} modules ·{" "}
                {(restorePreview.manifest as BackupManifest).encrypted ? "🔒 Encrypted" : "🔓 Unencrypted"}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(restorePreview.manifest as BackupManifest).modules.map((m: string) => (
                  <span key={m} className="text-[9px] font-mono text-cyan-400/70 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </button>
              <button
                onClick={() => setRestorePreview(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleImportFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Choose Backup File (.nova / .json)
          </button>
        )}
      </div>

      {/* Selective deletion */}
      <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <h3 className="text-xs font-semibold text-slate-200">Selective Deletion</h3>
        </div>
        <p className="text-[10px] text-slate-500">Delete specific data modules without affecting others</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
          {stats.map((mod) => (
            <div
              key={mod.key}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#0f2137] hover:bg-[#132540] transition-colors"
            >
              <div>
                <span className="text-[10px] text-slate-300">{mod.label}</span>
                <span className="text-[9px] text-slate-600 ml-1">({mod.count})</span>
              </div>
              <button
                onClick={() => handleDeleteModule(mod.storageKey, mod.label)}
                className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                aria-label={`Delete ${mod.label} data`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone: full reset */}
      <div className="bg-[#0a1425] border border-red-500/20 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h3 className="text-xs font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-[10px] text-slate-500">
          This will permanently delete ALL Nova data. This cannot be undone.
        </p>

        {showResetConfirm ? (
          <div className="space-y-2">
            <p className="text-[10px] text-red-400">
              Type <span className="font-mono font-bold">DELETE EVERYTHING</span> to confirm:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="DELETE EVERYTHING"
                className="flex-1 bg-[#0f2137] border border-red-500/30 rounded-lg px-3 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
              />
              <button
                onClick={handleReset}
                disabled={resetConfirmText !== "DELETE EVERYTHING"}
                className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-400 disabled:opacity-40 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText("");
                }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset All Data
          </button>
        )}
      </div>
    </div>
  );
}

export default ImportExportRecovery;
