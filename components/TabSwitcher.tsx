"use client";

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function TabSwitcher({ tabs, activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              background: active ? "#7c3aed" : "#fff",
              color: active ? "#fff" : "#6b7280",
              border: active ? "none" : "1.5px solid #e5e7eb",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                style={{
                  background: active ? "rgba(255,255,255,0.25)" : "#7c3aed",
                  color: active ? "#fff" : "#fff",
                  borderRadius: 10,
                  padding: "1px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
