"use client";

interface CardStackLoaderProps {
  message?: string;
}

export default function CardStackLoader({ message = "Stacking your cards…" }: CardStackLoaderProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 280, height: 180 }}>
        {[4, 3, 2, 1, 0].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              width: 240,
              height: 140,
              background: "#fff",
              borderRadius: 20,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
              transform: "translateX(-50%)",
              animation: `stackCard 2s ease-in-out ${i * 0.25}s infinite`,
            }}
          >
            <div style={{ padding: "18px 22px" }}>
              <div style={{ width: "60%", height: 10, background: "#e5e7eb", borderRadius: 5, marginBottom: 10 }} />
              <div style={{ width: "80%", height: 8, background: "#f3f4f6", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: "45%", height: 8, background: "#f3f4f6", borderRadius: 4 }} />
            </div>
            <div style={{ padding: "0 22px", display: "flex", gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #e5e7eb" }} />
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #e5e7eb" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>
        {message}
      </div>
      <style>{`
        @keyframes stackCard {
          0% { transform: translateX(-50%) translateY(60px) scale(0.9); opacity: 0; }
          20% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          80% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-10px) scale(0.96); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
