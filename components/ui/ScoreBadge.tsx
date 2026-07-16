type Props = {
  score: number;
};

function getScoreColors(s: number) {
  if (s >= 70) {
    return {
      bg: "var(--success-muted)",
      border: "var(--success-border)",
      text: "var(--success-fg)",
    };
  }
  if (s >= 40) {
    return {
      bg: "var(--warning-muted)",
      border: "var(--warning-border)",
      text: "var(--warning)",
    };
  }
  return {
    bg: "var(--bg-quaternary)",
    border: "var(--border)",
    text: "var(--text-tertiary)",
  };
}

export function ScoreBadge({ score }: Props) {
  const colors = getScoreColors(score);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 22,
        padding: "0 8px",
        background: colors.bg,
        border: `0.5px solid ${colors.border}`,
        borderRadius: 20,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: colors.text,
        }}
      />
      <span
        style={{
          fontFamily: "var(--ag-font-body)",
          fontSize: 10,
          fontWeight: 700,
          color: colors.text,
          letterSpacing: "0.04em",
        }}
      >
        {score}
      </span>
    </div>
  );
}
