"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthContextValue {
  token: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({ token: null, logout: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

/** Call this from api.ts to clear token + force re-render */
let globalLogout: (() => void) | null = null;
export function triggerLogout() {
  localStorage.removeItem("kb_token");
  globalLogout?.();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("kb_token");
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("kb_token"));
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kb_token");
    setToken(null);
  }, []);

  useEffect(() => {
    globalLogout = logout;
    return () => { globalLogout = null; };
  }, [logout]);

  if (!ready) return null; // avoid hydration flash

  if (!token) return <AccessCodeScreen onSuccess={(t) => setToken(t)} />;

  return (
    <AuthContext.Provider value={{ token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function AccessCodeScreen({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        throw new Error("Invalid access code");
      }
      const { token } = await res.json();
      localStorage.setItem("kb_token", token);
      onSuccess(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#f8f7fc",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: 40,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 380,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, textAlign: "center" }}>
          KB Manager
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#666", textAlign: "center" }}>
          Enter your access code to continue
        </p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          autoFocus
          required
          style={{
            padding: "10px 14px", borderRadius: 8,
            border: "1px solid #ddd", fontSize: 14, outline: "none",
          }}
          aria-label="Access code"
        />
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: "#e53e3e" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !code}
          style={{
            padding: "10px 0", borderRadius: 8, border: "none",
            background: loading ? "#a0aec0" : "#5a4fcf", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>
    </div>
  );
}
