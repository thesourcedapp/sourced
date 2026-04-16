// app/api/og/catalog/route.tsx

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const W = 1200;
const H = 630;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("image") ?? null;

    // If there's a catalog cover image, just show that — full bleed, no text
    // This is what appears in iMessage, Instagram, WhatsApp previews
    const response = new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            background: "#000",
            position: "relative",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              width={W}
              height={H}
              style={{
                width: W,
                height: H,
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          ) : (
            // No image fallback — just black with SOURCED text
            <div
              style={{
                width: W,
                height: H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
              }}
            >
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: "0.2em",
                  display: "flex",
                }}
              >
                SOURCED
              </div>
            </div>
          )}
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
    return new Response("OG image error", { status: 500 });
  }
}