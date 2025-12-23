"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type SearchCatalogResult = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  item_count: number;
  bookmark_count: number;
  is_bookmarked?: boolean;
};

export default function CatalogsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchCatalogResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId !== null && !searchParams.get("q")) {
      loadPopularCatalogs();
    }
  }, [currentUserId]);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) {
      setSearchQuery(query);
      searchCatalogs(query);
    }
  }, [searchParams]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadPopularCatalogs() {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .select(`
          id,
          name,
          description,
          image_url,
          bookmark_count,
          profiles!inner(username, full_name, avatar_url),
          catalog_items(count)
        `)
        .eq("visibility", "public")
        .order("bookmark_count", { ascending: false })
        .limit(20);

      if (error) throw error;

      let bookmarked = new Set<string>();
      if (currentUserId) {
        const { data } = await supabase
          .from("bookmarked_catalogs")
          .select("catalog_id")
          .eq("user_id", currentUserId);

        if (data) bookmarked = new Set(data.map(b => b.catalog_id));
      }

      setSearchResults(
        (data ?? []).map(catalog => ({
          id: catalog.id,
          name: catalog.name,
          description: catalog.description,
          image_url: catalog.image_url,
          username: catalog.profiles?.[0]?.username ?? "",
          full_name: catalog.profiles?.[0]?.full_name ?? null,
          avatar_url: catalog.profiles?.[0]?.avatar_url ?? null,
          item_count: catalog.catalog_items?.[0]?.count ?? 0,
          bookmark_count: catalog.bookmark_count ?? 0,
          is_bookmarked: bookmarked.has(catalog.id),
        }))
      );
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function searchCatalogs(query: string) {
    if (!query.trim()) {
      router.push("/catalogs", { scroll: false });
      loadPopularCatalogs();
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .select(`
          id,
          name,
          description,
          image_url,
          bookmark_count,
          profiles!inner(username, full_name, avatar_url),
          catalog_items(count)
        `)
        .ilike("name", `%${query}%`)
        .eq("visibility", "public")
        .limit(20);

      if (error) throw error;

      setSearchResults(
        (data ?? []).map(catalog => ({
          id: catalog.id,
          name: catalog.name,
          description: catalog.description,
          image_url: catalog.image_url,
          username: catalog.profiles?.[0]?.username ?? "",
          full_name: catalog.profiles?.[0]?.full_name ?? null,
          avatar_url: catalog.profiles?.[0]?.avatar_url ?? null,
          item_count: catalog.catalog_items?.[0]?.count ?? 0,
          bookmark_count: catalog.bookmark_count ?? 0,
        }))
      );
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = searchQuery.trim();
      router.push(q ? `/catalogs?q=${encodeURIComponent(q)}` : "/catalogs", { scroll: false });
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* UI unchanged */}
      {/* EVERYTHING BELOW STAYS EXACTLY AS YOU HAD IT */}
    </div>
  );
}
