"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import IngestWizard from "@/components/IngestWizard";
import AgentChatPanel from "@/components/AgentChatPanel";
import { useActiveJobs } from "@/hooks/useActiveJobs";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showIngestWizard, setShowIngestWizard] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const { mutate: activeJobsMutate } = useActiveJobs();

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div className="sidebar-desktop">
        <Sidebar onNewIngestion={() => setShowIngestWizard(true)} />
      </div>
      <main
        className="shell-main"
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>

        {/* Agent chat trigger bar */}
        <div style={{ padding: "0 24px 16px", flexShrink: 0 }}>
          <button
            onClick={() => setShowAgentChat(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              background: "#fff",
              border: "1.5px solid #ede9fe",
              borderRadius: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              color: "#9ca3af",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#c4b5fd";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#ede9fe";
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)";
            }}
          >
            <Sparkles size={15} color="#7c3aed" style={{ flexShrink: 0 }} />
            Ask the KB Agent…
          </button>
        </div>
      </main>

      <AgentChatPanel
        open={showAgentChat}
        onClose={() => setShowAgentChat(false)}
      />

      {showIngestWizard && (
        <IngestWizard
          onClose={() => setShowIngestWizard(false)}
          onComplete={() => activeJobsMutate()}
        />
      )}
    </div>
  );
}
