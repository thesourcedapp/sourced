// app/api/og/profile/route.tsx

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("image") ?? null;
    const SIZE = 1200;

    const response = new ImageResponse(
      (
        <div style={{ width: SIZE, height: SIZE, display: "flex", background: "#000" }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              width={SIZE}
              height={SIZE}
              style={{ width: SIZE, height: SIZE, objectFit: "cover", objectPosition: "center" }}
            />
          ) : (
            <div style={{ width: SIZE, height: SIZE, display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
              <div style={{ fontSize: 80, fontWeight: 900, color: "#fff", letterSpacing: "0.2em", display: "flex" }}>
                SOURCED
              </div>
            </div>
          )}
        </div>
      ),
      { width: SIZE, height: SIZE }
    );

    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response;
  } catch (err) {
    console.error("[og/profile] error:", err);
    return new Response("OG image error", { status: 500 });
  }
}