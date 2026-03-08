"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Tab = "overview" | "catalogs" | "items" | "monetization";

// Partner brands eligible for verification
const PARTNER_BRANDS = [
  "nike", "adidas", "supreme", "the north face", "patagonia",
  "stone island", "arc'teryx", "carhartt", "levi's", "uniqlo",
  "zara", "h&m", "ralph lauren", "tommy hilfiger", "calvin klein"
];

type CatalogData = {
  id: string;
  name: string;
  slug: string;
  image: string;
  totalItems: number;
  totalLikes: number;
  totalBookmarks: number;
  totalClicks: number;
  uniqueClicks: number;
  engagementScore: number;
};

type ItemData = {
  id: string;
  title: string;
  image: string;
  catalogName: string;
  catalogSlug: string;
  seller: string | null;
  brand: string | null;
  likes: number;
  clicks: number;
  uniqueClicks: number;
  isVerified: boolean;
  isMonetized: boolean;
  canVerify: boolean;
  verificationStatus: string | null;
  productUrl: string | null;
  affiliateLink: string | null;
};

type VerificationRequest = {
  id: string;
  itemId: string;
  itemType: "catalog" | "feed";
  brandName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  item: {
    title: string;
    image: string;
    seller: string;
  };
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [stats, setStats] = useState({
    totalFollowers: 0,
    totalCatalogs: 0,
    totalItems: 0,
    totalLikes: 0,
    totalBookmarks: 0,
    totalClicks: 0,
    uniqueClicks: 0,
    clickThroughRate: 0,
    avgEngagement: 0,
    totalReach: 0,
    verifiedItems: 0,
    monetizedItems: 0,
  });

  const [catalogs, setCatalogs] = useState<CatalogData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [sortBy, setSortBy] = useState<"clicks" | "likes" | "engagement">("clicks");

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

      // Get catalogs
      const { data: catalogsData } = await supabase
        .from("catalogs")
        .select("id, name, slug, image_url")
        .eq("owner_id", currentUserId);

      // Get catalog stats
      const catalogStats = await Promise.all(
        (catalogsData || []).map(async (catalog) => {
          const { data: catalogItems } = await supabase
            .from("catalog_items")
            .select("id, image_url, like_count, click_count, unique_click_count")
            .eq("catalog_id", catalog.id);

          const { count: bookmarks } = await supabase
            .from("bookmarked_catalogs")
            .select("*", { count: "exact", head: true })
            .eq("catalog_id", catalog.id);

          const totalLikes = catalogItems?.reduce((sum, i) => sum + (i.like_count || 0), 0) || 0;
          const totalClicks = catalogItems?.reduce((sum, i) => sum + (i.click_count || 0), 0) || 0;
          const totalUniqueClicks = catalogItems?.reduce((sum, i) => sum + (i.unique_click_count || 0), 0) || 0;

          return {
            id: catalog.id,
            name: catalog.name,
            slug: catalog.slug,
            image: catalogItems?.[0]?.image_url || catalog.image_url || "",
            totalItems: catalogItems?.length || 0,
            totalLikes,
            totalBookmarks: bookmarks || 0,
            totalClicks,
            uniqueClicks: totalUniqueClicks,
            engagementScore: totalLikes + (bookmarks || 0) * 2 + totalClicks * 1.5,
          };
        })
      );

      setCatalogs(catalogStats);

      // Get all items with verification status
      const { data: allItems } = await supabase
        .from("catalog_items")
        .select(`
          id,
          title,
          image_url,
          seller,
          brand,
          like_count,
          click_count,
          unique_click_count,
          is_verified,
          is_monetized,
          product_url,
          affiliate_link,
          catalogs!inner(owner_id, name, slug)
        `)
        .eq("catalogs.owner_id", currentUserId);

      // Get verification requests for these items
      const itemIds = allItems?.map(i => i.id) || [];
      const { data: requests } = await supabase
        .from("item_verification_requests")
        .select("*")
        .in("item_id", itemIds)
        .eq("item_type", "catalog");

      const itemsWithStatus = allItems?.map((item: any) => {
        const brandName = item.seller || item.brand || "";
        const canVerify = PARTNER_BRANDS.some(b => brandName.toLowerCase().includes(b));
        const request = requests?.find(r => r.item_id === item.id);

        return {
          id: item.id,
          title: item.title,
          image: item.image_url,
          catalogName: item.catalogs.name,
          catalogSlug: item.catalogs.slug,
          seller: item.seller,
          brand: item.brand,
          likes: item.like_count || 0,
          clicks: item.click_count || 0,
          uniqueClicks: item.unique_click_count || 0,
          isVerified: item.is_verified || false,
          isMonetized: item.is_monetized || false,
          canVerify,
          verificationStatus: request?.status || null,
          productUrl: item.product_url,
          affiliateLink: item.affiliate_link,
        };
      }) || [];

      setItems(itemsWithStatus);

      // Load verification requests
      const { data: allRequests } = await supabase
        .from("item_verification_requests")
        .select(`
          id,
          item_id,
          item_type,
          brand_name,
          status,
          created_at,
          catalog_items!inner(title, image_url, seller)
        `)
        .eq("user_id", currentUserId)
        .eq("item_type", "catalog")
        .order("created_at", { ascending: false });

      setVerificationRequests(allRequests?.map((r: any) => ({
        id: r.id,
        itemId: r.item_id,
        itemType: r.item_type,
        brandName: r.brand_name,
        status: r.status,
        createdAt: r.created_at,
        item: {
          title: r.catalog_items.title,
          image: r.catalog_items.image_url,
          seller: r.catalog_items.seller,
        },
      })) || []);

      // Calculate totals
      const totalLikes = catalogStats.reduce((sum, c) => sum + c.totalLikes, 0);
      const totalBookmarks = catalogStats.reduce((sum, c) => sum + c.totalBookmarks, 0);
      const totalClicks = catalogStats.reduce((sum, c) => sum + c.totalClicks, 0);
      const totalUniqueClicks = catalogStats.reduce((sum, c) => sum + c.uniqueClicks, 0);
      const totalItems = catalogStats.reduce((sum, c) => sum + c.totalItems, 0);
      const verifiedItems = itemsWithStatus.filter(i => i.isVerified).length;
      const monetizedItems = itemsWithStatus.filter(i => i.isMonetized).length;

      setStats({
        totalFollowers: followerCount || 0,
        totalCatalogs: catalogsData?.length || 0,
        totalItems,
        totalLikes,
        totalBookmarks,
        totalClicks,
        uniqueClicks: totalUniqueClicks,
        clickThroughRate: totalClicks > 0 ? (totalUniqueClicks / totalClicks) * 100 : 0,
        avgEngagement: totalItems > 0 ? (totalLikes / totalItems) * 100 : 0,
        totalReach: totalUniqueClicks + totalBookmarks,
        verifiedItems,
        monetizedItems,
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
          alert("Verification already requested for this item");
        } else {
          throw error;
        }
      } else {
        alert("Verification request submitted!");
        loadAnalytics();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to submit request");
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
    return n.toString();
  };

  const getSortedItems = () => {
    return [...items].sort((a, b) => {
      if (sortBy === "clicks") return b.clicks - a.clicks;
      if (sortBy === "likes") return b.likes - a.likes;
      return (b.likes + b.clicks) - (a.likes + a.clicks);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // VERIFICATION REQUEST SCREEN
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
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
                Analytics Dashboard
              </span>
            </h1>

            <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Get verified to access comprehensive analytics, item monetization, and powerful growth tools.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                title: "Live Analytics",
                desc: "Track clicks, engagement, and performance in real-time across all catalogs",
                gradient: "from-blue-500/20 to-cyan-500/20",
              },
              {
                title: "Item Verification",
                desc: "Submit partner brand items for verification and monetization",
                gradient: "from-purple-500/20 to-pink-500/20",
              },
              {
                title: "Performance Insights",
                desc: "Understand what drives engagement and optimize your content",
                gradient: "from-orange-500/20 to-red-500/20",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className={`relative p-6 bg-gradient-to-br ${feature.gradient} backdrop-blur-sm border border-white/10 rounded-2xl hover:border-white/20 transition-all`}
              >
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-white/60">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            {hasApplied ? (
              <div className="inline-flex flex-col items-center gap-4 p-8 bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-xl font-bold">Application Under Review</span>
                </div>
                <p className="text-white/60">We'll notify you once verified</p>
              </div>
            ) : (
              <button
                onClick={handleApplyForVerification}
                disabled={applying}
                className="px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105 disabled:opacity-50"
              >
                {applying ? "Submitting..." : "Apply for Verification"}
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

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black">Creator Analytics</h1>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: "overview", label: "Overview" },
              { id: "catalogs", label: "Catalogs" },
              { id: "items", label: "Items" },
              { id: "monetization", label: "Monetization" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-6 py-4 font-semibold transition-all relative ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Followers", value: fmt(stats.totalFollowers), gradient: "from-blue-500 to-cyan-500" },
                { label: "Total Clicks", value: fmt(stats.totalClicks), subValue: `${fmt(stats.uniqueClicks)} unique`, gradient: "from-purple-500 to-pink-500" },
                { label: "Engagement", value: fmt(stats.totalLikes + stats.totalBookmarks), subValue: `${stats.avgEngagement.toFixed(1)}% avg`, gradient: "from-orange-500 to-red-500" },
                { label: "Total Reach", value: fmt(stats.totalReach), subValue: `${stats.totalCatalogs} catalogs`, gradient: "from-green-500 to-emerald-500" },
              ].map((metric, i) => (
                <div key={i} className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-white/20 transition-all group relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  <div className="relative z-10">
                    <div className="text-sm text-white/50 font-medium mb-3">{metric.label}</div>
                    <div className="text-3xl font-black mb-1">{metric.value}</div>
                    {metric.subValue && <div className="text-xs text-white/40">{metric.subValue}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="text-sm text-white/50 mb-2">Click-Through Rate</div>
                <div className="text-4xl font-black mb-1">{stats.clickThroughRate.toFixed(1)}%</div>
                <div className="text-xs text-white/40">Unique / Total clicks</div>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="text-sm text-white/50 mb-2">Verified Items</div>
                <div className="text-4xl font-black mb-1">{stats.verifiedItems}</div>
                <div className="text-xs text-white/40">{stats.monetizedItems} monetized</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="text-sm text-white/50 mb-2">Total Items</div>
                <div className="text-4xl font-black mb-1">{fmt(stats.totalItems)}</div>
                <div className="text-xs text-white/40">Across all catalogs</div>
              </div>
            </div>
          </div>
        )}

        {/* CATALOGS TAB */}
        {activeTab === "catalogs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your Catalogs</h2>
              <div className="text-sm text-white/50">{catalogs.length} total</div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {catalogs.map((catalog, i) => (
                <div
                  key={catalog.id}
                  onClick={() => router.push(`/catalogs/${catalog.slug}`)}
                  className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-all cursor-pointer"
                >
                  {i < 3 && (
                    <div className="absolute top-3 left-3 z-10 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-black font-bold text-sm">
                      {i + 1}
                    </div>
                  )}
                  <div className="aspect-square bg-white/5 overflow-hidden">
                    {catalog.image && (
                      <img src={catalog.image} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold mb-3">{catalog.name}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-white/50 text-xs mb-1">Clicks</div>
                        <div className="font-bold">{fmt(catalog.totalClicks)}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-white/50 text-xs mb-1">Engagement</div>
                        <div className="font-bold">{fmt(catalog.totalLikes + catalog.totalBookmarks)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ITEMS TAB */}
        {activeTab === "items" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">All Items</h2>
              <div className="flex gap-2">
                {["clicks", "likes", "engagement"].map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setSortBy(sort as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === sort ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-4">
              {getSortedItems().map((item, i) => (
                <div key={item.id} className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all">
                  {i < 3 && (
                    <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {i + 1}
                    </div>
                  )}
                  {item.isVerified && (
                    <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                    </div>
                  )}
                  <div className="aspect-square bg-white/5 overflow-hidden">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-white/50">Clicks</span>
                      <span className="font-bold">{fmt(item.clicks)}</span>
                    </div>
                    {item.canVerify && !item.isVerified && !item.verificationStatus && (
                      <button
                        onClick={() => requestItemVerification(item.id, item.seller || item.brand || "")}
                        className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs font-medium transition-all"
                      >
                        Request Verification
                      </button>
                    )}
                    {item.verificationStatus === "pending" && (
                      <div className="w-full py-1.5 bg-yellow-500/20 rounded-lg text-xs font-medium text-center text-yellow-400">
                        Pending Review
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MONETIZATION TAB */}
        {activeTab === "monetization" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Monetization</h2>
              <p className="text-white/60">Submit partner brand items for verification and earn through affiliate links</p>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6">
                <div className="text-sm text-green-400 mb-2">Verified Items</div>
                <div className="text-4xl font-black">{stats.verifiedItems}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                <div className="text-sm text-blue-400 mb-2">Monetized Items</div>
                <div className="text-4xl font-black">{stats.monetizedItems}</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
                <div className="text-sm text-yellow-400 mb-2">Pending Requests</div>
                <div className="text-4xl font-black">{verificationRequests.filter(r => r.status === "pending").length}</div>
              </div>
            </div>

            {/* Requests */}
            <div>
              <h3 className="text-xl font-bold mb-4">Verification Requests</h3>
              {verificationRequests.length === 0 ? (
                <div className="text-center py-12 text-white/40">No verification requests yet</div>
              ) : (
                <div className="space-y-3">
                  {verificationRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                      <div className="w-16 h-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={request.item.image} alt={request.item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{request.item.title}</h4>
                        <p className="text-sm text-white/50">{request.brandName}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                        request.status === "approved" ? "bg-green-500/20 text-green-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {request.status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}