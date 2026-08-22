import { Circle, Line, Path, Rect, Svg } from "@react-pdf/renderer";

const STROKE = 1.75;

export function PdfIcon({
  name,
  color,
  size = 9,
}: {
  name:
    | "user"
    | "home"
    | "sun"
    | "zap"
    | "gauge"
    | "leaf"
    | "pay"
    | "shield"
    | "summary"
    | "phone"
    | "mail"
    | "web"
    | "pin"
    | "panel"
    | "chart";
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "user" ? (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={STROKE} fill="none" />
          <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
      {name === "home" ? (
        <>
          <Path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20Z" stroke={color} strokeWidth={STROKE} fill="none" />
          <Path d="M9 21.5V12h6v9.5" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
      {name === "sun" ? (
        <>
          <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth={STROKE} />
          <Line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth={STROKE} />
          <Line x1="2" y1="12" x2="5" y2="12" stroke={color} strokeWidth={STROKE} />
          <Line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth={STROKE} />
        </>
      ) : null}
      {name === "panel" ? (
        <>
          <Rect x="3" y="6" width="18" height="12" rx="1" stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1="12" y1="6" x2="12" y2="18" stroke={color} strokeWidth={STROKE} />
          <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={STROKE} />
        </>
      ) : null}
      {name === "zap" ? (
        <Path d="M13 2 4 13h7l-1 9 10-12h-7l0-8Z" stroke={color} strokeWidth={STROKE} fill="none" />
      ) : null}
      {name === "gauge" ? (
        <>
          <Path d="M5 19a9 9 0 1 1 14 0" stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1="12" y1="13" x2="16" y2="8" stroke={color} strokeWidth={STROKE} />
        </>
      ) : null}
      {name === "leaf" ? (
        <>
          <Path d="M5 19c8-1 13-8 14-16-8 1-14 7-14 16Z" stroke={color} strokeWidth={STROKE} fill="none" />
          <Path d="M8 12c2 2 4 4 7 5" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
      {name === "chart" ? (
        <>
          <Line x1="4" y1="20" x2="20" y2="20" stroke={color} strokeWidth={STROKE} />
          <Rect x="5" y="13" width="3.5" height="7" stroke={color} strokeWidth={STROKE} fill="none" />
          <Rect x="10.25" y="9" width="3.5" height="11" stroke={color} strokeWidth={STROKE} fill="none" />
          <Rect x="15.5" y="5" width="3.5" height="15" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
      {name === "pay" ? (
        <>
          <Rect x="3" y="6" width="18" height="13" rx="1.5" stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={STROKE} />
        </>
      ) : null}
      {name === "shield" ? (
        <Path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" stroke={color} strokeWidth={STROKE} fill="none" />
      ) : null}
      {name === "summary" ? (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="1.5" stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1="8" y1="9" x2="16" y2="9" stroke={color} strokeWidth={STROKE} />
          <Line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth={STROKE} />
        </>
      ) : null}
      {name === "phone" ? (
        <Path d="M7 3h4l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v4c-8 1-14-5-14-14Z" stroke={color} strokeWidth={STROKE} fill="none" />
      ) : null}
      {name === "mail" ? (
        <>
          <Rect x="3" y="6" width="18" height="13" rx="1.5" stroke={color} strokeWidth={STROKE} fill="none" />
          <Path d="M3 8l9 6 9-6" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
      {name === "web" ? (
        <>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={STROKE} />
          <Path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
      {name === "pin" ? (
        <>
          <Path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" stroke={color} strokeWidth={STROKE} fill="none" />
          <Circle cx="12" cy="10" r="2" stroke={color} strokeWidth={STROKE} fill="none" />
        </>
      ) : null}
    </Svg>
  );
}
