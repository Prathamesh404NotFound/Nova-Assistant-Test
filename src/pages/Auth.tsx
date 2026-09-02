import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UserX, Chrome, AlertTriangle, ExternalLink } from "lucide-react";
import React, { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { isFirebaseConfigured } from "@/lib/env-validator";

interface AuthProps { redirectAfterAuth?: string; }

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect);
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseReady) {
      setError("Firebase is not configured. Add your Firebase credentials in Settings → Environment.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("email", email);
      fd.append("password", password);
      fd.append("mode", isSignup ? "signup" : "signin");
      await signIn("email-otp", fd);
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!firebaseReady) {
      setError("Firebase is not configured. Add your Firebase credentials in Settings → Environment.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google");
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    if (!firebaseReady) {
      setError("Firebase is not configured. Add your Firebase credentials in Settings → Environment.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guest sign-in failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060e1a] jarvis-grid-bg">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#00d4ff]/5 blur-[120px]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#0ea5e9]/3 blur-[100px]" />
      <div className="flex-1 flex items-center justify-center relative z-10">
        <Card className="min-w-[380px] pb-0 border border-[#1a2f4a] bg-[#0b1929]/90 backdrop-blur-xl shadow-2xl shadow-black/50">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#0ea5e9] flex items-center justify-center mb-2 cursor-pointer shadow-lg shadow-[#00d4ff]/20" onClick={() => navigate("/")}>
                <span className="text-[#060e1a] font-black text-xl">N</span>
              </div>
            </div>
            <CardTitle className="text-xl text-[#e0ecf5]">Welcome to Nova</CardTitle>
            <CardDescription className="text-[#5a7a9a]">
              {isSignup ? "Create your account" : "Sign in to your AI operating system"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleEmailAuth}>
            <CardContent className="space-y-3">
              {!firebaseReady && (
                <div className="p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#f59e0b] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#f59e0b]">
                      <p className="font-medium">Firebase not configured</p>
                      <p className="mt-1 text-[#f59e0b]/80">Add your Firebase project credentials to enable authentication.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#00d4ff] hover:underline">
                      Open Firebase Console <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-[10px] text-[#5a7a9a]">|</span>
                    <button type="button" onClick={() => navigate("/settings")} className="text-[10px] text-[#00d4ff] hover:underline">
                      Go to Settings
                    </button>
                  </div>
                </div>
              )}

              <Button type="button" variant="outline"
                className="w-full border-[#1a2f4a] bg-[#0f2035] text-[#c8d6e5] hover:bg-[#162a42] hover:border-[#00d4ff]/30"
                onClick={handleGoogle} disabled={isLoading}>
                <Chrome className="mr-2 h-4 w-4" />Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#1a2f4a]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0b1929] px-2 text-[#5a7a9a]">Or</span>
                </div>
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[#5a7a9a]" />
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-[#0f2035] border-[#1a2f4a] text-[#c8d6e5] placeholder:text-[#5a7a9a] focus:border-[#00d4ff]/40"
                  disabled={isLoading} required />
              </div>
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0f2035] border-[#1a2f4a] text-[#c8d6e5] placeholder:text-[#5a7a9a] focus:border-[#00d4ff]/40"
                disabled={isLoading} required minLength={6} />

              {error && <p className="text-sm text-[#f43f5e]">{error}</p>}

              <Button type="submit"
                className="w-full bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] text-[#060e1a] font-semibold shadow-lg shadow-[#00d4ff]/15"
                disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {isSignup ? "Create Account" : "Sign In"}
              </Button>

              <Button type="button" variant="ghost"
                className="w-full text-[#5a7a9a] hover:text-[#c8d6e5]"
                onClick={() => { setIsSignup(!isSignup); setError(null); }} disabled={isLoading}>
                {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </Button>

              <Button type="button" variant="outline"
                className="w-full border-[#1a2f4a] bg-[#0f2035] text-[#c8d6e5] hover:bg-[#162a42] hover:border-[#00d4ff]/30"
                onClick={handleGuest} disabled={isLoading}>
                <UserX className="mr-2 h-4 w-4" />Continue as Guest
              </Button>
            </CardContent>
          </form>

          <div className="py-4 px-6 text-[10px] text-center text-[#5a7a9a] bg-[#081422]/80 border-t border-[#1a2f4a] rounded-b-lg uppercase tracking-wider">
            Nova AI Operating System v3.0.0
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return <Suspense><Auth {...props} /></Suspense>;
}
