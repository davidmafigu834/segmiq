import { Camera, Folder, RefreshCw } from "lucide-react";

export type TabId = "projects" | "capture" | "sync";

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

const NAV: { id: TabId; label: string; icon: typeof Folder }[] = [
  { id: "projects", label: "Projects", icon: Folder },
  { id: "capture", label: "Capture", icon: Camera },
  { id: "sync", label: "Sync", icon: RefreshCw },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-black/[0.08] bg-white px-2 font-fw-body"
      style={{
        paddingTop: 8,
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {NAV.map(({ id, label, icon: Icon }, idx) => {
        const isActive = active === id;
        const isCenter = idx === 1;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="relative flex flex-1 flex-col items-center gap-[3px]"
          >
            {isCenter ? (
              <div
                className="flex items-center justify-center rounded-full bg-lime"
                style={{
                  width: 52,
                  height: 52,
                  marginTop: -22,
                  boxShadow: "0 4px 16px rgba(212,255,79,0.28)",
                }}
              >
                <Icon className="h-[22px] w-[22px] text-[#111111]" strokeWidth={2} />
              </div>
            ) : (
              <>
                {isActive && (
                  <div
                    className="absolute top-1.5 rounded-full bg-lime"
                    style={{ width: 4, height: 4, left: "50%", transform: "translateX(-50%)" }}
                  />
                )}
                <div className="relative flex h-[22px] w-[22px] items-center justify-center">
                  <Icon
                    className="h-[22px] w-[22px]"
                    style={{ color: isActive ? "#1C1410" : "#B4A898" }}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </div>
                <span
                  className="font-fw-body"
                  style={{
                    fontSize: 9,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#1C1410" : "#B4A898",
                  }}
                >
                  {label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
