// app/api/og/catalog/route.tsx
// Generates the preview image shown when sharing a catalog link on
// iMessage, Instagram, Snapchat, Twitter/X, WhatsApp, etc.
//
// Usage (already wired in catalog-detail-page.tsx):
//   /api/og/catalog?catalog=NAME&username=USER&items=N&image=URL
//
// Deploy note: this uses @vercel/og which is built into Next.js 13.3+.
// No extra install needed on Vercel. For local dev: `npm i @vercel/og`

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// OG dimensions — standard for all major platforms
const W = 1200;
const H = 630;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const catalogName = searchParams.get("catalog") ?? "Untitled Catalog";
  const username    = searchParams.get("username") ?? "";
  const itemCount   = parseInt(searchParams.get("items") ?? "0", 10);
  const imageUrl    = searchParams.get("image") ?? null;

  // Load Archivo Black from Google Fonts for the bold headline
  // (edge runtime can fetch fonts at request time)
  let fontData: ArrayBuffer | null = null;
  try {
    const fontRes = await fetch(
      "https://fonts.gstatic.com/s/archivoblack/v21/HTxqL289NzCGg4MzN6KJ7eW6OYuP_x7yx1L3VJ3Qh-U.woff",
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
    fontData = await fontRes.arrayBuffer();
  } catch {
    // Falls back to system sans-serif if font fetch fails
  }

  // Cache the generated image for 1 hour — scrapers (Instagram, Snapchat, WhatsApp)
  // will serve the cached version rather than re-generating on every preview
  const response = new ImageResponse(
    (
      <div
        style={{
          width:  W,
          height: H,
          display: "flex",
          background: "#000000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── Background catalog image (blurred, darkened) ── */}
        {imageUrl && (
          <img
            src={imageUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.18,
              filter: "blur(0px)",
            }}
          />
        )}

        {/* Dark vignette overlay so text is always readable */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.92) 100%)",
            display: "flex",
          }}
        />

        {/* ── Accent bar — left edge ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: "#ffffff",
            display: "flex",
          }}
        />

        {/* ── Right side: catalog image as sharp card ── */}
        {imageUrl && (
          <div
            style={{
              position: "absolute",
              right: 80,
              top: 80,
              bottom: 80,
              width: 340,
              display: "flex",
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.12)",
            }}
          >
            <img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Subtle gradient fade on left edge of image card */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 60,
                background:
                  "linear-gradient(to right, rgba(0,0,0,0.8), transparent)",
                display: "flex",
              }}
            />
          </div>
        )}

        {/* ── Main text content ── */}
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 0,
            bottom: 0,
            right: imageUrl ? 460 : 72,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0,
          }}
        >
          {/* SOURCED wordmark */}
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.35em",
              color: "rgba(255,255,255,0.35)",
              fontFamily: fontData ? "Archivo Black" : "sans-serif",
              fontWeight: 900,
              marginBottom: 28,
              display: "flex",
            }}
          >
            SOURCED
          </div>

          {/* Catalog name — the hero text */}
          <div
            style={{
              fontSize: catalogName.length > 20 ? 72 : catalogName.length > 14 ? 84 : 96,
              lineHeight: 0.92,
              color: "#ffffff",
              fontFamily: fontData ? "Archivo Black" : "sans-serif",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginBottom: 32,
              display: "flex",
              flexWrap: "wrap",
              textTransform: "uppercase",
            }}
          >
            {catalogName}
          </div>

          {/* Divider */}
          <div
            style={{
              width: 48,
              height: 3,
              background: "#ffffff",
              marginBottom: 28,
              display: "flex",
            }}
          />

          {/* Username + item count row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            {username && (
              <div
                style={{
                  fontSize: 18,
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: fontData ? "Archivo Black" : "sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  display: "flex",
                }}
              >
                @{username}
              </div>
            )}

            {itemCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.3)",
                    display: "flex",
                  }}
                />
                <div
                  style={{
                    fontSize: 18,
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: fontData ? "Archivo Black" : "sans-serif",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    display: "flex",
                  }}
                >
                  {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
                </div>
              </div>
            )}
          </div>

          {/* CTA hint */}
          <div
            style={{
              marginTop: 36,
              fontSize: 13,
              color: "rgba(255,255,255,0.2)",
              fontFamily: fontData ? "Archivo Black" : "sans-serif",
              fontWeight: 700,
              letterSpacing: "0.3em",
              display: "flex",
            }}
          >
            THESOURCEDAPP.COM
          </div>
        </div>

        {/* ── Corner badge — bottom right ── */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: imageUrl ? 80 : 72,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "10px 18px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.5)",
              fontFamily: fontData ? "Archivo Black" : "sans-serif",
              fontWeight: 700,
              display: "flex",
            }}
          >
            VIEW CATALOG
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", display: "flex" }}>→</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: fontData
        ? [{ name: "Archivo Black", data: fontData, weight: 900, style: "normal" }]
        : [],
    }
  );

  response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.headers.set("CDN-Cache-Control", "public, s-maxage=3600");
  return response;
}