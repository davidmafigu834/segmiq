import { Flame, Snowflake, Thermometer } from "lucide-react";
import { scoreIntentStyles, scoreIntentTitle } from "@/lib/inbox/scoring";

type Variant = "list" | "header" | "default" | "dot";

type Props = {
  score: number;
  label: "Hot" | "Warm" | "Cold";
  variant?: Variant;
  showScore?: boolean;
  className?: string;
};

function IntentIcon({ label, size = 10 }: { label: Props["label"]; size?: number }) {
  if (label === "Hot") return <Flame size={size} className="shrink-0" />;
  if (label === "Warm") return <Thermometer size={size} className="shrink-0" />;
  return <Snowflake size={size} className="shrink-0" />;
}

export function LeadIntentBadge({
  score,
  label,
  variant = "list",
  showScore = false,
  className = "",
}: Props) {
  const title = scoreIntentTitle(label, score);

  if (variant === "dot") {
    const style = scoreIntentStyles(label, "list");
    return (
      <span
        title={title}
        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${className}`}
        style={{ background: style.dot }}
      />
    );
  }

  const styleVariant = variant === "header" ? "header" : variant === "default" ? "default" : "list";
  const style = scoreIntentStyles(label, styleVariant);

  return (
    <span
      title={title}
      className={`inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${className}`}
      style={{ background: style.bg, color: style.text, borderColor: style.border }}
    >
      <IntentIcon label={label} />
      <span className="truncate">{label}</span>
      {showScore ? <span className="opacity-80">· {score}</span> : null}
    </span>
  );
}
