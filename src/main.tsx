import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { VlyToolbar } from "./vly-toolbar-readonly";
import React, { Component, StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, useNavigate, Navigate } from "react-router";
import { validateEnvironment } from "@/lib/env-validator";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { AIServiceProvider } from "@/contexts/AIServiceProvider";
import { WakeWordProvider } from "@/contexts/WakeWordProvider";
import { WakeWordActivator } from "@/components/WakeWordActivator";
import { PermissionPrompt } from "@/components/PermissionPrompt";
import "./index.css";

// Lazy load all pages
const Landing = lazy(() => import("./pages/Landing"));
const AuthPage = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ChatPage = lazy(() => import("./pages/Chat"));
const TasksPage = lazy(() => import("./pages/Tasks"));
const MemoryPage = lazy(() => import("./pages/Memory"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AgentsPage = lazy(() => import("./pages/Agents"));
const DevicesPage = lazy(() => import("./pages/Devices"));
const VisionPage = lazy(() => import("./pages/Vision"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const EmailPage = lazy(() => import("./pages/EmailPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const BrowserPage = lazy(() => import("./pages/BrowserPage"));
const CodingPage = lazy(() => import("./pages/CodingPage"));
const SmartHomePage = lazy(() => import("./pages/SmartHome"));
const FilesPage = lazy(() => import("./pages/FilesPage"));
const AutomationsPage = lazy(() => import("./pages/Automations"));
const ActivityPage = lazy(() => import("./pages/Activity"));
const SecurityPage = lazy(() => import("./pages/Security"));
const PluginsPage = lazy(() => import("./pages/Plugins"));
const WorkflowPlannerPage = lazy(() => import("./pages/WorkflowPlanner"));
const MemorySearchControlPage = lazy(() => import("./pages/MemorySearchControl"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Sub-pages that redirect to canonical routes
const ObservabilityDashboard = lazy(() => import("./pages/ObservabilityPage"));
const PersonalizationSettings = lazy(() => import("./pages/PersonalizationPage"));
const ImportExportPage = lazy(() => import("./pages/ImportExportPage"));
const CalendarIntelligencePage = lazy(() => import("./pages/CalendarIntelligence"));
const AdminTeamPage = lazy(() => import("./pages/AdminTeamPage"));
const VoiceExperiencePage = lazy(() => import("./pages/VoiceExperiencePage"));
const BrowserResearchPage = lazy(() => import("./pages/BrowserResearchPage"));
const CodingWorkspacePage = lazy(() => import("./pages/CodingWorkspace"));
const SmartHomeScenesPage = lazy(() => import("./pages/SmartHomeScenes"));
const AutomationBuilderPage = lazy(() => import("./pages/AutomationBuilder"));
const AgentMarketplacePage = lazy(() => import("./pages/AgentMarketplace"));
const TTSConfigPage = lazy(() => import("./pages/TTSConfigPage"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06060c]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] animate-pulse" />
        <span className="text-sm text-[#6e6e8a]">Loading...</span>
      </div>
    </div>
  );
}

interface ToolbarProps { children: React.ReactNode }
interface ToolbarState { hasError: boolean }

class ToolbarErrorBoundary extends Component<ToolbarProps, ToolbarState> {
  state: ToolbarState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn("[VlyToolbar]", err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

interface RootProps { children: React.ReactNode }
interface RootState { hasError: boolean; message: string }

class RootErrorBoundary extends Component<RootProps, RootState> {
  state: RootState = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unknown error" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#06060c] text-[#e8e8f8] p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Runtime error</p>
            <p className="mt-2 text-xs text-[#6e6e8a] break-words">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*");
  }, [location.pathname]);

  // Bridge for the AI agent's navigation.go tool: tools can't call the router
  // directly, so they dispatch a window event and we navigate here.
  useEffect(() => {
    function handleNovaNavigate(event: Event) {
      const path = (event as CustomEvent<string>).detail;
      if (typeof path === "string" && path.startsWith("/")) {
        navigate(path);
      }
    }
    window.addEventListener("nova:navigate", handleNovaNavigate);
    return () => window.removeEventListener("nova:navigate", handleNovaNavigate);
  }, [navigate]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  );
}

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <BrowserRouter>
        <AIServiceProvider>
        <WakeWordProvider>
        <RouteSyncer />
        <WakeWordActivator />
        <PermissionPrompt />
        <CommandPalette />
        <KeyboardShortcuts />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />

            {/* Core routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/memory" element={<ProtectedRoute><MemoryPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
            <Route path="/vision" element={<ProtectedRoute><VisionPage /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/email" element={<ProtectedRoute><EmailPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/browser" element={<ProtectedRoute><BrowserPage /></ProtectedRoute>} />
            <Route path="/coding" element={<ProtectedRoute><CodingPage /></ProtectedRoute>} />
            <Route path="/smart-home" element={<ProtectedRoute><SmartHomePage /></ProtectedRoute>} />
            <Route path="/files" element={<ProtectedRoute><FilesPage /></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute><AutomationsPage /></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><SecurityPage /></ProtectedRoute>} />
            <Route path="/plugins" element={<ProtectedRoute><PluginsPage /></ProtectedRoute>} />
            <Route path="/workflows" element={<ProtectedRoute><WorkflowPlannerPage /></ProtectedRoute>} />
            <Route path="/memory-search" element={<ProtectedRoute><MemorySearchControlPage /></ProtectedRoute>} />
            <Route path="/workspace" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />

            {/* Sub-pages (still accessible, but grouped under canonical routes in sidebar) */}
            <Route path="/voice-experience" element={<ProtectedRoute><VoiceExperiencePage /></ProtectedRoute>} />
            <Route path="/browser-research" element={<ProtectedRoute><BrowserResearchPage /></ProtectedRoute>} />
            <Route path="/coding-workspace" element={<ProtectedRoute><CodingWorkspacePage /></ProtectedRoute>} />
            <Route path="/admin-team" element={<ProtectedRoute><AdminTeamPage /></ProtectedRoute>} />

            {/* Redirect old duplicate URLs to canonical routes */}
            <Route path="/calendar-intel" element={<ProtectedRoute><Navigate to="/calendar" replace /></ProtectedRoute>} />
            <Route path="/smart-home-scenes" element={<ProtectedRoute><Navigate to="/smart-home" replace /></ProtectedRoute>} />
            <Route path="/automation-builder" element={<ProtectedRoute><Navigate to="/automations" replace /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><Navigate to="/agents" replace /></ProtectedRoute>} />
            <Route path="/tts-config" element={<ProtectedRoute><Navigate to="/settings" replace /></ProtectedRoute>} />
            <Route path="/observability" element={<ProtectedRoute><Navigate to="/settings" replace /></ProtectedRoute>} />
            <Route path="/personalization" element={<ProtectedRoute><Navigate to="/settings" replace /></ProtectedRoute>} />
            <Route path="/import-export" element={<ProtectedRoute><Navigate to="/settings" replace /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </WakeWordProvider>
        </AIServiceProvider>
      </BrowserRouter>
      <Toaster />
    </RootErrorBoundary>
  </StrictMode>,
);
