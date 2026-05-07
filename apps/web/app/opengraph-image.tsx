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
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "linear-gradient(135deg, #1a1008 0%, #2c1a0e 50%, #1a1008 100%)",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            left: "50%",
            width: "800px",
            height: "800px",
            background: "radial-gradient(circle, rgba(255,120,0,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            transform: "translateX(-50%)",
          }}
        />

        {/* OL + PDF badge */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "24px" }}>
          <span style={{ fontSize: "96px", fontWeight: 900, color: "#f97316" }}>O</span>
          <span style={{ fontSize: "96px", fontWeight: 300, fontStyle: "italic", color: "#ffedd5", marginLeft: "-8px" }}>L</span>
          <div
            style={{
              background: "#e21818",
              borderRadius: "20px",
              padding: "4px 20px",
              display: "flex",
              alignItems: "baseline",
              gap: "2px",
              marginLeft: "4px",
            }}
          >
            <span style={{ fontSize: "80px", fontWeight: 700, color: "white", opacity: 0.9 }}>P</span>
            <span style={{ fontSize: "80px", fontWeight: 900, color: "white" }}>D</span>
            <span style={{ fontSize: "80px", fontWeight: 100, fontStyle: "italic", color: "white" }}>F</span>
          </div>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 700,
              fontStyle: "italic",
              color: "#4285f4",
              border: "3px solid #4285f4",
              borderRadius: "12px",
              padding: "2px 20px",
            }}
          >
            Word
          </span>
          <span style={{ fontSize: "48px", fontStyle: "italic", color: "#e2e8f0" }}>for</span>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 900,
              color: "#e21818",
              border: "3px solid #e21818",
              borderRadius: "12px",
              padding: "2px 20px",
            }}
          >
            PDFs.
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: "22px",
            color: "#94a3b8",
            margin: 0,
            maxWidth: "700px",
            lineHeight: 1.5,
          }}
        >
          Free AI-powered PDF editor. Reconstruct semantic layouts from raw coordinates and edit like a Word document.
        </p>

        {/* Bottom domain */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            right: "80px",
            fontSize: "20px",
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          olpdf.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}
