type Props = {
  score: number;
};

function getScoreColors(s: number) {
  if (s >= 70)
    return {
      bg: "rgba(61,214,140,0.1)",
      border: "rgba(61,214,140,0.25)",
      text: "#3dd68c",
    };
  if (s >= 40)
    return {
      bg: "rgba(245,166,35,0.1)",
      border: "rgba(245,166,35,0.25)",
      text: "#f5a623",
    };
  return {
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.1)",
    text: "#71717a",
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
