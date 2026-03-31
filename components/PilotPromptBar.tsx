"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, ChevronRight } from "lucide-react";

const PILOT_PROMPTS = [
  "Ask Pilot to scrape this URL",
  "Ask Pilot for a summary of the latest batch",
  "Ask Pilot to sync the knowledge base",
  "Ask Pilot 'which sources are outdated?'",
  "Ask Pilot to draft a report from these notes",
  "Ask Pilot to categorize these new entries",
  "Ask Pilot 'where is the documentation on API v2?'",
  "Ask Pilot to find gaps in our data",
  "Ask Pilot to merge duplicate records",
  "Ask Pilot to find pricing data on this site",
  "Ask Pilot 'did the competitor update their terms?'",
  "Ask Pilot to monitor this page for changes",
  "Ask Pilot to explain this complex document",
  "Ask Pilot 'what are the key takeaways from the scrape?'",
  "Ask Pilot to translate this entry to English",
  "Ask Pilot 'give me a high-level overview of our KB'",
  "Ask Pilot to clean up duplicate records",
  "Ask Pilot 'are there any pending files for review?'",
  "Ask Pilot to export this collection to CSV",
  "Ask Pilot to notify the team when the scrape finishes",
  "Ask Pilot 'summarize the last 5 scrapes'",
  "Ask Pilot 'create a new category for Research'",
  "Ask Pilot 'are there any broken links in the KB?'",
  "Ask Pilot 'scrape the pricing table from this URL'",
  "Ask Pilot to compare two sources side by side",
  "Ask Pilot 'which files haven't been updated in 30 days?'",
  "Ask Pilot to generate tags for untagged entries",
  "Ask Pilot 'what's the total word count across all sources?'",
  "Ask Pilot to flag low-quality content for review",
  "Ask Pilot to build a FAQ from the knowledge base",
];

const ROTATE_INTERVAL = 3500;

interface PilotPromptBarProps {
  onSubmitPrompt: (prompt: string) => void;
  onExpand: () => void;
}

export default function PilotPromptBar({ onSubmitPrompt, onExpand }: PilotPromptBarProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.floor(Math.random() * PILOT_PROMPTS.length)
  );
  const [animState, setAnimState] = useState<"visible" | "exiting" | "entering">("visible");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hovered, setHovered] = useState(false);
  const [arrowHovered, setArrowHovered] = useState(false);

  const currentPrompt = PILOT_PROMPTS[currentIndex];

  // Rotate prompts
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setAnimState("exiting");
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % PILOT_PROMPTS.length);
        setAnimState("entering");
        setTimeout(() => setAnimState("visible"), 30);
      }, 250);
    }, ROTATE_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handlePromptClick = useCallback(() => {
    onSubmitPrompt(currentPrompt);
  }, [currentPrompt, onSubmitPrompt]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand();
  }, [onExpand]);

  const textOpacity = animState === "exiting" ? 0 : animState === "entering" ? 0 : 1;
  const textTransform = animState === "exiting"
    ? "translateY(-6px)"
    : animState === "entering"
      ? "translateY(6px)"
      : "translateY(0)";

  return (
    <div style={{ padding: "0 24px 16px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          background: hovered || arrowHovered ? "#6d28d9" : "#7c3aed",
          borderRadius: 50,
          border: "none",
          boxShadow: hovered || arrowHovered
            ? "0 6px 20px rgba(124,58,237,0.35)"
            : "0 3px 12px rgba(124,58,237,0.2)",
          transition: "background 0.15s, box-shadow 0.15s",
          overflow: "hidden",
        }}
      >
        {/* Main prompt button */}
        <button
          onClick={handlePromptClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            transition: "opacity 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          <Sparkles
            size={14}
            color="#fff"
            style={{ flexShrink: 0, opacity: 0.85 }}
          />
          <span
            style={{
              opacity: textOpacity,
              transform: textTransform,
              transition: "opacity 0.25s ease, transform 0.25s ease",
            }}
          >
            {currentPrompt}
          </span>
        </button>

        {/* Divider */}
        <div
          style={{
            width: 1,
            background: "rgba(255,255,255,0.25)",
            margin: "8px 0",
            flexShrink: 0,
          }}
        />

        {/* Expand arrow button */}
        <button
          onClick={handleExpandClick}
          onMouseEnter={() => setArrowHovered(true)}
          onMouseLeave={() => setArrowHovered(false)}
          title="Open full chat"
          aria-label="Open full chat panel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 14px",
            background: arrowHovered ? "rgba(255,255,255,0.1)" : "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          <ChevronRight
            size={16}
            color="#fff"
            style={{ opacity: arrowHovered ? 1 : 0.7, transition: "opacity 0.15s" }}
          />
        </button>
      </div>
    </div>
  );
}
