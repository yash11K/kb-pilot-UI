"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import IngestWizard from "@/components/IngestWizard";
import AgentChatPanel from "@/components/AgentChatPanel";
import PilotPromptBar from "@/components/PilotPromptBar";
import { useActiveJobs } from "@/hooks/useActiveJobs";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showIngestWizard, setShowIngestWizard] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const { mutate: activeJobsMutate } = useActiveJobs();

  const handlePromptSubmit = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setShowAgentChat(true);
  }, []);

  const handleExpandChat = useCallback(() => {
    setPendingPrompt(null);
    setShowAgentChat(true);
  }, []);

  const handleCloseChat = useCallback(() => {
    setShowAgentChat(false);
    setPendingPrompt(null);
  }, []);

  const handlePromptConsumed = useCallback(() => {
    setPendingPrompt(null);
  }, []);

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

        <PilotPromptBar
          onSubmitPrompt={handlePromptSubmit}
          onExpand={handleExpandChat}
        />
      </main>

      <AgentChatPanel
        open={showAgentChat}
        onClose={handleCloseChat}
        initialPrompt={pendingPrompt}
        onPromptConsumed={handlePromptConsumed}
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
