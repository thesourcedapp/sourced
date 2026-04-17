// app/[username]/[slug]/page.tsx
// SERVER COMPONENT — no "use client" directive
// generateMetadata runs on the server and injects OG tags into the HTML
// before any scraper reads the page. This is the ONLY approach that works
// for Instagram, iMessage, WhatsApp, Snapchat etc.

import type { Metadata } from "next";
import CatalogDetailPage from "./CatalogDetailPage";

// Force dynamic rendering — never serve from cache
// This ensures generateMetadata always runs fresh for every request
// including scrapers from Instagram, iMessage, Facebook etc.
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thesourcedapp.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fallback — never crashes, always returns something valid
  const fallback: Metadata = {
    title: "Sourced",
    description: "Curated fashion catalogs on Sourced.",
    openGraph: {
      images: [`${BASE_URL}/og-default.png`],
    },
  };

  try {
    // Next.js 15: params is a Promise and must be awaited
    const { username, slug } = await params;

    console.log("[OG] slug:", slug);
    console.log("[OG] username:", username);
    console.log("[OG] SUPABASE_URL:", SUPABASE_URL?.slice(0, 30) ?? "MISSING");
    console.log("[OG] SUPABASE_KEY length:", SUPABASE_KEY?.length ?? 0);

    // Use raw fetch against Supabase REST API — no client needed, no imports that can fail
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/catalogs?slug=eq.${encodeURIComponent(slug)}&select=id,name,description,image_url,owner_id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );

    console.log("[OG] catalogs response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[OG] catalogs fetch failed:", res.status, text);
      return fallback;
    }
    const catalogs = await res.json();
    console.log("[OG] catalogs result:", JSON.stringify(catalogs));
    if (!catalogs?.length) return fallback;
    const catalog = catalogs[0];

    // Fetch owner username
    const ownerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${catalog.owner_id}&select=username&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );

    let ownerName = username.replace("@", "");
    if (ownerRes.ok) {
      const owners = await ownerRes.json();
      if (owners?.[0]?.username) ownerName = owners[0].username;
    }

    // Fetch item count
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/catalog_items?catalog_id=eq.${catalog.id}&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "count=exact",
          "Range-Unit": "items",
          Range: "0-0",
        },
        cache: "no-store",
      }
    );

    // Parse count from Content-Range header: "0-0/42"
    const contentRange = countRes.headers.get("content-range") ?? "";
    const n = parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;

    const title = catalog.name;
    const desc = `Curated by @${ownerName} · ${n} item${n !== 1 ? "s" : ""} · Shop on Sourced`;
    const pageUrl = `${BASE_URL}/${ownerName}/${slug}`;

    // OG image — v=2 busts any cached version of the old design
    const ogImage = catalog.image_url
      ? `${BASE_URL}/api/og/catalog?v=2&image=${encodeURIComponent(catalog.image_url)}`
      : `${BASE_URL}/api/og/catalog?v=2`;

    return {
      title,
      openGraph: {
        type: "website",
        url: pageUrl,
        siteName: "Sourced",
        title,
        images: [
          {
            url: ogImage,
            secureUrl: ogImage,
            width: 1200,
            height: 1200,
            type: "image/png",
            alt: catalog.name,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        images: [ogImage],
      },
      alternates: {
        canonical: pageUrl,
      },
    };
  } catch (err) {
    console.error("[generateMetadata] crashed with error:", err);
    console.error("[generateMetadata] error message:", (err as any)?.message);
    return fallback;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  await params;
  return <CatalogDetailPage />;
}