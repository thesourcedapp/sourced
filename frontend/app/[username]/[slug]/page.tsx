// app/[username]/[slug]/page.tsx
//
// This is a SERVER component — it exports generateMetadata which Next.js App Router
// uses to render <head> tags during SSR. The actual page UI is still the client
// component (CatalogDetailPage) imported below.
//
// The "use client" directive must NOT be in this file.

import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import CatalogDetailPage from "./CatalogDetailPage"; // rename your existing file to this

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thesourcedapp.com";

type Props = {
  params: { username: string; slug: string };
};

// ── generateMetadata runs on the server at request time ──────────────────────
// Facebook/Instagram/iMessage scrapers hit the page URL and read these tags
// from the server-rendered HTML — they never run client-side JS.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fallback: Metadata = {
    title: "Sourced",
    description: "Discover and shop curated fashion catalogs on Sourced.",
  };

  try {
    const username = params.username.replace("@", "");
    const slug     = params.slug;

    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return fallback;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: fetch catalog (no join — avoids any FK hint issues)
    const { data: catalogs, error: catError } = await supabase
      .from("catalogs")
      .select("id, name, description, image_url, owner_id")
      .eq("slug", slug)
      .limit(1);

    if (catError || !catalogs || catalogs.length === 0) return fallback;
    const catalog = catalogs[0];

    // Step 2: fetch owner username separately
    const { data: profiles } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", catalog.owner_id)
      .limit(1);

    const ownerName = profiles?.[0]?.username ?? username;

    // Step 3: item count
    const { count: itemCount } = await supabase
      .from("catalog_items")
      .select("id", { count: "exact", head: true })
      .eq("catalog_id", catalog.id);

    const n       = itemCount ?? 0;
    const title   = catalog.name;
    const desc    = `Curated by @${ownerName} · ${n} item${n !== 1 ? "s" : ""} · Shop on Sourced`;
    const pageUrl = `${BASE_URL}/${ownerName}/${slug}`;
    const ogImage = `${BASE_URL}/api/og/catalog?catalog=${encodeURIComponent(catalog.name)}&username=${encodeURIComponent(ownerName)}&items=${n}${catalog.image_url ? `&image=${encodeURIComponent(catalog.image_url)}` : ""}`;

    return {
      title,
      description: desc,
      openGraph: {
        type:        "website",
        url:         pageUrl,
        siteName:    "Sourced",
        title,
        description: desc,
        images: [
          {
            url:       ogImage,
            secureUrl: ogImage,
            width:     1200,
            height:    630,
            type:      "image/png",
            alt:       `${catalog.name} — curated by @${ownerName} on Sourced`,
          },
        ],
      },
      twitter: {
        card:        "summary_large_image",
        title,
        description: desc,
        images:      [ogImage],
      },
      alternates: {
        canonical: pageUrl,
      },
    };
  } catch (err) {
    console.error("[generateMetadata] error:", err);
    return fallback;
  }
}

// ── Page component — just renders the existing client component ───────────────
export default function Page({ params }: Props) {
  return <CatalogDetailPage />;
}