"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Tab = "overview" | "performance" | "monetization" | "audience" | "info";
type TimeRange = "7d" | "30d" | "90d" | "all";

type Stats = {
  totalFollowers: number;
  followerGrowth: number;
  totalViews: number;
  totalEngagement: number;
  engagementRate: number;
  totalClicks: number;
  uniqueClicks: number;
  clickThroughRate: number;
  totalCatalogs: number;
  totalItems: number;
  avgItemsPerCatalog: number;
  totalLikes: number;
  totalBookmarks: number;
  verifiedItems: number;
  monetizedItems: number;
  pendingVerifications: number;
  totalEarnings: number;
  estimatedEarnings: number;
  avgDailyViews: number;
  avgDailyClicks: number;
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

type Toast = {
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<Toast>({ show: false, message: "", type: "info" });

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

  // Auto-hide toast
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ ...toast, show: false });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ show: true, message, type });
  }

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
      const { data: brandsData } = await supabase
        .from("partner_brands")
        .select("brand_slug")
        .eq("is_active", true);

      const activeBrands = brandsData?.map(b => b.brand_slug.toLowerCase()) || [];
      setPartnerBrands(activeBrands);

      const now = new Date();
      let startDate = new Date();
      if (timeRange === "7d") startDate.setDate(now.getDate() - 7);
      else if (timeRange === "30d") startDate.setDate(now.getDate() - 30);
      else if (timeRange === "90d") startDate.setDate(now.getDate() - 90);
      else startDate = new Date(0);

      const { count: followerCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUserId);

      const { count: recentFollowers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUserId)
        .gte("created_at", startDate.toISOString());

      const { data: catalogsData } = await supabase
        .from("catalogs")
        .select("id, name, slug, image_url")
        .eq("owner_id", currentUserId);

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

          const recentItems = items?.filter(item =>
            new Date(item.created_at) >= startDate
          ) || [];

          const totalLikes = items?.reduce((sum, i) => sum + (i.like_count || 0), 0) || 0;
          const totalClicks = items?.reduce((sum, i) => sum + (i.click_count || 0), 0) || 0;
          const totalUniqueClicks = items?.reduce((sum, i) => sum + (i.unique_click_count || 0), 0) || 0;
          const totalViews = totalUniqueClicks + (bookmarks || 0);

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
          earnings: itemEarnings / 100,
        };
      }) || [];

      setTopItems(itemsWithPerformance);

      const itemIds = allItems?.map(i => i.id) || [];
      const { data: requests } = await supabase
        .from("item_verification_requests")
        .select("item_id, status")
        .in("item_id", itemIds)
        .eq("item_type", "catalog");

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

      const daysInRange = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
      const avgDailyViews = totalViews / daysInRange;
      const avgDailyClicks = totalClicks / daysInRange;

      const monetizedClicks = itemsWithPerformance
        .filter(i => i.isMonetized)
        .reduce((sum, i) => sum + i.clicks, 0);
      const estimatedEarnings = monetizedClicks * 0.05;

      setStats({
        totalFollowers: followerCount || 0,
        followerGrowth: (followerCount && followerCount > 0) ? ((recentFollowers || 0) / followerCount) * 100 : 0,
        totalViews,
        totalEngagement: totalLikes + totalBookmarks,
        engagementRate: totalViews > 0 ? ((totalLikes + totalBookmarks) / totalViews) * 100 : 0,
        totalClicks,
        uniqueClicks: totalUniqueClicks,
        clickThroughRate: totalClicks > 0 ? (totalUniqueClicks / totalClicks) * 100 : 0,
        totalCatalogs: catalogsData?.length || 0,
        totalItems,
        avgItemsPerCatalog: (catalogsData && catalogsData.length > 0) ? totalItems / catalogsData.length : 0,
        totalLikes,
        totalBookmarks,
        verifiedItems,
        monetizedItems,
        pendingVerifications: pendingCount || 0,
        totalEarnings: totalEarningsCents / 100,
        estimatedEarnings,
        avgDailyViews,
        avgDailyClicks,
      });

    } catch (error) {
      console.error("Error loading analytics:", error);
      showToast("Failed to load analytics data", "error");
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
          showToast("Verification already requested for this item", "info");
        } else {
          throw error;
        }
      } else {
        showToast("✓ Verification request submitted! We'll review within 48 hours.", "success");
        loadAnalytics();
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("Failed to submit verification request", "error");
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
      showToast("Failed to submit application", "error");
    } else {
      setHasApplied(true);
      showToast("✓ Application submitted successfully!", "success");
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // VERIFICATION REQUEST SCREEN
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Toast */}
        {toast.show && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg font-bold shadow-2xl animate-slide-in ${
            toast.type === "success" ? "bg-green-500" :
            toast.type === "error" ? "bg-red-500" :
            "bg-blue-500"
          }`}>
            {toast.message}
          </div>
        )}

        <div className="max-w-5xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-7xl md:text-8xl font-black mb-4 tracking-tight">
              CREATOR ANALYTICS
            </h1>
            <p className="text-xl text-white/60">Get verified to unlock your dashboard</p>
          </div>

          {/* What You Get */}
          <div className="mb-16">
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black mb-8">
              WHAT YOU GET
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border-2 border-white/10 p-8">
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl font-black mb-4">
                  PERFORMANCE TRACKING
                </h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Real-time views, clicks, and engagement metrics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Per-catalog and per-item performance breakdown</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Follower growth and audience insights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Time-based analytics (7d, 30d, 90d, all-time)</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white/5 border-2 border-white/10 p-8">
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl font-black mb-4">
                  MONETIZATION
                </h3>
                <ul className="space-y-3 text-white/80">
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Submit items from partner brands for verification</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Earn from verified item clicks through affiliate links</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Track earnings per item and total revenue</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-black">✓</span>
                    <span>Priority review for verification requests</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-16">
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black mb-8">
              HOW IT WORKS
            </h2>

            <div className="space-y-6">
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }} >
                  <span className="text-2xl font-black">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Apply for Verification</h3>
                  <p className="text-white/70">Click the button below to submit your creator application. We review all applications within 24-48 hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  <span className="text-2xl font-black">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Get Verified</h3>
                  <p className="text-white/70">Once approved, you'll receive verified creator status and access to the full analytics dashboard.</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  <span className="text-2xl font-black">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Submit Items for Monetization</h3>
                  <p className="text-white/70">Browse your items and submit products from our partner brands (Diesel, Hat Club, Finish Line) for verification and monetization.</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  <span className="text-2xl font-black">4</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Start Earning</h3>
                  <p className="text-white/70">Once items are approved, affiliate links are added and you earn from each click. Track your earnings in real-time on the dashboard.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="mb-16">
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black mb-8">
              REQUIREMENTS
            </h2>

            <div className="bg-white/5 border-2 border-white/10 p-8">
              <ul className="space-y-3 text-white/80">
                <li className="flex items-start gap-3">
                  <span className="text-white/40">•</span>
                  <span>Active Sourced account with at least one catalog</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-white/40">•</span>
                  <span>High-quality, authentic product curation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-white/40">•</span>
                  <span>Compliance with Sourced community guidelines</span>
                </li>
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            {hasApplied ? (
              <div className="inline-block bg-amber-500/20 border-2 border-amber-500 px-8 py-6">
                <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black text-amber-400 mb-2">
                  APPLICATION PENDING
                </div>
                <p className="text-white/70">We'll email you once your application is reviewed</p>
              </div>
            ) : (
              <button
                onClick={handleApplyForVerification}
                disabled={applying}
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="bg-white text-black px-12 py-5 text-2xl font-black hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? "SUBMITTING..." : "APPLY FOR VERIFICATION"}
              </button>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes slide-in {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }

  if (!stats) return null;

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg font-bold shadow-2xl animate-slide-in ${
          toast.type === "success" ? "bg-green-500" :
          toast.type === "error" ? "bg-red-500" :
          "bg-blue-500"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="border-b-2 border-white/10 sticky top-0 z-40 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl font-black truncate">
                ANALYTICS
              </h1>
              <p className="text-sm text-white/50">@{currentUsername}</p>
            </div>

            {/* Time Range */}
            <div className="flex items-center gap-2">
              <div className="flex border-2 border-white/10">
                {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    className={`px-3 py-2 text-sm font-black transition-all ${
                      timeRange === range
                        ? "bg-white text-black"
                        : "bg-black text-white hover:bg-white/10"
                    }`}
                  >
                    {range === "all" ? "ALL" : range.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={() => router.push(`/${currentUsername}`)}
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="px-4 py-2 border-2 border-white/10 hover:border-white/30 text-sm font-black transition-all whitespace-nowrap"
              >
                PROFILE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-white/10 sticky top-[73px] sm:top-[81px] z-30 bg-black overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "overview", label: "OVERVIEW" },
              { id: "performance", label: "PERFORMANCE" },
              { id: "monetization", label: "MONETIZATION" },
              { id: "audience", label: "AUDIENCE" },
              { id: "info", label: "INFO" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className={`px-6 py-4 text-lg font-black transition-all relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                KEY PERFORMANCE
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "TOTAL VIEWS", value: fmt(stats.totalViews), subValue: `${fmt(stats.avgDailyViews)}/day` },
                  { label: "ENGAGEMENT RATE", value: `${stats.engagementRate.toFixed(1)}%`, subValue: `${fmt(stats.totalEngagement)} total` },
                  { label: "CLICK-THROUGH RATE", value: `${stats.clickThroughRate.toFixed(1)}%`, subValue: `${fmt(stats.totalClicks)} clicks` },
                  { label: "TOTAL EARNINGS", value: fmtCurrency(stats.totalEarnings), subValue: fmtCurrency(stats.estimatedEarnings) + " pending" },
                ].map((metric, i) => (
                  <div key={i} className="bg-white/5 border-2 border-white/10 p-6 hover:border-white/30 transition-all">
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xs text-white/50 font-black mb-2">
                      {metric.label}
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black mb-1">
                      {metric.value}
                    </div>
                    <div className="text-xs text-white/40">{metric.subValue}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                AUDIENCE
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "FOLLOWERS", value: fmt(stats.totalFollowers), change: stats.followerGrowth },
                  { label: "CATALOGS", value: stats.totalCatalogs },
                  { label: "TOTAL ITEMS", value: fmt(stats.totalItems) },
                  { label: "AVG ITEMS/CATALOG", value: stats.avgItemsPerCatalog.toFixed(1) },
                ].map((metric, i) => (
                  <div key={i} className="bg-white/5 border-2 border-white/10 p-5">
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xs text-white/50 font-black mb-2">
                      {metric.label}
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black">
                      {metric.value}
                    </div>
                    {metric.change !== undefined && metric.change > 0 && (
                      <div className="text-xs text-green-500 font-bold mt-1">
                        ↗ +{metric.change.toFixed(1)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Catalogs */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                TOP CATALOGS
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalogPerformance.slice(0, 6).map((catalog, i) => (
                  <div
                    key={catalog.id}
                    onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                    className="group bg-white/5 border-2 border-white/10 overflow-hidden hover:border-white cursor-pointer transition-all relative"
                  >
                    {i < 3 && (
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="absolute top-4 left-4 z-10 w-10 h-10 bg-white text-black flex items-center justify-center text-xl font-black">
                        {i + 1}
                      </div>
                    )}
                    <div className="aspect-square bg-white/5 overflow-hidden">
                      {catalog.coverImage && (
                        <img src={catalog.coverImage} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      )}
                    </div>
                    <div className="p-5">
                      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl font-black mb-3 truncate">
                        {catalog.name}
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 p-2">
                          <div className="text-white/50 text-xs font-bold">VIEWS</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg font-black">
                            {fmt(catalog.views)}
                          </div>
                        </div>
                        <div className="bg-white/5 p-2">
                          <div className="text-white/50 text-xs font-bold">CLICKS</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg font-black">
                            {fmt(catalog.clicks)}
                          </div>
                        </div>
                        <div className="bg-white/5 p-2">
                          <div className="text-white/50 text-xs font-bold">CTR</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg font-black">
                            {catalog.clickRate.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === "performance" && (
          <div className="space-y-8">
            {/* Performance Breakdown */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                PERFORMANCE BREAKDOWN
              </h2>

              <div className="grid sm:grid-cols-3 gap-6">
                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    CLICKS
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black mb-1">
                    {fmt(stats.totalClicks)}
                  </div>
                  <div className="text-xs text-white/40">
                    {fmt(stats.uniqueClicks)} unique • {fmt(stats.avgDailyClicks)}/day
                  </div>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    ENGAGEMENT
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black mb-1">
                    {fmt(stats.totalEngagement)}
                  </div>
                  <div className="text-xs text-white/40">
                    {fmt(stats.totalLikes)} likes • {fmt(stats.totalBookmarks)} saves
                  </div>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    ENGAGEMENT RATE
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black mb-1">
                    {stats.engagementRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-white/40">Above average</div>
                </div>
              </div>
            </div>

            {/* Top Performing Items */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                TOP PERFORMING ITEMS
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {topItems.slice(0, 10).map((item, i) => (
                  <div key={item.id} className="group bg-white/5 border-2 border-white/10 overflow-hidden hover:border-white transition-all relative">
                    {i < 3 && (
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="absolute top-2 left-2 z-10 w-8 h-8 bg-white text-black flex items-center justify-center text-sm font-black">
                        {i + 1}
                      </div>
                    )}
                    {item.isVerified && (
                      <div className="absolute top-2 right-2 z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                      </div>
                    )}
                    <div className="aspect-square bg-white/5 overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <div className="text-white/50">VIEWS</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                            {fmt(item.views)}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/50">CLICKS</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                            {fmt(item.clicks)}
                          </div>
                        </div>
                      </div>
                      {item.earnings > 0 && (
                        <div className="mt-2 text-xs font-bold text-green-500">
                          {fmtCurrency(item.earnings)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Catalogs */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                ALL CATALOGS
              </h2>

              <div className="space-y-4">
                {catalogPerformance.map((catalog) => (
                  <div
                    key={catalog.id}
                    onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                    className="flex items-center gap-4 p-5 bg-white/5 border-2 border-white/10 hover:border-white transition-all cursor-pointer group"
                  >
                    <div className="w-20 h-20 bg-white/5 overflow-hidden flex-shrink-0">
                      {catalog.coverImage && (
                        <img src={catalog.coverImage} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl font-black mb-1 truncate">
                        {catalog.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
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
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="px-3 py-1 bg-green-500/20 border border-green-500 text-green-500 text-sm font-black whitespace-nowrap">
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
          <div className="space-y-8">
            {/* Earnings Overview */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                EARNINGS
              </h2>

              {earnings && (
                <div className="grid sm:grid-cols-3 gap-6">
                  <div className="bg-white/5 border-2 border-white/10 p-6">
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                      TOTAL EARNINGS
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black">
                      {fmtCurrency(earnings.totalEarnings)}
                    </div>
                  </div>

                  <div className="bg-white/5 border-2 border-white/10 p-6">
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                      THIS MONTH
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black">
                      {fmtCurrency(earnings.thisMonth)}
                    </div>
                    {earnings.growth !== 0 && (
                      <div className={`text-xs font-bold mt-2 ${earnings.growth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {earnings.growth > 0 ? '↗' : '↘'} {Math.abs(earnings.growth).toFixed(1)}% vs last month
                      </div>
                    )}
                  </div>

                  <div className="bg-white/5 border-2 border-white/10 p-6">
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                      ESTIMATED (PENDING)
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black">
                      {fmtCurrency(stats.estimatedEarnings)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Monetization Stats */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                MONETIZATION STATUS
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-green-500/10 border-2 border-green-500 p-5">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-green-500 font-black mb-2">
                    VERIFIED ITEMS
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black text-green-500">
                    {stats.verifiedItems}
                  </div>
                </div>
                <div className="bg-blue-500/10 border-2 border-blue-500 p-5">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-blue-500 font-black mb-2">
                    MONETIZED
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black text-blue-500">
                    {stats.monetizedItems}
                  </div>
                </div>
                <div className="bg-amber-500/10 border-2 border-amber-500 p-5">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-amber-500 font-black mb-2">
                    PENDING
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl font-black text-amber-500">
                    {stats.pendingVerifications}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Earning Items */}
            {earnings && earnings.byItem.length > 0 && (
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                  TOP EARNING ITEMS
                </h2>

                <div className="space-y-3">
                  {earnings.byItem.map((item, i) => (
                    <div key={item.itemId} className="flex items-center gap-4 p-5 bg-white/5 border-2 border-white/10 hover:border-green-500 transition-all">
                      {i < 3 && (
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="w-10 h-10 bg-white text-black flex items-center justify-center text-xl font-black flex-shrink-0">
                          {i + 1}
                        </div>
                      )}
                      <div className="w-16 h-16 bg-white/5 overflow-hidden flex-shrink-0">
                        <img src={item.itemImage} alt={item.itemTitle} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate">{item.itemTitle}</h3>
                        <div className="text-xs text-white/60">{fmt(item.clicks)} clicks</div>
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl font-black text-green-500 flex-shrink-0">
                        {fmtCurrency(item.earnings)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monetized Items - Currently Earning */}
            {topItems.filter(i => i.isMonetized).length > 0 && (
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-4">
                  MONETIZED ITEMS
                </h2>
                <p className="text-sm text-white/60 mb-6">
                  Items currently earning through affiliate links
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {topItems.filter(i => i.isMonetized).map((item) => (
                    <div key={item.id} className="bg-white/5 border-2 border-green-500/30 overflow-hidden hover:border-green-500 transition-all">
                      <div className="absolute top-2 right-2 z-10 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-black text-xs">$</span>
                      </div>
                      <div className="aspect-square bg-white/5 overflow-hidden">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                        <div className="text-xs text-white/50 mb-3">{item.seller}</div>

                        {/* Performance Stats */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Clicks</span>
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                              {fmt(item.clicks)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Click Rate</span>
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                              {item.clickRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Earnings */}
                        <div className="pt-3 border-t-2 border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/50">Earned</span>
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg font-black text-green-500">
                              {fmtCurrency(item.earnings)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Eligible for Verification */}
            {verifiableItems.length > 0 && (
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-4">
                  ITEMS ELIGIBLE FOR VERIFICATION
                </h2>
                <p className="text-sm text-white/60 mb-6">Partner brands: Diesel, Hat Club, Finish Line</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {verifiableItems.map((item) => (
                    <div key={item.id} className="bg-white/5 border-2 border-white/10 overflow-hidden hover:border-white transition-all">
                      <div className="aspect-square bg-white/5 overflow-hidden">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                        <div className="text-xs text-white/50 mb-3">{item.seller}</div>
                        {!item.verificationStatus && (
                          <button
                            onClick={() => requestItemVerification(item.id, item.seller)}
                            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                            className="w-full py-2 bg-white text-black hover:bg-white/90 text-xs font-black transition-all"
                          >
                            REQUEST VERIFICATION
                          </button>
                        )}
                        {item.verificationStatus === "pending" && (
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="w-full py-2 bg-amber-500/20 border border-amber-500 text-xs font-black text-center text-amber-500">
                            PENDING REVIEW
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
          <div className="space-y-8">
            {/* Audience Overview */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                AUDIENCE OVERVIEW
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    TOTAL FOLLOWERS
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black mb-1">
                    {fmt(stats.totalFollowers)}
                  </div>
                  {stats.followerGrowth > 0 && (
                    <div className="text-xs text-green-500 font-bold">
                      ↗ +{stats.followerGrowth.toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    AVG DAILY VIEWS
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black">
                    {fmt(stats.avgDailyViews)}
                  </div>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    AVG DAILY CLICKS
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black">
                    {fmt(stats.avgDailyClicks)}
                  </div>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-sm text-white/50 font-black mb-2">
                    ENGAGEMENT RATE
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-5xl font-black">
                    {stats.engagementRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Content Performance */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                CONTENT PERFORMANCE
              </h2>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl font-black mb-4">
                    ENGAGEMENT BREAKDOWN
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Likes</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                        {fmt(stats.totalLikes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Bookmarks</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                        {fmt(stats.totalBookmarks)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Clicks</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                        {fmt(stats.totalClicks)}
                      </span>
                    </div>
                    <div className="pt-3 border-t-2 border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Total Engagement</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl font-black">
                          {fmt(stats.totalEngagement)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6">
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl font-black mb-4">
                    CONTENT STATS
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Total Catalogs</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                        {stats.totalCatalogs}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Total Items</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                        {fmt(stats.totalItems)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Avg Items/Catalog</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="font-black">
                        {stats.avgItemsPerCatalog.toFixed(1)}
                      </span>
                    </div>
                    <div className="pt-3 border-t-2 border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Total Views</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-xl font-black">
                          {fmt(stats.totalViews)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INFO TAB */}
        {activeTab === "info" && (
          <div className="space-y-8">
            {/* Partner Brands */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                PARTNER BRANDS
              </h2>

              <div className="bg-white/5 border-2 border-white/10 p-8">
                <p className="text-white/70 mb-6">
                  Items from these brands are eligible for verification and monetization. Submit items through the Monetization tab to start earning.
                </p>

                <div className="grid sm:grid-cols-3 gap-6">
                  {[
                    { name: "Diesel", desc: "Premium denim and streetwear" },
                    { name: "Hat Club", desc: "Exclusive headwear and accessories" },
                    { name: "Finish Line", desc: "Athletic footwear and apparel" },
                  ].map((brand) => (
                    <div key={brand.name} className="bg-white/5 border-2 border-white/10 p-6">
                      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl font-black mb-2">
                        {brand.name}
                      </h3>
                      <p className="text-sm text-white/60">{brand.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                HOW MONETIZATION WORKS
              </h2>

              <div className="space-y-6">
                <div className="flex items-start gap-6 bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0 text-2xl font-black">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Add Partner Brand Items</h3>
                    <p className="text-white/70">Curate items from Diesel, Hat Club, or Finish Line in your catalogs</p>
                  </div>
                </div>

                <div className="flex items-start gap-6 bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0 text-2xl font-black">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Request Verification</h3>
                    <p className="text-white/70">Go to Monetization tab and click "Request Verification" on eligible items. We verify authenticity and brand partnership.</p>
                  </div>
                </div>

                <div className="flex items-start gap-6 bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0 text-2xl font-black">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Get Verified & Monetized</h3>
                    <p className="text-white/70">Items are marked as 'verified' first, then we add affiliate links and change status to 'monetized'. This takes 24-72 hours total.</p>
                  </div>
                </div>

                <div className="flex items-start gap-6 bg-white/5 border-2 border-white/10 p-6">
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="w-12 h-12 bg-white text-black flex items-center justify-center flex-shrink-0 text-2xl font-black">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Start Earning</h3>
                    <p className="text-white/70">Once monetized, your item appears in the "Monetized Items" section. Track clicks, earnings, and performance in real-time.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl font-black mb-6">
                FREQUENTLY ASKED QUESTIONS
              </h2>

              <div className="space-y-4">
                {[
                  {
                    q: "What's the difference between verified and monetized?",
                    a: "Verified items have been approved by our team and confirmed as authentic partner brand products. Monetized items are verified items that have affiliate links active and are currently earning. All monetized items are verified, but not all verified items are monetized yet."
                  },
                  {
                    q: "How much can I earn?",
                    a: "Earnings vary based on clicks and conversion rates. Most creators earn $0.03-$0.10 per click on monetized items. Top performers can earn $500+ per month."
                  },
                  {
                    q: "When do I get paid?",
                    a: "Payouts are processed monthly for earnings over $50. You can choose PayPal, bank transfer, or other methods. Payments are sent within 7 business days of month end."
                  },
                  {
                    q: "How long does verification take?",
                    a: "We review verification requests within 24-48 hours. Once verified, it may take an additional 1-3 days to activate affiliate links and change status to 'monetized'."
                  },
                  {
                    q: "Can I submit items from other brands?",
                    a: "Currently, only items from our partner brands (Diesel, Hat Club, Finish Line) are eligible. We're adding more partners soon!"
                  },
                  {
                    q: "What happens to my original product links?",
                    a: "Your original links are saved in the 'original_product_url' field and replaced with affiliate links in the 'product_url' field. You can see both in your item details."
                  },
                ].map((faq, i) => (
                  <div key={i} className="bg-white/5 border-2 border-white/10 p-6">
                    <h3 className="text-lg font-bold mb-2">{faq.q}</h3>
                    <p className="text-white/70">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}