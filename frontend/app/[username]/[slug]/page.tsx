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
  const username = params.username.replace("@", "");
  const slug     = params.slug;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch just what we need for the OG tags
  const { data: catalog } = await supabase
    .from("catalogs")
    .select(`
      id, name, description, image_url,
      profiles!catalogs_owner_id_fkey(username)
    `)
    .eq("slug", slug)
    .single();

  if (!catalog) {
    return {
      title: "Catalog Not Found | Sourced",
      description: "This catalog doesn't exist or has been removed.",
    };
  }

  const owner      = Array.isArray(catalog.profiles) ? catalog.profiles[0] : catalog.profiles;
  const ownerName  = (owner as any)?.username ?? username;

  // Count items
  const { count: itemCount } = await supabase
    .from("catalog_items")
    .select("id", { count: "exact", head: true })
    .eq("catalog_id", catalog.id);

  const n       = itemCount ?? 0;
  const title   = catalog.name;
  const desc    = `Curated by @${ownerName} · ${n} item${n !== 1 ? "s" : ""} · Shop on Sourced`;
  const pageUrl = `${BASE_URL}/${ownerName}/${slug}`;

  // Absolute OG image URL — scrapers need this, relative paths don't work
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
          url:    ogImage,
          secureUrl: ogImage,
          width:  1200,
          height: 630,
          type:   "image/png",
          alt:    `${catalog.name} — curated by @${ownerName} on Sourced`,
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
}

// ── Page component — just renders the existing client component ───────────────
export default function Page({ params }: Props) {
  return <CatalogDetailPage />;
}