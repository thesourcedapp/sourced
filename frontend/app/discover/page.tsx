"use client";

import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscoverMode = "trending" | "new" | "following";

type SearchItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  is_liked: boolean;
  is_monetized?: boolean;
  category?: string;
  brand?: string;
  primary_color?: string;
  style_tags?: string[];
  created_at?: string;
  catalog: {
    id: string;
    name: string;
    slug: string;
    owner: { username: string };
  };
};

type SearchCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  visibility: string;
  bookmark_count: number;
  is_bookmarked: boolean;
  item_count: number;
  slug: string;
  owner: { username: string; avatar_url: string | null };
};

type SearchProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  is_following: boolean;
  standing?: string;
  badges?: string[];
  is_verified?: boolean;
};

type SearchResultsState = {
  items: SearchItem[];
  catalogs: SearchCatalog[];
  profiles: SearchProfile[];
};

// ─── Smart Search Knowledge Base ──────────────────────────────────────────────

const SEARCH_KNOWLEDGE = {
  synonyms: {
    shirt: ["top", "tee", "blouse", "button-up", "oxford"],
    pants: ["trousers", "bottoms", "jeans", "slacks"],
    shoes: ["sneakers", "boots", "loafers", "heels", "sandals"],
    jacket: ["coat", "outerwear", "blazer", "parka"],
    bag: ["purse", "tote", "backpack", "satchel", "clutch"],
    dress: ["gown", "frock", "sundress"],
    sweater: ["pullover", "cardigan", "knit", "jumper"],
  },
  brandMappings: {
    rick: "rick owens",
    raf: "raf simons",
    chrome: "chrome hearts",
    cdg: "comme des garcons",
    bape: "a bathing ape",
    junya: "junya watanabe",
  } as Record<string, string>,
  aesthetics: {
    streetwear: { brands: ["supreme", "stussy", "bape", "palace"], categories: ["hoodies", "tees", "sneakers"] },
    techwear: { brands: ["acronym", "stone island", "arc'teryx"], categories: ["outerwear", "bags"] },
    minimalist: { brands: ["acne studios", "apc", "lemaire"], colors: ["black", "white", "gray", "beige"] },
    "avant-garde": { brands: ["rick owens", "julius", "yohji yamamoto"], colors: ["black"] },
    gorpcore: { brands: ["patagonia", "north face", "arc'teryx"], categories: ["outerwear", "fleece"] },
  } as Record<string, { brands?: string[]; categories?: string[]; colors?: string[] }>,
  colorVariations: {
    black: ["onyx", "midnight", "noir", "ebony"],
    white: ["cream", "ivory", "off-white", "bone"],
    blue: ["navy", "indigo", "azure", "cobalt"],
    gray: ["grey", "charcoal", "slate"],
    brown: ["tan", "camel", "chocolate", "khaki", "beige"],
  } as Record<string, string[]>,
  priceTiers: {
    cheap: "budget", budget: "budget", affordable: "budget",
    expensive: "luxury", luxury: "luxury", designer: "luxury", "high-end": "luxury",
  } as Record<string, string>,
};

function parseSmartQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(" ").filter((w) => w.length > 0);
  const filters = { colors: [] as string[], brands: [] as string[], categories: [] as string[], priceTier: null as string | null, aesthetic: null as string | null, expandedTerms: [] as string[] };

  for (const [aesthetic, config] of Object.entries(SEARCH_KNOWLEDGE.aesthetics)) {
    if (lowerQuery.includes(aesthetic)) {
      filters.aesthetic = aesthetic;
      if (config.brands) filters.brands.push(...config.brands);
      if (config.categories) filters.categories.push(...config.categories);
      if (config.colors) filters.colors.push(...config.colors);
    }
  }
  for (const [mainColor, variations] of Object.entries(SEARCH_KNOWLEDGE.colorVariations)) {
    if (lowerQuery.includes(mainColor) || variations.some((v) => lowerQuery.includes(v))) {
      if (!filters.colors.includes(mainColor)) filters.colors.push(mainColor);
    }
  }
  for (const [keyword, tier] of Object.entries(SEARCH_KNOWLEDGE.priceTiers)) {
    if (lowerQuery.includes(keyword)) filters.priceTier = tier;
  }
  for (const [nickname, fullName] of Object.entries(SEARCH_KNOWLEDGE.brandMappings)) {
    if (lowerQuery.includes(nickname)) { filters.brands.push(fullName); filters.expandedTerms.push(fullName); }
  }
  words.forEach((word) => {
    for (const [mainTerm, synonyms] of Object.entries(SEARCH_KNOWLEDGE.synonyms)) {
      if (word === mainTerm || synonyms.includes(word)) filters.expandedTerms.push(mainTerm, ...synonyms);
    }
  });
  return filters;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ItemCard({ item, onLike, onExpand, onClickThrough }: {
  item: SearchItem;
  onLike: (id: string, liked: boolean) => void;
  onExpand: (item: SearchItem) => void;
  onClickThrough: (item: SearchItem, e: React.MouseEvent) => void;
}) {
  return (
    <div className="group border border-black/10 hover:border-black transition-all duration-200 bg-white">
      <div
        className="aspect-square bg-black/5 overflow-hidden cursor-pointer relative"
        onClick={(e) => onClickThrough(item, e)}
      >
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
        {item.is_monetized && (
          <div
            className="absolute top-2 right-2 w-5 h-5 bg-black/20 backdrop-blur-sm flex items-center justify-center"
            title="Affiliate link — creator may earn a commission at no cost to you"
          >
            <span className="text-[10px] font-black text-white" style={{ fontFamily: "Bebas Neue, sans-serif" }}>$</span>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-black/10">
        <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-1.5" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
          {item.title}
        </h3>
        <div className="flex items-center justify-between text-[10px] tracking-wider opacity-50 mb-2">
          {item.seller && <span className="truncate">{item.seller}</span>}
          {item.price && <span className="ml-auto font-black">${item.price}</span>}
        </div>
        {item.brand && <div className="text-[9px] tracking-wider opacity-30 mb-2 uppercase">{item.brand}</div>}
        <div className="flex gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onLike(item.id, item.is_liked); }}
            className={`flex-1 py-1.5 border text-[10px] tracking-wider font-black transition-all ${
              item.is_liked ? "bg-black text-white border-black" : "border-black/20 hover:border-black hover:bg-black/5"
            }`}
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            {item.is_liked ? `♥ ${item.like_count}` : `♡ ${item.like_count}`}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(item); }}
            className="px-3 py-1.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-[10px] font-black tracking-wider"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            VIEW
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogSpotlightCard({ catalog, onBookmark, router }: {
  catalog: SearchCatalog;
  onBookmark: (id: string, bookmarked: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div
      className="col-span-2 border-2 border-black/10 hover:border-black transition-all cursor-pointer flex overflow-hidden bg-white group"
      onClick={() => router.push(`/${catalog.owner?.username}/${catalog.slug}`)}
    >
      <div className="w-32 md:w-48 flex-shrink-0 bg-black/5 overflow-hidden">
        {catalog.image_url ? (
          <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-10">✦</span>
          </div>
        )}
      </div>
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div>
          <div className="text-[9px] tracking-[0.3em] opacity-40 mb-1 font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
            CATALOG SPOTLIGHT
          </div>
          <h3 className="text-lg md:text-2xl font-black tracking-tighter mb-1 leading-none" style={{ fontFamily: "Archivo Black, sans-serif" }}>
            {catalog.name}
          </h3>
          {catalog.description && (
            <p className="text-xs opacity-50 line-clamp-2 mb-2">{catalog.description}</p>
          )}
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-60 transition-opacity"
            onClick={(e) => { e.stopPropagation(); router.push(`/${catalog.owner?.username}`); }}
          >
            <div className="w-5 h-5 rounded-full border border-black overflow-hidden">
              {catalog.owner?.avatar_url ? (
                <img src={catalog.owner.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-black/5" />
              )}
            </div>
            <span className="text-[10px] tracking-wider opacity-60" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
              @{catalog.owner?.username}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-[10px] tracking-wider opacity-50" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
            <span>{catalog.item_count} ITEMS</span>
            <span>{catalog.bookmark_count} SAVES</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onBookmark(catalog.id, catalog.is_bookmarked); }}
            className={`px-3 py-1 border text-[10px] tracking-wider font-black transition-all ${
              catalog.is_bookmarked ? "bg-black text-white border-black" : "border-black/30 hover:border-black hover:bg-black/5"
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

function ExpandedItemModal({ item, onClose, onLike, onClickThrough, router }: {
  item: SearchItem;
  onClose: () => void;
  onLike: (id: string, liked: boolean) => void;
  onClickThrough: (item: SearchItem, e: React.MouseEvent) => void;
  router: ReturnType<typeof useRouter>;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={onClose}>
      <div className="relative w-full max-w-sm md:max-w-3xl max-h-[85vh] md:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-8 md:-top-12 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50"
          style={{ fontFamily: "Bebas Neue, sans-serif" }}
        >
          [ESC]
        </button>
        <div className="bg-white border-2 border-white overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            <div
              className="aspect-square bg-black/5 overflow-hidden cursor-pointer"
              onClick={(e) => onClickThrough(item, e)}
            >
              <img src={item.image_url} alt={item.title} className="w-full h-full object-contain" />
            </div>
            <div className="p-4 md:p-8 space-y-3 md:space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <h2 className="text-xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                    {item.title}
                  </h2>
                  {item.is_monetized && (
                    <p className="text-[9px] tracking-[0.3em] opacity-40 mt-1.5" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                      $ AFFILIATED ITEM — CREATOR EARNS COMMISSION
                    </p>
                  )}
                </div>
                {item.brand && <p className="text-xs tracking-wider opacity-60 uppercase">Brand: {item.brand}</p>}
                {item.seller && <p className="text-xs tracking-wider opacity-60 uppercase">Seller: {item.seller}</p>}
                {item.price && (
                  <p className="text-2xl font-black tracking-wide" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                    ${item.price}
                  </p>
                )}
                {item.style_tags && item.style_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.style_tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-black/5 text-[9px] tracking-wider font-black border border-black/10" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => onLike(item.id, item.is_liked)}
                  className={`w-full py-2.5 border-2 transition-all text-xs tracking-[0.4em] font-black ${
                    item.is_liked ? "bg-black text-white border-black" : "border-black hover:bg-black hover:text-white"
                  }`}
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  {item.is_liked ? "♥ LIKED" : "♡ LIKE"} ({item.like_count})
                </button>
                {item.product_url && (
                  <button
                    onClick={(e) => onClickThrough(item, e)}
                    className="w-full py-2.5 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-xs tracking-[0.4em] font-black"
                    style={{ fontFamily: "Bebas Neue, sans-serif" }}
                  >
                    VIEW PRODUCT ↗
                  </button>
                )}
                <button
                  onClick={() => router.push(`/${item.catalog.owner.username}/${item.catalog.slug}`)}
                  className="w-full py-2.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-xs tracking-[0.4em] font-black"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  IN: {item.catalog.name}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Search Overlay ────────────────────────────────────────────────────────────

function SearchOverlay({ onClose, currentUserId, isOnboarded, router, onRequireLogin }: {
  onClose: () => void;
  currentUserId: string | null;
  isOnboarded: boolean;
  router: ReturnType<typeof useRouter>;
  onRequireLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultsState>({ items: [], catalogs: [], profiles: [] });
  const [expandedItem, setExpandedItem] = useState<SearchItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults({ items: [], catalogs: [], profiles: [] }); return; }
    debounceRef.current = setTimeout(() => runSearch(query), 350);
  }, [query]);

  async function runSearch(q: string) {
    setLoading(true);
    const smartFilters = parseSmartQuery(q);

    try {
      const [itemsResult, catalogsResult, profilesResult] = await Promise.all([
        // Items
        (async () => {
          let dbq = supabase
            .from("catalog_items")
            .select(`id,title,image_url,product_url,price,seller,like_count,is_monetized,category,brand,primary_color,colors,style_tags,material,pattern,season,gender,price_tier,created_at,catalogs!inner(id,name,slug,visibility,profiles!inner(username))`)
            .eq("catalogs.visibility", "public")
            .or(`title.ilike.%${q}%,brand.ilike.%${q}%,seller.ilike.%${q}%,category.ilike.%${q}%,material.ilike.%${q}%`)
            .limit(20);
          const { data } = await dbq;
          return (data || []).map((item: any) => ({
            ...item,
            is_liked: false,
            catalog: { id: item.catalogs.id, name: item.catalogs.name, slug: item.catalogs.slug, owner: { username: item.catalogs.profiles.username } },
          }));
        })(),
        // Catalogs
        (async () => {
          const { data } = await supabase
            .from("catalogs")
            .select(`id,name,description,image_url,visibility,bookmark_count,slug,profiles!catalogs_owner_id_fkey(username,avatar_url)`)
            .eq("visibility", "public")
            .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
            .limit(6);
          return (data || []).map((c: any) => ({
            ...c, is_bookmarked: false, item_count: 0,
            owner: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
          }));
        })(),
        // Profiles
        (async () => {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("is_onboarded", true)
            .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
            .limit(6);
          return (data || []).filter((p: any) => p.username).map((p: any) => ({
            id: p.id, username: p.username, full_name: p.full_name,
            avatar_url: p.avatar_url, bio: p.bio, follower_count: p.follower_count || 0,
            is_following: false, is_verified: p.is_verified || false,
          }));
        })(),
      ]);

      setResults({ items: itemsResult, catalogs: catalogsResult, profiles: profilesResult });
    } finally {
      setLoading(false);
    }
  }

  async function trackClick(itemId: string) {
    try {
      await fetch("/api/track-click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, itemType: "catalog", userId: currentUserId }) });
    } catch {}
  }

  function handleItemClick(item: SearchItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (item.product_url) { trackClick(item.id); window.open(item.product_url, "_blank"); }
  }

  const hasResults = results.items.length > 0 || results.catalogs.length > 0 || results.profiles.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Search Header */}
      <div className="border-b-2 border-black flex items-center px-6 md:px-10 gap-4 h-16 md:h-20 flex-shrink-0">
        <span className="text-2xl md:text-3xl opacity-30 select-none">⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH ITEMS, CATALOGS, CREATORS..."
          className="flex-1 bg-transparent text-sm md:text-base tracking-wider placeholder-black/30 focus:outline-none"
          style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "16px" }}
        />
        {loading && (
          <span className="text-[10px] tracking-[0.4em] opacity-40 animate-pulse" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
            SEARCHING...
          </span>
        )}
        <button
          onClick={onClose}
          className="text-xs tracking-[0.3em] opacity-50 hover:opacity-100 transition-opacity font-black"
          style={{ fontFamily: "Bebas Neue, sans-serif" }}
        >
          [ESC]
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          <div className="flex items-center justify-center h-full opacity-20">
            <p className="text-3xl md:text-5xl tracking-[0.2em]" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TYPE TO SEARCH</p>
          </div>
        ) : !hasResults && !loading ? (
          <div className="flex items-center justify-center h-full opacity-20">
            <p className="text-2xl tracking-[0.2em]" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NO RESULTS</p>
          </div>
        ) : (
          <div className="px-6 md:px-10 py-6 space-y-8">
            {/* Items */}
            {results.items.length > 0 && (
              <section>
                <div className="text-[10px] tracking-[0.4em] opacity-40 mb-4 font-black border-b border-black/10 pb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  ITEMS — {results.items.length} RESULTS
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {results.items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onLike={() => {}}
                      onExpand={setExpandedItem}
                      onClickThrough={handleItemClick}
                    />
                  ))}
                </div>
              </section>
            )}
            {/* Catalogs */}
            {results.catalogs.length > 0 && (
              <section>
                <div className="text-[10px] tracking-[0.4em] opacity-40 mb-4 font-black border-b border-black/10 pb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  CATALOGS — {results.catalogs.length} RESULTS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.catalogs.map((catalog) => (
                    <div
                      key={catalog.id}
                      className="border border-black/10 hover:border-black transition-all cursor-pointer p-3 flex items-center gap-3"
                      onClick={() => { router.push(`/${catalog.owner?.username}/${catalog.slug}`); onClose(); }}
                    >
                      <div className="w-14 h-14 bg-black/5 flex-shrink-0 overflow-hidden">
                        {catalog.image_url ? <img src={catalog.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl opacity-10">✦</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black tracking-tighter truncate text-sm" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.name}</p>
                        <p className="text-[10px] opacity-50 tracking-wider" style={{ fontFamily: "Bebas Neue, sans-serif" }}>@{catalog.owner?.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* Profiles */}
            {results.profiles.length > 0 && (
              <section>
                <div className="text-[10px] tracking-[0.4em] opacity-40 mb-4 font-black border-b border-black/10 pb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  CREATORS — {results.profiles.length} RESULTS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {results.profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="border border-black/10 hover:border-black transition-all cursor-pointer p-3 flex items-center gap-3"
                      style={{ borderRadius: "50px" }}
                      onClick={() => { router.push(`/${profile.username}`); onClose(); }}
                    >
                      <div className="w-10 h-10 rounded-full border border-black overflow-hidden flex-shrink-0">
                        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-black/5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black tracking-tighter text-sm" style={{ fontFamily: "Archivo Black, sans-serif" }}>@{profile.username}</p>
                        {profile.full_name && <p className="text-[10px] opacity-50 truncate">{profile.full_name}</p>}
                      </div>
                      <div className="ml-auto text-[10px] opacity-40 tracking-wider flex-shrink-0" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                        {profile.follower_count} FOLLOWERS
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Expanded item inside search */}
      {expandedItem && (
        <ExpandedItemModal
          item={expandedItem}
          onClose={() => setExpandedItem(null)}
          onLike={() => {}}
          onClickThrough={handleItemClick}
          router={router}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<DiscoverMode>("trending");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [catalogs, setCatalogs] = useState<SearchCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [expandedItem, setExpandedItem] = useState<SearchItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);

  // Filters (items only)
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const categories = [
    { value: "all", label: "ALL" }, { value: "tops", label: "TOPS" },
    { value: "bottoms", label: "BOTTOMS" }, { value: "shoes", label: "SHOES" },
    { value: "outerwear", label: "OUTERWEAR" }, { value: "accessories", label: "ACCESSORIES" },
    { value: "bags", label: "BAGS" }, { value: "dresses", label: "DRESSES" },
    { value: "activewear", label: "ACTIVEWEAR" }, { value: "jewelry", label: "JEWELRY" },
  ];

  useEffect(() => { loadCurrentUser(); }, []);
  useEffect(() => { loadContent(); }, [mode, currentUserId, selectedCategory]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("is_onboarded").eq("id", user.id).single();
      setIsOnboarded(profile?.is_onboarded || false);
    }
  }

  async function loadContent() {
    setLoading(true);
    try {
      await Promise.all([loadItems(), loadCatalogs()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadItems() {
    try {
      let q = supabase
        .from("catalog_items")
        .select(`id,title,image_url,product_url,price,seller,like_count,is_monetized,category,brand,primary_color,style_tags,created_at,catalogs!inner(id,name,slug,visibility,profiles!inner(username))`)
        .eq("catalogs.visibility", "public");

      if (selectedCategory !== "all") q = q.eq("category", selectedCategory);

      if (mode === "trending") {
        q = q.order("like_count", { ascending: false }).limit(40);
      } else if (mode === "new") {
        q = q.order("created_at", { ascending: false }).limit(40);
      } else if (mode === "following" && currentUserId) {
        // Get followed user IDs
        const { data: followData } = await supabase
          .from("follows").select("following_id").eq("follower_id", currentUserId);
        const followedIds = (followData || []).map((f: any) => f.following_id);
        if (followedIds.length === 0) { setItems([]); return; }
        q = q.in("catalogs.profiles.id", followedIds).order("created_at", { ascending: false }).limit(40);
      } else if (mode === "following" && !currentUserId) {
        setItems([]); return;
      }

      const { data, error } = await q;
      if (error) throw error;

      // Get liked items
      let likedIds = new Set<string>();
      if (currentUserId) {
        const { data: liked } = await supabase.from("liked_items").select("item_id").eq("user_id", currentUserId);
        (liked || []).forEach((l: any) => likedIds.add(l.item_id));
      }

      setItems((data || []).map((item: any) => ({
        ...item,
        is_liked: likedIds.has(item.id),
        catalog: { id: item.catalogs.id, name: item.catalogs.name, slug: item.catalogs.slug, owner: { username: item.catalogs.profiles.username } },
      })));
    } catch (err) {
      console.error(err);
      setItems([]);
    }
  }

  async function loadCatalogs() {
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .select(`id,name,description,image_url,visibility,bookmark_count,slug,profiles!catalogs_owner_id_fkey(username,avatar_url)`)
        .eq("visibility", "public")
        .order("bookmark_count", { ascending: false })
        .limit(8);
      if (error) throw error;

      let bookmarkedIds = new Set<string>();
      if (currentUserId) {
        const { data: bookmarked } = await supabase.from("bookmarked_catalogs").select("catalog_id").eq("user_id", currentUserId);
        (bookmarked || []).forEach((b: any) => bookmarkedIds.add(b.catalog_id));
      }

      const withCounts = await Promise.all((data || []).map(async (c: any) => {
        const { count } = await supabase.from("catalog_items").select("*", { count: "exact", head: true }).eq("catalog_id", c.id);
        return { ...c, is_bookmarked: bookmarkedIds.has(c.id), item_count: count || 0, owner: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles };
      }));

      setCatalogs(withCounts);
    } catch (err) {
      console.error(err);
      setCatalogs([]);
    }
  }

  async function trackClick(itemId: string, itemType: "catalog" | "feed") {
    try {
      await fetch("/api/track-click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, itemType, userId: currentUserId }) });
    } catch {}
  }

  function handleItemClick(item: SearchItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (item.product_url) {
      trackClick(item.id, item.catalog.id === "feed" ? "feed" : "catalog");
      window.open(item.product_url, "_blank");
    }
  }

  async function toggleLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) { setShowLoginMessage(true); return; }
    try {
      const { data: catalogItem } = await supabase.from("catalog_items").select("id").eq("id", itemId).single();
      const table = catalogItem ? "liked_items" : "liked_feed_post_items";
      if (currentlyLiked) {
        await supabase.from(table).delete().eq("user_id", currentUserId).eq("item_id", itemId);
      } else {
        await supabase.from(table).insert({ user_id: currentUserId, item_id: itemId });
      }
      const update = (item: SearchItem) => item.id === itemId ? { ...item, is_liked: !currentlyLiked, like_count: item.like_count + (currentlyLiked ? -1 : 1) } : item;
      setItems((prev) => prev.map(update));
      if (expandedItem?.id === itemId) setExpandedItem((prev) => prev ? update(prev) : null);
    } catch (err) { console.error(err); }
  }

  async function toggleBookmark(catalogId: string, currentlyBookmarked: boolean) {
    if (!currentUserId || !isOnboarded) { setShowLoginMessage(true); return; }
    try {
      if (currentlyBookmarked) {
        await supabase.from("bookmarked_catalogs").delete().eq("user_id", currentUserId).eq("catalog_id", catalogId);
      } else {
        await supabase.from("bookmarked_catalogs").insert({ user_id: currentUserId, catalog_id: catalogId });
      }
      setCatalogs((prev) => prev.map((c) => c.id === catalogId ? { ...c, is_bookmarked: !currentlyBookmarked, bookmark_count: c.bookmark_count + (currentlyBookmarked ? -1 : 1) } : c));
    } catch (err) { console.error(err); }
  }

  // Build mixed grid: inject catalog spotlight cards every N items
  function buildMixedGrid() {
    if (items.length === 0) return null;
    const SPOTLIGHT_INTERVAL = 8;
    const grid: React.ReactNode[] = [];
    let catalogIdx = 0;

    for (let i = 0; i < items.length; i++) {
      // Insert catalog spotlight every SPOTLIGHT_INTERVAL items
      if (i > 0 && i % SPOTLIGHT_INTERVAL === 0 && catalogIdx < catalogs.length) {
        grid.push(
          <CatalogSpotlightCard
            key={`catalog-${catalogs[catalogIdx].id}`}
            catalog={catalogs[catalogIdx]}
            onBookmark={toggleBookmark}
            router={router}
          />
        );
        catalogIdx++;
      }
      grid.push(
        <ItemCard
          key={items[i].id}
          item={items[i]}
          onLike={toggleLike}
          onExpand={setExpandedItem}
          onClickThrough={handleItemClick}
        />
      );
    }
    return grid;
  }

  const modeLabels: Record<DiscoverMode, string> = {
    trending: "TRENDING",
    new: "NEW DROPS",
    following: "FOLLOWING",
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        input, textarea, select { font-size: 16px !important; }
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-0">
        {/* ── Header ── */}
        <div className="border-b border-black/15 px-6 md:px-10 pt-6 pb-0 md:pt-10">
          <div className="max-w-7xl mx-auto">
            {/* Top row: title + search button */}
            <div className="flex items-end justify-between mb-6">
              <h1
                className="text-4xl md:text-6xl font-black tracking-tighter leading-none"
                style={{ fontFamily: "Archivo Black, sans-serif" }}
              >
                DISCOVER
              </h1>
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-black hover:bg-black hover:text-white transition-all group"
              >
                <span className="text-lg leading-none group-hover:text-white">⌕</span>
                <span
                  className="text-xs tracking-[0.3em] font-black hidden md:inline"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  SEARCH
                </span>
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-0 border-b-0">
              {(["trending", "new", "following"] as DiscoverMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-5 py-3 text-xs tracking-[0.3em] font-black border-b-2 transition-all ${
                    mode === m
                      ? "border-black text-black"
                      : "border-transparent text-black/30 hover:text-black/60 hover:border-black/20"
                  }`}
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Category filter chips ── */}
        <div className="border-b border-black/10 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex gap-2 py-3 min-w-max">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1 text-[10px] tracking-wider font-black border transition-all whitespace-nowrap ${
                    selectedCategory === cat.value
                      ? "bg-black text-white border-black"
                      : "border-black/15 text-black/50 hover:border-black hover:text-black"
                  }`}
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="px-6 md:px-10 py-6 md:py-8">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="text-center py-32">
                <p className="text-xs tracking-[0.5em] opacity-30 animate-pulse" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                  LOADING...
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-32">
                {mode === "following" && !currentUserId ? (
                  <div className="space-y-3">
                    <p className="text-2xl tracking-wider opacity-30" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LOG IN TO SEE YOUR FEED</p>
                    <button
                      onClick={() => router.push("/login")}
                      className="px-6 py-2.5 bg-black text-white text-xs tracking-[0.3em] font-black hover:bg-white hover:text-black border-2 border-black transition-all"
                      style={{ fontFamily: "Bebas Neue, sans-serif" }}
                    >
                      LOG IN
                    </button>
                  </div>
                ) : mode === "following" ? (
                  <div className="space-y-3">
                    <p className="text-2xl tracking-wider opacity-30" style={{ fontFamily: "Bebas Neue, sans-serif" }}>FOLLOW CREATORS TO SEE THEIR PIECES</p>
                    <button
                      onClick={() => setMode("trending")}
                      className="px-6 py-2.5 bg-black text-white text-xs tracking-[0.3em] font-black border-2 border-black hover:bg-white hover:text-black transition-all"
                      style={{ fontFamily: "Bebas Neue, sans-serif" }}
                    >
                      BROWSE TRENDING
                    </button>
                  </div>
                ) : (
                  <p className="text-2xl tracking-wider opacity-30" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NOTHING HERE YET</p>
                )}
              </div>
            ) : (
              <>
                {/* Result count + mode label */}
                <div className="flex items-center justify-between mb-5">
                  <p className="text-[10px] tracking-[0.4em] opacity-30 font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                    {modeLabels[mode]} — {items.length} ITEMS
                  </p>
                </div>

                {/* Mixed grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {buildMixedGrid()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Modals ── */}
        {expandedItem && (
          <ExpandedItemModal
            item={expandedItem}
            onClose={() => setExpandedItem(null)}
            onLike={toggleLike}
            onClickThrough={handleItemClick}
            router={router}
          />
        )}

        {searchOpen && (
          <SearchOverlay
            onClose={() => setSearchOpen(false)}
            currentUserId={currentUserId}
            isOnboarded={isOnboarded}
            router={router}
            onRequireLogin={() => setShowLoginMessage(true)}
          />
        )}

        {showLoginMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 md:top-auto md:bottom-6 md:right-6 md:left-auto md:translate-x-0 z-[9999] w-[calc(100%-2rem)] max-w-sm">
            <div className="bg-black border-2 border-white p-4 shadow-lg relative">
              <button onClick={() => setShowLoginMessage(false)} className="absolute top-2 right-2 text-white hover:opacity-50 text-lg leading-none">✕</button>
              <p className="text-white text-sm tracking-wide pr-6" style={{ fontFamily: "Bebas Neue, sans-serif" }}>YOU MUST BE LOGGED IN</p>
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-xs tracking-[0.4em] opacity-30" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LOADING...</p>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  );
}