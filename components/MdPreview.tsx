"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MdPreviewProps {
  content: string;
}

export default function MdPreview({ content }: MdPreviewProps) {
  const parts = content.split("---");
  let body = content;

  if (parts.length >= 3) {
    body = parts.slice(2).join("---").trim();
  }

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                margin: "14px 0 8px",
                color: "#111827",
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                margin: "12px 0 6px",
                color: "#1f2937",
              }}
            >
              {children}
            </h2>
          ),
          p: ({ children }) => (
            <p style={{ margin: "8px 0", lineHeight: 1.7, color: "#374151" }}>
              {children}
            </p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              style={{ color: "#7c3aed", textDecoration: "underline" }}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 700 }}>{children}</strong>
          ),
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 20, margin: "8px 0" }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ margin: "4px 0", lineHeight: 1.7, color: "#374151" }}>
              {children}
            </li>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
