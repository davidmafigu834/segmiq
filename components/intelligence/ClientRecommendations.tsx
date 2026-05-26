"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Send,
  TrendingDown,
  Zap,
  Phone,
  Calendar,
} from "lucide-react";

type Recommendation = {
  id: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  supporting_data: Record<string, unknown>;
  about_salesperson_name: string | null;
  generated_at: string;
};

type Props = {
  clientId: string;
  isAgencyAdmin: boolean;
};

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string }
> = {
  response_time: { icon: Clock, label: "Response time" },
  lead_quality: { icon: TrendingDown, label: "Lead quality" },
  call_quality: { icon: Phone, label: "Call quality" },
  follow_up: { icon: Calendar, label: "Follow-up" },
  send_assets: { icon: Send, label: "Send panel" },
  salesperson: { icon: Users, label: "Team member" },
  creative: { icon: Zap, label: "Creatives" },
  pricing: { icon: Zap, label: "Pricing" },
  segment: { icon: Users, label: "Audience" },
};

const PRIORITY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    colour: string;
    bgColour: string;
    borderColour: string;
  }
> = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    colour: "var(--error)",
    bgColour: "rgba(255,68,68,0.06)",
    borderColour: "rgba(255,68,68,0.2)",
  },
  high: {
    label: "High",
    icon: AlertTriangle,
    colour: "var(--warning)",
    bgColour: "rgba(245,166,35,0.06)",
    borderColour: "rgba(245,166,35,0.2)",
  },
  medium: {
    label: "Medium",
    icon: Info,
    colour: "#60a5fa",
    bgColour: "rgba(96,165,250,0.06)",
    borderColour: "rgba(96,165,250,0.2)",
  },
  low: {
    label: "Low",
    icon: Lightbulb,
    colour: "var(--text-tertiary)",
    bgColour: "transparent",
    borderColour: "var(--border)",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function RecommendationCard({
  rec,
  clientId,
  onDismiss,
  onResolve,
}: {
  rec: Recommendation;
  clientId: string;
  onDismiss: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actioning, setActioning] = useState(false);

  const priority = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.low;
  const category = CATEGORY_CONFIG[rec.category] ?? {
    icon: Lightbulb,
    label: rec.category,
  };
  const PriorityIcon = priority.icon;
  const CategoryIcon = category.icon;

  async function handleAction(status: "dismissed" | "resolved") {
    setActioning(true);
    try {
      await fetch(
        `/api/clients/${clientId}/recommendations/${rec.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (status === "dismissed") onDismiss(rec.id);
      else onResolve(rec.id);
    } catch {
      // silent
    } finally {
      setActioning(false);
    }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: priority.borderColour,
        background: priority.bgColour,
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* Priority icon */}
          <div className="shrink-0 mt-0.5">
            <PriorityIcon size={16} style={{ color: priority.colour }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: priority.colour }}
              >
                {priority.label}
              </span>
              <span className="text-[var(--text-disabled)] text-[10px]">·</span>
              <div className="flex items-center gap-1">
                <CategoryIcon
                  size={10}
                  className="text-[var(--text-tertiary)]"
                />
                <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                  {category.label}
                </span>
              </div>
              <span className="text-[var(--text-disabled)] text-[10px]">·</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {timeAgo(rec.generated_at)}
              </span>
            </div>

            {/* Title */}
            <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug mb-2">
              {rec.title}
            </p>

            {/* Expandable body */}
            {expanded && (
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
                {rec.body}
              </p>
            )}

            {/* Supporting data chips */}
            {expanded && Object.keys(rec.supporting_data).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(rec.supporting_data)
                  .slice(0, 4)
                  .map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center h-5 px-2 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[10px] font-medium text-[var(--text-tertiary)]"
                    >
                      {key.replace(/_/g, " ")}:{" "}
                      <strong className="text-[var(--text-secondary)] ml-1">
                        {typeof value === "number"
                          ? value % 1 === 0
                            ? value
                            : value.toFixed(1)
                          : String(value)}
                        {key.includes("pct") || key.includes("rate")
                          ? "%"
                          : ""}
                      </strong>
                    </span>
                  ))}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={11} />
                    Less
                  </>
                ) : (
                  <>
                    <ChevronDown size={11} />
                    Read more
                  </>
                )}
              </button>

              <span className="text-[var(--text-disabled)] text-[10px]">·</span>

              <button
                onClick={() => handleAction("resolved")}
                disabled={actioning}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--success)] hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                <CheckCircle size={10} />
                Mark resolved
              </button>

              <button
                onClick={() => handleAction("dismissed")}
                disabled={actioning}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors disabled:opacity-50"
              >
                <X size={10} />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientRecommendations({ clientId, isAgencyAdmin }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      fetch(`/api/clients/${clientId}/recommendations`)
        .then((r) => r.json())
        .then((data: { recommendations?: Recommendation[] }) =>
          setRecommendations(data.recommendations ?? [])
        )
        .catch(console.error)
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [clientId]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      if (isAgencyAdmin) {
        await fetch(`/api/clients/${clientId}/recommendations`, {
          method: "POST",
        });
      }
    } catch {
      // silent
    }
    load(true);
  }

  function handleDismiss(id: string) {
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  function handleResolve(id: string) {
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) {
    return (
      <div className="mt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-3 w-36 rounded bg-[var(--bg-quaternary)] animate-pulse" />
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-[90px] rounded-xl border border-[var(--border)] bg-[var(--surface-card)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const critical = recommendations.filter((r) => r.priority === "critical");
  const others = recommendations.filter((r) => r.priority !== "critical");

  return (
    <div className="mt-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Recommendations
          </p>
          {recommendations.length > 0 && (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
              {recommendations.length} active suggestion
              {recommendations.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw
            size={11}
            className={refreshing ? "animate-spin" : ""}
          />
          {isAgencyAdmin ? "Refresh analysis" : "Refresh"}
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-8 text-center">
          <CheckCircle
            size={24}
            className="text-[var(--success)] mx-auto mb-3"
          />
          <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
            No active recommendations
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)]">
            The platform will surface recommendations here as it analyses
            performance patterns. Check back after leads have been processed.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {critical.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              clientId={clientId}
              onDismiss={handleDismiss}
              onResolve={handleResolve}
            />
          ))}
          {others.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              clientId={clientId}
              onDismiss={handleDismiss}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}
