import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OLPDF — Word for PDFs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0a0a0c",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* ── Ambient glows ─────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            top: -280,
            left: -100,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            right: 200,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)",
          }}
        />

        {/* ── Dot grid ──────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* ── Left pane — content ───────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
            flex: 1,
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Fox icon placeholder circle */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "rgba(249,115,22,0.15)",
                border: "1px solid rgba(249,115,22,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#f97316",
                }}
              />
            </div>
            {/* OL + PDF badge */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: -1,
                }}
              >
                OL
              </span>
              <div
                style={{
                  background: "#e21818",
                  borderRadius: 8,
                  padding: "2px 10px",
                  display: "flex",
                  alignItems: "baseline",
                  marginLeft: 3,
                }}
              >
                <span style={{ fontSize: 26, fontWeight: 900, color: "white" }}>
                  PDF
                </span>
              </div>
            </div>
          </div>

          {/* Hero text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <span
              style={{
                fontSize: 96,
                fontWeight: 900,
                color: "white",
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              Word for
            </span>
            <span
              style={{
                fontSize: 96,
                fontWeight: 900,
                color: "#f97316",
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              PDFs.
            </span>
            <span
              style={{
                fontSize: 20,
                color: "#6b7280",
                marginTop: 20,
                lineHeight: 1.55,
                maxWidth: 480,
              }}
            >
              Free AI-powered PDF editor. Edit scanned documents, rewrite
              content with AI, export to PDF/A or EPUB3.
            </span>
          </div>

          {/* Tag pills */}
          <div style={{ display: "flex", gap: 10 }}>
            {["Open Source", "AI-Powered", "Zero Uploads"].map((tag) => (
              <div
                key={tag}
                style={{
                  border: "1px solid rgba(249,115,22,0.35)",
                  borderRadius: 100,
                  padding: "7px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f97316",
                  background: "rgba(249,115,22,0.06)",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right pane — editor mockup ────────────────────────────── */}
        <div
          style={{
            width: 360,
            margin: "48px 52px 48px 0",
            background: "#111113",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Editor chrome */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "14px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "#0e0e10",
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#ff5f57",
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#febc2e",
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#28c840",
              }}
            />
            <div
              style={{
                marginLeft: 10,
                fontSize: 11,
                color: "#374151",
                fontWeight: 700,
              }}
            >
              document.pdf
            </div>
          </div>

          {/* Editor body */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "20px 18px",
              flex: 1,
            }}
          >
            {/* Heading block */}
            <div
              style={{
                background: "#1a1a1d",
                borderRadius: 6,
                height: 22,
                width: "75%",
              }}
            />

            {/* Paragraph lines */}
            {["100%", "92%", "88%"].map((w, i) => (
              <div
                key={i}
                style={{
                  background: "#1a1a1d",
                  borderRadius: 5,
                  height: 13,
                  width: w,
                }}
              />
            ))}

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.05)",
                margin: "4px 0",
              }}
            />

            {/* AI-highlighted block */}
            <div
              style={{
                background: "rgba(249,115,22,0.09)",
                border: "1px solid rgba(249,115,22,0.28)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  background: "rgba(249,115,22,0.45)",
                  borderRadius: 4,
                  height: 13,
                  width: "65%",
                }}
              />
              <div
                style={{
                  background: "rgba(249,115,22,0.22)",
                  borderRadius: 4,
                  height: 11,
                  width: "100%",
                }}
              />
              <div
                style={{
                  background: "rgba(249,115,22,0.22)",
                  borderRadius: 4,
                  height: 11,
                  width: "82%",
                }}
              />
            </div>

            {/* More lines */}
            {["78%", "95%", "70%"].map((w, i) => (
              <div
                key={i}
                style={{
                  background: "#1a1a1d",
                  borderRadius: 5,
                  height: 13,
                  width: w,
                }}
              />
            ))}

            {/* AI status badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: "auto",
                padding: "9px 12px",
                background: "rgba(249,115,22,0.07)",
                borderRadius: 8,
                border: "1px solid rgba(249,115,22,0.2)",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#f97316",
                }}
              />
              <span
                style={{ fontSize: 12, color: "#f97316", fontWeight: 700 }}
              >
                AI rewriting block...
              </span>
            </div>
          </div>

          {/* Orange accent bar at bottom */}
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, #f97316 0%, rgba(249,115,22,0.2) 100%)",
            }}
          />
        </div>

        {/* ── Domain stamp ──────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: 64,
            fontSize: 15,
            color: "#374151",
            fontWeight: 600,
            zIndex: 10,
          }}
        >
          olpdf.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}
