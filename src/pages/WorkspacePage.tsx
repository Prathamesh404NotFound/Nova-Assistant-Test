/**
 * Nova AI OS — Context-Aware Workspace
 * Create projects with shared instructions, files, goals, permissions,
 * and conversation history per project.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  FolderOpen,
  Target,
  FileText,
  Users,
  MessageSquare,
  Trash2,
  Edit3,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Lock,
  Globe,
} from "lucide-react";

export interface WorkspaceFile {
  id: string;
  name: string;
  content: string;
  type: string;
  createdAt: number;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  instructions: string;
  goals: string[];
  files: WorkspaceFile[];
  permissions: "private" | "shared" | "public";
  conversationHistory: { role: "user" | "assistant"; content: string; timestamp: number }[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

const STORAGE_KEY = "nova_workspaces";

function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadWorkspaces(): WorkspaceProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWorkspaces(projects: WorkspaceProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString();
}

function PermissionIcon({ perm }: { perm: WorkspaceProject["permissions"] }) {
  switch (perm) {
    case "private":
      return <Lock className="h-3 w-3 text-red-400" />;
    case "shared":
      return <Users className="h-3 w-3 text-amber-400" />;
    case "public":
      return <Globe className="h-3 w-3 text-emerald-400" />;
  }
}

export function WorkspacePage() {
  const [projects, setProjects] = useState<WorkspaceProject[]>(loadWorkspaces);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newGoals, setNewGoals] = useState<string[]>([]);

  // File add state
  const [addingFileTo, setAddingFileTo] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");

  useEffect(() => {
    saveWorkspaces(projects);
  }, [projects]);

  const createProject = useCallback(() => {
    if (!newName.trim()) return;
    const project: WorkspaceProject = {
      id: generateId(),
      name: newName.trim(),
      description: newDesc.trim(),
      instructions: newInstructions.trim(),
      goals: newGoals,
      files: [],
      permissions: "private",
      conversationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };
    setProjects((prev) => [project, ...prev]);
    setNewName("");
    setNewDesc("");
    setNewInstructions("");
    setNewGoals([]);
    setShowCreate(false);
    setExpandedId(project.id);
  }, [newName, newDesc, newInstructions, newGoals]);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [expandedId]);

  const updateInstructions = useCallback((id: string, instructions: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, instructions, updatedAt: Date.now() } : p))
    );
  }, []);

  const toggleGoal = useCallback((projectId: string, goalIndex: number) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const goals = [...p.goals];
        // Toggle with a done prefix
        if (goals[goalIndex].startsWith("✅ ")) {
          goals[goalIndex] = goals[goalIndex].replace("✅ ", "");
        } else {
          goals[goalIndex] = "✅ " + goals[goalIndex];
        }
        return { ...p, goals, updatedAt: Date.now() };
      })
    );
  }, []);

  const addGoal = useCallback((projectId: string, goal: string) => {
    if (!goal.trim()) return;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, goals: [...p.goals, goal.trim()], updatedAt: Date.now() };
      })
    );
  }, []);

  const addFile = useCallback((projectId: string) => {
    if (!newFileName.trim()) return;
    const file: WorkspaceFile = {
      id: generateId(),
      name: newFileName.trim(),
      content: newFileContent,
      type: newFileName.split(".").pop() || "txt",
      createdAt: Date.now(),
    };
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, files: [...p.files, file], updatedAt: Date.now() };
      })
    );
    setNewFileName("");
    setNewFileContent("");
    setAddingFileTo(null);
  }, [newFileName, newFileContent]);

  const deleteFile = useCallback((projectId: string, fileId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, files: p.files.filter((f) => f.id !== fileId), updatedAt: Date.now() };
      })
    );
  }, []);

  const cyclePermissions = useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next =
          p.permissions === "private"
            ? "shared"
            : p.permissions === "shared"
            ? "public"
            : "private";
        return { ...p, permissions: next, updatedAt: Date.now() };
      })
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Workspaces</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""} ·{" "}
            {projects.filter((p) => p.isActive).length} active
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name..."
            className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description..."
            className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          />
          <textarea
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            placeholder="System instructions for this project (e.g., tone, constraints, context)..."
            rows={3}
            className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 outline-none focus:border-cyan-500/50 resize-none"
          />
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Goals</p>
            {newGoals.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <Target className="h-3 w-3 text-cyan-400" />
                {g}
                <button
                  onClick={() => setNewGoals(newGoals.filter((_, j) => j !== i))}
                  className="text-slate-600 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Add a goal..."
                className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGoal.trim()) {
                    setNewGoals([...newGoals, newGoal.trim()]);
                    setNewGoal("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newGoal.trim()) {
                    setNewGoals([...newGoals, newGoal.trim()]);
                    setNewGoal("");
                  }
                }}
                className="px-2 py-1 text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                Add
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={createProject}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >
              Create
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

      {/* Project list */}
      {projects.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <FolderOpen className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No projects yet</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Create a workspace to organize files, goals, and context
          </p>
        </div>
      )}

      {projects.map((project) => {
        const expanded = expandedId === project.id;
        const completedGoals = project.goals.filter((g) => g.startsWith("✅ ")).length;

        return (
          <div
            key={project.id}
            className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg overflow-hidden"
          >
            {/* Summary row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#0f2137] transition-colors"
              onClick={() => setExpandedId(expanded ? null : project.id)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {project.name}
                  </span>
                  <PermissionIcon perm={project.permissions} />
                  {project.isActive ? (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
                      active
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-full">
                      archived
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {project.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {project.goals.length > 0 && (
                  <span className="text-[10px] font-mono text-cyan-400">
                    {completedGoals}/{project.goals.length} goals
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-600">
                  {project.files.length} files
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="border-t border-[#1a2f4a] px-4 py-4 space-y-4">
                {/* Instructions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Instructions
                    </p>
                    <button
                      onClick={() =>
                        setEditingProject(editingProject === project.id ? null : project.id)
                      }
                      className="text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                      {editingProject === project.id ? "Done" : "Edit"}
                    </button>
                  </div>
                  {editingProject === project.id ? (
                    <textarea
                      value={project.instructions}
                      onChange={(e) => updateInstructions(project.id, e.target.value)}
                      rows={4}
                      className="w-full bg-[#0f2137] border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none resize-none"
                    />
                  ) : (
                    <p className="text-xs text-slate-300 bg-[#0f2137] rounded-lg px-3 py-2">
                      {project.instructions || (
                        <span className="text-slate-600 italic">No instructions set</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Goals */}
                {project.goals.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                      Goals
                    </p>
                    <div className="space-y-1">
                      {project.goals.map((goal, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0f2137] hover:bg-[#132540] transition-colors cursor-pointer"
                          onClick={() => toggleGoal(project.id, i)}
                        >
                          {goal.startsWith("✅ ") ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Target className="h-3.5 w-3.5 text-slate-500" />
                          )}
                          <span
                            className={`text-xs ${
                              goal.startsWith("✅ ") ? "text-emerald-400 line-through" : "text-slate-300"
                            }`}
                          >
                            {goal.replace("✅ ", "")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Files ({project.files.length})
                    </p>
                    <button
                      onClick={() =>
                        setAddingFileTo(addingFileTo === project.id ? null : project.id)
                      }
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                      <Plus className="h-3 w-3" />
                      Add File
                    </button>
                  </div>

                  {addingFileTo === project.id && (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="filename.txt"
                        className="w-40 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
                      />
                      <input
                        type="text"
                        value={newFileContent}
                        onChange={(e) => setNewFileContent(e.target.value)}
                        placeholder="Content..."
                        className="flex-1 bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 placeholder:text-slate-500 outline-none"
                      />
                      <button
                        onClick={() => addFile(project.id)}
                        disabled={!newFileName.trim()}
                        className="px-2 py-1 text-[10px] font-medium bg-cyan-500 text-black rounded-md hover:bg-cyan-400 disabled:opacity-40 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {project.files.length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic px-3 py-2">
                      No files yet
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {project.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0f2137] hover:bg-[#132540] transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs text-slate-300 flex-1">{file.name}</span>
                          <span className="text-[9px] font-mono text-slate-600">{file.type}</span>
                          <button
                            onClick={() => deleteFile(project.id, file.id)}
                            className="p-0.5 text-slate-600 hover:text-red-400 transition-colors"
                            aria-label={`Delete ${file.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Permissions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1a2f4a]/50">
                  <span className="text-[10px] font-mono text-slate-500">Permissions</span>
                  <button
                    onClick={() => cyclePermissions(project.id)}
                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono rounded-md bg-[#0f2137] hover:bg-[#132540] transition-colors"
                  >
                    <PermissionIcon perm={project.permissions} />
                    <span className="text-slate-300 capitalize">{project.permissions}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WorkspacePage;
