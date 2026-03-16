"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import IngestWizard from "@/components/IngestWizard";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showIngestWizard, setShowIngestWizard] = useState(false);

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
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>

      {showIngestWizard && (
        <IngestWizard onClose={() => setShowIngestWizard(false)} />
      )}
    </div>
  );
}
