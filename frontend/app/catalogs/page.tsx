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

export default function CatalogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Search Catalogs
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCatalogResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    // Load popular catalogs when currentUserId is loaded and no search query
    if (currentUserId !== null && !searchParams.get('q')) {
      loadPopularCatalogs();
    }
  }, [currentUserId]);

  useEffect(() => {
    // Load search query from URL on mount
    const query = searchParams.get('q');
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
      // Get most bookmarked public catalogs
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
        .eq('visibility', 'public')
        .order('bookmark_count', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading popular catalogs:', error);
        setSearchResults([]);
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

      const resultsWithBookmarks: SearchCatalogResult[] = (data || []).map(catalog => ({
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

      setSearchResults(resultsWithBookmarks);
    } catch (error) {
      console.error('Error loading popular catalogs:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function searchCatalogs(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      // Clear URL and load popular catalogs if query is empty
      router.push('/catalogs', { scroll: false });
      loadPopularCatalogs();
      return;
    }

    setSearchLoading(true);
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
        .ilike('name', `%${query}%`)
        .eq('visibility', 'public')
        .limit(20);

      if (error) {
        console.error('Error searching catalogs:', error);
        setSearchResults([]);
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

      const resultsWithBookmarks: SearchCatalogResult[] = (data || []).map(catalog => ({
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

      setSearchResults(resultsWithBookmarks);
    } catch (error) {
      console.error('Error searching catalogs:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
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
      setSearchResults(prevResults =>
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

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchQuery.trim();

      if (query) {
        // Update URL with search query
        router.push(`/catalogs?q=${encodeURIComponent(query)}`, { scroll: false });
        searchCatalogs(query);
      } else {
        // Clear URL if query is empty
        router.push('/catalogs', { scroll: false });
        setSearchResults([]);
      }
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              CATALOGS
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              <button
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-black text-black"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                SEARCH CATALOGS
              </button>
              <button
                onClick={() => router.push('/catalogs/your_catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                YOUR CATALOGS
              </button>
              <button
                onClick={() => router.push('/catalogs/liked_items')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                LIKED ITEMS
              </button>
              <button
                onClick={() => router.push('/catalogs/bookmarked_catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                BOOKMARKED
              </button>
            </div>
          </div>
        </div>

        {/* Search Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div className="max-w-2xl">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  placeholder="SEARCH CATALOGS BY NAME..."
                  className="w-full px-4 py-3 border-2 border-black bg-white text-black placeholder-black/50 focus:outline-none focus:border-black text-lg tracking-wider"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                />
              </div>

              {searchLoading ? (
                <div className="text-center py-20">
                  <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    SEARCHING...
                  </p>
                </div>
              ) : searchResults.length === 0 && searchQuery ? (
                <div className="text-center py-20">
                  <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    NO CATALOGS FOUND
                  </p>
                  <p className="text-sm tracking-wide opacity-30 mt-2">
                    Try different keywords
                  </p>
                </div>
              ) : (
                <>
                  {!searchQuery && searchResults.length > 0 && (
                    <div className="mb-4">
                      <h2 className="text-2xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        POPULAR CATALOGS
                      </h2>
                      <p className="text-xs tracking-wider opacity-50 mt-1">
                        Most bookmarked public catalogs
                      </p>
                    </div>
                  )}
                  {searchQuery && searchResults.length > 0 && (
                    <div className="mb-4">
                      <h2 className="text-2xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {searchResults.length} RESULTS FOR "{searchQuery}"
                      </h2>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((catalog) => (
                    <div key={catalog.id} className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200 cursor-pointer"
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
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}