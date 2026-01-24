"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

type CatalogItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  catalog_name: string;
  created_at: string;
};

type PostItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  post_caption: string | null;
  created_at: string;
};

type Catalog = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string;
  item_count: number;
  visibility: string;
  created_at: string;
};

type Post = {
  id: string;
  caption: string | null;
  image_url: string;
  like_count: number;
  comment_count: number;
  created_at: string;
};

type Stats = {
  totalFollowers: number;
  totalCatalogs: number;
  totalPosts: number;
  totalCatalogItems: number;
  totalPostItems: number;
  totalLikesReceived: number;
  totalBookmarks: number;
};

export default function CreatorAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats>({
    totalFollowers: 0,
    totalCatalogs: 0,
    totalPosts: 0,
    totalCatalogItems: 0,
    totalPostItems: 0,
    totalLikesReceived: 0,
    totalBookmarks: 0,
  });

  // Data
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [postItems, setPostItems] = useState<PostItem[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'catalogs' | 'posts' | 'items' | 'affiliate'>('overview');

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    // Get profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_verified, username, avatar_url, full_name')
      .eq('id', user.id)
      .single();

    if (profile) {
      setCurrentUser(profile);
      setIsVerified(profile.is_verified || false);
    }

    // Check if user has applied for verification
    const { data: application } = await supabase
      .from('verification_requests')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (application) {
      setHasApplied(true);
    }

    if (profile?.is_verified) {
      await loadAnalyticsData(user.id);
    }

    setLoading(false);
  }

  async function loadAnalyticsData(userId: string) {
    // Load followers count
    const { count: followersCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    // Load catalogs
    const { data: catalogsData, count: catalogsCount } = await supabase
      .from('catalogs')
      .select('id, name, slug, description, image_url, visibility, created_at', { count: 'exact' })
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    // Get item counts for each catalog
    const catalogsWithCounts = await Promise.all(
      (catalogsData || []).map(async (catalog) => {
        const { count } = await supabase
          .from('catalog_items')
          .select('*', { count: 'exact', head: true })
          .eq('catalog_id', catalog.id);

        return { ...catalog, item_count: count || 0 };
      })
    );

    setCatalogs(catalogsWithCounts);

    // Load posts
    const { data: postsData, count: postsCount } = await supabase
      .from('feed_posts')
      .select('id, caption, image_url, like_count, comment_count, created_at', { count: 'exact' })
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    setPosts(postsData || []);

    // Load catalog items with catalog names
    const { data: catalogItemsData, count: catalogItemsCount } = await supabase
      .from('catalog_items')
      .select(`
        id,
        title,
        image_url,
        product_url,
        price,
        seller,
        created_at,
        catalogs!inner(name, owner_id)
      `, { count: 'exact' })
      .eq('catalogs.owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get like counts for catalog items
    const catalogItemsWithLikes = await Promise.all(
      (catalogItemsData || []).map(async (item: any) => {
        const { count } = await supabase
          .from('liked_catalog_items')
          .select('*', { count: 'exact', head: true })
          .eq('item_id', item.id);

        return {
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          product_url: item.product_url,
          price: item.price,
          seller: item.seller,
          like_count: count || 0,
          catalog_name: item.catalogs.name,
          created_at: item.created_at,
        };
      })
    );

    setCatalogItems(catalogItemsWithLikes);

    // Load post items
    const { data: postItemsData, count: postItemsCount } = await supabase
      .from('feed_post_items')
      .select(`
        id,
        title,
        image_url,
        product_url,
        price,
        seller,
        created_at,
        feed_posts!inner(owner_id, caption)
      `, { count: 'exact' })
      .eq('feed_posts.owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get like counts for post items
    const postItemsWithLikes = await Promise.all(
      (postItemsData || []).map(async (item: any) => {
        const { count } = await supabase
          .from('liked_feed_post_items')
          .select('*', { count: 'exact', head: true })
          .eq('item_id', item.id);

        return {
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          product_url: item.product_url,
          price: item.price,
          seller: item.seller,
          like_count: count || 0,
          post_caption: item.feed_posts.caption,
          created_at: item.created_at,
        };
      })
    );

    setPostItems(postItemsWithLikes);

    // Calculate total likes received
    const totalCatalogItemLikes = catalogItemsWithLikes.reduce((sum, item) => sum + item.like_count, 0);
    const totalPostItemLikes = postItemsWithLikes.reduce((sum, item) => sum + item.like_count, 0);
    const totalPostLikes = (postsData || []).reduce((sum: number, post: any) => sum + (post.like_count || 0), 0);

    // Get bookmarks count
    const { count: bookmarksCount } = await supabase
      .from('saved_feed_posts')
      .select('*', { count: 'exact', head: true })
      .eq('feed_posts.owner_id', userId);

    setStats({
      totalFollowers: followersCount || 0,
      totalCatalogs: catalogsCount || 0,
      totalPosts: postsCount || 0,
      totalCatalogItems: catalogItemsCount || 0,
      totalPostItems: postItemsCount || 0,
      totalLikesReceived: totalCatalogItemLikes + totalPostItemLikes + totalPostLikes,
      totalBookmarks: bookmarksCount || 0,
    });
  }

  async function handleApplyForVerification() {
    setApplying(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: user.id,
        status: 'pending',
      });

    if (error) {
      console.error('Error applying for verification:', error);
      alert('Failed to submit application. Please try again.');
    } else {
      setHasApplied(true);
      alert('Application submitted! We will review your request soon.');
    }

    setApplying(false);
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>Creator Analytics | Sourced</title>
        </Head>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-black text-2xl font-black tracking-widest animate-pulse" style={{ fontFamily: 'Bebas Neue' }}>
              LOADING...
            </div>
          </div>
        </div>
      </>
    );
  }

  // Not verified - show application screen
  if (!isVerified) {
    return (
      <>
        <Head>
          <title>Apply for Verification | Sourced</title>
        </Head>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        `}</style>

        <div className="min-h-screen bg-white">
          <div className="max-w-4xl mx-auto px-6 py-20">
            <div className="text-center space-y-8">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full bg-black/5 flex items-center justify-center">
                  <svg className="w-12 h-12 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>

              {/* Heading */}
              <div className="space-y-3">
                <h1 className="text-5xl md:text-6xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black' }}>
                  BECOME A VERIFIED CREATOR
                </h1>
                <p className="text-lg text-black/60 max-w-2xl mx-auto">
                  Get access to advanced analytics, affiliate programs, and exclusive creator tools.
                </p>
              </div>

              {/* Benefits */}
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto pt-8">
                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl mb-3">📊</div>
                  <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>ANALYTICS</h3>
                  <p className="text-sm text-black/60">Track engagement, views, and performance metrics</p>
                </div>
                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl mb-3">💰</div>
                  <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>AFFILIATES</h3>
                  <p className="text-sm text-black/60">Earn commissions on recommended products</p>
                </div>
                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl mb-3">✓</div>
                  <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>VERIFIED BADGE</h3>
                  <p className="text-sm text-black/60">Stand out with the verified creator checkmark</p>
                </div>
              </div>

              {/* CTA */}
              <div className="pt-8">
                {hasApplied ? (
                  <div className="inline-block px-8 py-4 bg-black/5 rounded-lg">
                    <p className="text-sm font-black tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
                      APPLICATION PENDING REVIEW
                    </p>
                    <p className="text-xs text-black/60 mt-2">
                      We'll notify you once your application is reviewed
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleApplyForVerification}
                    disabled={applying}
                    className="px-12 py-4 bg-black text-white hover:bg-black/80 transition-all font-black tracking-wider text-lg disabled:opacity-50"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    {applying ? 'SUBMITTING...' : 'APPLY FOR VERIFICATION'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Verified - show full analytics
  return (
    <>
      <Head>
        <title>Creator Analytics | Sourced</title>
      </Head>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-black/10 bg-white sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black' }}>
                  CREATOR ANALYTICS
                </h1>
                <p className="text-sm text-black/60 mt-1">
                  @{currentUser?.username}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-black" style={{ fontFamily: 'Bebas Neue' }}>VERIFIED</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'catalogs', label: 'Catalogs' },
                { id: 'posts', label: 'Posts' },
                { id: 'items', label: 'Items' },
                { id: 'affiliate', label: 'Affiliates' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-2 font-black tracking-wider transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-black text-white'
                      : 'bg-black/5 text-black hover:bg-black/10'
                  }`}
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalFollowers}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    FOLLOWERS
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalLikesReceived}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    TOTAL LIKES
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalCatalogs}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    CATALOGS
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalPosts}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    POSTS
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalCatalogItems}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    CATALOG ITEMS
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalPostItems}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    POST ITEMS
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalBookmarks}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    BOOKMARKS
                  </div>
                </div>

                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Archivo Black' }}>
                    {stats.totalCatalogItems + stats.totalPostItems}
                  </div>
                  <div className="text-xs tracking-wider text-black/60 mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                    TOTAL ITEMS
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="border-t border-black/10 pt-8">
                <h2 className="text-2xl font-black mb-4" style={{ fontFamily: 'Bebas Neue' }}>
                  QUICK ACTIONS
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <button
                    onClick={() => router.push('/create/catalog')}
                    className="p-6 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📚</div>
                    <div className="font-black text-lg" style={{ fontFamily: 'Bebas Neue' }}>
                      CREATE CATALOG
                    </div>
                    <div className="text-xs text-black/60 mt-1">
                      Start a new collection
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/create/post/setup')}
                    className="p-6 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📸</div>
                    <div className="font-black text-lg" style={{ fontFamily: 'Bebas Neue' }}>
                      CREATE POST
                    </div>
                    <div className="text-xs text-black/60 mt-1">
                      Share your style
                    </div>
                  </button>

                  <button
                    onClick={() => router.push(`/${currentUser?.username}`)}
                    className="p-6 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">👤</div>
                    <div className="font-black text-lg" style={{ fontFamily: 'Bebas Neue' }}>
                      VIEW PROFILE
                    </div>
                    <div className="text-xs text-black/60 mt-1">
                      See your public page
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CATALOGS TAB */}
          {activeTab === 'catalogs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue' }}>
                  YOUR CATALOGS ({catalogs.length})
                </h2>
                <button
                  onClick={() => router.push('/create/catalog')}
                  className="px-6 py-2 bg-black text-white hover:bg-black/80 transition-all font-black tracking-wider text-sm"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  + NEW CATALOG
                </button>
              </div>

              {catalogs.length === 0 ? (
                <div className="text-center py-20 border border-black/10 rounded-lg">
                  <p className="text-black/40">No catalogs yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catalogs.map((catalog) => (
                    <div
                      key={catalog.id}
                      onClick={() => router.push(`/${currentUser?.username}/${catalog.slug}`)}
                      className="border border-black/20 hover:border-black cursor-pointer transition-all group"
                    >
                      <div className="aspect-square bg-black/5 overflow-hidden">
                        {catalog.image_url && (
                          <img
                            src={catalog.image_url}
                            alt={catalog.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-black text-lg tracking-wide" style={{ fontFamily: 'Bebas Neue' }}>
                          {catalog.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-xs text-black/60">
                          <span>{catalog.item_count} items</span>
                          <span>{catalog.visibility}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue' }}>
                  YOUR POSTS ({posts.length})
                </h2>
                <button
                  onClick={() => router.push('/create/post/setup')}
                  className="px-6 py-2 bg-black text-white hover:bg-black/80 transition-all font-black tracking-wider text-sm"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  + NEW POST
                </button>
              </div>

              {posts.length === 0 ? (
                <div className="text-center py-20 border border-black/10 rounded-lg">
                  <p className="text-black/40">No posts yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="border border-black/20 hover:border-black cursor-pointer transition-all group"
                    >
                      <div className="aspect-square bg-black/5 overflow-hidden">
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-3 text-xs text-black/60">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            {post.like_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {post.comment_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ITEMS TAB */}
          {activeTab === 'items' && (
            <div className="space-y-8">
              {/* Catalog Items */}
              <div>
                <h2 className="text-2xl font-black mb-4" style={{ fontFamily: 'Bebas Neue' }}>
                  CATALOG ITEMS ({catalogItems.length})
                </h2>
                {catalogItems.length === 0 ? (
                  <div className="text-center py-10 border border-black/10 rounded-lg">
                    <p className="text-black/40">No catalog items yet</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {catalogItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-black/20 hover:border-black transition-all group"
                      >
                        <div className="aspect-square bg-black/5 overflow-hidden relative">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-1 bg-blue-500 text-white text-[9px] font-black" style={{ fontFamily: 'Bebas Neue' }}>
                              CATALOG
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>
                            {item.title}
                          </p>
                          <p className="text-[10px] text-black/40 truncate mt-1">
                            {item.catalog_name}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            {item.price && (
                              <span className="text-xs font-black">${item.price}</span>
                            )}
                            <span className="text-[10px] text-black/60">
                              ♥ {item.like_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Post Items */}
              <div className="border-t border-black/10 pt-8">
                <h2 className="text-2xl font-black mb-4" style={{ fontFamily: 'Bebas Neue' }}>
                  POST ITEMS ({postItems.length})
                </h2>
                {postItems.length === 0 ? (
                  <div className="text-center py-10 border border-black/10 rounded-lg">
                    <p className="text-black/40">No post items yet</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {postItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-black/20 hover:border-black transition-all group"
                      >
                        <div className="aspect-square bg-black/5 overflow-hidden relative">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-1 bg-green-500 text-white text-[9px] font-black" style={{ fontFamily: 'Bebas Neue' }}>
                              POST
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>
                            {item.title}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            {item.price && (
                              <span className="text-xs font-black">${item.price}</span>
                            )}
                            <span className="text-[10px] text-black/60">
                              ♥ {item.like_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AFFILIATE TAB */}
          {activeTab === 'affiliate' && (
            <div className="space-y-6">
              <div className="text-center py-20 border-2 border-dashed border-black/20 rounded-lg">
                <div className="text-6xl mb-4">🚀</div>
                <h2 className="text-3xl font-black mb-3" style={{ fontFamily: 'Archivo Black' }}>
                  COMING SOON
                </h2>
                <p className="text-black/60 mb-6 max-w-md mx-auto">
                  Submit your top-performing items for affiliate consideration. Earn commissions when your recommendations drive sales.
                </p>
                <div className="space-y-4 max-w-xl mx-auto">
                  <div className="p-4 bg-black/5 rounded-lg text-left">
                    <h3 className="font-black text-sm mb-2" style={{ fontFamily: 'Bebas Neue' }}>
                      HOW IT WORKS
                    </h3>
                    <ol className="text-sm text-black/70 space-y-2">
                      <li>1. Submit items from your catalogs or posts</li>
                      <li>2. We review and approve eligible products</li>
                      <li>3. Items get unique affiliate tracking links</li>
                      <li>4. Earn commission on every sale you drive</li>
                    </ol>
                  </div>
                  <button
                    disabled
                    className="px-8 py-3 bg-black/20 text-black/40 font-black tracking-wider cursor-not-allowed"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    SUBMIT ITEMS (COMING SOON)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}