"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type TimeRange = "7d" | "30d" | "90d" | "all";

type CatalogAnalytics = {
  id: string;
  name: string;
  slug: string;
  total_items: number;
  total_likes: number;
  total_bookmarks: number;
  total_clicks: number;
  total_unique_clicks: number;
  top_items: ItemAnalytics[];
};

type ItemAnalytics = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  seller: string | null;
  brand: string | null;
  like_count: number;
  click_count: number;
  unique_click_count: number;
  catalog_name: string;
  catalog_slug: string;
};

type OverviewStats = {
  total_catalogs: number;
  total_items: number;
  total_likes: number;
  total_bookmarks: number;
  total_clicks: number;
  total_unique_clicks: number;
  avg_likes_per_item: number;
  avg_clicks_per_item: number;
  click_through_rate: number;
};

export default function CreatorAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "catalogs" | "items">("overview");

  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    total_catalogs: 0,
    total_items: 0,
    total_likes: 0,
    total_bookmarks: 0,
    total_clicks: 0,
    total_unique_clicks: 0,
    avg_likes_per_item: 0,
    avg_clicks_per_item: 0,
    click_through_rate: 0,
  });

  const [catalogAnalytics, setCatalogAnalytics] = useState<CatalogAnalytics[]>([]);
  const [topItems, setTopItems] = useState<ItemAnalytics[]>([]);
  const [sortBy, setSortBy] = useState<"likes" | "clicks" | "unique_clicks">("clicks");

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUserId && isVerified) {
      loadAnalytics();
    }
  }, [currentUserId, isVerified]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_verified, username, is_onboarded")
      .eq("id", user.id)
      .single();

    if (!profile?.is_onboarded) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);
    setCurrentUsername(profile.username);
    setIsVerified(profile?.is_verified || false);

    // Check if user has applied for verification
    if (!profile?.is_verified) {
      const { data: application } = await supabase
        .from("verification_requests")
        .select("status")
        .eq("user_id", user.id)
        .single();

      if (application) {
        setHasApplied(true);
      }
    }

    setLoading(false);
  }

  async function loadAnalytics() {
    setLoading(true);
    try {
      await Promise.all([
        loadOverviewStats(),
        loadCatalogAnalytics(),
        loadTopItems(),
      ]);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOverviewStats() {
    if (!currentUserId) return;

    // Get total catalogs
    const { count: catalogCount } = await supabase
      .from("catalogs")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", currentUserId);

    // Get all catalog items with their metrics
    const { data: catalogItems } = await supabase
      .from("catalog_items")
      .select("id, like_count, click_count, unique_click_count, catalogs!inner(owner_id)")
      .eq("catalogs.owner_id", currentUserId);

    // Get total bookmarks across all user's catalogs
    const { count: bookmarkCount } = await supabase
      .from("bookmarked_catalogs")
      .select("*, catalogs!inner(owner_id)", { count: "exact", head: true })
      .eq("catalogs.owner_id", currentUserId);

    const totalLikes = catalogItems?.reduce((sum, item) => sum + (item.like_count || 0), 0) || 0;
    const totalClicks = catalogItems?.reduce((sum, item) => sum + (item.click_count || 0), 0) || 0;
    const totalUniqueClicks = catalogItems?.reduce((sum, item) => sum + (item.unique_click_count || 0), 0) || 0;
    const itemCount = catalogItems?.length || 0;

    setOverviewStats({
      total_catalogs: catalogCount || 0,
      total_items: itemCount,
      total_likes: totalLikes,
      total_bookmarks: bookmarkCount || 0,
      total_clicks: totalClicks,
      total_unique_clicks: totalUniqueClicks,
      avg_likes_per_item: itemCount > 0 ? totalLikes / itemCount : 0,
      avg_clicks_per_item: itemCount > 0 ? totalClicks / itemCount : 0,
      click_through_rate: totalClicks > 0 ? (totalUniqueClicks / totalClicks) * 100 : 0,
    });
  }

  async function loadCatalogAnalytics() {
    if (!currentUserId) return;

    const { data: catalogs } = await supabase
      .from("catalogs")
      .select("id, name, slug")
      .eq("owner_id", currentUserId);

    if (!catalogs) return;

    const catalogAnalyticsData = await Promise.all(
      catalogs.map(async (catalog) => {
        const { data: items } = await supabase
          .from("catalog_items")
          .select("id, title, image_url, product_url, seller, brand, like_count, click_count, unique_click_count")
          .eq("catalog_id", catalog.id);

        const { count: bookmarkCount } = await supabase
          .from("bookmarked_catalogs")
          .select("*", { count: "exact", head: true })
          .eq("catalog_id", catalog.id);

        const totalLikes = items?.reduce((sum, item) => sum + (item.like_count || 0), 0) || 0;
        const totalClicks = items?.reduce((sum, item) => sum + (item.click_count || 0), 0) || 0;
        const totalUniqueClicks = items?.reduce((sum, item) => sum + (item.unique_click_count || 0), 0) || 0;

        const topItems: ItemAnalytics[] = items?.map(item => ({
          ...item,
          catalog_name: catalog.name,
          catalog_slug: catalog.slug,
        })) || [];

        return {
          id: catalog.id,
          name: catalog.name,
          slug: catalog.slug,
          total_items: items?.length || 0,
          total_likes: totalLikes,
          total_bookmarks: bookmarkCount || 0,
          total_clicks: totalClicks,
          total_unique_clicks: totalUniqueClicks,
          top_items: topItems,
        };
      })
    );

    setCatalogAnalytics(catalogAnalyticsData);
  }

  async function loadTopItems() {
    if (!currentUserId) return;

    const { data: items } = await supabase
      .from("catalog_items")
      .select(`
        id,
        title,
        image_url,
        product_url,
        seller,
        brand,
        like_count,
        click_count,
        unique_click_count,
        catalogs!inner(owner_id, name, slug)
      `)
      .eq("catalogs.owner_id", currentUserId)
      .order("click_count", { ascending: false })
      .limit(50);

    const formattedItems: ItemAnalytics[] = items?.map((item: any) => ({
      id: item.id,
      title: item.title,
      image_url: item.image_url,
      product_url: item.product_url,
      seller: item.seller,
      brand: item.brand,
      like_count: item.like_count || 0,
      click_count: item.click_count || 0,
      unique_click_count: item.unique_click_count || 0,
      catalog_name: item.catalogs.name,
      catalog_slug: item.catalogs.slug,
    })) || [];

    setTopItems(formattedItems);
  }

  async function handleApplyForVerification() {
    setApplying(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("verification_requests")
      .insert({
        user_id: user.id,
        status: "pending",
      });

    if (error) {
      console.error("Error applying for verification:", error);
      alert("Failed to submit application. Please try again.");
    } else {
      setHasApplied(true);
      alert("Application submitted! We will review your request soon.");
    }

    setApplying(false);
  }

  function getSortedItems(items: ItemAnalytics[]) {
    return [...items].sort((a, b) => {
      if (sortBy === "likes") return b.like_count - a.like_count;
      if (sortBy === "clicks") return b.click_count - a.click_count;
      if (sortBy === "unique_clicks") return b.unique_click_count - a.unique_click_count;
      return 0;
    });
  }

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LOADING...</p>
        </div>
      </>
    );
  }

  // Not verified - show application screen
  if (!isVerified) {
    return (
      <>
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
                  Get access to advanced analytics and exclusive creator tools.
                </p>
              </div>

              {/* Benefits */}
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto pt-8">
                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl mb-3">📊</div>
                  <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>ANALYTICS</h3>
                  <p className="text-sm text-black/60">Track clicks, engagement, and performance metrics</p>
                </div>
                <div className="p-6 border border-black/10 rounded-lg">
                  <div className="text-3xl mb-3">📈</div>
                  <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>INSIGHTS</h3>
                  <p className="text-sm text-black/60">See which items perform best with your audience</p>
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

  // Verified - show analytics
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-0">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                  CREATOR ANALYTICS
                </h1>
                <p className="text-sm text-black/60 mt-2">@{currentUsername}</p>
              </div>
              <button
                onClick={() => router.push(`/${currentUsername}`)}
                className="px-4 py-2 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs font-black"
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                VIEW PROFILE
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-6 py-2 text-xs tracking-wider font-black transition-all ${
                  activeTab === "overview"
                    ? "bg-black text-white"
                    : "bg-white text-black border border-black/20 hover:bg-black/10"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                OVERVIEW
              </button>
              <button
                onClick={() => setActiveTab("catalogs")}
                className={`px-6 py-2 text-xs tracking-wider font-black transition-all ${
                  activeTab === "catalogs"
                    ? "bg-black text-white"
                    : "bg-white text-black border border-black/20 hover:bg-black/10"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                CATALOGS
              </button>
              <button
                onClick={() => setActiveTab("items")}
                className={`px-6 py-2 text-xs tracking-wider font-black transition-all ${
                  activeTab === "items"
                    ? "bg-black text-white"
                    : "bg-white text-black border border-black/20 hover:bg-black/10"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                TOP ITEMS
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL CATALOGS</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_catalogs}</p>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL ITEMS</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_items}</p>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL LIKES</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_likes}</p>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL BOOKMARKS</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_bookmarks}</p>
                  </div>
                  <div className="border-2 border-black p-4 bg-black text-white">
                    <p className="text-[10px] tracking-wider opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL CLICKS</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_clicks}</p>
                  </div>
                  <div className="border-2 border-black p-4 bg-black text-white">
                    <p className="text-[10px] tracking-wider opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>UNIQUE CLICKS</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_unique_clicks}</p>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>AVG LIKES/ITEM</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.avg_likes_per_item.toFixed(1)}</p>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>AVG CLICKS/ITEM</p>
                    <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.avg_clicks_per_item.toFixed(1)}</p>
                  </div>
                </div>

                {/* Engagement Rate */}
                <div className="border-2 border-black p-6">
                  <h2 className="text-2xl font-black mb-4" style={{ fontFamily: "Archivo Black, sans-serif" }}>ENGAGEMENT METRICS</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CLICK-THROUGH RATE</p>
                      <p className="text-4xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                        {overviewStats.click_through_rate.toFixed(1)}%
                      </p>
                      <p className="text-[10px] opacity-40 mt-1">Unique clicks / Total clicks</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>ENGAGEMENT RATE</p>
                      <p className="text-4xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                        {overviewStats.total_items > 0
                          ? ((overviewStats.total_likes / overviewStats.total_items) * 100).toFixed(1)
                          : "0"}%
                      </p>
                      <p className="text-[10px] opacity-40 mt-1">Likes per item ratio</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL REACH</p>
                      <p className="text-4xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                        {overviewStats.total_unique_clicks + overviewStats.total_bookmarks}
                      </p>
                      <p className="text-[10px] opacity-40 mt-1">Unique clicks + Bookmarks</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CATALOGS TAB */}
            {activeTab === "catalogs" && (
              <div className="space-y-6">
                {catalogAnalytics.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NO CATALOGS FOUND</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {catalogAnalytics.map((catalog) => (
                      <div key={catalog.id} className="border-2 border-black">
                        <div className="p-6 bg-black text-white">
                          <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.name}</h2>
                            <button
                              onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                              className="px-4 py-2 bg-white text-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all text-xs font-black"
                              style={{ fontFamily: "Bebas Neue, sans-serif" }}
                            >
                              VIEW CATALOG
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-t-2 border-black">
                          <div className="border-r border-black/20 p-4">
                            <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>ITEMS</p>
                            <p className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_items}</p>
                          </div>
                          <div className="border-r border-black/20 p-4">
                            <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LIKES</p>
                            <p className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_likes}</p>
                          </div>
                          <div className="border-r border-black/20 p-4">
                            <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>BOOKMARKS</p>
                            <p className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_bookmarks}</p>
                          </div>
                          <div className="border-r border-black/20 p-4">
                            <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CLICKS</p>
                            <p className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_clicks}</p>
                          </div>
                          <div className="p-4">
                            <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>UNIQUE CLICKS</p>
                            <p className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_unique_clicks}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TOP ITEMS TAB */}
            {activeTab === "items" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>TOP PERFORMING ITEMS</h2>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 border-2 border-black bg-white text-xs tracking-wider font-black focus:outline-none"
                    style={{ fontFamily: "Bebas Neue, sans-serif" }}
                  >
                    <option value="clicks">SORT BY CLICKS</option>
                    <option value="unique_clicks">SORT BY UNIQUE CLICKS</option>
                    <option value="likes">SORT BY LIKES</option>
                  </select>
                </div>

                {topItems.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NO ITEMS FOUND</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getSortedItems(topItems).map((item) => (
                      <div key={item.id} className="border-2 border-black">
                        <div className="aspect-square bg-black/5 overflow-hidden">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>

                        <div className="p-4 space-y-3">
                          <h3 className="text-sm font-black tracking-tight line-clamp-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>{item.title}</h3>

                          <p className="text-xs opacity-60 truncate">{item.catalog_name}</p>

                          {item.seller && (
                            <p className="text-xs opacity-60 truncate">{item.seller}</p>
                          )}

                          <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-black/20">
                            <div>
                              <p className="text-[9px] tracking-wider opacity-60" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LIKES</p>
                              <p className="text-lg font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{item.like_count}</p>
                            </div>
                            <div>
                              <p className="text-[9px] tracking-wider opacity-60" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CLICKS</p>
                              <p className="text-lg font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{item.click_count}</p>
                            </div>
                            <div>
                              <p className="text-[9px] tracking-wider opacity-60" style={{ fontFamily: "Bebas Neue, sans-serif" }}>UNIQUE</p>
                              <p className="text-lg font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{item.unique_click_count}</p>
                            </div>
                          </div>

                          {item.product_url && (
                            <a
                              href={item.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full py-2 border-2 border-black hover:bg-black hover:text-white transition-all text-center text-xs font-black"
                              style={{ fontFamily: "Bebas Neue, sans-serif" }}
                            >
                              VIEW PRODUCT ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}