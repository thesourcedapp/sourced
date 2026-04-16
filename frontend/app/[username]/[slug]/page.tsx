// app/[username]/[slug]/page.tsx
// SERVER COMPONENT — no "use client" directive
// generateMetadata runs on the server and injects OG tags into the HTML
// before any scraper reads the page. This is the ONLY approach that works
// for Instagram, iMessage, WhatsApp, Snapchat etc.

import type { Metadata } from "next";
import CatalogDetailPage from "./CatalogDetailPage";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thesourcedapp.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Props = {
  params: { username: string; slug: string };
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
    const slug = params.slug;

    // Use raw fetch against Supabase REST API — no client needed, no imports that can fail
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/catalogs?slug=eq.${encodeURIComponent(slug)}&select=id,name,description,image_url,owner_id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        // Don't cache — always get fresh data
        cache: "no-store",
      }
    );

    if (!res.ok) return fallback;
    const catalogs = await res.json();
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

    let ownerName = params.username.replace("@", "");
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

    // Absolute OG image URL — must be absolute for all scrapers
    const ogImage = catalog.image_url
      ? `${BASE_URL}/api/og/catalog?catalog=${encodeURIComponent(catalog.name)}&username=${encodeURIComponent(ownerName)}&items=${n}&image=${encodeURIComponent(catalog.image_url)}`
      : `${BASE_URL}/api/og/catalog?catalog=${encodeURIComponent(catalog.name)}&username=${encodeURIComponent(ownerName)}&items=${n}`;

    return {
      title,
      description: desc,
      openGraph: {
        type: "website",
        url: pageUrl,
        siteName: "Sourced",
        title,
        description: desc,
        images: [
          {
            url: ogImage,
            secureUrl: ogImage,
            width: 1200,
            height: 630,
            type: "image/png",
            alt: `${catalog.name} — curated by @${ownerName} on Sourced`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        images: [ogImage],
      },
      alternates: {
        canonical: pageUrl,
      },
    };
  } catch (err) {
    console.error("[generateMetadata] failed:", err);
    return fallback;
  }
}

export default function Page() {
  return <CatalogDetailPage />;
}