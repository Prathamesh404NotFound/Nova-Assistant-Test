/**
 * Nova AI OS — Admin & Team Mode
 * Roles, shared workspaces, approval policies,
 * connector governance, and audit logs.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Shield,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Lock,
  Globe,
  AlertTriangle,
  Key,
  Activity,
} from "lucide-react";

// --- Types ---
export type TeamRole = "owner" | "admin" | "editor" | "viewer";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: number;
  lastActive: number;
  avatarColor: string;
}

export interface ApprovalPolicy {
  id: string;
  actionType: string;
  requireApproval: boolean;
  approverRole: TeamRole;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  details: string;
  timestamp: number;
  ip?: string;
}

const MEMBERS_KEY = "nova_team_members";
const POLICIES_KEY = "nova_approval_policies";
const AUDIT_KEY = "nova_audit_log";

function generateId(): string {
  return `team_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomColor(): string {
  const colors = ["#00d4ff", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  return colors[Math.floor(Math.random() * colors.length)];
}

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: "text-purple-400 bg-purple-400/10",
  admin: "text-cyan-400 bg-cyan-400/10",
  editor: "text-emerald-400 bg-emerald-400/10",
  viewer: "text-slate-400 bg-slate-400/10",
};

const DEFAULT_POLICIES: ApprovalPolicy[] = [
  { id: "p1", actionType: "email.send", requireApproval: true, approverRole: "admin", description: "Sending emails requires admin approval" },
  { id: "p2", actionType: "code.deploy", requireApproval: true, approverRole: "owner", description: "Deployments require owner approval" },
  { id: "p3", actionType: "device.toggle", requireApproval: false, approverRole: "editor", description: "Device toggles are allowed for editors" },
  { id: "p4", actionType: "file.delete", requireApproval: true, approverRole: "admin", description: "File deletion requires admin approval" },
  { id: "p5", actionType: "automation.create", requireApproval: false, approverRole: "editor", description: "Automation creation is allowed for editors" },
];

function loadMembers(): TeamMember[] {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
    if (saved.length === 0) {
      // Seed with a default owner
      const owner: TeamMember = {
        id: "user_self",
        name: "You",
        email: "you@example.com",
        role: "owner",
        joinedAt: Date.now() - 86400000 * 30,
        lastActive: Date.now(),
        avatarColor: "#00d4ff",
      };
      return [owner];
    }
    return saved;
  } catch {
    return [];
  }
}

function loadPolicies(): ApprovalPolicy[] {
  try {
    const saved = JSON.parse(localStorage.getItem(POLICIES_KEY) || "[]");
    return saved.length > 0 ? saved : DEFAULT_POLICIES;
  } catch {
    return DEFAULT_POLICIES;
  }
}

function loadAuditLog(): AuditLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMembers(members: TeamMember[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

function savePolicies(policies: ApprovalPolicy[]) {
  localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
}

function saveAuditLog(entries: AuditLogEntry[]) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(-500)));
}

function addAuditEntry(entries: AuditLogEntry[], entry: Omit<AuditLogEntry, "id" | "timestamp">) {
  return [...entries, { ...entry, id: generateId(), timestamp: Date.now() }];
}

// --- Component ---
export function AdminTeamMode() {
  const [members, setMembers] = useState<TeamMember[]>(loadMembers);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>(loadPolicies);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(loadAuditLog);
  const [activeTab, setActiveTab] = useState<"members" | "policies" | "audit">("members");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("viewer");

  useEffect(() => { saveMembers(members); }, [members]);
  useEffect(() => { savePolicies(policies); }, [policies]);
  useEffect(() => { saveAuditLog(auditLog); }, [auditLog]);

  const addMember = useCallback(() => {
    if (!newName.trim() || !newEmail.trim()) return;
    const member: TeamMember = {
      id: generateId(),
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      avatarColor: randomColor(),
    };
    setMembers((prev) => [...prev, member]);
    setAuditLog((prev) => addAuditEntry(prev, {
      userId: "user_self", userName: "You",
      action: "member.add", target: member.name,
      details: `Added ${member.name} as ${ROLE_LABELS[member.role]}`,
    }));
    setNewName("");
    setNewEmail("");
    setNewRole("viewer");
    setShowAddMember(false);
  }, [newName, newEmail, newRole]);

  const removeMember = useCallback((id: string) => {
    const member = members.find((m) => m.id === id);
    if (!member || member.role === "owner") return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setAuditLog((prev) => addAuditEntry(prev, {
      userId: "user_self", userName: "You",
      action: "member.remove", target: member.name,
      details: `Removed ${member.name} from team`,
    }));
  }, [members]);

  const changeRole = useCallback((id: string, role: TeamRole) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
    const member = members.find((m) => m.id === id);
    if (member) {
      setAuditLog((prev) => addAuditEntry(prev, {
        userId: "user_self", userName: "You",
        action: "member.role_change", target: member.name,
        details: `Changed ${member.name}'s role to ${ROLE_LABELS[role]}`,
      }));
    }
  }, [members]);

  const togglePolicy = useCallback((id: string) => {
    setPolicies((prev) => prev.map((p) => p.id === id ? { ...p, requireApproval: !p.requireApproval } : p));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Admin & Team</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {members.length} members · {policies.filter((p) => p.requireApproval).length} approval policies
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-0.5">
        {(["members", "policies", "audit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[10px] font-mono rounded-md transition-colors ${
              activeTab === tab ? "bg-cyan-500/15 text-cyan-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab === "members" ? "Members" : tab === "policies" ? "Approval Policies" : "Audit Log"}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">Team Members</span>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-cyan-500/15 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Member
            </button>
          </div>

          {showAddMember && (
            <div className="bg-[#0f2137] border border-[#1a2f4a] rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name" className="flex-1 bg-[#0a1425] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-500 outline-none"
                />
                <input
                  type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email" className="flex-1 bg-[#0a1425] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-500 outline-none"
                />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as TeamRole)}
                  className="bg-[#0a1425] border border-[#1a2f4a] rounded-md px-2 py-1.5 text-[10px] text-slate-300 outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={addMember} disabled={!newName.trim() || !newEmail.trim()}
                  className="px-2.5 py-1 text-[10px] font-medium bg-cyan-500 text-black rounded-md hover:bg-cyan-400 disabled:opacity-40 transition-colors"
                >Add</button>
                <button onClick={() => setShowAddMember(false)} className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0a1425] border border-[#1a2f4a] rounded-lg hover:bg-[#0f2137] transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black" style={{ background: member.avatarColor }}>
                {member.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">{member.name}</p>
                <p className="text-[10px] text-slate-500">{member.email}</p>
              </div>
              <select
                value={member.role}
                onChange={(e) => changeRole(member.id, e.target.value as TeamRole)}
                disabled={member.role === "owner"}
                className={`text-[10px] font-mono px-2 py-1 rounded-md bg-[#0f2137] border border-[#1a2f4a] outline-none disabled:opacity-50 ${ROLE_COLORS[member.role]}`}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              {member.role !== "owner" && (
                <button onClick={() => removeMember(member.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors" aria-label={`Remove ${member.name}`}>
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Policies Tab */}
      {activeTab === "policies" && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Configure which actions require approval before execution.</p>
          {policies.map((policy) => (
            <div key={policy.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0a1425] border border-[#1a2f4a] rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">{policy.actionType}</p>
                <p className="text-[10px] text-slate-500">{policy.description}</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Min role: {ROLE_LABELS[policy.approverRole]}</span>
              <button
                onClick={() => togglePolicy(policy.id)}
                className={`relative w-9 h-5 rounded-full transition-colors ${policy.requireApproval ? "bg-cyan-500" : "bg-slate-600"}`}
                role="switch"
                aria-checked={policy.requireApproval}
                aria-label={`Toggle approval for ${policy.actionType}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${policy.requireApproval ? "translate-x-4" : ""}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {auditLog.length === 0 && (
            <div className="text-center py-8">
              <Activity className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No audit entries yet</p>
            </div>
          )}
          {auditLog.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100).map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#0a1425] hover:bg-[#0f2137] transition-colors">
              <Shield className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300">
                  <span className="font-medium text-slate-200">{entry.userName}</span>
                  {" "}{entry.action.replace(".", " ")}{" "}
                  <span className="text-cyan-400">{entry.target}</span>
                </p>
                <p className="text-[10px] text-slate-500">{entry.details}</p>
              </div>
              <span className="text-[9px] font-mono text-slate-600 shrink-0">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminTeamMode;
