"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type FeedItem = {
  id: string;
  type: 'catalog_created' | 'item_liked' | 'catalog_bookmarked';
  user_id: string;
  username: string;
  user_avatar: string | null;
  full_name: string | null;
  catalog_id?: string;
  catalog_name?: string;
  catalog_image?: string | null;
  catalog_item_count?: number;
  item_id?: string;
  item_title?: string;
  item_image?: string | null;
  item_price?: string | null;
  created_at: string;
};

type TrendingCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  owner_username: string;
  owner_avatar: string | null;
  bookmark_count: number;
  item_count: number;
};

type TrendingItem = {
  id: string;
  title: string;
  image_url: string;
  price: string | null;
  seller: string | null;
  catalog_name: string;
  catalog_owner: string;
  like_count: number;
  catalog_id: string;
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
  const [activeTab, setActiveTab] = useState<'feed' | 'trending'>('feed');

  // Feed data
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // Trending data
  const [trendingCatalogs, setTrendingCatalogs] = useState<TrendingCatalog[]>([]);
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      if (activeTab === 'feed') {
        loadFeed();
      } else {
        loadTrending();
      }
    }
  }, [currentUserId, activeTab]);

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

  async function loadFeed() {
    if (!currentUserId) return;

    setFeedLoading(true);
    try {
      // Get users that current user follows
      const { data: following } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (!following || following.length === 0) {
        setFeed([]);
        setFeedLoading(false);
        return;
      }

      const followingIds = following.map(f => f.following_id);
      const feedItems: FeedItem[] = [];

      // Get recent catalogs created by followed users
      const { data: catalogs } = await supabase
        .from('catalogs')
        .select(`
          id, name, image_url, created_at, owner_id, visibility,
          catalog_items(count),
          profiles!catalogs_owner_id_fkey(username, avatar_url, full_name)
        `)
        .in('owner_id', followingIds)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20);

      catalogs?.forEach(cat => {
        const profile = Array.isArray(cat.profiles) ? cat.profiles[0] : cat.profiles;
        if (!profile) return;

        feedItems.push({
          id: `catalog_${cat.id}`,
          type: 'catalog_created',
          user_id: cat.owner_id,
          username: profile.username,
          user_avatar: profile.avatar_url,
          full_name: profile.full_name,
          catalog_id: cat.id,
          catalog_name: cat.name,
          catalog_image: cat.image_url,
          catalog_item_count: cat.catalog_items?.[0]?.count || 0,
          created_at: cat.created_at
        });
      });

      // Get recent items liked by followed users
      const { data: likes } = await supabase
        .from('liked_items')
        .select(`
          item_id, user_id, created_at,
          profiles!liked_items_user_id_fkey(username, avatar_url, full_name),
          catalog_items!liked_items_item_id_fkey(
            id, title, image_url, price, catalog_id,
            catalogs!catalog_items_catalog_id_fkey(name, visibility)
          )
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20);

      likes?.forEach(like => {
        const profile = Array.isArray(like.profiles) ? like.profiles[0] : like.profiles;
        const item = like.catalog_items;
        if (!profile || !item?.catalogs) return;

        if (item.catalogs.visibility === 'public') {
          feedItems.push({
            id: `like_${like.item_id}_${like.user_id}`,
            type: 'item_liked',
            user_id: like.user_id,
            username: profile.username,
            user_avatar: profile.avatar_url,
            full_name: profile.full_name,
            item_id: item.id,
            item_title: item.title,
            item_image: item.image_url,
            item_price: item.price,
            catalog_name: item.catalogs.name,
            created_at: like.created_at
          });
        }
      });

      // Get recent catalog bookmarks by followed users
      const { data: bookmarks } = await supabase
        .from('bookmarked_catalogs')
        .select(`
          catalog_id, user_id, created_at,
          profiles!bookmarked_catalogs_user_id_fkey(username, avatar_url, full_name),
          catalogs!bookmarked_catalogs_catalog_id_fkey(
            id, name, image_url, visibility,
            catalog_items(count)
          )
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20);

      bookmarks?.forEach(bookmark => {
        const profile = Array.isArray(bookmark.profiles) ? bookmark.profiles[0] : bookmark.profiles;
        const cat = bookmark.catalogs;
        if (!profile || !cat) return;

        if (cat.visibility === 'public') {
          feedItems.push({
            id: `bookmark_${bookmark.catalog_id}_${bookmark.user_id}`,
            type: 'catalog_bookmarked',
            user_id: bookmark.user_id,
            username: profile.username,
            user_avatar: profile.avatar_url,
            full_name: profile.full_name,
            catalog_id: cat.id,
            catalog_name: cat.name,
            catalog_image: cat.image_url,
            catalog_item_count: cat.catalog_items?.[0]?.count || 0,
            created_at: bookmark.created_at
          });
        }
      });

      // Sort all feed items by date
      feedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFeed(feedItems.slice(0, 30));
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadTrending() {
    setTrendingLoading(true);
    try {
      // Get trending catalogs (most bookmarked in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: catalogs } = await supabase
        .from('catalogs')
        .select(`
          id, name, description, image_url, bookmark_count, owner_id, visibility,
          catalog_items(count),
          profiles!catalogs_owner_id_fkey(username, avatar_url)
        `)
        .eq('visibility', 'public')
        .gte('bookmark_count', 1)
        .order('bookmark_count', { ascending: false })
        .limit(12);

      setTrendingCatalogs(catalogs?.map(cat => {
        const profile = Array.isArray(cat.profiles) ? cat.profiles[0] : cat.profiles;
        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          image_url: cat.image_url,
          owner_username: profile?.username || 'unknown',
          owner_avatar: profile?.avatar_url || null,
          bookmark_count: cat.bookmark_count || 0,
          item_count: cat.catalog_items?.[0]?.count || 0
        };
      }) || []);

      // Get trending items (most liked)
      const { data: items } = await supabase
        .from('catalog_items')
        .select(`
          id, title, image_url, price, seller, like_count, catalog_id,
          catalogs!catalog_items_catalog_id_fkey(
            name, owner_id, visibility,
            profiles!catalogs_owner_id_fkey(username)
          )
        `)
        .gte('like_count', 1)
        .order('like_count', { ascending: false })
        .limit(20);

      setTrendingItems(items?.filter(item => item.catalogs?.visibility === 'public').map(item => {
        const profile = item.catalogs?.profiles ? (Array.isArray(item.catalogs.profiles) ? item.catalogs.profiles[0] : item.catalogs.profiles) : null;
        return {
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          price: item.price,
          seller: item.seller,
          catalog_name: item.catalogs!.name,
          catalog_owner: profile?.username || 'unknown',
          like_count: item.like_count || 0,
          catalog_id: item.catalog_id
        };
      }) || []);
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setTrendingLoading(false);
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
      const { data: catalogs } = await supabase
        .from('catalogs')
        .select(`
          id, name, description, image_url, owner_id, visibility,
          catalog_items(count),
          profiles!catalogs_owner_id_fkey(username)
        `)
        .ilike('name', `%${query}%`)
        .eq('visibility', 'public')
        .limit(5);

      catalogs?.forEach(cat => {
        const profile = Array.isArray(cat.profiles) ? cat.profiles[0] : cat.profiles;
        results.push({
          id: cat.id,
          type: 'catalog',
          title: cat.name,
          subtitle: `by @${profile?.username || 'unknown'}`,
          image: cat.image_url,
          metadata: `${cat.catalog_items?.[0]?.count || 0} items`
        });
      });

      // Search items
      const { data: items } = await supabase
        .from('catalog_items')
        .select(`
          id, title, image_url, price, catalog_id,
          catalogs!catalog_items_catalog_id_fkey(name, visibility)
        `)
        .ilike('title', `%${query}%`)
        .limit(5);

      items?.filter(item => item.catalogs?.visibility === 'public').forEach(item => {
        results.push({
          id: item.id,
          type: 'item',
          title: item.title,
          subtitle: item.catalogs?.name,
          image: item.image_url,
          metadata: item.price || undefined
        });
      });

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
      // Navigate to catalog containing the item
      const item = trendingItems.find(i => i.id === result.id);
      if (item) {
        router.push(`/catalogs/${item.catalog_id}`);
      }
    }
  }

  function getFeedItemAction(item: FeedItem) {
    if (item.type === 'catalog_created') {
      return 'created a catalog';
    } else if (item.type === 'item_liked') {
      return 'liked an item';
    } else {
      return 'bookmarked a catalog';
    }
  }

  function getTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
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

  if (!currentUserId) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              LOGIN
              <br />
              REQUIRED
            </h1>
            <p className="text-sm tracking-wider opacity-60">
              Sign in to discover fashion
            </p>
          </div>
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
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              DISCOVER
            </h1>

            {/* Search Bar */}
            <div className="relative">
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
                          className="p-4 hover:bg-black/5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {result.image ? (
                              <img
                                src={result.image}
                                alt={result.title}
                                className="w-12 h-12 object-cover border border-black/20"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-black/5 border border-black/20 flex items-center justify-center">
                                <span className="text-2xl opacity-20">
                                  {result.type === 'user' ? '👤' : result.type === 'catalog' ? '✦' : '◆'}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black tracking-wide truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {result.title}
                                </p>
                                <span className="text-[9px] tracking-wider opacity-40 uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {result.type}
                                </span>
                              </div>
                              {result.subtitle && (
                                <p className="text-xs opacity-60 truncate">{result.subtitle}</p>
                              )}
                              {result.metadata && (
                                <p className="text-[10px] tracking-wider opacity-40 mt-1">{result.metadata}</p>
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
            <div className="flex gap-2 mt-4 border-b border-black/20 -mb-px">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-6 py-3 text-sm tracking-wider font-black border-b-2 transition-all ${
                  activeTab === 'feed'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                FEED
              </button>
              <button
                onClick={() => setActiveTab('trending')}
                className={`px-6 py-3 text-sm tracking-wider font-black border-b-2 transition-all ${
                  activeTab === 'trending'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                TRENDING
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {/* Feed Tab */}
          {activeTab === 'feed' && (
            <div>
              {feedLoading ? (
                <div className="py-20 text-center">
                  <p className="text-xs tracking-[0.4em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    LOADING FEED...
                  </p>
                </div>
              ) : feed.length === 0 ? (
                <div className="py-20 text-center border border-black/20">
                  <div className="text-6xl opacity-10 mb-4">✦</div>
                  <p className="text-lg tracking-wider opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    NO ACTIVITY YET
                  </p>
                  <p className="text-sm tracking-wide opacity-30">
                    Follow users to see their activity here
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {feed.map(item => (
                    <div key={item.id} className="border border-black/20 hover:border-black transition-all">
                      {/* User Header */}
                      <div
                        className="p-4 border-b border-black/10 flex items-center gap-3 cursor-pointer hover:bg-black/5"
                        onClick={() => router.push(`/profiles/${item.user_id}`)}
                      >
                        <div className="w-10 h-10 border border-black overflow-hidden">
                          {item.user_avatar ? (
                            <img src={item.user_avatar} alt={item.username} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-black/5 flex items-center justify-center">
                              <span className="text-sm opacity-20">👤</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black tracking-wide truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            @{item.username}
                          </p>
                          <p className="text-xs opacity-60 truncate">
                            {getFeedItemAction(item)} · {getTimeAgo(item.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Content */}
                      {(item.type === 'catalog_created' || item.type === 'catalog_bookmarked') && (
                        <div
                          className="cursor-pointer"
                          onClick={() => router.push(`/catalogs/${item.catalog_id}`)}
                        >
                          <div className="aspect-video bg-black/5 overflow-hidden">
                            {item.catalog_image ? (
                              <img src={item.catalog_image} alt={item.catalog_name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-6xl opacity-10">✦</span>
                              </div>
                            )}
                          </div>
                          <div className="p-4 border-t border-black/10">
                            <h3 className="text-lg font-black tracking-wide uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {item.catalog_name}
                            </h3>
                            <p className="text-xs tracking-wider opacity-60">
                              {item.catalog_item_count} items
                            </p>
                          </div>
                        </div>
                      )}

                      {item.type === 'item_liked' && (
                        <div className="grid grid-cols-2 md:grid-cols-3">
                          <div className="aspect-square bg-black/5 overflow-hidden">
                            <img src={item.item_image!} alt={item.item_title} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-4 border-l border-black/10 col-span-1 md:col-span-2 flex flex-col justify-center">
                            <h3 className="text-base md:text-lg font-black tracking-wide uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {item.item_title}
                            </h3>
                            <p className="text-xs tracking-wider opacity-60 mb-2">
                              from {item.catalog_name}
                            </p>
                            {item.item_price && (
                              <p className="text-sm font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {item.item_price}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trending Tab */}
          {activeTab === 'trending' && (
            <div className="space-y-12">
              {trendingLoading ? (
                <div className="py-20 text-center">
                  <p className="text-xs tracking-[0.4em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    LOADING TRENDING...
                  </p>
                </div>
              ) : (
                <>
                  {/* Trending Catalogs */}
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter mb-6 pb-3 border-b border-black/20" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      TRENDING CATALOGS
                    </h2>
                    {trendingCatalogs.length === 0 ? (
                      <div className="py-12 text-center border border-black/20">
                        <p className="text-sm tracking-wider opacity-40">No trending catalogs</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trendingCatalogs.map(catalog => (
                          <div
                            key={catalog.id}
                            className="group cursor-pointer border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200"
                            onClick={() => router.push(`/catalogs/${catalog.id}`)}
                          >
                            <div className="aspect-square bg-white overflow-hidden">
                              {catalog.image_url ? (
                                <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                  <span className="text-6xl opacity-20">✦</span>
                                </div>
                              )}
                            </div>
                            <div className="p-4 border-t border-black/20">
                              <h3 className="text-lg font-black tracking-wide uppercase truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {catalog.name}
                              </h3>
                              <p className="text-xs tracking-wider opacity-40 mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                BY @{catalog.owner_username}
                              </p>
                              <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                                <span>🔖 {catalog.bookmark_count}</span>
                                <span>{catalog.item_count} items</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trending Items */}
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter mb-6 pb-3 border-b border-black/20" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      TRENDING ITEMS
                    </h2>
                    {trendingItems.length === 0 ? (
                      <div className="py-12 text-center border border-black/20">
                        <p className="text-sm tracking-wider opacity-40">No trending items</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {trendingItems.map(item => (
                          <div
                            key={item.id}
                            className="group cursor-pointer border border-black/20 hover:border-black transition-all"
                            onClick={() => router.push(`/catalogs/${item.catalog_id}`)}
                          >
                            <div className="aspect-square bg-white overflow-hidden">
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-3 bg-white border-t border-black/20">
                              <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {item.title}
                              </h3>
                              <p className="text-[9px] tracking-wider opacity-40 mb-1 truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {item.catalog_name}
                              </p>
                              <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60">
                                <span>♥ {item.like_count}</span>
                                {item.price && <span className="ml-auto truncate">{item.price}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}