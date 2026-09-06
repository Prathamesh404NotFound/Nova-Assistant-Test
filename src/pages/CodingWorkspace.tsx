/**
 * Nova AI OS — Coding Workspace
 * Repository browsing, inline diffs, test runner output,
 * lint results, sandbox preview, and confirmation before commits.
 */

import { useState, useCallback } from "react";
import {
  Code,
  FileText,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitBranch,
  GitCommit,
  Eye,
  Save,
  RotateCcw,
  Trash2,
  Plus,
  Search,
  Terminal,
  Shield,
} from "lucide-react";

// --- Types ---
export interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
  modified?: boolean;
  originalContent?: string;
}

export interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  error?: string;
}

export interface LintIssue {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
  rule?: string;
}

// --- Sample repo structure ---
const SAMPLE_REPO: FileNode[] = [
  {
    name: "src", type: "folder", children: [
      {
        name: "components", type: "folder", children: [
          { name: "Header.tsx", type: "file", language: "typescript", content: "import React from 'react';\n\nexport function Header() {\n  return (\n    <header className=\"flex items-center p-4\">\n      <h1>Nova AI OS</h1>\n    </header>\n  );\n}" },
          { name: "Sidebar.tsx", type: "file", language: "typescript", content: "import React from 'react';\n\nexport function Sidebar() {\n  return <aside>Sidebar</aside>;\n}" },
        ],
      },
      {
        name: "pages", type: "folder", children: [
          { name: "Dashboard.tsx", type: "file", language: "typescript", content: "export function Dashboard() {\n  return <div>Dashboard</div>;\n}" },
          { name: "Settings.tsx", type: "file", language: "typescript", content: "export function Settings() {\n  return <div>Settings</div>;\n}" },
        ],
      },
      { name: "main.tsx", type: "file", language: "typescript", content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\n\ncreateRoot(document.getElementById('root')!).render(<App />);" },
    ],
  },
  {
    name: "tests", type: "folder", children: [
      { name: "Header.test.tsx", type: "file", language: "typescript", content: "describe('Header', () => {\n  it('renders', () => {\n    expect(true).toBe(true);\n  });\n});" },
      { name: "Sidebar.test.tsx", type: "file", language: "typescript", content: "describe('Sidebar', () => {\n  it('renders', () => {\n    expect(true).toBe(true);\n  });\n});" },
    ],
  },
  { name: "package.json", type: "file", language: "json", content: '{\n  "name": "nova-ai-os",\n  "version": "1.0.0"\n}' },
  { name: "README.md", type: "file", language: "markdown", content: "# Nova AI OS\n\nAn intelligent personal operating system." },
  { name: "tsconfig.json", type: "file", language: "json", content: '{\n  "compilerOptions": {\n    "target": "ES2020"\n  }\n}' },
];

function flattenFiles(nodes: FileNode[], prefix = ""): { path: string; file: FileNode }[] {
  const result: { path: string; file: FileNode }[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") result.push({ path, file: node });
    if (node.children) result.push(...flattenFiles(node.children, path));
  }
  return result;
}

function countTests(nodes: FileNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === "folder" && n.children) count += countTests(n.children);
    if (n.type === "file" && n.name.endsWith(".test.tsx")) count++;
  }
  return count;
}

