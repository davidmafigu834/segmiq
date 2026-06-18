export type TabId = "projects" | "capture" | "sync";

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

const tabs: { id: TabId; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "capture", label: "Capture" },
  { id: "sync", label: "Sync" },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-black/[0.08] bg-white px-2"
      style={{ paddingTop: 8, paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
    >
      {tabs.map(({ id, label }) => {
        const isActive = active === id;
        const isCapture = id === "capture";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex flex-1 flex-col items-center gap-1 py-1"
          >
            {isCapture ? (
              <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-lime text-[13px] font-bold text-ink shadow-md"
                style={{ marginTop: -18 }}
              >
                +
              </span>
            ) : (
              <>
                <span
                  className={`text-[11px] font-semibold ${isActive ? "text-ink" : "text-warm"}`}
                >
                  {label}
                </span>
                {isActive && (
                  <span className="h-1 w-1 rounded-full bg-lime" />
                )}
              </>
            )}
            {isCapture && (
              <span className={`text-[9px] font-semibold ${isActive ? "text-ink" : "text-warm"}`}>
                {label}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
