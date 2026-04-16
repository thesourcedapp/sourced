// app/api/og/catalog/route.tsx

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const W = 1200;
const H = 630;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const catalogName = searchParams.get("catalog") ?? "Untitled Catalog";
    const username    = searchParams.get("username") ?? "";
    const itemCount   = parseInt(searchParams.get("items") ?? "0", 10);
    const imageUrl    = searchParams.get("image") ?? null;

    const response = new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            background: "#000",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background image — blurred/dark */}
          {imageUrl && (
            <img
              src={imageUrl}
              width={W}
              height={H}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: H,
                objectFit: "cover",
                opacity: 0.15,
              }}
            />
          )}

          {/* Dark overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              background: "rgba(0,0,0,0.82)",
              display: "flex",
            }}
          />

          {/* Left accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 6,
              height: H,
              background: "#fff",
              display: "flex",
            }}
          />

          {/* Right image card */}
          {imageUrl && (
            <img
              src={imageUrl}
              width={320}
              height={H - 160}
              style={{
                position: "absolute",
                top: 80,
                right: 80,
                width: 320,
                height: H - 160,
                objectFit: "cover",
                border: "1.5px solid rgba(255,255,255,0.15)",
              }}
            />
          )}

          {/* Text content */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 72,
              right: imageUrl ? 460 : 72,
              height: H,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* Wordmark */}
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.4em",
                color: "rgba(255,255,255,0.3)",
                fontWeight: 900,
                marginBottom: 24,
                display: "flex",
              }}
            >
              SOURCED
            </div>

            {/* Catalog name */}
            <div
              style={{
                fontSize: catalogName.length > 22 ? 68 : catalogName.length > 16 ? 80 : 92,
                lineHeight: 0.9,
                color: "#fff",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                marginBottom: 28,
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
                width: 44,
                height: 3,
                background: "#fff",
                marginBottom: 24,
                display: "flex",
              }}
            />

            {/* Username */}
            {username && (
              <div
                style={{
                  fontSize: 17,
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                  display: "flex",
                }}
              >
                @{username}
              </div>
            )}

            {/* Item count */}
            {itemCount > 0 && (
              <div
                style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.35)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  display: "flex",
                }}
              >
                {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
              </div>
            )}

            {/* Domain */}
            <div
              style={{
                marginTop: 32,
                fontSize: 11,
                color: "rgba(255,255,255,0.18)",
                fontWeight: 700,
                letterSpacing: "0.3em",
                display: "flex",
              }}
            >
              THESOURCEDAPP.COM
            </div>
          </div>

          {/* VIEW CATALOG badge */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              left: 72,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "8px 16px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.35em",
                color: "rgba(255,255,255,0.45)",
                fontWeight: 700,
                display: "flex",
              }}
            >
              VIEW CATALOG →
            </div>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
      }
    );

    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response;

  } catch (err) {
    console.error("[og/catalog] error:", err);
    // Return a plain black 1x1 image on error rather than a 500
    return new Response("OG image error", { status: 500 });
  }
}