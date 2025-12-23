"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type SearchResult = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  catalog_id: string;
  catalog_name: string;
  catalog_owner: string;
  like_count: number;
  is_liked: boolean;
};

type CatalogResult = {
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

type ProfileResult = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  catalog_count: number;
  total_items: number;
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState<'items' | 'catalogs' | 'profiles'>('items');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Items
  const [itemResults, setItemResults] = useState<SearchResult[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

  // Catalogs
  const [catalogResults, setCatalogResults] = useState<CatalogResult[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);

  // Profiles
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
  if (query) {
    // Search all tabs when query changes to get counts for all tabs
    performItemSearch(query);
    performCatalogSearch(query);
    performProfileSearch(query);
  } else {
    setItemResults([]);
    setCatalogResults([]);
    setProfileResults([]);
  }
}, [query, currentUserId]);

// Remove the activeTab dependency from the search useEffect
// The tab switching will just change which results are displayed, not trigger new searches

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function performItemSearch(searchTerm: string) {
    if (!searchTerm.trim()) {
      setItemResults([]);
      return;
    }

    setItemsLoading(true);

    try {
      // Split search term into individual keywords
      const keywords = searchTerm.trim().toLowerCase().split(/\s+/);

      // Build OR conditions for each keyword
      const orConditions = keywords.flatMap(keyword => [
        `title.ilike.%${keyword}%`,
        `seller.ilike.%${keyword}%`
      ]).join(',');

      // Search catalog_items with catalog info
      const { data, error } = await supabase
        .from('catalog_items')
        .select(`
          id,
          title,
          image_url,
          product_url,
          price,
          seller,
          catalog_id,
          like_count,
          catalogs!inner(
            name,
            visibility,
            profiles!inner(username)
          )
        `)
        .or(orConditions)
        .eq('catalogs.visibility', 'public')
        .limit(100);

      if (error) {
        console.error('Search error:', error);
        setItemResults([]);
        return;
      }

      // Get user's liked items separately if user is logged in
      let userLikedItems: Set<string> = new Set();
      if (currentUserId) {
        const { data: likedData } = await supabase
          .from('liked_items')
          .select('item_id')
          .eq('user_id', currentUserId);

        if (likedData) {
          userLikedItems = new Set(likedData.map(like => like.item_id));
        }
      }

      // Transform the data
      const transformedResults: SearchResult[] = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        image_url: item.image_url,
        product_url: item.product_url,
        price: item.price,
        seller: item.seller,
        catalog_id: item.catalog_id,
        catalog_name: item.catalogs.name,
        catalog_owner: item.catalogs.profiles.username,
        like_count: item.like_count || 0,
        is_liked: userLikedItems.has(item.id)
      }));

      // Filter and sort results by relevance
      const filteredResults = transformedResults.filter(item => {
        const itemText = `${item.title} ${item.seller || ''}`.toLowerCase();
        return keywords.some(keyword => itemText.includes(keyword));
      });

      const sortedResults = filteredResults.sort((a, b) => {
        const aText = `${a.title} ${a.seller || ''}`.toLowerCase();
        const bText = `${b.title} ${b.seller || ''}`.toLowerCase();

        const aMatches = keywords.filter(keyword => aText.includes(keyword)).length;
        const bMatches = keywords.filter(keyword => bText.includes(keyword)).length;

        return bMatches - aMatches;
      });

      setItemResults(sortedResults);
    } catch (error) {
      console.error('Search error:', error);
      setItemResults([]);
    } finally {
      setItemsLoading(false);
    }
  }

  async function performCatalogSearch(searchTerm: string) {
    if (!searchTerm.trim()) {
      setCatalogResults([]);
      return;
    }

    setCatalogsLoading(true);
    try {
      // Get catalog data first
      const { data, error } = await supabase
        .from('catalogs')
        .select(`
          id,
          name,
          description,
          image_url,
          bookmark_count,
          profiles!inner(username, full_name, avatar_url),
          catalog_items(count)
        `)
        .ilike('name', `%${searchTerm}%`)
        .eq('visibility', 'public')
        .limit(20);

      if (error) {
        console.error('Error searching catalogs:', error);
        setCatalogResults([]);
        return;
      }

      // Get user's bookmarked catalogs separately if user is logged in
      let userBookmarkedCatalogs: Set<string> = new Set();
      if (currentUserId) {
        const { data: bookmarkedData } = await supabase
          .from('bookmarked_catalogs')
          .select('catalog_id')
          .eq('user_id', currentUserId);

        if (bookmarkedData) {
          userBookmarkedCatalogs = new Set(bookmarkedData.map(bookmark => bookmark.catalog_id));
        }
      }

      const resultsWithBookmarks: CatalogResult[] = (data || []).map(catalog => ({
        id: catalog.id,
        name: catalog.name,
        description: catalog.description,
        image_url: catalog.image_url,
        username: catalog.profiles.username,
        full_name: catalog.profiles.full_name,
        avatar_url: catalog.profiles.avatar_url,
        item_count: catalog.catalog_items?.[0]?.count || 0,
        bookmark_count: catalog.bookmark_count || 0,
        is_bookmarked: userBookmarkedCatalogs.has(catalog.id)
      }));

      setCatalogResults(resultsWithBookmarks);
    } catch (error) {
      console.error('Error searching catalogs:', error);
      setCatalogResults([]);
    } finally {
      setCatalogsLoading(false);
    }
  }

  async function performProfileSearch(searchTerm: string) {
    if (!searchTerm.trim()) {
      setProfileResults([]);
      return;
    }

    setProfilesLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          catalogs!left(
            id,
            visibility,
            catalog_items(count)
          )
        `)
        .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) {
        console.error('Error searching profiles:', error);
        setProfileResults([]);
        return;
      }

      const transformedResults: ProfileResult[] = (data || []).map(profile => {
        const publicCatalogs = profile.catalogs?.filter(catalog => catalog.visibility === 'public') || [];
        const totalItems = publicCatalogs.reduce((sum, catalog) => {
          return sum + (catalog.catalog_items?.[0]?.count || 0);
        }, 0);

        return {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          catalog_count: publicCatalogs.length,
          total_items: totalItems
        };
      });

      setProfileResults(transformedResults);
    } catch (error) {
      console.error('Error searching profiles:', error);
      setProfileResults([]);
    } finally {
      setProfilesLoading(false);
    }
  }

  async function toggleLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId) {
      router.push('/login');
      return;
    }

    try {
      if (currentlyLiked) {
        await supabase
          .from('liked_items')
          .delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);
      } else {
        await supabase
          .from('liked_items')
          .insert({
            user_id: currentUserId,
            item_id: itemId
          });
      }

      // Update local state optimistically
      setItemResults(prevResults =>
        prevResults.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              is_liked: !currentlyLiked,
              like_count: currentlyLiked ? item.like_count - 1 : item.like_count + 1
            };
          }
          return item;
        })
      );

      // Update selectedItem if it's open
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? {
          ...prev,
          is_liked: !currentlyLiked,
          like_count: currentlyLiked ? prev.like_count - 1 : prev.like_count + 1
        } : null);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  async function toggleBookmark(catalogId: string) {
    if (!currentUserId) {
      router.push('/login');
      return;
    }

    try {
      // Check if already bookmarked
      const { data: existingBookmark } = await supabase
        .from('bookmarked_catalogs')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('catalog_id', catalogId)
        .single();

      if (existingBookmark) {
        // Remove bookmark
        await supabase
          .from('bookmarked_catalogs')
          .delete()
          .eq('user_id', currentUserId)
          .eq('catalog_id', catalogId);
      } else {
        // Add bookmark
        await supabase
          .from('bookmarked_catalogs')
          .insert({
            user_id: currentUserId,
            catalog_id: catalogId
          });
      }

      // Update local state
      setCatalogResults(prevResults =>
        prevResults.map(catalog => {
          if (catalog.id === catalogId) {
            return {
              ...catalog,
              is_bookmarked: !catalog.is_bookmarked,
              bookmark_count: catalog.is_bookmarked ? catalog.bookmark_count - 1 : catalog.bookmark_count + 1
            };
          }
          return catalog;
        })
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }

  function handleImageClick(item: SearchResult, e: React.MouseEvent) {
    e.stopPropagation();
    if (item.product_url) {
      window.open(item.product_url, '_blank');
    } else {
      setSelectedItem(item);
    }
  }

  function handleCardClick(item: SearchResult) {
    setSelectedItem(item);
  }

  const isLoading = itemsLoading || catalogsLoading || profilesLoading;
  const hasResults = itemResults.length > 0 || catalogResults.length > 0 || profileResults.length > 0;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Search Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {query ? (
              <div className="space-y-2">
                <p className="text-sm tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  SHOWING RESULTS FOR
                </p>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  "{query}"
                </h1>
                <p className="text-sm tracking-wider opacity-60">
                  {isLoading ? 'Searching...' :
                    activeTab === 'items' ? `${itemResults.length} items found` :
                    activeTab === 'catalogs' ? `${catalogResults.length} catalogs found` :
                    `${profileResults.length} profiles found`
                  }
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  SEARCH
                </h1>
                <p className="text-sm tracking-wide opacity-40 mt-2">
                  Use the search bar above to find items, catalogs, or profiles
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Search Tabs */}
        <div className="border-b border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('items')}
                className={`py-4 px-6 text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'items'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                ITEMS ({itemResults.length})
              </button>
              <button
                onClick={() => setActiveTab('catalogs')}
                className={`py-4 px-6 text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'catalogs'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                CATALOGS ({catalogResults.length})
              </button>
              <button
                onClick={() => setActiveTab('profiles')}
                className={`py-4 px-6 text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'profiles'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/40 hover:text-black/70'
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                PROFILES ({profileResults.length})
              </button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">

            {!query ? (
              <div className="text-center py-20">
                <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  SEARCH FOR FASHION ITEMS, CATALOGS, OR PROFILES
                </p>
                <p className="text-sm tracking-wide opacity-30 mt-2">
                  Enter keywords to find what you're looking for
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-20">
                <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  SEARCHING...
                </p>
              </div>
            ) : (
              <>
                {/* Items Tab */}
                {activeTab === 'items' && (
                  itemResults.length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        NO ITEMS FOUND
                      </p>
                      <p className="text-sm tracking-wide opacity-30 mt-2">
                        Try different keywords or check your spelling
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                      {itemResults.map((item) => (
                        <div
                          key={item.id}
                          className="group cursor-pointer"
                          onClick={() => handleCardClick(item)}
                        >
                          <div className="border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200">
                            <div className="relative aspect-square bg-white overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.title}
                                className="w-full h-full object-cover transition-all duration-500 cursor-pointer"
                                onClick={(e) => handleImageClick(item, e)}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />

                              {/* Like button */}
                              <button
                                className="absolute top-2 left-2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white border border-black transition-all opacity-0 group-hover:opacity-100 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(item.id, item.is_liked);
                                }}
                              >
                                <span className={`text-sm ${item.is_liked ? 'text-red-500' : 'text-black'}`}>
                                  {item.is_liked ? '♥' : '♡'}
                                </span>
                              </button>

                              {/* Product Link indicator */}
                              {item.product_url && (
                                <div className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 border border-black opacity-0 group-hover:opacity-100 pointer-events-none">
                                  <span className="text-black text-xs">↗</span>
                                </div>
                              )}

                              {/* Like count badge */}
                              {item.like_count > 0 && (
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
                                  ♥ {item.like_count}
                                </div>
                              )}
                            </div>

                            <div className="p-3 bg-white border-t border-black/20">
                              <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {item.title}
                              </h3>
                              <p className="text-[9px] tracking-wider opacity-40 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                FROM @{item.catalog_owner} / {item.catalog_name}
                              </p>
                              <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60">
                                {item.seller && <p className="truncate">{item.seller}</p>}
                                {item.price && <p className="ml-auto">{item.price}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Catalogs Tab */}
                {activeTab === 'catalogs' && (
                  catalogResults.length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        NO CATALOGS FOUND
                      </p>
                      <p className="text-sm tracking-wide opacity-30 mt-2">
                        Try different keywords
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {catalogResults.map((catalog) => (
                        <div key={catalog.id} className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200 relative">
                          <div
                            className="cursor-pointer"
                            onClick={() => router.push(`/catalogs/${catalog.id}`)}
                          >
                            <div className="aspect-square bg-white overflow-hidden">
                              {catalog.image_url ? (
                                <img
                                  src={catalog.image_url}
                                  alt={catalog.name}
                                  className="w-full h-full object-cover"
                                />
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
                              <p className="text-xs tracking-wider opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                BY @{catalog.username}
                              </p>
                              <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                                <span>🔖 {catalog.bookmark_count}</span>
                                <span>{catalog.item_count} items</span>
                              </div>
                            </div>
                          </div>

                          {/* Bookmark button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(catalog.id);
                            }}
                            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white border border-black transition-all opacity-0 group-hover:opacity-100 z-10"
                          >
                            <span className={`text-sm ${catalog.is_bookmarked ? 'text-blue-500' : 'text-black'}`}>
                              {catalog.is_bookmarked ? '🔖' : '⊞'}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Profiles Tab */}
                {activeTab === 'profiles' && (
                  profileResults.length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        NO PROFILES FOUND
                      </p>
                      <p className="text-sm tracking-wide opacity-30 mt-2">
                        Try different usernames or names
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {profileResults.map((profile) => (
                        <div
                          key={profile.id}
                          className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200 cursor-pointer"
                          onClick={() => router.push(`/profiles/${profile.id}`)}
                        >
                          <div className="p-6">
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="w-16 h-16 border-2 border-black overflow-hidden">
                                {profile.avatar_url ? (
                                  <img
                                    src={profile.avatar_url}
                                    alt={profile.username}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                    <span className="text-2xl opacity-20">👤</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xl font-black tracking-wide uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  @{profile.username}
                                </h3>
                                {profile.full_name && (
                                  <p className="text-sm opacity-60 mt-1">
                                    {profile.full_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm tracking-wider opacity-60">
                              <span>{profile.catalog_count} catalogs</span>
                              <span>{profile.total_items} items</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>

        {/* Item Detail Modal - same as before */}
        {selectedItem && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="bg-white border-2 border-black max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-8">
                {/* Left side - Image */}
                <div className="aspect-square border border-black bg-white flex items-center justify-center relative">
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.title}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => {
                      if (selectedItem.product_url) {
                        window.open(selectedItem.product_url, '_blank');
                      }
                    }}
                  />
                  {selectedItem.product_url && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
                      CLICK TO SHOP
                    </div>
                  )}
                </div>

                {/* Right side - Info */}
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="w-10 h-10 border border-black hover:bg-black hover:text-white transition-all flex items-center justify-center text-xl"
                    >
                      ×
                    </button>
                  </div>

                  <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-wide uppercase leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      {selectedItem.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-4 text-sm opacity-60">
                    {selectedItem.like_count > 0 && (
                      <span>♥ {selectedItem.like_count} likes</span>
                    )}
                    <span>FROM @{selectedItem.catalog_owner}</span>
                  </div>

                  {selectedItem.seller && (
                    <div className="space-y-1">
                      <p className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        SELLER
                      </p>
                      <p className="text-lg tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {selectedItem.seller}
                      </p>
                    </div>
                  )}

                  {selectedItem.price && (
                    <div className="space-y-1">
                      <p className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        PRICE
                      </p>
                      <p className="text-2xl font-black tracking-wide">
                        {selectedItem.price}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {selectedItem.product_url && (
                      <button
                        onClick={() => window.open(selectedItem.product_url!, '_blank')}
                        className="block w-full py-4 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-center text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        SHOP THIS ITEM
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        className={`py-4 border-2 transition-all text-center text-xs tracking-[0.4em] font-black ${
                          selectedItem.is_liked
                            ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                            : 'border-black text-black hover:bg-black hover:text-white'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(selectedItem.id, selectedItem.is_liked);
                        }}
                      >
                        {selectedItem.is_liked ? '♥ LIKED' : '♡ LIKE'}
                      </button>

                      <button
                        className="py-4 border-2 border-black text-black hover:bg-black hover:text-white transition-all text-center text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        onClick={() => {
                          router.push(`/catalogs/${selectedItem.catalog_id}`);
                        }}
                      >
                        VIEW CATALOG
                      </button>
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