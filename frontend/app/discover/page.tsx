"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

type SearchTab = "items" | "catalogs" | "profiles";

type SearchItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  is_liked: boolean;
  category?: string;
  brand?: string;
  primary_color?: string;
  style_tags?: string[];
  catalog: {
    id: string;
    name: string;
    owner: {
      username: string;
    };
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
  owner: {
    username: string;
    avatar_url: string | null;
  };
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

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SearchTab) || "items";
  const initialQuery = searchParams.get("q") || "";

  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedColor, setSelectedColor] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("relevance");

  const [items, setItems] = useState<SearchItem[]>([]);
  const [catalogs, setCatalogs] = useState<SearchCatalog[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);

  const [expandedItem, setExpandedItem] = useState<SearchItem | null>(null);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter options
  const categories = [
    { value: "all", label: "All Items" },
    { value: "tops", label: "Tops" },
    { value: "bottoms", label: "Bottoms" },
    { value: "shoes", label: "Shoes" },
    { value: "outerwear", label: "Outerwear" },
    { value: "dresses", label: "Dresses" },
    { value: "activewear", label: "Activewear" },
    { value: "accessories", label: "Accessories" },
    { value: "bags", label: "Bags" },
    { value: "jewelry", label: "Jewelry" }
  ];

  const colors = [
    { value: "all", label: "All Colors" },
    { value: "black", label: "Black" },
    { value: "white", label: "White" },
    { value: "gray", label: "Gray" },
    { value: "brown", label: "Brown" },
    { value: "beige", label: "Beige" },
    { value: "blue", label: "Blue" },
    { value: "green", label: "Green" },
    { value: "red", label: "Red" },
    { value: "pink", label: "Pink" },
    { value: "purple", label: "Purple" },
    { value: "yellow", label: "Yellow" },
    { value: "orange", label: "Orange" }
  ];

  const genders = [
    { value: "all", label: "All" },
    { value: "men", label: "Men" },
    { value: "women", label: "Women" },
    { value: "unisex", label: "Unisex" }
  ];

  const seasons = [
    { value: "all", label: "All Seasons" },
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
    { value: "fall", label: "Fall" },
    { value: "winter", label: "Winter" },
    { value: "all-season", label: "Year-Round" }
  ];

  const priceRanges = [
    { value: "all", label: "All Prices" },
    { value: "budget", label: "Budget (<$50)" },
    { value: "mid-range", label: "Mid-Range ($50-$200)" },
    { value: "luxury", label: "Luxury ($200+)" }
  ];

  const sortOptions = [
    { value: "relevance", label: "Most Relevant" },
    { value: "popular", label: "Most Popular" },
    { value: "recent", label: "Most Recent" }
  ];

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      loadDefaultContent();
    }
  }, [activeTab, currentUserId, selectedCategory, selectedColor, selectedGender, selectedSeason, priceRange, sortBy]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', user.id)
        .single();

      setIsOnboarded(profile?.is_onboarded || false);
    }
  }

  async function loadDefaultContent() {
    setLoading(true);
    try {
      if (activeTab === "items") {
        await searchItems("");
      } else if (activeTab === "catalogs") {
        await searchCatalogs("");
      } else if (activeTab === "profiles") {
        console.log('Loading default profiles...');
        await searchProfiles("");
      }
    } catch (error) {
      console.error('Error loading default content:', error);
    } finally {
      setLoading(false);
    }
  }

  async function performSearch() {
    if (!searchQuery.trim()) {
      loadDefaultContent();
      return;
    }

    setLoading(true);
    try {
      if (activeTab === "items") {
        await searchItems(searchQuery);
      } else if (activeTab === "catalogs") {
        await searchCatalogs(searchQuery);
      } else if (activeTab === "profiles") {
        await searchProfiles(searchQuery);
      }
    } finally {
      setLoading(false);
    }
  }

  async function searchItems(query: string) {
    try {
      let itemsQuery = supabase
        .from('catalog_items')
        .select(`
          id,
          title,
          image_url,
          product_url,
          price,
          seller,
          like_count,
          category,
          subcategory,
          brand,
          primary_color,
          colors,
          style_tags,
          material,
          pattern,
          season,
          formality,
          gender,
          price_tier,
          created_at,
          catalogs!inner(id, name, visibility, profiles!inner(username))
        `)
        .eq('catalogs.visibility', 'public');

      // Apply filters
      if (selectedCategory !== "all") {
        itemsQuery = itemsQuery.eq('category', selectedCategory);
      }

      if (selectedColor !== "all") {
        itemsQuery = itemsQuery.contains('colors', [selectedColor]);
      }

      if (selectedGender !== "all") {
        itemsQuery = itemsQuery.eq('gender', selectedGender);
      }

      if (selectedSeason !== "all") {
        itemsQuery = itemsQuery.eq('season', selectedSeason);
      }

      if (priceRange !== "all") {
        itemsQuery = itemsQuery.eq('price_tier', priceRange);
      }

      // Apply sorting
      if (sortBy === "popular") {
        itemsQuery = itemsQuery.order('like_count', { ascending: false });
      } else if (sortBy === "recent") {
        itemsQuery = itemsQuery.order('created_at', { ascending: false });
      }

      itemsQuery = itemsQuery.limit(100);

      // Apply search query if exists
      if (query.trim()) {
        const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 0);

        itemsQuery = itemsQuery.or(
          `title.ilike.%${query}%,` +
          `brand.ilike.%${query}%,` +
          `seller.ilike.%${query}%,` +
          `category.ilike.%${query}%,` +
          `subcategory.ilike.%${query}%,` +
          `primary_color.ilike.%${query}%,` +
          `material.ilike.%${query}%,` +
          `pattern.ilike.%${query}%,` +
          `season.ilike.%${query}%,` +
          `formality.ilike.%${query}%,` +
          `gender.ilike.%${query}%`
        );
      }

      const { data, error } = await itemsQuery;

      if (error) throw error;

      let likedItemIds: Set<string> = new Set();
      if (currentUserId) {
        const { data: likedData } = await supabase
          .from('liked_items')
          .select('item_id')
          .eq('user_id', currentUserId);

        if (likedData) {
          likedItemIds = new Set(likedData.map(like => like.item_id));
        }
      }

      let formattedItems = data.map((item: any) => ({
        ...item,
        is_liked: likedItemIds.has(item.id),
        catalog: {
          id: item.catalogs.id,
          name: item.catalogs.name,
          owner: {
            username: item.catalogs.profiles.username
          }
        }
      }));

      // Smart ranking: if search query exists and sortBy is "relevance"
      if (query.trim() && sortBy === "relevance") {
        formattedItems = formattedItems.sort((a, b) => {
          // Calculate relevance score
          const getRelevanceScore = (item: any) => {
            let score = 0;
            const q = query.toLowerCase();

            // Exact matches get highest score
            if (item.title?.toLowerCase() === q) score += 100;
            if (item.brand?.toLowerCase() === q) score += 80;
            if (item.category?.toLowerCase() === q) score += 60;

            // Partial matches
            if (item.title?.toLowerCase().includes(q)) score += 50;
            if (item.brand?.toLowerCase().includes(q)) score += 40;
            if (item.subcategory?.toLowerCase().includes(q)) score += 30;
            if (item.seller?.toLowerCase().includes(q)) score += 20;

            // Style tags match
            if (item.style_tags?.some((tag: string) => tag.toLowerCase().includes(q))) score += 35;

            return score;
          };

          const scoreA = getRelevanceScore(a);
          const scoreB = getRelevanceScore(b);

          // If scores are equal (both relevant or both not), prefer items with more likes
          if (scoreA === scoreB) {
            return (b.like_count || 0) - (a.like_count || 0);
          }

          return scoreB - scoreA;
        });
      } else if (sortBy === "relevance" && !query.trim()) {
        // No search query, just sort by likes
        formattedItems = formattedItems.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      }

      setItems(formattedItems);
    } catch (error) {
      console.error('Error searching items:', error);
      setItems([]);
    }
  }

  async function searchCatalogs(query: string) {
    try {
      let catalogsQuery = supabase
        .from('catalogs')
        .select(`
          id,
          name,
          description,
          image_url,
          visibility,
          bookmark_count,
          profiles!catalogs_owner_id_fkey(username, avatar_url)
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(50);

      if (query.trim()) {
        catalogsQuery = catalogsQuery.or(
          `name.ilike.%${query}%,` +
          `description.ilike.%${query}%`
        );
      }

      const { data, error } = await catalogsQuery;

      if (error) throw error;

      let bookmarkedCatalogIds: Set<string> = new Set();
      if (currentUserId) {
        const { data: bookmarkedData } = await supabase
          .from('bookmarked_catalogs')
          .select('catalog_id')
          .eq('user_id', currentUserId);

        if (bookmarkedData) {
          bookmarkedCatalogIds = new Set(bookmarkedData.map(b => b.catalog_id));
        }
      }

      const catalogsWithCounts = await Promise.all(
        data.map(async (catalog: any) => {
          const { count } = await supabase
            .from('catalog_items')
            .select('*', { count: 'exact', head: true })
            .eq('catalog_id', catalog.id);

          return {
            ...catalog,
            is_bookmarked: bookmarkedCatalogIds.has(catalog.id),
            item_count: count || 0,
            owner: Array.isArray(catalog.profiles) ? catalog.profiles[0] : catalog.profiles
          };
        })
      );

      setCatalogs(catalogsWithCounts);
    } catch (error) {
      console.error('Error searching catalogs:', error);
      setCatalogs([]);
    }
  }

  async function searchProfiles(query: string) {
    try {
      console.log('Searching profiles with query:', query);

      // Simplified query
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .limit(50);

      // Add filters
      if (query.trim()) {
        profilesQuery = profilesQuery.or(
          `username.ilike.%${query}%,` +
          `full_name.ilike.%${query}%,` +
          `bio.ilike.%${query}%`
        );
      }

      const { data, error } = await profilesQuery;

      console.log('Profiles data:', data);
      console.log('Profiles error:', error);

      if (error) {
        console.error('Profiles query error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No profiles found in database');
        setProfiles([]);
        return;
      }

      // Filter to only onboarded users with usernames
      const onboardedProfiles = data.filter((p: any) =>
        p.is_onboarded === true && p.username != null
      );

      console.log('Onboarded profiles:', onboardedProfiles.length);

      // Sort by follower count
      onboardedProfiles.sort((a: any, b: any) =>
        (b.follower_count || 0) - (a.follower_count || 0)
      );

      let followingIds: Set<string> = new Set();
      if (currentUserId) {
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId);

        if (followingData) {
          followingIds = new Set(followingData.map(f => f.following_id));
        }
      }

      const profilesWithFollowing = onboardedProfiles.map((profile: any) => ({
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        follower_count: profile.follower_count || 0,
        is_following: followingIds.has(profile.id),
        standing: profile.standing || null,
        badges: profile.badges || [],
        is_verified: profile.is_verified || false
      }));

      console.log('Final profiles to display:', profilesWithFollowing.length);
      setProfiles(profilesWithFollowing);
    } catch (error) {
      console.error('Error searching profiles:', error);
      setProfiles([]);
    }
  }

  async function toggleLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
      return;
    }

    try {
      if (currentlyLiked) {
        await supabase.from('liked_items').delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);
      } else {
        await supabase.from('liked_items')
          .insert({ user_id: currentUserId, item_id: itemId });
      }

      // Update local state
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId
            ? { ...item, is_liked: !currentlyLiked, like_count: item.like_count + (currentlyLiked ? -1 : 1) }
            : item
        )
      );

      if (expandedItem?.id === itemId) {
        setExpandedItem(prev => prev ? {
          ...prev,
          is_liked: !currentlyLiked,
          like_count: prev.like_count + (currentlyLiked ? -1 : 1)
        } : null);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  async function toggleBookmark(catalogId: string, currentlyBookmarked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
      return;
    }

    try {
      if (currentlyBookmarked) {
        await supabase.from('bookmarked_catalogs').delete()
          .eq('user_id', currentUserId)
          .eq('catalog_id', catalogId);
      } else {
        await supabase.from('bookmarked_catalogs')
          .insert({ user_id: currentUserId, catalog_id: catalogId });
      }

      setCatalogs(prevCatalogs =>
        prevCatalogs.map(catalog =>
          catalog.id === catalogId
            ? { ...catalog, is_bookmarked: !currentlyBookmarked, bookmark_count: catalog.bookmark_count + (currentlyBookmarked ? -1 : 1) }
            : catalog
        )
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }

  async function toggleFollow(profileId: string, currentlyFollowing: boolean) {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
      return;
    }

    if (profileId === currentUserId) return;

    try {
      if (currentlyFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId);
      } else {
        await supabase.from('follows')
          .insert({ follower_id: currentUserId, following_id: profileId });
      }

      setProfiles(prevProfiles =>
        prevProfiles.map(profile =>
          profile.id === profileId
            ? { ...profile, is_following: !currentlyFollowing, follower_count: profile.follower_count + (currentlyFollowing ? -1 : 1) }
            : profile
        )
      );
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    performSearch();
  }

  function changeTab(tab: SearchTab) {
    setActiveTab(tab);
    router.push(`/discover?tab=${tab}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`);
  }

  // Helper function to get standing badge based on profile
  function getStandingBadge(profile: SearchProfile) {
    // If user has manually assigned standing, use that
    if (profile.standing) {
      const standingConfig: Record<string, { label: string; icon: string; bg: string }> = {
        'legendary': { label: 'LEGENDARY', icon: '👑', bg: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' },
        'elite': { label: 'ELITE', icon: '⭐', bg: 'bg-black text-white' },
        'creator': { label: 'CREATOR', icon: '✦', bg: 'bg-black/80 text-white' },
        'rising': { label: 'RISING', icon: '◆', bg: 'bg-black/60 text-white' },
        'member': { label: 'MEMBER', icon: '○', bg: 'bg-black/20 text-black' }
      };
      return standingConfig[profile.standing] || standingConfig['member'];
    }

    // Otherwise calculate based on follower count
    if (profile.follower_count >= 1000) {
      return { label: 'ELITE', icon: '⭐', bg: 'bg-black text-white' };
    } else if (profile.follower_count >= 100) {
      return { label: 'CREATOR', icon: '✦', bg: 'bg-black/80 text-white' };
    } else if (profile.follower_count >= 10) {
      return { label: 'RISING', icon: '◆', bg: 'bg-black/60 text-white' };
    } else {
      return { label: 'MEMBER', icon: '○', bg: 'bg-black/20 text-black' };
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        input, textarea, select { font-size: 16px !important; }
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-0">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-6" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              DISCOVER
            </h1>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`SEARCH ${activeTab.toUpperCase()}...`}
                className="w-full px-4 py-3 border-2 border-black bg-white text-black placeholder-black/40 focus:outline-none focus:border-black text-sm tracking-wider"
                style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
              />
            </form>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => changeTab("items")}
                className={`px-6 py-2 text-xs tracking-wider font-black transition-all ${
                  activeTab === "items"
                    ? "bg-black text-white"
                    : "bg-white text-black border border-black/20 hover:bg-black/10"
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                ITEMS
              </button>
              <button
                onClick={() => changeTab("catalogs")}
                className={`px-6 py-2 text-xs tracking-wider font-black transition-all ${
                  activeTab === "catalogs"
                    ? "bg-black text-white"
                    : "bg-white text-black border border-black/20 hover:bg-black/10"
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                CATALOGS
              </button>
              <button
                onClick={() => changeTab("profiles")}
                className={`px-6 py-2 text-xs tracking-wider font-black transition-all ${
                  activeTab === "profiles"
                    ? "bg-black text-white"
                    : "bg-white text-black border border-black/20 hover:bg-black/10"
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                PROFILES
              </button>
            </div>

            {/* Filters - Only show for Items tab */}
            {activeTab === "items" && (
              <div className="border-t border-black/20 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="text-xs tracking-wider font-black hover:opacity-70 transition-opacity flex items-center gap-2"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {showFilters ? '▼' : '▶'} FILTERS
                    </button>
                    {(selectedCategory !== "all" || selectedColor !== "all" || selectedGender !== "all" || selectedSeason !== "all" || priceRange !== "all") && (
                      <button
                        onClick={() => {
                          setSelectedCategory("all");
                          setSelectedColor("all");
                          setSelectedGender("all");
                          setSelectedSeason("all");
                          setPriceRange("all");
                        }}
                        className="text-[10px] tracking-wider opacity-60 hover:opacity-100 transition-opacity underline"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CLEAR FILTERS
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] tracking-wider opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {items.length} RESULTS
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-1.5 border border-black/20 bg-white text-xs tracking-wider font-black focus:outline-none focus:border-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                    >
                      {sortOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pb-4">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-black/20 bg-white text-xs tracking-wider focus:outline-none focus:border-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>

                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="px-3 py-2 border border-black/20 bg-white text-xs tracking-wider focus:outline-none focus:border-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                    >
                      {colors.map(color => (
                        <option key={color.value} value={color.value}>{color.label}</option>
                      ))}
                    </select>

                    <select
                      value={selectedGender}
                      onChange={(e) => setSelectedGender(e.target.value)}
                      className="px-3 py-2 border border-black/20 bg-white text-xs tracking-wider focus:outline-none focus:border-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                    >
                      {genders.map(gender => (
                        <option key={gender.value} value={gender.value}>{gender.label}</option>
                      ))}
                    </select>

                    <select
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(e.target.value)}
                      className="px-3 py-2 border border-black/20 bg-white text-xs tracking-wider focus:outline-none focus:border-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                    >
                      {seasons.map(season => (
                        <option key={season.value} value={season.value}>{season.label}</option>
                      ))}
                    </select>

                    <select
                      value={priceRange}
                      onChange={(e) => setPriceRange(e.target.value)}
                      className="px-3 py-2 border border-black/20 bg-white text-xs tracking-wider focus:outline-none focus:border-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                    >
                      {priceRanges.map(range => (
                        <option key={range.value} value={range.value}>{range.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="text-center py-20">
                <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>LOADING...</p>
              </div>
            ) : (
              <>
                {/* Items Tab */}
                {activeTab === "items" && (
                  <>
                    {items.length === 0 ? (
                      <div className="text-center py-20">
                        <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NO ITEMS FOUND</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {items.map((item) => (
                          <div key={item.id} className="border border-black/20 hover:border-black transition-all">
                            <div className="aspect-square bg-white overflow-hidden cursor-pointer" onClick={() => { if (item.product_url) window.open(item.product_url, '_blank'); }}>
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            </div>

                            <div className="p-3 bg-white border-t border-black/20">
                              <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</h3>

                              <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-2">
                                {item.seller && <span className="truncate">{item.seller}</span>}
                                {item.price && <span className="ml-auto">{item.price}</span>}
                              </div>

                              {item.brand && (
                                <div className="text-[9px] tracking-wider opacity-40 mb-2">
                                  {item.brand}
                                </div>
                              )}

                              {/* Like count above buttons */}
                              <div className="flex items-center gap-1 text-[10px] tracking-wider opacity-60 mb-2">
                                <span>♥ {item.like_count} {item.like_count === 1 ? 'like' : 'likes'}</span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleLike(item.id, item.is_liked); }}
                                  className={`flex-1 py-1 border transition-all text-xs flex items-center justify-center gap-1 font-black ${
                                    item.is_liked
                                      ? 'border-black bg-black text-white hover:bg-white hover:text-black'
                                      : 'border-black/20 hover:border-black hover:bg-black/10'
                                  }`}
                                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                  {item.is_liked ? '♥ LIKED' : '♡ LIKE'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }}
                                  className="px-3 py-1 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs font-black"
                                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                  VIEW
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Catalogs Tab */}
                {activeTab === "catalogs" && (
                  <>
                    {catalogs.length === 0 ? (
                      <div className="text-center py-20">
                        <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NO CATALOGS FOUND</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {catalogs.map((catalog) => (
                          <div key={catalog.id} className="border-2 border-black/20 hover:border-black transition-all cursor-pointer" onClick={() => router.push(`/catalogs/${catalog.id}`)}>
                            <div className="aspect-square bg-black/5 overflow-hidden">
                              {catalog.image_url ? (
                                <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-6xl opacity-20">✦</span>
                                </div>
                              )}
                            </div>

                            <div className="p-4">
                              <h3 className="text-xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{catalog.name}</h3>

                              {catalog.description && (
                                <p className="text-sm opacity-60 mb-3 line-clamp-2">{catalog.description}</p>
                              )}

                              <div className="flex items-center gap-2 mb-3">
                                {/* Circular avatar */}
                                <div className="w-6 h-6 rounded-full border border-black overflow-hidden">
                                  {catalog.owner?.avatar_url ? (
                                    <img src={catalog.owner.avatar_url} alt={catalog.owner.username} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-black/5" />
                                  )}
                                </div>
                                <span className="text-xs tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>@{catalog.owner?.username}</span>
                              </div>

                              {/* More visible stats with full text */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-1 text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  <span>{catalog.item_count}</span>
                                  <span className="opacity-60">ITEMS</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  <span className="text-base">🔖</span>
                                  <span>{catalog.bookmark_count}</span>
                                  <span className="opacity-60">BOOKMARKS</span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => { e.stopPropagation(); toggleBookmark(catalog.id, catalog.is_bookmarked); }}
                                className={`w-full py-2 border-2 transition-all text-xs tracking-wider font-black ${
                                  catalog.is_bookmarked
                                    ? 'bg-black text-white border-black hover:bg-white hover:text-black'
                                    : 'border-black text-black hover:bg-black hover:text-white'
                                }`}
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                              >
                                {catalog.is_bookmarked ? '🔖 BOOKMARKED' : 'BOOKMARK'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Profiles Tab - Better pills */}
                {activeTab === "profiles" && (
                  <>
                    {profiles.length === 0 ? (
                      <div className="text-center py-20">
                        <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NO PROFILES FOUND</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {profiles.map((profile) => {
                          const standingBadge = getStandingBadge(profile);
                          return (
                            <div
                              key={profile.id}
                              className="border border-black/20 hover:border-black transition-all cursor-pointer"
                              style={{ borderRadius: '50px' }}
                              onClick={() => router.push(`/profiles/${profile.id}`)}
                            >
                              <div className="flex items-center gap-3 p-3">
                                {/* Circular avatar */}
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-black overflow-hidden flex-shrink-0">
                                  {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                      <span className="text-xl opacity-20">👤</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <h3 className="text-base md:text-lg font-black tracking-tighter truncate" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                                      @{profile.username}
                                    </h3>
                                    {profile.is_verified && (
                                      <span className="text-blue-500 text-sm flex-shrink-0">✓</span>
                                    )}
                                  </div>
                                  {profile.full_name && (
                                    <p className="text-xs opacity-60 mb-1.5 truncate">{profile.full_name}</p>
                                  )}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] tracking-wider opacity-60 flex-shrink-0">{profile.follower_count} FOLLOWERS</span>
                                    <div className={`px-1.5 py-0.5 ${standingBadge.bg} text-[8px] tracking-wider font-black flex-shrink-0`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                      {standingBadge.icon} {standingBadge.label}
                                    </div>
                                    {(profile.badges && profile.badges.length > 0) && profile.badges.slice(0, 2).map((badge, idx) => {
                                      const badgeDisplay: Record<string, { label: string; bg: string }> = {
                                        'early-adopter': { label: '🌟', bg: 'bg-purple-500 text-white' },
                                        'top-contributor': { label: '🏆', bg: 'bg-yellow-600 text-white' },
                                        'influencer': { label: '📢', bg: 'bg-pink-500 text-white' },
                                        'curator': { label: '🎨', bg: 'bg-indigo-500 text-white' },
                                        'trendsetter': { label: '⚡', bg: 'bg-orange-500 text-white' },
                                        'collector': { label: '💎', bg: 'bg-cyan-500 text-white' }
                                      };
                                      const badgeInfo = badgeDisplay[badge] || { label: badge[0].toUpperCase(), bg: 'bg-gray-500 text-white' };
                                      return (
                                        <div key={idx} className={`px-1 py-0.5 ${badgeInfo.bg} text-[8px] flex-shrink-0`}>
                                          {badgeInfo.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expanded Item Modal */}
        {expandedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setExpandedItem(null)}>
            <div className="relative w-full max-w-sm md:max-w-3xl max-h-[85vh] md:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setExpandedItem(null)} className="absolute -top-8 md:-top-12 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>[ESC]</button>

              <div className="bg-white border-2 border-white overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="aspect-square bg-black/5 overflow-hidden cursor-pointer" onClick={() => { if (expandedItem.product_url) window.open(expandedItem.product_url, '_blank'); }}>
                    <img src={expandedItem.image_url} alt={expandedItem.title} className="w-full h-full object-contain" />
                  </div>

                  <div className="p-4 md:p-8 space-y-3 md:space-y-6">
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{expandedItem.title}</h2>

                    {expandedItem.brand && (
                      <p className="text-xs md:text-sm tracking-wider opacity-60">BRAND: {expandedItem.brand}</p>
                    )}

                    {expandedItem.seller && (
                      <p className="text-xs md:text-sm tracking-wider opacity-60">SELLER: {expandedItem.seller}</p>
                    )}

                    {expandedItem.price && (
                      <p className="text-lg md:text-2xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{expandedItem.price}</p>
                    )}

                    {expandedItem.style_tags && expandedItem.style_tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {expandedItem.style_tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-black/10 text-[10px] tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 md:space-y-3">
                      <button
                        onClick={() => toggleLike(expandedItem.id, expandedItem.is_liked)}
                        className="w-full py-2 md:py-3 border-2 border-black hover:bg-black hover:text-white transition-all text-[10px] md:text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {expandedItem.is_liked ? '♥ LIKED' : '♡ LIKE'} ({expandedItem.like_count})
                      </button>

                      {expandedItem.product_url && (
                        <button
                          onClick={() => window.open(expandedItem.product_url!, '_blank')}
                          className="w-full py-2 md:py-3 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-[10px] md:text-xs tracking-[0.4em] font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          VIEW PRODUCT ↗
                        </button>
                      )}

                      <button
                        onClick={() => router.push(`/catalogs/${expandedItem.catalog.id}`)}
                        className="w-full py-2 md:py-3 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-[10px] md:text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        VIEW CATALOG: {expandedItem.catalog.name}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Message */}
        {showLoginMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 md:top-auto md:bottom-6 md:right-6 md:left-auto md:translate-x-0 z-[9999] w-[calc(100%-2rem)] max-w-sm">
            <div className="bg-black border-2 border-white p-4 shadow-lg relative">
              <button onClick={() => setShowLoginMessage(false)} className="absolute top-2 right-2 text-white hover:opacity-50 transition-opacity text-lg leading-none">✕</button>
              <p className="text-white text-sm tracking-wide pr-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>YOU MUST BE LOGGED IN</p>
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
        <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>LOADING...</p>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  );
}