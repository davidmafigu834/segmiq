import {
  FIELD_APP_DOWNLOAD_PATH,
  FIELD_APP_FILENAME,
  FIELD_APP_NAME,
  FIELD_APP_VERSION,
} from "@/lib/cloud/field-app";

/** Server-rendered so the download CTA appears in HTML without waiting on client JS. */
export function FieldAppDownloadBar() {
  return (
    <div
      data-field-app-download
      style={{
        margin: "0 20px",
        paddingTop: 16,
        paddingBottom: 4,
        maxWidth: 960,
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          borderRadius: 20,
          background: "#1C1410",
          border: "0.5px solid rgba(255,255,255,0.08)",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(212,255,79,0.15)",
              border: "0.5px solid rgba(212,255,79,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 22,
            }}
            aria-hidden
          >
            📱
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 16,
                color: "#FFFFFF",
                margin: "0 0 3px",
                lineHeight: 1.2,
              }}
            >
              {FIELD_APP_NAME}
            </p>
            <p
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                margin: 0,
              }}
            >
              Download for Android · v{FIELD_APP_VERSION}
            </p>
          </div>
        </div>
        <a
          href={FIELD_APP_DOWNLOAD_PATH}
          download={FIELD_APP_FILENAME}
          style={{
            height: 44,
            padding: "0 16px",
            borderRadius: 12,
            background: "#D4FF4F",
            color: "#1C1410",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textDecoration: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          Download Android app
        </a>
      </div>
    </div>
  );
}
