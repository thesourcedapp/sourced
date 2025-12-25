"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Catalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bookmark_count: number;
  item_count: number;
  owner_username: string;
  owner_avatar: string | null;
  is_bookmarked?: boolean;
};

type Item = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  catalog_id: string;
  catalog_name: string;
  catalog_owner: string;
  is_liked?: boolean;
};

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
};

type SearchResult = {
  id: string;
  type: 'user' | 'catalog' | 'item';
  title: string;
  subtitle?: string;
  image?: string | null;
  metadata?: string;
};

export default function DiscoverPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalogs' | 'items' | 'profiles'>('catalogs');

  // Content data
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Counts
  const [catalogCount, setCatalogCount] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [profileCount, setProfileCount] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Expanded item modal
  const [expandedItem, setExpandedItem] = useState<Item | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadContent();
    }
  }, [activeTab, loading]);

  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    if (searchQuery.trim().length >= 2) {
      setShowSearch(true);
      const timer = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
      setSearchDebounce(timer);
    } else {
      setShowSearch(false);
      setSearchResults([]);
    }

    return () => {
      if (searchDebounce) clearTimeout(searchDebounce);
    };
  }, [searchQuery]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    setLoading(false);
  }

  async function loadContent() {
    setContentLoading(true);

    try {
      if (activeTab === 'catalogs') {
        await loadCatalogs();
      } else if (activeTab === 'items') {
        await loadItems();
      } else {
        await loadProfiles();
      }
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setContentLoading(false);
    }
  }

  async function loadCatalogs() {
    try {
      // Get total count
      const { count } = await supabase
        .from('catalogs')
        .select('*', { count: 'exact', head: true })
        .eq('visibility', 'public');

      setCatalogCount(count || 0);

      const { data, error } = await supabase
        .from('catalogs')
        .select('id, name, description, image_url, bookmark_count, owner_id, visibility')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length === 0) {
        setCatalogs([]);
        return;
      }

      // Get owner info
      const ownerIds = [...new Set(data.map(c => c.owner_id))];
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ownerIds);

      const ownersMap = new Map(owners?.map(o => [o.id, o]) || []);

      // Get item counts
      const catalogIds = data.map(c => c.id);
      const { data: itemCounts } = await supabase
        .from('catalog_items')
        .select('catalog_id')
        .in('catalog_id', catalogIds);

      const countsMap = new Map<string, number>();
      itemCounts?.forEach(item => {
        countsMap.set(item.catalog_id, (countsMap.get(item.catalog_id) || 0) + 1);
      });

      // Check if user has bookmarked
      let bookmarkedIds: string[] = [];
      if (currentUserId) {
        const { data: bookmarks } = await supabase
          .from('bookmarked_catalogs')
          .select('catalog_id')
          .eq('user_id', currentUserId)
          .in('catalog_id', catalogIds);

        bookmarkedIds = bookmarks?.map(b => b.catalog_id) || [];
      }

      const catalogsData: Catalog[] = data.map(cat => {
        const owner = ownersMap.get(cat.owner_id);
        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          image_url: cat.image_url,
          bookmark_count: cat.bookmark_count || 0,
          item_count: countsMap.get(cat.id) || 0,
          owner_username: owner?.username || 'unknown',
          owner_avatar: owner?.avatar_url || null,
          is_bookmarked: bookmarkedIds.includes(cat.id)
        };
      });

      setCatalogs(catalogsData);
    } catch (error) {
      console.error('Error loading catalogs:', error);
      setCatalogs([]);
    }
  }

  async function loadItems() {
    try {
      // Get total count
      const { count } = await supabase
        .from('catalog_items')
        .select('*', { count: 'exact', head: true });

      setItemCount(count || 0);

      const { data, error } = await supabase
        .from('catalog_items')
        .select('id, title, image_url, product_url, price, seller, like_count, catalog_id')
        .order('like_count', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length === 0) {
        setItems([]);
        return;
      }

      // Get catalog info
      const catalogIds = [...new Set(data.map(i => i.catalog_id))];
      const { data: catalogsData } = await supabase
        .from('catalogs')
        .select('id, name, owner_id, visibility')
        .in('id', catalogIds);

      const catalogsMap = new Map(catalogsData?.map(c => [c.id, c]) || []);

      // Get owner info
      const ownerIds = [...new Set(catalogsData?.map(c => c.owner_id) || [])];
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ownerIds);

      const ownersMap = new Map(owners?.map(o => [o.id, o]) || []);

      // Check if user has liked
      let likedIds: string[] = [];
      if (currentUserId) {
        const { data: likes } = await supabase
          .from('liked_items')
          .select('item_id')
          .eq('user_id', currentUserId)
          .in('item_id', data.map(i => i.id));

        likedIds = likes?.map(l => l.item_id) || [];
      }

      const itemsData: Item[] = data
        .filter(item => catalogsMap.get(item.catalog_id)?.visibility === 'public')
        .map(item => {
          const catalog = catalogsMap.get(item.catalog_id);
          const owner = catalog ? ownersMap.get(catalog.owner_id) : null;

          return {
            id: item.id,
            title: item.title,
            image_url: item.image_url,
            product_url: item.product_url,
            price: item.price,
            seller: item.seller,
            like_count: item.like_count || 0,
            catalog_id: item.catalog_id,
            catalog_name: catalog?.name || 'Unknown',
            catalog_owner: owner?.username || 'unknown',
            is_liked: likedIds.includes(item.id)
          };
        });

      setItems(itemsData);
    } catch (error) {
      console.error('Error loading items:', error);
      setItems([]);
    }
  }

  async function loadProfiles() {
    try {
      // Get total count
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_onboarded', true);

      setProfileCount(count || 0);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, followers_count, following_count')
        .eq('is_onboarded', true)
        .order('followers_count', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Check if current user follows these profiles
      let followingIds: string[] = [];
      if (currentUserId && data) {
        const { data: following } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', currentUserId)
          .in('following_id', data.map(p => p.id));

        followingIds = following?.map(f => f.following_id) || [];
      }

      const profilesData: Profile[] = (data || []).map(profile => ({
        ...profile,
        is_following: followingIds.includes(profile.id)
      }));

      setProfiles(profilesData);
    } catch (error) {
      console.error('Error loading profiles:', error);
      setProfiles([]);
    }
  }

  async function toggleLike(itemId: string) {
    if (!currentUserId) {
      router.push('/');
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const wasLiked = item.is_liked;

    // Optimistic update
    setItems(items.map(i =>
      i.id === itemId
        ? { ...i, is_liked: !wasLiked, like_count: wasLiked ? i.like_count - 1 : i.like_count + 1 }
        : i
    ));

    if (expandedItem?.id === itemId) {
      setExpandedItem({
        ...expandedItem,
        is_liked: !wasLiked,
        like_count: wasLiked ? expandedItem.like_count - 1 : expandedItem.like_count + 1
      });
    }

    try {
      if (wasLiked) {
        await supabase
          .from('liked_items')
          .delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);
      } else {
        await supabase
          .from('liked_items')
          .insert({ user_id: currentUserId, item_id: itemId });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      setItems(items.map(i =>
        i.id === itemId
          ? { ...i, is_liked: wasLiked, like_count: item.like_count }
          : i
      ));
    }
  }

  async function toggleBookmark(catalogId: string) {
    if (!currentUserId) {
      router.push('/');
      return;
    }

    const catalog = catalogs.find(c => c.id === catalogId);
    if (!catalog) return;

    const wasBookmarked = catalog.is_bookmarked;

    // Optimistic update
    setCatalogs(catalogs.map(c =>
      c.id === catalogId
        ? { ...c, is_bookmarked: !wasBookmarked, bookmark_count: wasBookmarked ? c.bookmark_count - 1 : c.bookmark_count + 1 }
        : c
    ));

    try {
      if (wasBookmarked) {
        await supabase
          .from('bookmarked_catalogs')
          .delete()
          .eq('user_id', currentUserId)
          .eq('catalog_id', catalogId);
      } else {
        await supabase
          .from('bookmarked_catalogs')
          .insert({ user_id: currentUserId, catalog_id: catalogId });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      // Revert on error
      setCatalogs(catalogs.map(c =>
        c.id === catalogId
          ? { ...c, is_bookmarked: wasBookmarked, bookmark_count: catalog.bookmark_count }
          : c
      ));
    }
  }

  async function toggleFollow(profileId: string) {
    if (!currentUserId) {
      router.push('/');
      return;
    }

    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const wasFollowing = profile.is_following;

    // Optimistic update
    setProfiles(profiles.map(p =>
      p.id === profileId
        ? { ...p, is_following: !wasFollowing, followers_count: wasFollowing ? p.followers_count - 1 : p.followers_count + 1 }
        : p
    ));

    try {
      if (wasFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId);
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: currentUserId, following_id: profileId });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert on error
      setProfiles(profiles.map(p =>
        p.id === profileId
          ? { ...p, is_following: wasFollowing, followers_count: profile.followers_count }
          : p
      ));
    }
  }

  async function performSearch(query: string) {
    setSearchLoading(true);
    const results: SearchResult[] = [];

    try {
      // Search users
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, followers_count')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .eq('is_onboarded', true)
        .limit(5);

      users?.forEach(user => {
        results.push({
          id: user.id,
          type: 'user',
          title: `@${user.username}`,
          subtitle: user.full_name || undefined,
          image: user.avatar_url,
          metadata: `${user.followers_count || 0} followers`
        });
      });

      // Search catalogs
      const { data: catalogsData } = await supabase
        .from('catalogs')
        .select('id, name, image_url, owner_id, visibility')
        .ilike('name', `%${query}%`)
        .eq('visibility', 'public')
        .limit(5);

      if (catalogsData && catalogsData.length > 0) {
        const ownerIds = [...new Set(catalogsData.map(c => c.owner_id))];
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', ownerIds);

        const ownersMap = new Map(owners?.map(o => [o.id, o]) || []);

        const catalogIds = catalogsData.map(c => c.id);
        const { data: itemCounts } = await supabase
          .from('catalog_items')
          .select('catalog_id')
          .in('catalog_id', catalogIds);

        const countsMap = new Map<string, number>();
        itemCounts?.forEach(item => {
          countsMap.set(item.catalog_id, (countsMap.get(item.catalog_id) || 0) + 1);
        });

        catalogsData.forEach(cat => {
          const owner = ownersMap.get(cat.owner_id);
          results.push({
            id: cat.id,
            type: 'catalog',
            title: cat.name,
            subtitle: `by @${owner?.username || 'unknown'}`,
            image: cat.image_url,
            metadata: `${countsMap.get(cat.id) || 0} items`
          });
        });
      }

      // Search items
      const { data: itemsData } = await supabase
        .from('catalog_items')
        .select('id, title, image_url, price, catalog_id')
        .ilike('title', `%${query}%`)
        .limit(5);

      if (itemsData && itemsData.length > 0) {
        const catalogIds = [...new Set(itemsData.map(i => i.catalog_id))];
        const { data: catalogsForItems } = await supabase
          .from('catalogs')
          .select('id, name, visibility')
          .in('id', catalogIds);

        const catalogsForItemsMap = new Map(catalogsForItems?.map(c => [c.id, c]) || []);

        itemsData
          .filter(item => catalogsForItemsMap.get(item.catalog_id)?.visibility === 'public')
          .forEach(item => {
            const catalog = catalogsForItemsMap.get(item.catalog_id);
            results.push({
              id: item.id,
              type: 'item',
              title: item.title,
              subtitle: catalog?.name,
              image: item.image_url,
              metadata: item.price || undefined
            });
          });
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleResultClick(result: SearchResult) {
    setShowSearch(false);
    setSearchQuery('');

    if (result.type === 'user') {
      router.push(`/profiles/${result.id}`);
    } else if (result.type === 'catalog') {
      router.push(`/catalogs/${result.id}`);
    } else if (result.type === 'item') {
      const item = items.find(i => i.id === result.id);
      if (item) {
        setExpandedItem(item);
      }
    }
  }

  function getResultCount() {
    if (activeTab === 'catalogs') return catalogCount;
    if (activeTab === 'items') return itemCount;
    return profileCount;
  }

  function getDisplayedCount() {
    if (activeTab === 'catalogs') return catalogs.length;
    if (activeTab === 'items') return items.length;
    return profiles.length;
  }

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            LOADING...
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        /* Prevent zoom on mobile inputs */
        input, textarea, select {
          font-size: 16px !important;
        }
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Header with Search */}
        <div className="sticky top-0 z-40 bg-white border-b border-black/20">
          <div className="max-w-7xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                DISCOVER
              </h1>

              {/* Result count */}
              {!contentLoading && (
                <div className="text-right">
                  <p className="text-xs tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    SHOWING {getDisplayedCount()} OF {getResultCount()}
                  </p>
                </div>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH USERS, CATALOGS, ITEMS..."
                className="w-full px-4 py-3 bg-white border-2 border-black focus:outline-none text-sm tracking-wider"
                style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
              />

              {/* Search Results Dropdown */}
              {showSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-black max-h-96 overflow-y-auto z-50">
                  {searchLoading ? (
                    <div className="p-8 text-center">
                      <p className="text-xs tracking-wider opacity-40">SEARCHING...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-xs tracking-wider opacity-40">NO RESULTS</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-black/10">
                      {searchResults.map(result => (
                        <div
                          key={`${result.type}_${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="p-3 md:p-4 hover:bg-black/5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {result.image ? (
                              <img
                                src={result.image}
                                alt={result.title}
                                className="w-10 h-10 md:w-12 md:h-12 object-cover border border-black/20"
                              />
                            ) : (
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-black/5 border border-black/20 flex items-center justify-center">
                                <span className="text-lg md:text-2xl opacity-20">
                                  {result.type === 'user' ? '👤' : result.type === 'catalog' ? '✦' : '◆'}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs md:text-sm font-black tracking-wide truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {result.title}
                                </p>
                                <span className="text-[8px] md:text-[9px] tracking-wider opacity-40 uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {result.type}
                                </span>
                              </div>
                              {result.subtitle && (
                                <p className="text-[10px] md:text-xs opacity-60 truncate">{result.subtitle}</p>
                              )}
                              {result.metadata && (
                                <p className="text-[9px] md:text-[10px] tracking-wider opacity-40 mt-1">{result.metadata}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 md:gap-2 border-b border-black/20 -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab('catalogs')}
                className={`px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'catalogs'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                CATALOGS
              </button>
              <button
                onClick={() => setActiveTab('items')}
                className={`px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'items'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                ITEMS
              </button>
              <button
                onClick={() => setActiveTab('profiles')}
                className={`px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'profiles'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                PROFILES
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {contentLoading ? (
            <div className="py-20 text-center">
              <p className="text-xs tracking-[0.4em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                LOADING...
              </p>
            </div>
          ) : (
            <>
              {/* Catalogs Grid */}
              {activeTab === 'catalogs' && (
                <div>
                  {catalogs.length === 0 ? (
                    <div className="py-20 text-center border border-black/20">
                      <div className="text-6xl opacity-10 mb-4">✦</div>
                      <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        NO CATALOGS YET
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                      {catalogs.map(catalog => (
                        <div
                          key={catalog.id}
                          className="group border border-black/20 hover:border-black transition-all"
                        >
                          <div
                            className="cursor-pointer"
                            onClick={() => router.push(`/catalogs/${catalog.id}`)}
                          >
                            <div className="aspect-square bg-white overflow-hidden">
                              {catalog.image_url ? (
                                <img
                                  src={catalog.image_url}
                                  alt={catalog.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                  <span className="text-6xl opacity-20">✦</span>
                                </div>
                              )}
                            </div>

                            <div className="p-3 md:p-4 border-t border-black/20">
                              <h3 className="text-sm md:text-base font-black tracking-wide uppercase truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {catalog.name}
                              </h3>
                              <p className="text-[10px] md:text-xs tracking-wider opacity-40 mb-2 truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                BY @{catalog.owner_username}
                              </p>
                              <div className="flex items-center justify-between text-[10px] md:text-xs tracking-wider opacity-60">
                                <span>🔖 {catalog.bookmark_count}</span>
                                <span>{catalog.item_count} items</span>
                              </div>
                            </div>
                          </div>

                          {/* Bookmark button */}
                          {currentUserId && (
                            <div className="p-2 md:p-3 border-t border-black/10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark(catalog.id);
                                }}
                                className={`w-full py-1.5 md:py-2 border transition-all text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.4em] font-black ${
                                  catalog.is_bookmarked
                                    ? 'bg-black text-white border-black hover:bg-white hover:text-black'
                                    : 'border-black hover:bg-black hover:text-white'
                                }`}
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                              >
                                {catalog.is_bookmarked ? '🔖 BOOKMARKED' : 'BOOKMARK'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Items Grid */}
              {activeTab === 'items' && (
                <div>
                  {items.length === 0 ? (
                    <div className="py-20 text-center border border-black/20">
                      <div className="text-6xl opacity-10 mb-4">◆</div>
                      <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        NO ITEMS YET
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="group border border-black/20 hover:border-black transition-all"
                        >
                          {/* Image - clickable to product */}
                          <a
                            href={item.product_url || '#'}
                            target={item.product_url ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            className="block aspect-square bg-white overflow-hidden"
                            onClick={(e) => {
                              if (!item.product_url) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </a>

                          {/* Info */}
                          <div className="p-2 md:p-3 bg-white border-t border-black/20">
                            <h3 className="text-[10px] md:text-xs font-black tracking-wide uppercase leading-tight truncate mb-1 md:mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {item.title}
                            </h3>

                            <p className="text-[8px] md:text-[9px] tracking-wider opacity-40 mb-1 md:mb-2 truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {item.catalog_name}
                            </p>

                            <div className="flex items-center justify-between text-[9px] md:text-[10px] tracking-wider opacity-60 mb-2">
                              <span>♥ {item.like_count}</span>
                              {item.price && <span className="ml-auto truncate">{item.price}</span>}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-1 md:gap-2">
                              {currentUserId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLike(item.id);
                                  }}
                                  className={`flex-1 py-1 md:py-1.5 border transition-all text-[9px] md:text-[10px] font-black ${
                                    item.is_liked
                                      ? 'bg-black text-white border-black'
                                      : 'border-black hover:bg-black hover:text-white'
                                  }`}
                                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                  ♥
                                </button>
                              )}
                              <button
                                onClick={() => setExpandedItem(item)}
                                className="flex-1 py-1 md:py-1.5 border border-black hover:bg-black hover:text-white transition-all text-[9px] md:text-[10px] font-black"
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
                </div>
              )}

              {/* Profiles Grid */}
              {activeTab === 'profiles' && (
                <div>
                  {profiles.length === 0 ? (
                    <div className="py-20 text-center border border-black/20">
                      <div className="text-6xl opacity-10 mb-4">👤</div>
                      <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        NO PROFILES YET
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {profiles.map(profile => (
                        <div
                          key={profile.id}
                          className="border border-black/20 hover:border-black transition-all"
                        >
                          <div
                            className="p-4 md:p-6 cursor-pointer hover:bg-black/5 transition-colors"
                            onClick={() => router.push(`/profiles/${profile.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-black rounded-full overflow-hidden flex-shrink-0">
                                {profile.avatar_url ? (
                                  <img
                                    src={profile.avatar_url}
                                    alt={profile.username}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                    <span className="text-3xl md:text-4xl opacity-20">👤</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="text-base md:text-lg font-black tracking-wide truncate mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  @{profile.username}
                                </h3>
                                {profile.full_name && (
                                  <p className="text-xs md:text-sm opacity-60 truncate mb-2">{profile.full_name}</p>
                                )}
                                <div className="flex items-center gap-3 text-[10px] md:text-xs tracking-wider opacity-40">
                                  <span>{profile.followers_count} followers</span>
                                  <span>{profile.following_count} following</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Follow button */}
                          {currentUserId && currentUserId !== profile.id && (
                            <div className="p-3 md:p-4 border-t border-black/10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFollow(profile.id);
                                }}
                                className={`w-full py-2 border-2 transition-all text-xs tracking-[0.4em] font-black ${
                                  profile.is_following
                                    ? 'border-black text-black hover:bg-black hover:text-white'
                                    : 'bg-black text-white hover:bg-white hover:text-black border-black'
                                }`}
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                              >
                                {profile.is_following ? 'UNFOLLOW' : 'FOLLOW'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Expanded Item Modal */}
        {expandedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setExpandedItem(null)}
          >
            <div className="relative max-w-sm md:max-w-3xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setExpandedItem(null)}
                className="absolute -top-8 md:-top-10 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="bg-white border-2 border-white overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  {/* Image */}
                  <div className="aspect-square bg-black/5 overflow-hidden">
                    <img
                      src={expandedItem.image_url}
                      alt={expandedItem.title}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Details */}
                  <div className="p-6 md:p-8 space-y-4 md:space-y-6">
                    <h2 className="text-xl md:text-2xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      {expandedItem.title}
                    </h2>

                    <p className="text-xs md:text-sm tracking-wider opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      FROM @{expandedItem.catalog_owner} / {expandedItem.catalog_name}
                    </p>

                    {expandedItem.seller && (
                      <p className="text-xs md:text-sm tracking-wider opacity-60">
                        SELLER: {expandedItem.seller}
                      </p>
                    )}

                    {expandedItem.price && (
                      <p className="text-lg md:text-xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {expandedItem.price}
                      </p>
                    )}

                    <div className="space-y-3">
                      <p className="text-xs opacity-60">
                        ♥ {expandedItem.like_count} {expandedItem.like_count === 1 ? 'LIKE' : 'LIKES'}
                      </p>

                      {expandedItem.product_url && (
                        <a
                          href={expandedItem.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full py-2.5 md:py-3 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-xs tracking-[0.4em] font-black text-center"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          VIEW PRODUCT ↗
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setExpandedItem(null);
                          router.push(`/catalogs/${expandedItem.catalog_id}`);
                        }}
                        className="w-full py-2.5 md:py-3 border-2 border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        VIEW CATALOG
                      </button>

                      {currentUserId && (
                        <button
                          onClick={() => toggleLike(expandedItem.id)}
                          className={`w-full py-2.5 md:py-3 border-2 transition-all text-xs tracking-[0.4em] font-black ${
                            expandedItem.is_liked
                              ? 'bg-black text-white border-black hover:bg-white hover:text-black'
                              : 'border-black hover:bg-black hover:text-white'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          {expandedItem.is_liked ? '♥ LIKED' : 'LIKE'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}