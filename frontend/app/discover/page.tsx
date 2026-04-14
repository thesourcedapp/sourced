"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscoverMode = "trending" | "new" | "following";

type GridItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  is_liked: boolean;
  is_monetized: boolean;
  brand?: string;
  style_tags?: string[];
  created_at: string;
  // catalog_item fields
  catalog_id?: string;
  catalog_name?: string;
  catalog_slug?: string;
  owner_username?: string;
  // feed_post fields
  feed_post_id?: string;
  // discriminator
  type: "catalog_item" | "feed_post";
};

type SpotlightCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bookmark_count: number;
  is_bookmarked: boolean;
  item_count: number;
  slug: string;
  owner_username: string;
  owner_avatar: string | null;
};

type RecommendedProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  is_following: boolean;
  is_verified: boolean;
};

type SearchResult = {
  items: GridItem[];
  catalogs: SpotlightCatalog[];
  profiles: RecommendedProfile[];
};

// ─── Module-level scroll cache (persists across Next.js soft navigations) ─────
const cache = {
  scrollY: 0,
  mode: "trending" as DiscoverMode,
  category: "all",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Safe number coerce — Supabase sometimes returns bigint columns as strings
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

// ─── ProfileChip (for follow recommendations) ────────────────────────────────

function ProfileChip({
  profile,
  currentUserId,
  isOnboarded,
  onFollow,
  onNavigate,
}: {
  profile: RecommendedProfile;
  currentUserId: string | null;
  isOnboarded: boolean;
  onFollow: (id: string, following: boolean) => void;
  onNavigate: (username: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 border border-black/10 hover:border-black/30 transition-all cursor-pointer bg-white min-w-[200px]"
      style={{ borderRadius: "50px" }}
      onClick={() => onNavigate(profile.username)}
    >
      <div className="w-9 h-9 rounded-full border border-black/20 overflow-hidden flex-shrink-0">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-black/5 flex items-center justify-center text-xs opacity-30">👤</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black tracking-tight truncate" style={{ fontFamily: "Archivo Black, sans-serif" }}>
          @{profile.username}
        </p>
        <p className="text-[9px] opacity-40 tracking-wider" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
          {num(profile.follower_count).toLocaleString()} FOLLOWERS
        </p>
      </div>
      {currentUserId && currentUserId !== profile.id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOnboarded) return;
            onFollow(profile.id, profile.is_following);
          }}
          className={`flex-shrink-0 px-2.5 py-1 text-[9px] tracking-wider font-black border transition-all ${
            profile.is_following
              ? "bg-black text-white border-black"
              : "border-black/30 hover:border-black hover:bg-black/5"
          }`}
          style={{ fontFamily: "Bebas Neue, sans-serif", borderRadius: "50px" }}
        >
          {profile.is_following ? "FOLLOWING" : "FOLLOW"}
        </button>
      )}
    </div>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onLike,
  onExpand,
  onClick,
}: {
  item: GridItem;
  onLike: (id: string, liked: boolean) => void;
  onExpand: (item: GridItem) => void;
  onClick: (item: GridItem) => void;
}) {
  const isFeed = item.type === "feed_post";
  return (
    <div className="group border border-black/10 hover:border-black transition-all duration-150 bg-white">
      <div
        className="aspect-square bg-black/5 overflow-hidden cursor-pointer relative"
        onClick={() => onClick(item)}
      >
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
        />
        {item.is_monetized && (
          <div
            className="absolute top-2 right-2 w-5 h-5 bg-black/25 backdrop-blur-sm flex items-center justify-center"
            title="Affiliate — creator earns commission"
          >
            <span className="text-[9px] font-black text-white" style={{ fontFamily: "Bebas Neue, sans-serif" }}>$</span>
          </div>
        )}
        {isFeed && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/40 backdrop-blur-sm">
            <span className="text-[8px] tracking-[0.15em] text-white font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>POST</span>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-black/10">
        <p className="text-[11px] font-black tracking-wide uppercase leading-tight truncate mb-1.5" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
          {item.title}
        </p>
        <div className="flex items-center justify-between text-[9px] tracking-wider opacity-40 mb-2">
          {item.seller && <span className="truncate mr-2">{item.seller}</span>}
          {item.price && <span className="flex-shrink-0 font-black">${item.price}</span>}
        </div>
        {item.brand && (
          <p className="text-[9px] tracking-wider opacity-25 mb-2 uppercase truncate">{item.brand}</p>
        )}
        <div className="flex gap-1.5">
          {!isFeed ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onLike(item.id, item.is_liked); }}
                className={`flex-1 py-1.5 border text-[9px] tracking-wider font-black transition-all ${
                  item.is_liked ? "bg-black text-white border-black" : "border-black/20 hover:border-black hover:bg-black/5"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                {item.is_liked ? `♥ ${item.like_count}` : `♡ ${item.like_count}`}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onExpand(item); }}
                className="px-3 py-1.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-[9px] font-black tracking-wider"
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                VIEW
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onClick(item); }}
              className="flex-1 py-1.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-[9px] font-black tracking-wider"
              style={{ fontFamily: "Bebas Neue, sans-serif" }}
            >
              VIEW POST ↗
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CatalogSpotlightCard ─────────────────────────────────────────────────────

function CatalogSpotlight({
  catalog,
  onBookmark,
  onNavigate,
}: {
  catalog: SpotlightCatalog;
  onBookmark: (id: string, currently: boolean) => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <div
      className="col-span-2 border border-black/10 hover:border-black transition-all cursor-pointer flex overflow-hidden bg-white group"
      onClick={() => onNavigate(`/${catalog.owner_username}/${catalog.slug}`)}
    >
      <div className="w-28 md:w-44 flex-shrink-0 bg-black/5 overflow-hidden">
        {catalog.image_url ? (
          <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-10">✦</span>
          </div>
        )}
      </div>
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div>
          <p className="text-[9px] tracking-[0.3em] opacity-30 mb-0.5 font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CATALOG SPOTLIGHT</p>
          <h3 className="text-base md:text-xl font-black tracking-tighter leading-tight mb-1" style={{ fontFamily: "Archivo Black, sans-serif" }}>
            {catalog.name}
          </h3>
          {catalog.description && (
            <p className="text-[10px] opacity-40 line-clamp-2 mb-2">{catalog.description}</p>
          )}
          <button
            className="flex items-center gap-1.5 hover:opacity-60 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onNavigate(`/${catalog.owner_username}`); }}
          >
            <div className="w-4 h-4 rounded-full border border-black/30 overflow-hidden">
              {catalog.owner_avatar ? (
                <img src={catalog.owner_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-black/5" />
              )}
            </div>
            <span className="text-[9px] tracking-wider opacity-50" style={{ fontFamily: "Bebas Neue, sans-serif" }}>@{catalog.owner_username}</span>
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-3 text-[9px] tracking-wider opacity-40" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
            <span>{catalog.item_count} ITEMS</span>
            <span>{catalog.bookmark_count} SAVES</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onBookmark(catalog.id, catalog.is_bookmarked); }}
            className={`px-2.5 py-1 border text-[9px] tracking-wider font-black transition-all ${
              catalog.is_bookmarked ? "bg-black text-white border-black" : "border-black/20 hover:border-black"
            }`}
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            {catalog.is_bookmarked ? "🔖 SAVED" : "SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExpandedItemModal ────────────────────────────────────────────────────────

function ItemModal({
  item,
  onClose,
  onLike,
  onNavigate,
  currentUserId,
  isOnboarded,
  onRequireLogin,
}: {
  item: GridItem;
  onClose: () => void;
  onLike: (id: string, liked: boolean) => void;
  onNavigate: (path: string) => void;
  currentUserId: string | null;
  isOnboarded: boolean;
  onRequireLogin: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", h);
    };
  }, [onClose]);

  function handleLike() {
    if (!currentUserId || !isOnboarded) { onRequireLogin(); return; }
    onLike(item.id, item.is_liked);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full md:max-w-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors text-xs font-black"
          style={{ fontFamily: "Bebas Neue, sans-serif" }}
        >
          ✕
        </button>
        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="w-full md:w-64 aspect-square flex-shrink-0 bg-black/5">
            <img src={item.image_url} alt={item.title} className="w-full h-full object-contain" />
          </div>
          {/* Info */}
          <div className="flex-1 p-5 flex flex-col justify-between min-h-0">
            <div className="space-y-2 mb-4">
              <div>
                <h2 className="text-lg md:text-2xl font-black tracking-tighter leading-tight" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                  {item.title}
                </h2>
                {item.is_monetized && (
                  <p className="text-[8px] tracking-[0.3em] opacity-30 mt-0.5" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                    $ AFFILIATED — CREATOR EARNS COMMISSION
                  </p>
                )}
              </div>
              {item.brand && <p className="text-[10px] tracking-wider opacity-50 uppercase">Brand: {item.brand}</p>}
              {item.seller && <p className="text-[10px] tracking-wider opacity-50 uppercase">Seller: {item.seller}</p>}
              {item.price && (
                <p className="text-xl font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>${item.price}</p>
              )}
              {item.style_tags && item.style_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.style_tags.slice(0, 5).map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-black/5 text-[8px] tracking-wider border border-black/10" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <button
                onClick={handleLike}
                className={`w-full py-2.5 border-2 text-[10px] tracking-[0.3em] font-black transition-all ${
                  item.is_liked ? "bg-black text-white border-black" : "border-black hover:bg-black hover:text-white"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                {item.is_liked ? "♥ LIKED" : "♡ LIKE"} ({item.like_count})
              </button>
              {item.product_url && (
                <button
                  onClick={() => {
                    try { fetch("/api/track-click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, itemType: "catalog", userId: currentUserId }) }); } catch {}
                    window.open(item.product_url!, "_blank");
                  }}
                  className="w-full py-2.5 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-[10px] tracking-[0.3em] font-black"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  VIEW PRODUCT ↗
                </button>
              )}
              {item.catalog_slug && item.owner_username && (
                <button
                  onClick={() => { onClose(); onNavigate(`/${item.owner_username}/${item.catalog_slug}`); }}
                  className="w-full py-2 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-[9px] tracking-[0.3em] font-black"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  IN: {item.catalog_name}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SearchOverlay ────────────────────────────────────────────────────────────

function SearchOverlay({
  onClose,
  currentUserId,
  onNavigate,
}: {
  onClose: () => void;
  currentUserId: string | null;
  onNavigate: (path: string) => void;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult>({ items: [], catalogs: [], profiles: [] });
  const [expandedItem, setExpandedItem] = useState<GridItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { if (expandedItem) setExpandedItem(null); else onClose(); } };
    window.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", h); };
  }, [onClose, expandedItem]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults({ items: [], catalogs: [], profiles: [] }); return; }
    timer.current = setTimeout(() => search(q.trim()), 300);
  }, [q]);

  async function search(query: string) {
    setSearching(true);
    try {
      // Fire all queries in parallel — completely independent, no joins that can conflict
      const [itemsRes, catalogsRes, profilesByUser, profilesByName] = await Promise.all([

        // ── Items: simple text search on own columns, then soft-join catalog data ──
        supabase
          .from("catalog_items")
          .select("id,title,image_url,product_url,price,seller,like_count,is_monetized,brand,style_tags,created_at,catalog_id")
          .or(`title.ilike.%${query}%,brand.ilike.%${query}%,seller.ilike.%${query}%,category.ilike.%${query}%`)
          .limit(24),

        // ── Catalogs ──────────────────────────────────────────────────────────
        supabase
          .from("catalogs")
          .select("id,name,description,image_url,bookmark_count,slug,owner_id,profiles!catalogs_owner_id_fkey(username,avatar_url)")
          .eq("visibility", "public")
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(6),

        // ── Profiles: by username (always safe) ───────────────────────────────
        supabase
          .from("profiles")
          .select("id,username,full_name,avatar_url,follower_count,is_onboarded,is_verified")
          .eq("is_onboarded", true)
          .ilike("username", `%${query}%`)
          .order("follower_count", { ascending: false })
          .limit(8),

        // ── Profiles: by full_name (guard null first) ─────────────────────────
        supabase
          .from("profiles")
          .select("id,username,full_name,avatar_url,follower_count,is_onboarded,is_verified")
          .eq("is_onboarded", true)
          .not("full_name", "is", null)
          .ilike("full_name", `%${query}%`)
          .order("follower_count", { ascending: false })
          .limit(8),
      ]);

      // Enrich catalog items: fetch catalog name/slug/owner for the catalog_ids we got
      const catalogIds = [...new Set((itemsRes.data || []).map((i: any) => i.catalog_id).filter(Boolean))];
      let catalogMap: Record<string, { name: string; slug: string; owner_username: string }> = {};
      if (catalogIds.length > 0) {
        const { data: catalogRows } = await supabase
          .from("catalogs")
          .select("id,name,slug,profiles!catalogs_owner_id_fkey(username)")
          .in("id", catalogIds);
        (catalogRows || []).forEach((c: any) => {
          const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          catalogMap[c.id] = { name: c.name, slug: c.slug, owner_username: p?.username ?? "" };
        });
      }

      const items: GridItem[] = (itemsRes.data || []).map((item: any) => {
        const cat = catalogMap[item.catalog_id] ?? {};
        return {
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          product_url: item.product_url,
          price: item.price,
          seller: item.seller,
          like_count: num(item.like_count),
          is_liked: false,
          is_monetized: !!item.is_monetized,
          brand: item.brand,
          style_tags: item.style_tags,
          created_at: item.created_at,
          catalog_id: item.catalog_id,
          catalog_name: cat.name,
          catalog_slug: cat.slug,
          owner_username: cat.owner_username,
          type: "catalog_item",
        };
      });

      const catalogs: SpotlightCatalog[] = (catalogsRes.data || []).map((c: any) => {
        const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: c.id, name: c.name, description: c.description, image_url: c.image_url,
          bookmark_count: num(c.bookmark_count), is_bookmarked: false, item_count: 0,
          slug: c.slug, owner_username: p?.username ?? "", owner_avatar: p?.avatar_url ?? null,
        };
      });

      // Merge + dedup profiles
      const seen = new Set<string>();
      const profiles: RecommendedProfile[] = [];
      for (const p of [...(profilesByUser.data || []), ...(profilesByName.data || [])]) {
        if (!seen.has(p.id) && p.username) {
          seen.add(p.id);
          profiles.push({
            id: p.id, username: p.username, full_name: p.full_name ?? null,
            avatar_url: p.avatar_url ?? null, follower_count: num(p.follower_count),
            is_following: false, is_verified: !!p.is_verified,
          });
        }
      }

      setResults({ items, catalogs, profiles: profiles.slice(0, 8) });
    } finally {
      setSearching(false);
    }
  }

  function handleItemClick(item: GridItem) {
    if (item.type === "feed_post" && item.feed_post_id) {
      onNavigate(`/feed/${item.feed_post_id}`); onClose();
    } else {
      setExpandedItem(item);
    }
  }

  const hasResults = results.items.length > 0 || results.catalogs.length > 0 || results.profiles.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Search input */}
      <div className="border-b-2 border-black flex items-center px-5 md:px-10 gap-3 h-16 flex-shrink-0">
        <span className="text-xl opacity-30 select-none flex-shrink-0">⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SEARCH ITEMS, CATALOGS, CREATORS..."
          className="flex-1 bg-transparent tracking-wider placeholder-black/25 focus:outline-none"
          style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "16px" }}
        />
        {searching && (
          <span className="text-[9px] tracking-[0.4em] opacity-30 animate-pulse flex-shrink-0" style={{ fontFamily: "Bebas Neue, sans-serif" }}>SEARCHING</span>
        )}
        <button onClick={onClose} className="text-[10px] tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity font-black flex-shrink-0" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
          [ESC]
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {!q.trim() ? (
          <div className="flex items-center justify-center h-full opacity-15">
            <p className="text-4xl tracking-[0.2em]" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TYPE TO SEARCH</p>
          </div>
        ) : !hasResults && !searching ? (
          <div className="flex items-center justify-center h-full opacity-15">
            <p className="text-3xl tracking-[0.2em]" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NO RESULTS</p>
          </div>
        ) : (
          <div className="px-5 md:px-10 py-6 space-y-8 max-w-5xl mx-auto">

            {/* Profiles */}
            {results.profiles.length > 0 && (
              <section>
                <p className="text-[9px] tracking-[0.4em] opacity-30 mb-3 font-black border-b border-black/8 pb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  CREATORS — {results.profiles.length}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {results.profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-3 p-3 border border-black/10 hover:border-black/40 transition-all cursor-pointer"
                      style={{ borderRadius: "50px" }}
                      onClick={() => { onNavigate(`/${profile.username}`); onClose(); }}
                    >
                      <div className="w-9 h-9 rounded-full border border-black/20 overflow-hidden flex-shrink-0">
                        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-black/5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black tracking-tighter truncate" style={{ fontFamily: "Archivo Black, sans-serif" }}>@{profile.username}</p>
                        {profile.full_name && <p className="text-[9px] opacity-40 truncate">{profile.full_name}</p>}
                      </div>
                      <p className="text-[9px] opacity-35 tracking-wider flex-shrink-0" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                        {num(profile.follower_count).toLocaleString()} FOLLOWERS
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Items */}
            {results.items.length > 0 && (
              <section>
                <p className="text-[9px] tracking-[0.4em] opacity-30 mb-3 font-black border-b border-black/8 pb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  ITEMS — {results.items.length}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {results.items.map((item) => (
                    <ItemCard key={item.id} item={item} onLike={() => {}} onExpand={setExpandedItem} onClick={handleItemClick} />
                  ))}
                </div>
              </section>
            )}

            {/* Catalogs */}
            {results.catalogs.length > 0 && (
              <section>
                <p className="text-[9px] tracking-[0.4em] opacity-30 mb-3 font-black border-b border-black/8 pb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  CATALOGS — {results.catalogs.length}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {results.catalogs.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 border border-black/10 hover:border-black/40 transition-all cursor-pointer"
                      onClick={() => { onNavigate(`/${c.owner_username}/${c.slug}`); onClose(); }}
                    >
                      <div className="w-12 h-12 bg-black/5 flex-shrink-0 overflow-hidden">
                        {c.image_url ? <img src={c.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl opacity-10">✦</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black tracking-tighter truncate text-sm" style={{ fontFamily: "Archivo Black, sans-serif" }}>{c.name}</p>
                        <p className="text-[9px] opacity-40 tracking-wider" style={{ fontFamily: "Bebas Neue, sans-serif" }}>@{c.owner_username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Expanded item within search */}
      {expandedItem && (
        <ItemModal
          item={expandedItem}
          onClose={() => setExpandedItem(null)}
          onLike={() => {}}
          onNavigate={(path) => { onNavigate(path); onClose(); }}
          currentUserId={currentUserId}
          isOnboarded={false}
          onRequireLogin={() => {}}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function DiscoverContent() {
  const router = useRouter();

  const [mode, setMode] = useState<DiscoverMode>(cache.mode);
  const [category, setCategory] = useState(cache.category);
  const [items, setItems] = useState<GridItem[]>([]);
  const [spotlightCatalogs, setSpotlightCatalogs] = useState<SpotlightCatalog[]>([]);
  const [followRecs, setFollowRecs] = useState<RecommendedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [expandedItem, setExpandedItem] = useState<GridItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredScroll = useRef(false);
  const loadingRef = useRef(false);

  const categories = [
    { v: "all", l: "ALL" }, { v: "tops", l: "TOPS" }, { v: "bottoms", l: "BOTTOMS" },
    { v: "shoes", l: "SHOES" }, { v: "outerwear", l: "OUTERWEAR" },
    { v: "accessories", l: "ACCESSORIES" }, { v: "bags", l: "BAGS" },
    { v: "dresses", l: "DRESSES" }, { v: "activewear", l: "ACTIVEWEAR" },
    { v: "jewelry", l: "JEWELRY" },
  ];

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data } = await supabase.from("profiles").select("is_onboarded").eq("id", user.id).single();
        setIsOnboarded(!!data?.is_onboarded);
      }
    })();
  }, []);

  // ── Scroll tracking — write to cache on every scroll ─────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { cache.scrollY = el.scrollTop; };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ── Restore scroll after initial data load ────────────────────────────────
  useEffect(() => {
    if (!loading && !restoredScroll.current && cache.scrollY > 0) {
      restoredScroll.current = true;
      const el = scrollRef.current;
      if (el) el.scrollTop = cache.scrollY;
    }
  }, [loading]);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Don't reload just because currentUserId set; wait for explicit mode/category change
    loadData();
  }, [mode, category]);

  // Also reload when auth resolves (currentUserId goes from null to a value)
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUserId;
      loadData();
    }
  }, [currentUserId]);

  async function loadData() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.all([fetchItems(), fetchSpotlights(), mode === "following" ? fetchFollowRecs() : Promise.resolve()]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // ─── fetchItems ────────────────────────────────────────────────────────────
  async function fetchItems() {
    try {
      let catalogItems: any[] = [];
      let feedItems: any[] = [];

      if (mode === "following") {
        // ── Step 1: who does the user follow ───────────────────────────────
        if (!currentUserId) { setItems([]); return; }

        const { data: followRows, error: followErr } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId);

        if (followErr) throw followErr;

        const followedIds: string[] = (followRows || []).map((r: any) => r.following_id);
        if (followedIds.length === 0) { setItems([]); return; }

        // ── Step 2: get catalog IDs owned by followed users ─────────────────
        const { data: ownedCats, error: catErr } = await supabase
          .from("catalogs")
          .select("id")
          .in("owner_id", followedIds)
          .eq("visibility", "public");

        if (catErr) throw catErr;
        const ownedCatIds: string[] = (ownedCats || []).map((c: any) => c.id);

        // ── Step 3: get feed post IDs from followed users ───────────────────
        const { data: ownedPosts, error: postErr } = await supabase
          .from("feed_posts")
          .select("id")
          .in("user_id", followedIds);

        if (postErr) throw postErr;
        const ownedPostIds: string[] = (ownedPosts || []).map((p: any) => p.id);

        // ── Step 4: fetch catalog items by catalog_id — NO join filters ─────
        if (ownedCatIds.length > 0) {
          let q = supabase
            .from("catalog_items")
            .select("id,title,image_url,product_url,price,seller,like_count,is_monetized,brand,style_tags,created_at,catalog_id")
            .in("catalog_id", ownedCatIds)
            .order("created_at", { ascending: false })
            .limit(50);
          if (category !== "all") q = q.eq("category", category);
          const { data } = await q;
          catalogItems = data || [];
        }

        // ── Step 5: fetch feed post items by feed_post_id — NO join filters ─
        if (ownedPostIds.length > 0) {
          const { data } = await supabase
            .from("feed_post_items")
            .select("id,title,image_url,product_url,price,seller,like_count,created_at,feed_post_id")
            .in("feed_post_id", ownedPostIds)
            .order("created_at", { ascending: false })
            .limit(10);
          feedItems = data || [];
        }

      } else {
        // ── Trending / New ──────────────────────────────────────────────────
        const orderCol = mode === "trending" ? "like_count" : "created_at";

        let catQ = supabase
          .from("catalog_items")
          .select("id,title,image_url,product_url,price,seller,like_count,is_monetized,brand,style_tags,created_at,catalog_id")
          .order(orderCol, { ascending: false })
          .limit(48);
        if (category !== "all") catQ = catQ.eq("category", category);

        const feedQ = supabase
          .from("feed_post_items")
          .select("id,title,image_url,product_url,price,seller,like_count,created_at,feed_post_id")
          .order(orderCol, { ascending: false })
          .limit(8);

        const [catRes, feedRes] = await Promise.all([catQ, feedQ]);
        catalogItems = catRes.data || [];
        feedItems = feedRes.data || [];
      }

      // ── Enrich: fetch catalog info for all catalog_ids in one query ────────
      const catalogIds = [...new Set(catalogItems.map((i: any) => i.catalog_id).filter(Boolean))];
      let catalogInfoMap: Record<string, { name: string; slug: string; owner_username: string }> = {};
      if (catalogIds.length > 0) {
        const { data: catInfoRows } = await supabase
          .from("catalogs")
          .select("id,name,slug,profiles!catalogs_owner_id_fkey(username)")
          .in("id", catalogIds);
        (catInfoRows || []).forEach((c: any) => {
          const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          catalogInfoMap[c.id] = { name: c.name, slug: c.slug, owner_username: p?.username ?? "" };
        });
      }

      // ── Liked IDs ──────────────────────────────────────────────────────────
      let likedIds = new Set<string>();
      if (currentUserId) {
        const { data: liked } = await supabase
          .from("liked_items")
          .select("item_id")
          .eq("user_id", currentUserId);
        (liked || []).forEach((l: any) => likedIds.add(l.item_id));
      }

      // ── Format catalog items ───────────────────────────────────────────────
      const formattedCatalog: GridItem[] = catalogItems
        .filter((i: any) => i.catalog_id && catalogInfoMap[i.catalog_id])
        .map((i: any) => {
          const cat = catalogInfoMap[i.catalog_id];
          return {
            id: i.id, title: i.title, image_url: i.image_url, product_url: i.product_url,
            price: i.price, seller: i.seller, like_count: num(i.like_count),
            is_liked: likedIds.has(i.id), is_monetized: !!i.is_monetized,
            brand: i.brand, style_tags: i.style_tags, created_at: i.created_at,
            catalog_id: i.catalog_id, catalog_name: cat.name, catalog_slug: cat.slug,
            owner_username: cat.owner_username, type: "catalog_item" as const,
          };
        });

      // ── Format feed items ──────────────────────────────────────────────────
      const formattedFeed: GridItem[] = feedItems.map((i: any) => ({
        id: i.id, title: i.title, image_url: i.image_url, product_url: i.product_url,
        price: i.price, seller: i.seller, like_count: num(i.like_count),
        is_liked: false, is_monetized: false, created_at: i.created_at,
        feed_post_id: i.feed_post_id, type: "feed_post" as const,
        catalog: { id: "feed", name: "", slug: "", owner: { username: "" } },
      }));

      // ── Scatter feed items 1 per 8 catalog items ───────────────────────────
      const merged: GridItem[] = [];
      let fi = 0;
      for (let i = 0; i < formattedCatalog.length; i++) {
        if (i > 0 && i % 8 === 0 && fi < formattedFeed.length) merged.push(formattedFeed[fi++]);
        merged.push(formattedCatalog[i]);
      }
      while (fi < formattedFeed.length) merged.push(formattedFeed[fi++]);

      setItems(merged);
    } catch (err) {
      console.error("fetchItems error:", err);
      setItems([]);
    }
  }

  // ─── fetchSpotlights ───────────────────────────────────────────────────────
  async function fetchSpotlights() {
    try {
      const { data } = await supabase
        .from("catalogs")
        .select("id,name,description,image_url,bookmark_count,slug,profiles!catalogs_owner_id_fkey(username,avatar_url)")
        .eq("visibility", "public")
        .order("bookmark_count", { ascending: false })
        .limit(8);

      let bookmarkedIds = new Set<string>();
      if (currentUserId) {
        const { data: bm } = await supabase.from("bookmarked_catalogs").select("catalog_id").eq("user_id", currentUserId);
        (bm || []).forEach((b: any) => bookmarkedIds.add(b.catalog_id));
      }

      const enriched = await Promise.all((data || []).map(async (c: any) => {
        const { count } = await supabase.from("catalog_items").select("*", { count: "exact", head: true }).eq("catalog_id", c.id);
        const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: c.id, name: c.name, description: c.description, image_url: c.image_url,
          bookmark_count: num(c.bookmark_count), is_bookmarked: bookmarkedIds.has(c.id),
          item_count: count || 0, slug: c.slug,
          owner_username: p?.username ?? "", owner_avatar: p?.avatar_url ?? null,
        };
      }));
      setSpotlightCatalogs(enriched);
    } catch (err) { console.error("fetchSpotlights error:", err); }
  }

  // ─── fetchFollowRecs ───────────────────────────────────────────────────────
  async function fetchFollowRecs() {
    if (!currentUserId) { setFollowRecs([]); return; }
    try {
      // Get who user already follows
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);
      const alreadyFollowing = new Set((followRows || []).map((r: any) => r.following_id));
      alreadyFollowing.add(currentUserId); // exclude self

      // Get popular creators NOT already followed
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,follower_count,is_onboarded,is_verified")
        .eq("is_onboarded", true)
        .order("follower_count", { ascending: false })
        .limit(20);

      const recs: RecommendedProfile[] = (profiles || [])
        .filter((p: any) => p.username && !alreadyFollowing.has(p.id))
        .slice(0, 8)
        .map((p: any) => ({
          id: p.id, username: p.username, full_name: p.full_name ?? null,
          avatar_url: p.avatar_url ?? null, follower_count: num(p.follower_count),
          is_following: false, is_verified: !!p.is_verified,
        }));

      setFollowRecs(recs);
    } catch (err) { console.error("fetchFollowRecs error:", err); }
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  function navigate(path: string) {
    cache.scrollY = scrollRef.current?.scrollTop ?? 0;
    cache.mode = mode;
    cache.category = category;
    router.push(path);
  }

  async function toggleLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) { setShowLoginPrompt(true); return; }
    try {
      // Determine table: try catalog_items first; if not found it's a feed item
      const { data: isCI } = await supabase.from("catalog_items").select("id").eq("id", itemId).maybeSingle();
      const table = isCI ? "liked_items" : "liked_feed_post_items";
      if (currentlyLiked) {
        await supabase.from(table).delete().eq("user_id", currentUserId).eq("item_id", itemId);
      } else {
        await supabase.from(table).insert({ user_id: currentUserId, item_id: itemId });
      }
      const upd = (i: GridItem) => i.id === itemId
        ? { ...i, is_liked: !currentlyLiked, like_count: i.like_count + (currentlyLiked ? -1 : 1) }
        : i;
      setItems((prev) => prev.map(upd));
      if (expandedItem?.id === itemId) setExpandedItem((prev) => prev ? upd(prev) : null);
    } catch (err) { console.error(err); }
  }

  async function toggleBookmark(catalogId: string, currently: boolean) {
    if (!currentUserId || !isOnboarded) { setShowLoginPrompt(true); return; }
    try {
      if (currently) {
        await supabase.from("bookmarked_catalogs").delete().eq("user_id", currentUserId).eq("catalog_id", catalogId);
      } else {
        await supabase.from("bookmarked_catalogs").insert({ user_id: currentUserId, catalog_id: catalogId });
      }
      setSpotlightCatalogs((prev) => prev.map((c) =>
        c.id === catalogId ? { ...c, is_bookmarked: !currently, bookmark_count: c.bookmark_count + (currently ? -1 : 1) } : c
      ));
    } catch (err) { console.error(err); }
  }

  async function toggleFollow(profileId: string, currently: boolean) {
    if (!currentUserId || !isOnboarded) { setShowLoginPrompt(true); return; }
    try {
      if (currently) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profileId);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: profileId });
      }
      setFollowRecs((prev) => prev.map((p) =>
        p.id === profileId ? { ...p, is_following: !currently } : p
      ));
    } catch (err) { console.error(err); }
  }

  function handleItemClick(item: GridItem) {
    if (item.type === "feed_post" && item.feed_post_id) {
      navigate(`/feed/${item.feed_post_id}`);
    } else {
      setExpandedItem(item);
    }
  }

  function changeMode(m: DiscoverMode) {
    if (m === mode) return;
    cache.scrollY = 0;
    restoredScroll.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setMode(m);
    cache.mode = m;
  }

  function changeCategory(c: string) {
    if (c === category) return;
    cache.scrollY = 0;
    restoredScroll.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setCategory(c);
    cache.category = c;
  }

  // ── Grid builder ───────────────────────────────────────────────────────────
  function buildGrid() {
    const nodes: React.ReactNode[] = [];
    let si = 0; // spotlight index

    for (let i = 0; i < items.length; i++) {
      // Inject spotlight every 8 items (offset by 4 so first one lands at position 4)
      if (i > 0 && (i + 4) % 8 === 0 && si < spotlightCatalogs.length) {
        nodes.push(
          <CatalogSpotlight
            key={`spot-${spotlightCatalogs[si].id}`}
            catalog={spotlightCatalogs[si]}
            onBookmark={toggleBookmark}
            onNavigate={navigate}
          />
        );
        si++;
      }
      nodes.push(
        <ItemCard
          key={`${items[i].type}-${items[i].id}`}
          item={items[i]}
          onLike={toggleLike}
          onExpand={setExpandedItem}
          onClick={handleItemClick}
        />
      );
    }
    return nodes;
  }

  const modeLabel: Record<DiscoverMode, string> = { trending: "TRENDING", new: "NEW DROPS", following: "FOLLOWING" };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        input, textarea, select { font-size: 16px !important; }
      `}</style>

      {/*
        KEY SCROLL FIX: the entire page scrolls inside this div, NOT window.
        This prevents conflicts between window.scrollY and layout repaints that
        cause glitchy scroll behaviour with sticky headers.
      */}
      <div
        ref={scrollRef}
        className="h-screen overflow-y-auto overscroll-none bg-white text-black"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-30 bg-white border-b border-black/10">
          {/* Title row */}
          <div className="px-5 md:px-10 pt-5 pb-0 flex items-end justify-between">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none pb-3" style={{ fontFamily: "Archivo Black, sans-serif" }}>
              DISCOVER
            </h1>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 pb-3 hover:opacity-40 transition-opacity"
            >
              <span className="text-xl leading-none">⌕</span>
              <span className="text-[10px] tracking-[0.3em] font-black hidden md:inline opacity-40" style={{ fontFamily: "Bebas Neue, sans-serif" }}>SEARCH</span>
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex px-5 md:px-10 gap-0 border-t border-black/8">
            {(["trending", "new", "following"] as DiscoverMode[]).map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                className={`px-4 py-2.5 text-[10px] tracking-[0.25em] font-black border-b-2 transition-all ${
                  mode === m ? "border-black text-black" : "border-transparent text-black/25 hover:text-black/50"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                {modeLabel[m]}
              </button>
            ))}
          </div>

          {/* Category chips */}
          <div className="border-t border-black/8 overflow-x-auto scrollbar-none">
            <div className="flex gap-1.5 px-5 md:px-10 py-2 min-w-max">
              {categories.map((cat) => (
                <button
                  key={cat.v}
                  onClick={() => changeCategory(cat.v)}
                  className={`px-3 py-1 text-[9px] tracking-wider font-black border transition-all whitespace-nowrap ${
                    category === cat.v
                      ? "bg-black text-white border-black"
                      : "border-black/12 text-black/40 hover:border-black/40 hover:text-black/70"
                  }`}
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  {cat.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-5 md:px-10 py-5 max-w-7xl mx-auto">

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <p className="text-[10px] tracking-[0.5em] opacity-20 animate-pulse" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LOADING</p>
            </div>

          ) : mode === "following" && !currentUserId ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <p className="text-2xl tracking-wider opacity-20" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LOG IN TO SEE YOUR FEED</p>
              <button onClick={() => router.push("/login")} className="px-6 py-2.5 bg-black text-white text-[10px] tracking-[0.3em] font-black border-2 border-black hover:bg-white hover:text-black transition-all" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                LOG IN
              </button>
            </div>

          ) : mode === "following" && items.length === 0 ? (
            // Following tab with no content — show follow recs prominently
            <div className="py-10 space-y-8">
              <div className="text-center space-y-2">
                <p className="text-2xl tracking-wider opacity-20" style={{ fontFamily: "Bebas Neue, sans-serif" }}>FOLLOW CREATORS TO SEE THEIR PIECES</p>
                <p className="text-[10px] opacity-30 tracking-wider" style={{ fontFamily: "Bebas Neue, sans-serif" }}>SUGGESTED FOR YOU</p>
              </div>
              {followRecs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-xl mx-auto">
                  {followRecs.map((p) => (
                    <ProfileChip
                      key={p.id}
                      profile={p}
                      currentUserId={currentUserId}
                      isOnboarded={isOnboarded}
                      onFollow={toggleFollow}
                      onNavigate={(username) => navigate(`/${username}`)}
                    />
                  ))}
                </div>
              )}
              <div className="text-center">
                <button onClick={() => changeMode("trending")} className="px-6 py-2.5 bg-black text-white text-[10px] tracking-[0.3em] font-black border-2 border-black hover:bg-white hover:text-black transition-all" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  BROWSE TRENDING INSTEAD
                </button>
              </div>
            </div>

          ) : (
            <>
              {/* Following: follow recs strip above the grid */}
              {mode === "following" && followRecs.length > 0 && (
                <div className="mb-5">
                  <p className="text-[9px] tracking-[0.3em] opacity-30 mb-2 font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>SUGGESTED CREATORS</p>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {followRecs.map((p) => (
                      <ProfileChip
                        key={p.id}
                        profile={p}
                        currentUserId={currentUserId}
                        isOnboarded={isOnboarded}
                        onFollow={toggleFollow}
                        onNavigate={(username) => navigate(`/${username}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Result count */}
              <p className="text-[9px] tracking-[0.4em] opacity-25 font-black mb-4" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                {modeLabel[mode]} — {items.filter(i => i.type === "catalog_item").length} ITEMS
              </p>

              {/* Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {buildGrid()}
              </div>
            </>
          )}
        </div>

        {/* ── Modals ── */}
        {expandedItem && (
          <ItemModal
            item={expandedItem}
            onClose={() => setExpandedItem(null)}
            onLike={toggleLike}
            onNavigate={navigate}
            currentUserId={currentUserId}
            isOnboarded={isOnboarded}
            onRequireLogin={() => setShowLoginPrompt(true)}
          />
        )}

        {searchOpen && (
          <SearchOverlay
            onClose={() => setSearchOpen(false)}
            currentUserId={currentUserId}
            onNavigate={navigate}
          />
        )}

        {showLoginPrompt && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-xs">
            <div className="bg-black p-4 relative flex items-center justify-between gap-4">
              <p className="text-white text-[11px] tracking-wider font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>YOU MUST BE LOGGED IN</p>
              <button onClick={() => setShowLoginPrompt(false)} className="text-white/50 hover:text-white transition-colors text-sm leading-none flex-shrink-0">✕</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-white flex items-center justify-center">
        <p className="text-[10px] tracking-[0.4em] opacity-20" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LOADING</p>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  );
}