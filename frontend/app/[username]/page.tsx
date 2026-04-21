// app/[username]/page.tsx
// SERVER COMPONENT — no "use client" directive
// generateMetadata injects OG tags server-side so scrapers see them

import type { Metadata } from "next";
import ProfilePage from "./ProfilePage";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thesourcedapp.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fallback: Metadata = {
    title: "Sourced",
    description: "Discover fashion catalogs on Sourced.",
  };

  try {
    const { username } = await params;
    const clean = username.replace("@", "");

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(clean)}&select=id,username,avatar_url,bio&limit=1`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: "no-store",
      }
    );

    if (!res.ok) return fallback;
    const profiles = await res.json();
    if (!profiles?.length) return fallback;
    const profile = profiles[0];

    const title = `@${profile.username} · Sourced`;
    const pageUrl = `${BASE_URL}/${profile.username}`;

    // OG image — just the avatar, full bleed square
    const ogImage = profile.avatar_url
      ? `${BASE_URL}/api/og/profile?v=1&image=${encodeURIComponent(profile.avatar_url)}`
      : `${BASE_URL}/api/og/profile?v=1`;

    return {
      title,
      openGraph: {
        type: "profile",
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
            alt: `@${profile.username} on Sourced`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        images: [ogImage],
      },
      alternates: { canonical: pageUrl },
    };
  } catch (err) {
    console.error("[generateMetadata profile] failed:", err);
    return fallback;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await params;
  return <ProfilePage />;
}