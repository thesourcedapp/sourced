"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type TimeRange = "7d" | "30d" | "90d" | "all";

type AnalyticsData = {
  overview: {
    totalFollowers: number;
    totalCatalogs: number;
    totalItems: number;
    totalLikes: number;
    totalBookmarks: number;
    totalClicks: number;
    uniqueClicks: number;
    clickThroughRate: number;
    avgEngagementRate: number;
    totalReach: number;
    followerGrowth: number;
  };
  topCatalogs: Array<{
    id: string;
    name: string;
    slug: string;
    image: string;
    items: number;
    likes: number;
    bookmarks: number;
    clicks: number;
    uniqueClicks: number;
    engagementScore: number;
  }>;
  topItems: Array<{
    id: string;
    title: string;
    image: string;
    catalogName: string;
    likes: number;
    clicks: number;
    uniqueClicks: number;
    clickThroughRate: number;
  }>;
  recentActivity: Array<{
    type: "like" | "bookmark" | "click" | "follow";
    timestamp: string;
    itemName?: string;
    catalogName?: string;
    userName?: string;
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
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"clicks" | "likes" | "engagement">("clicks");

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
      // Get follower count
      const { count: followerCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUserId);

      // Get catalogs with stats
      const { data: catalogs } = await supabase
        .from("catalogs")
        .select("id, name, slug, image_url")
        .eq("owner_id", currentUserId);

      const catalogStats = await Promise.all(
        (catalogs || []).map(async (catalog) => {
          const { data: items } = await supabase
            .from("catalog_items")
            .select("id, image_url, like_count, click_count, unique_click_count")
            .eq("catalog_id", catalog.id);

          const { count: bookmarks } = await supabase
            .from("bookmarked_catalogs")
            .select("*", { count: "exact", head: true })
            .eq("catalog_id", catalog.id);

          const totalLikes = items?.reduce((sum, i) => sum + (i.like_count || 0), 0) || 0;
          const totalClicks = items?.reduce((sum, i) => sum + (i.click_count || 0), 0) || 0;
          const totalUniqueClicks = items?.reduce((sum, i) => sum + (i.unique_click_count || 0), 0) || 0;
          const engagementScore = totalLikes + (bookmarks || 0) * 2 + totalClicks * 1.5;

          return {
            id: catalog.id,
            name: catalog.name,
            slug: catalog.slug,
            image: items?.[0]?.image_url || catalog.image_url || "",
            items: items?.length || 0,
            likes: totalLikes,
            bookmarks: bookmarks || 0,
            clicks: totalClicks,
            uniqueClicks: totalUniqueClicks,
            engagementScore,
          };
        })
      );

      // Get all items
      const { data: allItems } = await supabase
        .from("catalog_items")
        .select(`
          id,
          title,
          image_url,
          like_count,
          click_count,
          unique_click_count,
          catalogs!inner(owner_id, name)
        `)
        .eq("catalogs.owner_id", currentUserId)
        .order("click_count", { ascending: false })
        .limit(10);

      const topItems = allItems?.map((item: any) => ({
        id: item.id,
        title: item.title,
        image: item.image_url,
        catalogName: item.catalogs.name,
        likes: item.like_count || 0,
        clicks: item.click_count || 0,
        uniqueClicks: item.unique_click_count || 0,
        clickThroughRate: item.click_count > 0 ? ((item.unique_click_count || 0) / item.click_count) * 100 : 0,
      })) || [];

      // Calculate totals
      const totalLikes = catalogStats.reduce((sum, c) => sum + c.likes, 0);
      const totalBookmarks = catalogStats.reduce((sum, c) => sum + c.bookmarks, 0);
      const totalClicks = catalogStats.reduce((sum, c) => sum + c.clicks, 0);
      const totalUniqueClicks = catalogStats.reduce((sum, c) => sum + c.uniqueClicks, 0);
      const totalItems = catalogStats.reduce((sum, c) => sum + c.items, 0);

      setAnalytics({
        overview: {
          totalFollowers: followerCount || 0,
          totalCatalogs: catalogs?.length || 0,
          totalItems,
          totalLikes,
          totalBookmarks,
          totalClicks,
          uniqueClicks: totalUniqueClicks,
          clickThroughRate: totalClicks > 0 ? (totalUniqueClicks / totalClicks) * 100 : 0,
          avgEngagementRate: totalItems > 0 ? (totalLikes / totalItems) * 100 : 0,
          totalReach: totalUniqueClicks + totalBookmarks,
          followerGrowth: 0, // TODO: Calculate from historical data
        },
        topCatalogs: catalogStats.sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 6),
        topItems,
        recentActivity: [], // TODO: Implement activity feed
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
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
      console.error("Error:", error);
      alert("Failed to submit. Please try again.");
    } else {
      setHasApplied(true);
      alert("Application submitted!");
    }
    setApplying(false);
  }

  const fmt = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" style={{ animationDuration: "0.8s" }} />
        </div>
      </div>
    );
  }

  // VERIFICATION REQUEST SCREEN
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full mb-8">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium tracking-wider">CREATOR VERIFICATION</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-none">
              Unlock Your
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Creator Dashboard
              </span>
            </h1>

            <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Get verified to access real-time analytics, performance insights, and powerful tools to grow your influence.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: "📊",
                title: "Live Analytics",
                desc: "Track clicks, engagement, and performance in real-time",
                gradient: "from-blue-500/20 to-cyan-500/20",
              },
              {
                icon: "🎯",
                title: "Deep Insights",
                desc: "Understand what resonates with your audience",
                gradient: "from-purple-500/20 to-pink-500/20",
              },
              {
                icon: "✨",
                title: "Verified Badge",
                desc: "Stand out with official creator verification",
                gradient: "from-orange-500/20 to-red-500/20",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className={`relative p-6 bg-gradient-to-br ${feature.gradient} backdrop-blur-sm border border-white/10 rounded-2xl hover:border-white/20 transition-all hover:scale-105`}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-white/60">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            {hasApplied ? (
              <div className="inline-flex flex-col items-center gap-4 p-8 bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-xl font-bold">Application Under Review</span>
                </div>
                <p className="text-white/60">We'll notify you once your profile has been reviewed</p>
              </div>
            ) : (
              <button
                onClick={handleApplyForVerification}
                disabled={applying}
                className="group relative px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">
                  {applying ? "Submitting..." : "Apply for Verification →"}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
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
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
      </div>
    );
  }

  // MAIN ANALYTICS DASHBOARD
  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-lg">
                {currentUsername[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">@{currentUsername}</h1>
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                      <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-white/50">Creator Analytics</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Time range selector */}
              <div className="flex bg-white/5 rounded-lg p-1">
                {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      timeRange === range
                        ? "bg-white text-black"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {range === "all" ? "All Time" : range.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={() => router.push(`/${currentUsername}`)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all"
              >
                View Profile →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Followers",
              value: fmt(analytics.overview.totalFollowers),
              change: analytics.overview.followerGrowth,
              icon: "👥",
              gradient: "from-blue-500 to-cyan-500",
            },
            {
              label: "Total Clicks",
              value: fmt(analytics.overview.totalClicks),
              subValue: `${fmt(analytics.overview.uniqueClicks)} unique`,
              icon: "👆",
              gradient: "from-purple-500 to-pink-500",
            },
            {
              label: "Total Engagement",
              value: fmt(analytics.overview.totalLikes + analytics.overview.totalBookmarks),
              subValue: `${analytics.overview.avgEngagementRate.toFixed(1)}% rate`,
              icon: "❤️",
              gradient: "from-orange-500 to-red-500",
            },
            {
              label: "Total Reach",
              value: fmt(analytics.overview.totalReach),
              subValue: `${analytics.overview.totalCatalogs} catalogs`,
              icon: "📈",
              gradient: "from-green-500 to-emerald-500",
            },
          ].map((metric, i) => (
            <div
              key={i}
              className="relative p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-white/20 transition-all group overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/50 font-medium">{metric.label}</span>
                  <span className="text-2xl">{metric.icon}</span>
                </div>
                <div className="text-3xl font-black mb-1">{metric.value}</div>
                {metric.subValue && (
                  <div className="text-xs text-white/40">{metric.subValue}</div>
                )}
                {metric.change !== undefined && metric.change > 0 && (
                  <div className="text-xs text-green-400 flex items-center gap-1 mt-2">
                    <span>↗</span>
                    <span>+{metric.change}% this period</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Performance Overview */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Performance Metrics</h2>
              <div className="flex gap-2">
                {["clicks", "likes", "engagement"].map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric as any)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedMetric === metric
                        ? "bg-white text-black"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Simple bar visualization */}
            <div className="space-y-4">
              {analytics.topCatalogs.slice(0, 5).map((catalog, i) => {
                const maxValue = Math.max(...analytics.topCatalogs.map(c =>
                  selectedMetric === "clicks" ? c.clicks : selectedMetric === "likes" ? c.likes : c.engagementScore
                ));
                const value = selectedMetric === "clicks" ? catalog.clicks : selectedMetric === "likes" ? catalog.likes : catalog.engagementScore;
                const percentage = (value / maxValue) * 100;

                return (
                  <div key={catalog.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{catalog.name}</span>
                      <span className="text-sm text-white/50">{fmt(value)}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="text-sm text-white/50 mb-2">Click-Through Rate</div>
              <div className="text-4xl font-black mb-1">{analytics.overview.clickThroughRate.toFixed(1)}%</div>
              <div className="text-xs text-white/40">Unique clicks / Total clicks</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="text-sm text-white/50 mb-2">Avg Engagement</div>
              <div className="text-4xl font-black mb-1">{analytics.overview.avgEngagementRate.toFixed(1)}%</div>
              <div className="text-xs text-white/40">Likes per item ratio</div>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="text-sm text-white/50 mb-2">Total Items</div>
              <div className="text-4xl font-black mb-1">{fmt(analytics.overview.totalItems)}</div>
              <div className="text-xs text-white/40">Across {analytics.overview.totalCatalogs} catalogs</div>
            </div>
          </div>
        </div>

        {/* Top Performing Catalogs */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6">Top Performing Catalogs</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {analytics.topCatalogs.slice(0, 6).map((catalog, i) => (
              <div
                key={catalog.id}
                onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)}
                className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all cursor-pointer"
              >
                {i < 3 && (
                  <div className="absolute top-3 left-3 z-10 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-black font-bold text-sm">
                    {i + 1}
                  </div>
                )}
                <div className="aspect-square bg-white/5 overflow-hidden">
                  {catalog.image && (
                    <img
                      src={catalog.image}
                      alt={catalog.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold mb-3 truncate">{catalog.name}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white/5 rounded-lg p-2">
                      <div className="text-white/50 text-xs mb-1">Clicks</div>
                      <div className="font-bold">{fmt(catalog.clicks)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <div className="text-white/50 text-xs mb-1">Engagement</div>
                      <div className="font-bold">{fmt(catalog.likes + catalog.bookmarks)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Items */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6">Top Performing Items</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {analytics.topItems.slice(0, 10).map((item, i) => (
              <div
                key={item.id}
                className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all"
              >
                {i < 3 && (
                  <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {i + 1}
                  </div>
                )}
                <div className="aspect-square bg-white/5 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="p-3">
                  <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Clicks</span>
                    <span className="font-bold">{fmt(item.clicks)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile padding */}
      <div className="h-20 md:hidden" />
    </div>
  );
}