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
          {/* Hero Section */}
          <div className="border-b-4 border-black bg-white">
            <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
              <div className="text-center space-y-6">
                <div className="inline-block px-4 py-2 bg-black text-white" style={{ fontFamily: 'Bebas Neue' }}>
                  <span className="text-xs tracking-[0.3em]">CREATOR PROGRAM</span>
                </div>

                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none" style={{ fontFamily: 'Archivo Black' }}>
                  GET
                  <br />
                  VERIFIED
                </h1>

                <p className="text-xl md:text-2xl max-w-2xl mx-auto" style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                  UNLOCK ADVANCED ANALYTICS AND EXCLUSIVE CREATOR TOOLS
                </p>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Analytics */}
              <div className="border-4 border-black bg-white hover:bg-black hover:text-white transition-all group">
                <div className="p-8 space-y-4">
                  <div className="text-5xl">📊</div>
                  <h3 className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                    DETAILED ANALYTICS
                  </h3>
                  <div className="h-1 w-12 bg-black group-hover:bg-white transition-all"></div>
                  <p className="text-base leading-relaxed">
                    Track total clicks, unique visitors, engagement rates, and performance metrics for every catalog and item
                  </p>
                </div>
              </div>

              {/* Insights */}
              <div className="border-4 border-black bg-white hover:bg-black hover:text-white transition-all group">
                <div className="p-8 space-y-4">
                  <div className="text-5xl">📈</div>
                  <h3 className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                    DEEP INSIGHTS
                  </h3>
                  <div className="h-1 w-12 bg-black group-hover:bg-white transition-all"></div>
                  <p className="text-base leading-relaxed">
                    Discover which items resonate most with your audience and optimize your content strategy
                  </p>
                </div>
              </div>

              {/* Badge */}
              <div className="border-4 border-black bg-black text-white">
                <div className="p-8 space-y-4">
                  <div className="text-5xl">✓</div>
                  <h3 className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                    VERIFIED BADGE
                  </h3>
                  <div className="h-1 w-12 bg-white"></div>
                  <p className="text-base leading-relaxed">
                    Stand out with the official verified creator checkmark next to your profile
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto px-6 py-16">
            {hasApplied ? (
              <div className="border-4 border-black p-12 text-center bg-yellow-400">
                <div className="text-6xl mb-6">⏳</div>
                <h2 className="text-3xl font-black mb-3" style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                  APPLICATION UNDER REVIEW
                </h2>
                <p className="text-lg">
                  Your application is being reviewed. We'll notify you via email once a decision has been made.
                </p>
              </div>
            ) : (
              <div className="border-4 border-black bg-white">
                <div className="p-12 text-center space-y-8">
                  <div>
                    <h2 className="text-3xl font-black mb-3" style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                      READY TO LEVEL UP?
                    </h2>
                    <p className="text-lg">
                      Join the verified creator community and unlock powerful analytics
                    </p>
                  </div>

                  <button
                    onClick={handleApplyForVerification}
                    disabled={applying}
                    className="px-16 py-6 bg-black text-white hover:bg-white hover:text-black border-4 border-black transition-all text-xl font-black disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'Bebas Neue', letterSpacing: '0.1em' }}
                  >
                    {applying ? 'SUBMITTING APPLICATION...' : 'APPLY FOR VERIFICATION'}
                  </button>
                </div>
              </div>
            )}
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
        <div className="border-b-4 border-black bg-white sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                    ANALYTICS
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm opacity-60">@{currentUsername}</p>
                    <span className="px-2 py-0.5 bg-blue-500 text-white text-[9px] font-black" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                      VERIFIED ✓
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push(`/${currentUsername}`)}
                className="px-6 py-3 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-xs font-black"
                style={{ fontFamily: "Bebas Neue, sans-serif", letterSpacing: '0.1em' }}
              >
                VIEW PROFILE
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-8 py-3 text-sm tracking-wider font-black transition-all border-2 border-black ${
                  activeTab === "overview"
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-black/10"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                OVERVIEW
              </button>
              <button
                onClick={() => setActiveTab("catalogs")}
                className={`px-8 py-3 text-sm tracking-wider font-black transition-all border-2 border-black ${
                  activeTab === "catalogs"
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-black/10"
                }`}
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                CATALOGS ({catalogAnalytics.length})
              </button>
              <button
                onClick={() => setActiveTab("items")}
                className={`px-8 py-3 text-sm tracking-wider font-black transition-all border-2 border-black ${
                  activeTab === "items"
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-black/10"
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
                {/* Main Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border-4 border-black p-6 bg-white hover:bg-black hover:text-white transition-all group">
                    <p className="text-xs tracking-wider opacity-60 group-hover:opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CATALOGS</p>
                    <p className="text-5xl font-black mb-1" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_catalogs}</p>
                    <div className="h-1 w-8 bg-black group-hover:bg-white transition-all"></div>
                  </div>
                  <div className="border-4 border-black p-6 bg-white hover:bg-black hover:text-white transition-all group">
                    <p className="text-xs tracking-wider opacity-60 group-hover:opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>ITEMS</p>
                    <p className="text-5xl font-black mb-1" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_items}</p>
                    <div className="h-1 w-8 bg-black group-hover:bg-white transition-all"></div>
                  </div>
                  <div className="border-4 border-black p-6 bg-white hover:bg-black hover:text-white transition-all group">
                    <p className="text-xs tracking-wider opacity-60 group-hover:opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LIKES</p>
                    <p className="text-5xl font-black mb-1" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_likes}</p>
                    <div className="h-1 w-8 bg-black group-hover:bg-white transition-all"></div>
                  </div>
                  <div className="border-4 border-black p-6 bg-white hover:bg-black hover:text-white transition-all group">
                    <p className="text-xs tracking-wider opacity-60 group-hover:opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>BOOKMARKS</p>
                    <p className="text-5xl font-black mb-1" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_bookmarks}</p>
                    <div className="h-1 w-8 bg-black group-hover:bg-white transition-all"></div>
                  </div>
                </div>

                {/* Click Stats - Highlighted */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-4 border-black p-8 bg-black text-white">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs tracking-wider opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>TOTAL CLICKS</p>
                        <p className="text-6xl md:text-7xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_clicks}</p>
                      </div>
                      <div className="text-6xl opacity-20">👆</div>
                    </div>
                    <div className="h-1 w-16 bg-white mt-4"></div>
                    <p className="text-sm opacity-60 mt-3">All-time product link clicks</p>
                  </div>

                  <div className="border-4 border-black p-8 bg-black text-white">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs tracking-wider opacity-80 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>UNIQUE CLICKS</p>
                        <p className="text-6xl md:text-7xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{overviewStats.total_unique_clicks}</p>
                      </div>
                      <div className="text-6xl opacity-20">👥</div>
                    </div>
                    <div className="h-1 w-16 bg-white mt-4"></div>
                    <p className="text-sm opacity-60 mt-3">Unique users who clicked</p>
                  </div>
                </div>

                {/* Engagement Metrics */}
                <div className="border-4 border-black p-8 bg-white">
                  <h2 className="text-3xl font-black mb-6" style={{ fontFamily: "Archivo Black, sans-serif" }}>ENGAGEMENT</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="border-l-4 border-black pl-6">
                      <p className="text-sm tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CLICK-THROUGH RATE</p>
                      <p className="text-5xl font-black mb-2" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                        {overviewStats.click_through_rate.toFixed(1)}%
                      </p>
                      <p className="text-xs opacity-40">Unique / Total clicks</p>
                    </div>
                    <div className="border-l-4 border-black pl-6">
                      <p className="text-sm tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>AVG LIKES PER ITEM</p>
                      <p className="text-5xl font-black mb-2" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                        {overviewStats.avg_likes_per_item.toFixed(1)}
                      </p>
                      <p className="text-xs opacity-40">Average engagement</p>
                    </div>
                    <div className="border-l-4 border-black pl-6">
                      <p className="text-sm tracking-wider opacity-60 mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>AVG CLICKS PER ITEM</p>
                      <p className="text-5xl font-black mb-2" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                        {overviewStats.avg_clicks_per_item.toFixed(1)}
                      </p>
                      <p className="text-xs opacity-40">Average click performance</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CATALOGS TAB */}
            {activeTab === "catalogs" && (
              <div className="space-y-6">
                {catalogAnalytics.length === 0 ? (
                  <div className="border-4 border-black p-20 text-center">
                    <div className="text-6xl mb-4 opacity-20">📚</div>
                    <p className="text-2xl font-black opacity-40" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NO CATALOGS YET</p>
                    <button
                      onClick={() => router.push("/create/catalog")}
                      className="mt-6 px-8 py-3 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-sm font-black"
                      style={{ fontFamily: "Bebas Neue, sans-serif" }}
                    >
                      CREATE YOUR FIRST CATALOG
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {catalogAnalytics.map((catalog) => (
                      <div key={catalog.id} className="border-4 border-black bg-white hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <div className="grid md:grid-cols-[300px_1fr] gap-0">
                          {/* Catalog Preview */}
                          <div className="border-r-4 border-black">
                            <div className="aspect-square bg-black/5 overflow-hidden">
                              {catalog.top_items[0]?.image_url ? (
                                <img
                                  src={catalog.top_items[0].image_url}
                                  alt={catalog.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-8xl opacity-10">📚</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Catalog Stats */}
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-6">
                              <div>
                                <h2 className="text-3xl font-black mb-2" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.name}</h2>
                                <div className="flex items-center gap-3 text-sm opacity-60">
                                  <span>{catalog.total_items} items</span>
                                  <span>•</span>
                                  <span>{catalog.total_bookmarks} bookmarks</span>
                                </div>
                              </div>
                              <button
                                onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                                className="px-6 py-2 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-xs font-black whitespace-nowrap"
                                style={{ fontFamily: "Bebas Neue, sans-serif" }}
                              >
                                VIEW →
                              </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="border-2 border-black p-4 bg-white">
                                <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>ITEMS</p>
                                <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_items}</p>
                              </div>
                              <div className="border-2 border-black p-4 bg-white">
                                <p className="text-[10px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LIKES</p>
                                <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_likes}</p>
                              </div>
                              <div className="border-2 border-black p-4 bg-black text-white">
                                <p className="text-[10px] tracking-wider opacity-80 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CLICKS</p>
                                <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_clicks}</p>
                              </div>
                              <div className="border-2 border-black p-4 bg-black text-white">
                                <p className="text-[10px] tracking-wider opacity-80 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>UNIQUE</p>
                                <p className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{catalog.total_unique_clicks}</p>
                              </div>
                            </div>
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
                <div className="flex items-center justify-between border-b-4 border-black pb-4">
                  <h2 className="text-3xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>TOP PERFORMERS</h2>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-6 py-3 border-4 border-black bg-white text-sm tracking-wider font-black focus:outline-none cursor-pointer"
                    style={{ fontFamily: "Bebas Neue, sans-serif" }}
                  >
                    <option value="clicks">SORT BY CLICKS</option>
                    <option value="unique_clicks">SORT BY UNIQUE CLICKS</option>
                    <option value="likes">SORT BY LIKES</option>
                  </select>
                </div>

                {topItems.length === 0 ? (
                  <div className="border-4 border-black p-20 text-center">
                    <div className="text-6xl mb-4 opacity-20">🎯</div>
                    <p className="text-2xl font-black opacity-40" style={{ fontFamily: "Bebas Neue, sans-serif" }}>NO ITEMS YET</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {getSortedItems(topItems).map((item, index) => (
                      <div key={item.id} className="border-4 border-black bg-white hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group">
                        {/* Rank Badge */}
                        {index < 3 && (
                          <div className="absolute -top-3 -left-3 z-10">
                            <div className={`w-12 h-12 flex items-center justify-center font-black text-xl border-4 border-black ${
                              index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-300' : 'bg-orange-300'
                            }`} style={{ fontFamily: "Archivo Black, sans-serif" }}>
                              {index + 1}
                            </div>
                          </div>
                        )}

                        <div className="aspect-square bg-black/5 overflow-hidden border-b-4 border-black">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>

                        <div className="p-4 space-y-3">
                          <div>
                            <h3 className="text-sm font-black line-clamp-2 leading-tight mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                              {item.title}
                            </h3>
                            <p className="text-xs opacity-40 truncate">{item.catalog_name}</p>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-black">
                            <div className="text-center">
                              <p className="text-[9px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>LIKES</p>
                              <p className="text-xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{item.like_count}</p>
                            </div>
                            <div className="text-center border-l-2 border-r-2 border-black">
                              <p className="text-[9px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>CLICKS</p>
                              <p className="text-xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{item.click_count}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] tracking-wider opacity-60 mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>UNIQUE</p>
                              <p className="text-xl font-black" style={{ fontFamily: "Archivo Black, sans-serif" }}>{item.unique_click_count}</p>
                            </div>
                          </div>

                          {item.product_url && (
                            <a
                              href={item.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full py-2 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-center text-xs font-black"
                              style={{ fontFamily: "Bebas Neue, sans-serif" }}
                            >
                              VIEW PRODUCT →
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