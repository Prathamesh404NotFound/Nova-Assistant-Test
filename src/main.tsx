import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import React, { Component, StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load all pages
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const ChatPage = lazy(() => import("./pages/Chat.tsx"));
const TasksPage = lazy(() => import("./pages/Tasks.tsx"));
const MemoryPage = lazy(() => import("./pages/Memory.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const AgentsPage = lazy(() => import("./pages/Agents.tsx"));
const DevicesPage = lazy(() => import("./pages/Devices.tsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.tsx"));
const EmailPage = lazy(() => import("./pages/EmailPage.tsx"));
const MessagesPage = lazy(() => import("./pages/MessagesPage.tsx"));
const BrowserPage = lazy(() => import("./pages/BrowserPage.tsx"));
const CodingPage = lazy(() => import("./pages/CodingPage.tsx"));
const SmartHomePage = lazy(() => import("./pages/SmartHome.tsx"));
const FilesPage = lazy(() => import("./pages/FilesPage.tsx"));
const AutomationsPage = lazy(() => import("./pages/Automations.tsx"));
const ActivityPage = lazy(() => import("./pages/Activity.tsx"));
const SecurityPage = lazy(() => import("./pages/Security.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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
  useEffect(() => {
    window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*");
  }, [location.pathname]);
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <BrowserRouter>
        <RouteSyncer />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/memory" element={<ProtectedRoute><MemoryPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </RootErrorBoundary>
  </StrictMode>,
);
