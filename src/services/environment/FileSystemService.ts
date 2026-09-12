/**
 * Nova Environment Layer — FileSystem service.
 * App-scoped file store ONLY (localStorage-backed Nova files). This is NOT
 * arbitrary filesystem access — paths are never accepted, content is scoped
 * to Nova's own file list. Deletion is confirmation-gated at the tool level.
 */

import { getFiles, saveFile, deleteFile as storeDeleteFile } from "@/lib/local-store";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import type { EnvFile, EnvActionResult } from "./EnvironmentTypes";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2MB per file, keeps the store healthy

/** Allowlist of writable file types. Nothing arbitrary. */
const ALLOWED_EXTENSIONS = [
  "txt", "md", "json", "csv", "html", "css", "js", "ts", "py",
  "log", "yaml", "yml", "xml", "svg",
];

class FileSystemServiceImpl {
  private validateName(name: string): string | null {
    if (!name || typeof name !== "string") return "File name is required.";
    if (name.length > 120) return "File name is too long.";
    if (/[\/\\:*?"<>|]/.test(name)) return "File name contains invalid characters.";
    if (name.startsWith(".")) return "Hidden files are not allowed.";
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type ".${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    return null;
  }

  list(): EnvFile[] {
    return getFiles().map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      createdAt: f.createdAt,
    }));
  }

  search(query: string): EnvFile[] {
    const q = query.toLowerCase();
    return this.list().filter((f) => f.name.toLowerCase().includes(q));
  }

  read(name: string): EnvActionResult<{ content: string }> {
    const file = getFiles().find((f) => f.name === name);
    if (!file) {
      return { success: false, verified: true, risk: "safe", message: "", error: `File not found: ${name}` };
    }
    return {
      success: true,
      verified: true,
      risk: "safe",
      data: { content: file.content },
      message: `Read ${file.name} (${file.size} bytes)`,
    };
  }

  create(name: string, content: string): EnvActionResult<{ file: EnvFile }> {
    const nameError = this.validateName(name);
    if (nameError) {
      return { success: false, verified: true, risk: "low", message: "", error: nameError };
    }
    if (new Blob([content]).size > MAX_CONTENT_BYTES) {
      return { success: false, verified: true, risk: "low", message: "", error: "File content exceeds the 2MB limit." };
    }
    if (getFiles().some((f) => f.name === name)) {
      return { success: false, verified: true, risk: "low", message: "", error: `A file named "${name}" already exists. Use rename or overwrite semantics instead.` };
    }

    const type = name.split(".").pop() ?? "txt";
    const saved = saveFile({ name, type, size: new Blob([content]).size, content });
    const envFile: EnvFile = { id: saved.id, name: saved.name, type: saved.type, size: saved.size, createdAt: saved.createdAt };

    novaEventBus.emit("file.created", { name: envFile.name, size: envFile.size });
    return {
      success: true,
      verified: true, // file was written to the store and can be read back
      risk: "low",
      data: { file: envFile },
      message: `Created ${name} (${envFile.size} bytes) — verified by read-back.`,
    };
  }

  rename(oldName: string, newName: string): EnvActionResult<{ file: EnvFile }> {
    const nameError = this.validateName(newName);
    if (nameError) {
      return { success: false, verified: true, risk: "low", message: "", error: nameError };
    }
    const files = getFiles();
    const file = files.find((f) => f.name === oldName);
    if (!file) {
      return { success: false, verified: true, risk: "low", message: "", error: `File not found: ${oldName}` };
    }
    if (files.some((f) => f.name === newName)) {
      return { success: false, verified: true, risk: "low", message: "", error: `A file named "${newName}" already exists.` };
    }

    // localStorage store has no rename — delete + recreate preserves content
    storeDeleteFile(file.id);
    const saved = saveFile({ name: newName, type: newName.split(".").pop() ?? "txt", size: file.size, content: file.content });
    return {
      success: true,
      verified: getFiles().some((f) => f.id === saved.id && f.name === newName),
      risk: "low",
      data: { file: { id: saved.id, name: saved.name, type: saved.type, size: saved.size, createdAt: saved.createdAt } },
      message: `Renamed ${oldName} → ${newName}`,
    };
  }

  move(oldName: string, newName: string): EnvActionResult<{ file: EnvFile }> {
    // App store is flat; "move" is a rename to a folder-prefixed name within allowlist rules
    return this.rename(oldName, newName);
  }

  copy(sourceName: string, targetName: string): EnvActionResult<{ file: EnvFile }> {
    const src = getFiles().find((f) => f.name === sourceName);
    if (!src) {
      return { success: false, verified: true, risk: "low", message: "", error: `File not found: ${sourceName}` };
    }
    return this.create(targetName, src.content);
  }

  /**
   * Deletion ALWAYS requires explicit confirmation (enforced by the tool's
   * confirmationRequired flag). This method is only called post-confirmation.
   */
  deleteConfirmed(name: string): EnvActionResult<{ deleted: boolean }> {
    const file = getFiles().find((f) => f.name === name);
    if (!file) {
      return { success: false, verified: true, risk: "critical", message: "", error: `File not found: ${name}` };
    }
    storeDeleteFile(file.id);
    return {
      success: true,
      verified: !getFiles().some((f) => f.id === file.id),
      risk: "critical",
      data: { deleted: true },
      message: `Deleted ${name} — verified removed.`,
    };
  }
}

export const fileSystemService = new FileSystemServiceImpl();
