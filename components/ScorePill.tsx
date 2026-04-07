import { scoreColor, scoreBg } from "@/lib/types";

interface ScorePillProps {
  score: number;
  large?: boolean;
}

export default function ScorePill({ score, large }: ScorePillProps) {
  const pct = Math.round((score / 30) * 100);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: large ? 7 : 5,
        padding: large ? "6px 16px" : "4px 12px",
        borderRadius: 20,
        fontSize: large ? 15 : 12,
        fontWeight: 700,
        color: scoreColor(score),
        background: scoreBg(score),
        fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
      }}
    >
      <span
        style={{
          width: large ? 9 : 7,
          height: large ? 9 : 7,
          borderRadius: "50%",
          background: scoreColor(score),
        }}
      />
      {pct}%
    </span>
  );
}
