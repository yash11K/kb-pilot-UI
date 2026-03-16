interface BadgeProps {
  label: string;
  color: string;
  bg: string;
}

export default function Badge({ label, color, bg }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
}