function FileTreeItem({ node, depth, onSelect, selectedPath }: {
  node: FileNode; depth: number; onSelect: (path: string, file: FileNode) => void; selectedPath: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const path = node.name;

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] hover:bg-[#0f2137] rounded transition-colors text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
          {expanded ? <FolderOpen className="h-3 w-3 text-cyan-400" /> : <Folder className="h-3 w-3 text-cyan-400" />}
          <span className="text-slate-300">{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <FileTreeItem
            key={child.name} node={child} depth={depth + 1}
            onSelect={(p, f) => onSelect(`${node.name}/${p}`, f)}
            selectedPath={selectedPath}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(path, node)}
      className={`flex items-center gap-1.5 w-full px-2 py-1 text-[10px] rounded transition-colors text-left ${
        selectedPath === path ? "bg-cyan-500/15 text-cyan-400" : "hover:bg-[#0f2137] text-slate-400"
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileText className="h-3 w-3" />
      <span className={node.modified ? "text-amber-400" : ""}>{node.name}</span>
      {node.modified && <span className="text-[8px] text-amber-400">M</span>}
    </button>
  );
}

export function CodingWorkspace() {
  const [repo] = useState<FileNode[]>(SAMPLE_REPO);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isLinting, setIsLinting] = useState(false);
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"code" | "tests" | "lint" | "preview">("code");
  const [searchQuery, setSearchQuery] = useState("");

  const allFiles = flattenFiles(repo);
  const totalFiles = allFiles.length;
  const totalTests = countTests(repo);

  const handleSelectFile = useCallback((path: string, file: FileNode) => {
    setSelectedFile(file);
    setSelectedPath(path);
    setEditContent(file.content || "");
    setIsEditing(false);
    setActiveTab("code");
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedFile) return;
    selectedFile.content = editContent;
    selectedFile.modified = true;
    setIsEditing(false);
  }, [selectedFile, editContent]);

  const runTests = useCallback(() => {
    setIsRunningTests(true);
    setActiveTab("tests");
    setTimeout(() => {
      const results: TestResult[] = flattenFiles(repo)
        .filter(({ path, file }) => file.name.endsWith(".test.tsx") || file.name.endsWith(".test.ts"))
        .map(({ path, file }) => ({
          name: path,
          status: file.content?.includes("expect(") ? "passed" : "failed",
          duration: Math.max(1, (file.content?.length || 0) % 30),
          error: file.content?.includes("expect(") ? undefined : "Test contains no expect assertion",
        }));
      setTestResults(results);
      setIsRunningTests(false);
    }, 250);
  }, [repo]);

  const runLint = useCallback(() => {
    setIsLinting(true);
    setActiveTab("lint");
    setTimeout(() => {
      const issues: LintIssue[] = [];
      for (const { path, file } of flattenFiles(repo)) {
        const lines = (file.content || "").split("\n");
        lines.forEach((line, index) => {
          if (line.includes(": any")) issues.push({ file: path, line: index + 1, column: line.indexOf(": any") + 1, severity: "warning", message: "Avoid explicit any types", rule: "no-explicit-any" });
          if (line.includes("console.log")) issues.push({ file: path, line: index + 1, column: line.indexOf("console.log") + 1, severity: "info", message: "Console output should be removed before production", rule: "no-console" });
        });
      }
      setLintIssues(issues);
      setIsLinting(false);
    }, 250);
  }, [repo]);

  const handleCommit = useCallback(() => {
    setShowCommitConfirm(false);
    setCommitMessage("");
    // Reset modified flags
    allFiles.forEach(({ file }) => { file.modified = false; });
  }, [allFiles]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Coding Workspace</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {totalFiles} files · {totalTests} tests ·{" "}
              {allFiles.filter(({ file }) => file.modified).length} modified
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runTests} disabled={isRunningTests}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 rounded-md hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            {isRunningTests ? <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" /> : <Play className="h-3 w-3" />}
            Tests
          </button>
          <button onClick={runLint} disabled={isLinting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium bg-amber-500/15 text-amber-400 rounded-md hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
          >
            {isLinting ? <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
            Lint
          </button>
          <button
            onClick={() => allFiles.some(({ file }) => file.modified) && setShowCommitConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
          >
            <GitCommit className="h-3 w-3" />
            Commit
          </button>
        </div>
      </div>

      {/* Commit confirmation */}
      {showCommitConfirm && (
        <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-cyan-400">Confirm Commit</h3>
          </div>
          <p className="text-[10px] text-slate-500">
            {allFiles.filter(({ file }) => file.modified).length} file(s) will be committed.
          </p>
          <input type="text" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..." className="w-full bg-[#0f2137] border border-[#1a2f4a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCommit} disabled={!commitMessage.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >Commit</button>
            <button onClick={() => setShowCommitConfirm(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* File tree */}
        <div className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-2 max-h-[600px] overflow-y-auto">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <GitBranch className="h-3 w-3 text-cyan-400" />
            <span className="text-[10px] font-mono text-slate-500">main</span>
          </div>
          {repo.map((node) => (
            <FileTreeItem key={node.name} node={node} depth={0} onSelect={handleSelectFile} selectedPath={selectedPath} />
          ))}
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 bg-[#0a1425] border border-[#1a2f4a] rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[#1a2f4a]">
            {(["code", "tests", "lint", "preview"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-colors ${
                  activeTab === tab ? "bg-cyan-500/15 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab === "code" ? (selectedFile?.name || "Code") : tab === "tests" ? `Tests (${testResults.length})` : tab === "lint" ? `Lint (${lintIssues.length})` : "Preview"}
              </button>
            ))}
          </div>

          {/* Code tab */}
          {activeTab === "code" && (
            <div className="p-4">
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">{selectedPath}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditing(!isEditing)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      {isEditing && (
                        <button onClick={handleSave}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-cyan-500 text-black rounded hover:bg-cyan-400 transition-colors"
                        ><Save className="h-2.5 w-2.5" /> Save</button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-[400px] bg-[#0a1425] border border-cyan-500/30 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 outline-none resize-none"
                    />
                  ) : (
                    <pre className="bg-[#0a1425] rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[400px] overflow-y-auto">
                      {selectedFile.content}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Code className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Select a file to view</p>
                </div>
              )}
            </div>
          )}

          {/* Tests tab */}
          {activeTab === "tests" && (
            <div className="p-4 space-y-2">
              {isRunningTests ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Running tests...</p>
                </div>
              ) : testResults.length === 0 ? (
                <div className="text-center py-8">
                  <Play className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No test results — click "Tests" to run</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-[10px] font-mono mb-3">
                    <span className="text-emerald-400">{testResults.filter((r) => r.status === "passed").length} passed</span>
                    <span className="text-red-400">{testResults.filter((r) => r.status === "failed").length} failed</span>
                    <span className="text-slate-500">{testResults.reduce((s, r) => s + r.duration, 0)}ms total</span>
                  </div>
                  {testResults.map((t, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs ${
                      t.status === "failed" ? "bg-red-400/5" : "bg-[#0f2137]"
                    }`}>
                      {t.status === "passed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : t.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />}
                      <span className="flex-1 text-slate-300">{t.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{t.duration}ms</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Lint tab */}
          {activeTab === "lint" && (
            <div className="p-4 space-y-2">
              {isLinting ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Linting...</p>
                </div>
              ) : lintIssues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No issues — click "Lint" to run</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-[10px] font-mono mb-3">
                    <span className="text-red-400">{lintIssues.filter((i) => i.severity === "error").length} errors</span>
                    <span className="text-amber-400">{lintIssues.filter((i) => i.severity === "warning").length} warnings</span>
                    <span className="text-slate-500">{lintIssues.filter((i) => i.severity === "info").length} info</span>
                  </div>
                  {lintIssues.map((issue, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs ${
                      issue.severity === "error" ? "bg-red-400/5" : issue.severity === "warning" ? "bg-amber-400/5" : "bg-[#0f2137]"
                    }`}>
                      {issue.severity === "error" ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                        : issue.severity === "warning" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        : <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />}
                      <div className="flex-1">
                        <p className="text-slate-300">{issue.message}</p>
                        <p className="text-[9px] font-mono text-slate-600">{issue.file}:{issue.line}:{issue.column} {issue.rule && `(${issue.rule})`}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Preview tab */}
          {activeTab === "preview" && (
            <div className="p-4">
              <div className="bg-white rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Eye className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Sandbox Preview</p>
                  <p className="text-xs mt-1">Live preview of your code will appear here</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CodingWorkspace;
