"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Tab = "overview" | "performance" | "monetization" | "audience";
type TimeRange = "7d" | "30d" | "90d" | "all";

type Stats = {
  // Core metrics
  totalFollowers: number;
  followerGrowth: number;
  totalViews: number;
  viewGrowth: number;
  totalEngagement: number;
  engagementRate: number;

  // Clicks & Performance
  totalClicks: number;
  uniqueClicks: number;
  clickThroughRate: number;
  clickGrowth: number;

  // Content
  totalCatalogs: number;
  totalItems: number;
  avgItemsPerCatalog: number;

  // Engagement breakdown
  totalLikes: number;
  totalBookmarks: number;
  totalShares: number;

  // Monetization
  verifiedItems: number;
  monetizedItems: number;
  pendingVerifications: number;
  totalEarnings: number;
  estimatedEarnings: number;

  // Time-based
  avgDailyViews: number;
  avgDailyClicks: number;
  peakHour: number;
  bestDay: string;
};

type CatalogPerformance = {
  id: string;
  name: string;
  slug: string;
  coverImage: string;
  totalItems: number;
  views: number;
  clicks: number;
  uniqueClicks: number;
  likes: number;
  bookmarks: number;
  engagementRate: number;
  clickRate: number;
  growth: number;
};

type ItemPerformance = {
  id: string;
  title: string;
  image: string;
  catalogName: string;
  catalogSlug: string;
  seller: string | null;
  views: number;
  clicks: number;
  uniqueClicks: number;
  likes: number;
  clickRate: number;
  isVerified: boolean;
  isMonetized: boolean;
  earnings: number;
};

type VerifiableItem = {
  id: string;
  title: string;
  image: string;
  seller: string;
  catalogName: string;
  clicks: number;
  verificationStatus: string | null;
};

type EarningsData = {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  growth: number;
  byItem: Array<{
    itemId: string;
    itemTitle: string;
    itemImage: string;
    earnings: number;
    clicks: number;
  }>;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const [stats, setStats] = useState<Stats | null>(null);
  const [catalogPerformance, setCatalogPerformance] = useState<CatalogPerformance[]>([]);
  const [topItems, setTopItems] = useState<ItemPerformance[]>([]);
  const [verifiableItems, setVerifiableItems] = useState<VerifiableItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [partnerBrands, setPartnerBrands] = useState<string[]>([]);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUserId && isVerified) {
      loadAnalytics();
    }
  }, [currentUserId, isVerified, timeRange]);

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
      // Fetch partner brands
      const { data: brandsData } = await supabase
        .from("partner_brands")
        .select("brand_slug")
        .eq("is_active", true);

      const activeBrands = brandsData?.map(b => b.brand_slug.toLowerCase()) || [];
      setPartnerBrands(activeBrands);

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      if (timeRange === "7d") startDate.setDate(now.getDate() - 7);
      else if (timeRange === "30d") startDate.setDate(now.getDate() - 30);
      else if (timeRange === "90d") startDate.setDate(now.getDate() - 90);
      else startDate = new Date(0); // All time

      // Get follower count & growth
      const { count: followerCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUserId);

      const { count: recentFollowers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUserId)
        .gte("created_at", startDate.toISOString());

      // Get catalogs with proper cover images
      const { data: catalogsData } = await supabase
        .from("catalogs")
        .select("id, name, slug, image_url")
        .eq("owner_id", currentUserId);

      // Get detailed catalog performance
      const catalogStats = await Promise.all(
        (catalogsData || []).map(async (catalog) => {
          const { data: items } = await supabase
            .from("catalog_items")
            .select("id, image_url, like_count, click_count, unique_click_count, created_at")
            .eq("catalog_id", catalog.id);

          const { count: bookmarks } = await supabase
            .from("bookmarked_catalogs")
            .select("*", { count: "exact", head: true })
            .eq("catalog_id", catalog.id);

          // Filter items by time range for growth calculation
          const recentItems = items?.filter(item =>
            new Date(item.created_at) >= startDate
          ) || [];

          const totalLikes = items?.reduce((sum, i) => sum + (i.like_count || 0), 0) || 0;
          const totalClicks = items?.reduce((sum, i) => sum + (i.click_count || 0), 0) || 0;
          const totalUniqueClicks = items?.reduce((sum, i) => sum + (i.unique_click_count || 0), 0) || 0;
          const totalViews = totalUniqueClicks + (bookmarks || 0); // Views = unique clicks + bookmarks

          const recentClicks = recentItems.reduce((sum, i) => sum + (i.click_count || 0), 0);
          const previousClicks = totalClicks - recentClicks;
          const growth = previousClicks > 0 ? ((recentClicks - previousClicks) / previousClicks) * 100 : 0;

          return {
            id: catalog.id,
            name: catalog.name,
            slug: catalog.slug,
            coverImage: catalog.image_url || items?.[0]?.image_url || "",
            totalItems: items?.length || 0,
            views: totalViews,
            clicks: totalClicks,
            uniqueClicks: totalUniqueClicks,
            likes: totalLikes,
            bookmarks: bookmarks || 0,
            engagementRate: totalViews > 0 ? (totalLikes / totalViews) * 100 : 0,
            clickRate: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
            growth,
          };
        })
      );

      setCatalogPerformance(catalogStats.sort((a, b) => b.views - a.views));

      // Get top performing items
      const { data: allItems } = await supabase
        .from("catalog_items")
        .select(`
          id,
          title,
          image_url,
          seller,
          like_count,
          click_count,
          unique_click_count,
          is_verified,
          is_monetized,
          created_at,
          catalogs!inner(owner_id, name, slug)
        `)
        .eq("catalogs.owner_id", currentUserId)
        .order("click_count", { ascending: false })
        .limit(50);

      // Get earnings data
      const { data: earningsData } = await supabase
        .from("creator_earnings")
        .select("item_id, earnings_cents, created_at")
        .eq("user_id", currentUserId);

      const earningsByItem = new Map<string, number>();
      let totalEarningsCents = 0;
      let thisMonthCents = 0;
      let lastMonthCents = 0;

      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const lastMonthStart = new Date();
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      lastMonthStart.setDate(1);
      lastMonthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date();
      lastMonthEnd.setDate(0);
      lastMonthEnd.setHours(23, 59, 59, 999);

      earningsData?.forEach(e => {
        totalEarningsCents += e.earnings_cents;
        const current = earningsByItem.get(e.item_id) || 0;
        earningsByItem.set(e.item_id, current + e.earnings_cents);

        const earnDate = new Date(e.created_at);
        if (earnDate >= thisMonthStart) {
          thisMonthCents += e.earnings_cents;
        } else if (earnDate >= lastMonthStart && earnDate <= lastMonthEnd) {
          lastMonthCents += e.earnings_cents;
        }
      });

      const earningsGrowth = lastMonthCents > 0
        ? ((thisMonthCents - lastMonthCents) / lastMonthCents) * 100
        : 0;

      // Process items with earnings
      const itemsWithPerformance: ItemPerformance[] = allItems?.map((item: any) => {
        const views = (item.unique_click_count || 0) + (item.like_count || 0);
        const itemEarnings = earningsByItem.get(item.id) || 0;

        return {
          id: item.id,
          title: item.title,
          image: item.image_url,
          catalogName: item.catalogs.name,
          catalogSlug: item.catalogs.slug,
          seller: item.seller,
          views,
          clicks: item.click_count || 0,
          uniqueClicks: item.unique_click_count || 0,
          likes: item.like_count || 0,
          clickRate: views > 0 ? ((item.click_count || 0) / views) * 100 : 0,
          isVerified: item.is_verified || false,
          isMonetized: item.is_monetized || false,
          earnings: itemEarnings / 100, // Convert cents to dollars
        };
      }) || [];

      setTopItems(itemsWithPerformance);

      // Get verification requests
      const itemIds = allItems?.map(i => i.id) || [];
      const { data: requests } = await supabase
        .from("item_verification_requests")
        .select("item_id, status")
        .in("item_id", itemIds)
        .eq("item_type", "catalog");

      // Find verifiable items (partner brands, not yet verified)
      const verifiable = allItems?.filter((item: any) => {
        if (item.is_verified) return false;
        const seller = item.seller || "";
        const canVerify = activeBrands.some(b => seller.toLowerCase().includes(b));
        return canVerify;
      }).map((item: any) => {
        const request = requests?.find(r => r.item_id === item.id);
        return {
          id: item.id,
          title: item.title,
          image: item.image_url,
          seller: item.seller || "Unknown",
          catalogName: item.catalogs.name,
          clicks: item.click_count || 0,
          verificationStatus: request?.status || null,
        };
      }) || [];

      setVerifiableItems(verifiable);

      // Get earnings by top items
      const topEarningItems = itemsWithPerformance
        .filter(i => i.earnings > 0)
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 10)
        .map(i => ({
          itemId: i.id,
          itemTitle: i.title,
          itemImage: i.image,
          earnings: i.earnings,
          clicks: i.clicks,
        }));

      setEarnings({
        totalEarnings: totalEarningsCents / 100,
        thisMonth: thisMonthCents / 100,
        lastMonth: lastMonthCents / 100,
        growth: earningsGrowth,
        byItem: topEarningItems,
      });

      // Calculate comprehensive stats
      const totalLikes = catalogStats.reduce((sum, c) => sum + c.likes, 0);
      const totalBookmarks = catalogStats.reduce((sum, c) => sum + c.bookmarks, 0);
      const totalClicks = catalogStats.reduce((sum, c) => sum + c.clicks, 0);
      const totalUniqueClicks = catalogStats.reduce((sum, c) => sum + c.uniqueClicks, 0);
      const totalItems = catalogStats.reduce((sum, c) => sum + c.totalItems, 0);
      const totalViews = catalogStats.reduce((sum, c) => sum + c.views, 0);

      const verifiedItems = itemsWithPerformance.filter(i => i.isVerified).length;
      const monetizedItems = itemsWithPerformance.filter(i => i.isMonetized).length;

      const { count: pendingCount } = await supabase
        .from("item_verification_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .eq("status", "pending");

      // Calculate time-based metrics
      const daysInRange = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
      const avgDailyViews = totalViews / daysInRange;
      const avgDailyClicks = totalClicks / daysInRange;

      // Estimated earnings (placeholder - $0.05 per click for monetized items)
      const monetizedClicks = itemsWithPerformance
        .filter(i => i.isMonetized)
        .reduce((sum, i) => sum + i.clicks, 0);
      const estimatedEarnings = monetizedClicks * 0.05;

      setStats({
        totalFollowers: followerCount || 0,
        followerGrowth: followerCount > 0 ? ((recentFollowers || 0) / followerCount) * 100 : 0,
        totalViews,
        viewGrowth: 0, // TODO: Calculate from historical data
        totalEngagement: totalLikes + totalBookmarks,
        engagementRate: totalViews > 0 ? ((totalLikes + totalBookmarks) / totalViews) * 100 : 0,
        totalClicks,
        uniqueClicks: totalUniqueClicks,
        clickThroughRate: totalClicks > 0 ? (totalUniqueClicks / totalClicks) * 100 : 0,
        clickGrowth: 0, // TODO: Calculate from historical data
        totalCatalogs: catalogsData?.length || 0,
        totalItems,
        avgItemsPerCatalog: catalogsData?.length ? totalItems / catalogsData.length : 0,
        totalLikes,
        totalBookmarks,
        totalShares: 0, // TODO: Implement sharing
        verifiedItems,
        monetizedItems,
        pendingVerifications: pendingCount || 0,
        totalEarnings: totalEarningsCents / 100,
        estimatedEarnings,
        avgDailyViews,
        avgDailyClicks,
        peakHour: 14, // TODO: Calculate from click timestamps
        bestDay: "Monday", // TODO: Calculate from click timestamps
      });

    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  async function requestItemVerification(itemId: string, brandName: string) {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from("item_verification_requests")
        .insert({
          user_id: currentUserId,
          item_id: itemId,
          item_type: "catalog",
          brand_name: brandName,
          status: "pending",
        });

      if (error) {
        if (error.code === "23505") {
          alert("Verification already requested");
        } else {
          throw error;
        }
      } else {
        alert("Request submitted! We'll review within 48 hours.");
        loadAnalytics();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to submit");
    }
  }

  async function handleApplyForVerification() {
    setApplying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("verification_requests")
      .insert({ user_id: user.id, status: "pending" });

    if (error) {
      alert("Failed to submit");
    } else {
      setHasApplied(true);
      alert("Application submitted!");
    }
    setApplying(false);
  }

  const fmt = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toFixed(0);
  };

  const fmtCurrency = (n: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(n);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0a1a] to-[#0a0a1a] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // VERIFICATION REQUEST SCREEN
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0a1a] to-[#0a0a1a] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/10 backdrop-blur-md border border-purple-500/20 rounded-full mb-8">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-sm font-bold tracking-widest text-purple-300">CREATOR ACCESS</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-none tracking-tight">
              Unlock
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Analytics Dashboard
              </span>
            </h1>

            <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed font-medium">
              Get verified to access analytics, item monetization, and earnings tracking
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { title: "Performance Analytics", desc: "Track views, clicks, and engagement across all content" },
              { title: "Monetization Tools", desc: "Earn from verified items with partner brands" },
              { title: "Audience Insights", desc: "Understand your followers and optimize growth" },
            ].map((feature, i) => (
              <div
                key={i}
                className="relative p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-purple-500/30 hover:bg-white/10 transition-all group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 rounded-2xl transition-all" />
                <div className="relative">
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/60">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            {hasApplied ? (
              <div className="inline-flex flex-col items-center gap-4 p-8 bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-xl font-bold">Under Review</span>
                </div>
                <p className="text-white/60">We'll notify you once verified</p>
              </div>
            ) : (
              <button
                onClick={handleApplyForVerification}
                disabled={applying}
                className="group relative px-12 py-5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105 disabled:opacity-50"
              >
                <span className="relative z-10">
                  {applying ? "Submitting..." : "Apply for Verification"}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              </button>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes blob {
            0%, 100% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
        `}</style>
      </div>
    );
  }

  if (!stats) return null;

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0a1a] to-[#0a0a1a] text-white pb-20">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent truncate">
                Analytics
              </h1>
              <p className="text-xs sm:text-sm text-white/40 mt-0.5">@{currentUsername}</p>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                      timeRange === range
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {range === "all" ? "ALL" : range.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={() => router.push(`/${currentUsername}`)}
                className="px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs sm:text-sm font-semibold transition-all border border-white/10 hover:border-white/20 whitespace-nowrap"
              >
                Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-[73px] sm:top-[81px] z-40 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "overview", label: "Overview" },
              { id: "performance", label: "Performance" },
              { id: "monetization", label: "Monetization" },
              { id: "audience", label: "Audience" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-bold text-sm sm:text-base transition-all relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Priority Metrics - Most Important First */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                Key Performance
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  {
                    label: "Total Views",
                    value: fmt(stats.totalViews),
                    change: stats.viewGrowth,
                    subValue: `${fmt(stats.avgDailyViews)}/day avg`,
                    gradient: "from-blue-500/20 to-cyan-500/20",
                    border: "border-blue-500/30",
                    icon: "👁️"
                  },
                  {
                    label: "Engagement Rate",
                    value: `${stats.engagementRate.toFixed(1)}%`,
                    subValue: `${fmt(stats.totalEngagement)} total`,
                    gradient: "from-purple-500/20 to-pink-500/20",
                    border: "border-purple-500/30",
                    icon: "❤️"
                  },
                  {
                    label: "Click-Through Rate",
                    value: `${stats.clickThroughRate.toFixed(1)}%`,
                    change: stats.clickGrowth,
                    subValue: `${fmt(stats.totalClicks)} clicks`,
                    gradient: "from-pink-500/20 to-red-500/20",
                    border: "border-pink-500/30",
                    icon: "👆"
                  },
                  {
                    label: "Total Earnings",
                    value: fmtCurrency(stats.totalEarnings),
                    subValue: `${fmtCurrency(stats.estimatedEarnings)} pending`,
                    gradient: "from-green-500/20 to-emerald-500/20",
                    border: "border-green-500/30",
                    icon: "💰"
                  },
                ].map((metric, i) => (
                  <div key={i} className={`p-4 sm:p-6 bg-gradient-to-br ${metric.gradient} backdrop-blur-md border ${metric.border} rounded-xl sm:rounded-2xl hover:scale-105 transition-all group relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="text-xs text-white/60 font-bold tracking-wider uppercase">{metric.label}</div>
                        <span className="text-lg sm:text-xl">{metric.icon}</span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black mb-1">{metric.value}</div>
                      {metric.change !== undefined && metric.change !== 0 && (
                        <div className={`text-xs font-bold ${metric.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {metric.change > 0 ? '↗' : '↘'} {Math.abs(metric.change).toFixed(1)}%
                        </div>
                      )}
                      {metric.subValue && (
                        <div className="text-xs text-white/50 font-medium">{metric.subValue}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audience Overview */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                Audience
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: "Followers", value: fmt(stats.totalFollowers), change: stats.followerGrowth, icon: "👥" },
                  { label: "Catalogs", value: stats.totalCatalogs, icon: "📁" },
                  { label: "Total Items", value: fmt(stats.totalItems), icon: "🎯" },
                  { label: "Avg Items/Catalog", value: stats.avgItemsPerCatalog.toFixed(1), icon: "📊" },
                ].map((metric, i) => (
                  <div key={i} className="p-4 sm:p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-white/60 font-bold tracking-wide uppercase">{metric.label}</div>
                      <span className="text-base sm:text-lg">{metric.icon}</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black mb-1">{metric.value}</div>
                    {metric.change !== undefined && metric.change > 0 && (
                      <div className="text-xs text-green-400 font-bold">↗ +{metric.change.toFixed(1)}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performing Catalogs */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-pink-500 to-red-500 rounded-full" />
                Top Catalogs
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {catalogPerformance.slice(0, 6).map((catalog, i) => (
                  <div
                    key={catalog.id}
                    onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                    className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden hover:border-purple-500/40 hover:scale-105 transition-all cursor-pointer relative"
                  >
                    {i < 3 && (
                      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-black font-black text-sm shadow-xl">
                        {i + 1}
                      </div>
                    )}
                    {catalog.growth > 0 && (
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10 px-2 py-1 bg-green-500/90 backdrop-blur-sm rounded-full text-xs font-black">
                        ↗ {catalog.growth.toFixed(0)}%
                      </div>
                    )}
                    <div className="aspect-square bg-white/5 overflow-hidden">
                      {catalog.coverImage && (
                        <img src={catalog.coverImage} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      )}
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="font-bold text-base sm:text-lg mb-3 truncate">{catalog.name}</h3>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                          <div className="text-white/50 text-xs mb-1 font-medium">Views</div>
                          <div className="font-black text-sm sm:text-base">{fmt(catalog.views)}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                          <div className="text-white/50 text-xs mb-1 font-medium">Clicks</div>
                          <div className="font-black text-sm sm:text-base">{fmt(catalog.clicks)}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                          <div className="text-white/50 text-xs mb-1 font-medium">CTR</div>
                          <div className="font-black text-sm sm:text-base">{catalog.clickRate.toFixed(0)}%</div>
                        </div>
                      </div>
                      <div className="text-xs text-white/50">{catalog.totalItems} items</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === "performance" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Performance Metrics */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                Performance Breakdown
              </h2>

              <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-md border border-blue-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-blue-300 font-bold mb-2 tracking-wide">Clicks</div>
                  <div className="text-4xl sm:text-5xl font-black mb-1 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">{fmt(stats.totalClicks)}</div>
                  <div className="text-xs text-white/40">{fmt(stats.uniqueClicks)} unique • {fmt(stats.avgDailyClicks)}/day</div>
                </div>

                <div className="bg-gradient-to-br from-pink-500/10 to-red-500/10 backdrop-blur-md border border-pink-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-pink-300 font-bold mb-2 tracking-wide">Engagement</div>
                  <div className="text-4xl sm:text-5xl font-black mb-1 bg-gradient-to-r from-pink-300 to-red-300 bg-clip-text text-transparent">{fmt(stats.totalEngagement)}</div>
                  <div className="text-xs text-white/40">{fmt(stats.totalLikes)} likes • {fmt(stats.totalBookmarks)} saves</div>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-md border border-green-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-green-300 font-bold mb-2 tracking-wide">Engagement Rate</div>
                  <div className="text-4xl sm:text-5xl font-black mb-1 bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">{stats.engagementRate.toFixed(1)}%</div>
                  <div className="text-xs text-white/40">Above average performance</div>
                </div>
              </div>
            </div>

            {/* Top Performing Items */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                Top Performing Items
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {topItems.slice(0, 10).map((item, i) => (
                  <div key={item.id} className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-lg sm:rounded-xl overflow-hidden hover:border-purple-500/40 hover:scale-105 transition-all relative">
                    {i < 3 && (
                      <div className="absolute top-2 left-2 z-10 w-6 h-6 sm:w-7 sm:h-7 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg">
                        {i + 1}
                      </div>
                    )}
                    {item.isVerified && (
                      <div className="absolute top-2 right-2 z-10 w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="white" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                      </div>
                    )}
                    <div className="aspect-square bg-white/5 overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <div className="p-2 sm:p-3">
                      <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <div className="text-white/50">Views</div>
                          <div className="font-black">{fmt(item.views)}</div>
                        </div>
                        <div>
                          <div className="text-white/50">Clicks</div>
                          <div className="font-black">{fmt(item.clicks)}</div>
                        </div>
                      </div>
                      {item.earnings > 0 && (
                        <div className="mt-2 text-xs font-bold text-green-400">
                          {fmtCurrency(item.earnings)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Catalogs Performance */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
                All Catalogs
              </h2>

              <div className="space-y-3 sm:space-y-4">
                {catalogPerformance.map((catalog) => (
                  <div
                    key={catalog.id}
                    onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                    className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl hover:border-purple-500/30 transition-all cursor-pointer group"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                      {catalog.coverImage && (
                        <img src={catalog.coverImage} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base sm:text-lg mb-1 truncate">{catalog.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-white/60">
                        <span>{catalog.totalItems} items</span>
                        <span>•</span>
                        <span>{fmt(catalog.views)} views</span>
                        <span>•</span>
                        <span>{fmt(catalog.clicks)} clicks</span>
                        <span>•</span>
                        <span>{catalog.engagementRate.toFixed(1)}% engagement</span>
                      </div>
                    </div>
                    {catalog.growth > 0 && (
                      <div className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-xs font-bold text-green-400 whitespace-nowrap">
                        ↗ {catalog.growth.toFixed(0)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MONETIZATION TAB */}
        {activeTab === "monetization" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Earnings Overview */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
                Earnings
              </h2>

              {earnings && (
                <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                    <div className="text-sm text-green-300 font-bold mb-2">Total Earnings</div>
                    <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                      {fmtCurrency(earnings.totalEarnings)}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                    <div className="text-sm text-blue-300 font-bold mb-2">This Month</div>
                    <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                      {fmtCurrency(earnings.thisMonth)}
                    </div>
                    {earnings.growth !== 0 && (
                      <div className={`text-xs font-bold mt-2 ${earnings.growth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {earnings.growth > 0 ? '↗' : '↘'} {Math.abs(earnings.growth).toFixed(1)}% vs last month
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                    <div className="text-sm text-purple-300 font-bold mb-2">Estimated (Pending)</div>
                    <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                      {fmtCurrency(stats.estimatedEarnings)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Monetization Stats */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                Monetization Status
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="text-sm text-green-300 font-bold mb-2">Verified Items</div>
                  <div className="text-3xl sm:text-4xl font-black text-green-300">{stats.verifiedItems}</div>
                </div>
                <div className="p-4 sm:p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="text-sm text-blue-300 font-bold mb-2">Monetized</div>
                  <div className="text-3xl sm:text-4xl font-black text-blue-300">{stats.monetizedItems}</div>
                </div>
                <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="text-sm text-amber-300 font-bold mb-2">Pending</div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-300">{stats.pendingVerifications}</div>
                </div>
              </div>
            </div>

            {/* Top Earning Items */}
            {earnings && earnings.byItem.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
                  Top Earning Items
                </h2>

                <div className="space-y-3">
                  {earnings.byItem.map((item, i) => (
                    <div key={item.itemId} className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl hover:border-green-500/30 transition-all">
                      {i < 3 && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-black font-black text-sm flex-shrink-0">
                          {i + 1}
                        </div>
                      )}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={item.itemImage} alt={item.itemTitle} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm sm:text-base mb-1 truncate">{item.itemTitle}</h3>
                        <div className="text-xs text-white/60">{fmt(item.clicks)} clicks</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg sm:text-xl font-black text-green-400">{fmtCurrency(item.earnings)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Eligible for Verification */}
            {verifiableItems.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                  Items Eligible for Verification
                </h2>
                <p className="text-sm text-white/60 mb-4">Partner brands: Diesel, Hat Club, Finish Line</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {verifiableItems.map((item) => (
                    <div key={item.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg sm:rounded-xl overflow-hidden hover:border-blue-500/30 transition-all">
                      <div className="aspect-square bg-white/5 overflow-hidden">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                        <div className="text-xs text-white/50 mb-3">{item.seller}</div>
                        {!item.verificationStatus && (
                          <button
                            onClick={() => requestItemVerification(item.id, item.seller)}
                            className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-xs font-bold transition-all"
                          >
                            Request Verification
                          </button>
                        )}
                        {item.verificationStatus === "pending" && (
                          <div className="w-full py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs font-bold text-center text-amber-300">
                            Pending Review
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUDIENCE TAB */}
        {activeTab === "audience" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Audience Overview */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                Audience Overview
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-blue-300 font-bold mb-2">Total Followers</div>
                  <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">{fmt(stats.totalFollowers)}</div>
                  {stats.followerGrowth > 0 && (
                    <div className="text-xs text-green-400 font-bold mt-2">↗ +{stats.followerGrowth.toFixed(1)}%</div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-purple-300 font-bold mb-2">Avg Daily Views</div>
                  <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">{fmt(stats.avgDailyViews)}</div>
                </div>

                <div className="bg-gradient-to-br from-pink-500/10 to-red-500/10 border border-pink-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-pink-300 font-bold mb-2">Peak Hour</div>
                  <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-pink-300 to-red-300 bg-clip-text text-transparent">{stats.peakHour}:00</div>
                  <div className="text-xs text-white/40 mt-2">Best time to post</div>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl sm:rounded-2xl p-5 sm:p-6">
                  <div className="text-sm text-green-300 font-bold mb-2">Best Day</div>
                  <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">{stats.bestDay}</div>
                  <div className="text-xs text-white/40 mt-2">Highest engagement</div>
                </div>
              </div>
            </div>

            {/* Content Performance */}
            <div>
              <h2 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                Content Performance
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="p-5 sm:p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl">
                  <h3 className="font-bold mb-4">Engagement Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Likes</span>
                      <span className="font-bold">{fmt(stats.totalLikes)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Bookmarks</span>
                      <span className="font-bold">{fmt(stats.totalBookmarks)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Clicks</span>
                      <span className="font-bold">{fmt(stats.totalClicks)}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Total Engagement</span>
                        <span className="font-black">{fmt(stats.totalEngagement)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl">
                  <h3 className="font-bold mb-4">Content Stats</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Total Catalogs</span>
                      <span className="font-bold">{stats.totalCatalogs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Total Items</span>
                      <span className="font-bold">{fmt(stats.totalItems)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Avg Items/Catalog</span>
                      <span className="font-bold">{stats.avgItemsPerCatalog.toFixed(1)}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Engagement Rate</span>
                        <span className="font-black">{stats.engagementRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}