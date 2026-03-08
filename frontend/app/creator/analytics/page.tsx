"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Tab = "overview" | "catalogs" | "items" | "monetization";

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
};

type ItemData = {
  id: string;
  title: string;
  image: string;
  catalogName: string;
  seller: string | null;
  likes: number;
  clicks: number;
  uniqueClicks: number;
  isVerified: boolean;
  canVerify: boolean;
  verificationStatus: string | null;
};

type VerificationRequest = {
  id: string;
  itemId: string;
  brandName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  item: {
    title: string;
    image: string;
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
  });

  const [catalogs, setCatalogs] = useState<CatalogData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [partnerBrands, setPartnerBrands] = useState<string[]>([]);
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
      .select("is_verified, is_onboarded")
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
      // Fetch partner brands
      const { data: brandsData } = await supabase
        .from("partner_brands")
        .select("brand_slug")
        .eq("is_active", true);

      const activeBrands = brandsData?.map(b => b.brand_slug.toLowerCase()) || [];
      setPartnerBrands(activeBrands);

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
          };
        })
      );

      setCatalogs(catalogStats);

      // Get all items
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
          catalogs!inner(owner_id, name)
        `)
        .eq("catalogs.owner_id", currentUserId);

      // Get verification requests
      const itemIds = allItems?.map(i => i.id) || [];
      const { data: requests } = await supabase
        .from("item_verification_requests")
        .select("*")
        .in("item_id", itemIds)
        .eq("item_type", "catalog");

      const itemsWithStatus = allItems?.map((item: any) => {
        const seller = item.seller || "";
        const canVerify = activeBrands.some(b => seller.toLowerCase().includes(b));
        const request = requests?.find(r => r.item_id === item.id);

        return {
          id: item.id,
          title: item.title,
          image: item.image_url,
          catalogName: item.catalogs.name,
          seller: item.seller,
          likes: item.like_count || 0,
          clicks: item.click_count || 0,
          uniqueClicks: item.unique_click_count || 0,
          isVerified: item.is_verified || false,
          canVerify,
          verificationStatus: request?.status || null,
        };
      }) || [];

      setItems(itemsWithStatus);

      // Load verification requests
      const { data: allRequests } = await supabase
        .from("item_verification_requests")
        .select(`
          id,
          item_id,
          brand_name,
          status,
          created_at,
          catalog_items!inner(title, image_url)
        `)
        .eq("user_id", currentUserId)
        .eq("item_type", "catalog")
        .order("created_at", { ascending: false });

      setVerificationRequests(allRequests?.map((r: any) => ({
        id: r.id,
        itemId: r.item_id,
        brandName: r.brand_name,
        status: r.status,
        createdAt: r.created_at,
        item: {
          title: r.catalog_items.title,
          image: r.catalog_items.image_url,
        },
      })) || []);

      // Calculate totals
      const totalLikes = catalogStats.reduce((sum, c) => sum + c.totalLikes, 0);
      const totalBookmarks = catalogStats.reduce((sum, c) => sum + c.totalBookmarks, 0);
      const totalClicks = catalogStats.reduce((sum, c) => sum + c.totalClicks, 0);
      const totalUniqueClicks = catalogStats.reduce((sum, c) => sum + c.uniqueClicks, 0);
      const totalItems = catalogStats.reduce((sum, c) => sum + c.totalItems, 0);
      const verifiedItems = itemsWithStatus.filter(i => i.isVerified).length;

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
        alert("Verification request submitted! We'll review it soon.");
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
              Get verified to access analytics, item monetization, and growth insights
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { title: "Live Analytics", desc: "Real-time performance tracking across all catalogs" },
              { title: "Item Verification", desc: "Submit partner brand items for monetization" },
              { title: "Growth Insights", desc: "Understand your audience and optimize content" },
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

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0a1a] to-[#0a0a1a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Analytics</h1>
              <p className="text-sm text-white/40 mt-0.5">Track your performance</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-semibold transition-all border border-white/10 hover:border-white/20"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Tabs - Fixed for mobile scrolling */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-[89px] z-40 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "overview", label: "Overview" },
              { id: "catalogs", label: "Catalogs" },
              { id: "items", label: "Items" },
              { id: "monetization", label: "Monetization" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-6 py-4 font-bold transition-all relative whitespace-nowrap ${
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Followers", value: fmt(stats.totalFollowers), gradient: "from-blue-500/20 to-cyan-500/20", border: "border-blue-500/30" },
                { label: "Total Clicks", value: fmt(stats.totalClicks), subValue: `${fmt(stats.uniqueClicks)} unique`, gradient: "from-purple-500/20 to-pink-500/20", border: "border-purple-500/30" },
                { label: "Engagement", value: fmt(stats.totalLikes + stats.totalBookmarks), subValue: `${stats.avgEngagement.toFixed(1)}% avg`, gradient: "from-pink-500/20 to-red-500/20", border: "border-pink-500/30" },
                { label: "Total Reach", value: fmt(stats.totalReach), subValue: `${stats.totalCatalogs} catalogs`, gradient: "from-green-500/20 to-emerald-500/20", border: "border-green-500/30" },
              ].map((metric, i) => (
                <div key={i} className={`p-6 bg-gradient-to-br ${metric.gradient} backdrop-blur-md border ${metric.border} rounded-2xl hover:scale-105 transition-all group relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="text-xs text-white/60 font-bold mb-3 tracking-wider uppercase">{metric.label}</div>
                    <div className="text-3xl font-black mb-1">{metric.value}</div>
                    {metric.subValue && <div className="text-xs text-white/50 font-medium">{metric.subValue}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-md border border-blue-500/20 rounded-2xl p-6 hover:border-purple-500/40 transition-all">
                <div className="text-sm text-blue-300 font-bold mb-2 tracking-wide">Click-Through Rate</div>
                <div className="text-5xl font-black mb-1 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">{stats.clickThroughRate.toFixed(1)}%</div>
                <div className="text-xs text-white/40">Unique / Total clicks</div>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-md border border-green-500/20 rounded-2xl p-6 hover:border-emerald-500/40 transition-all">
                <div className="text-sm text-green-300 font-bold mb-2 tracking-wide">Verified Items</div>
                <div className="text-5xl font-black mb-1 bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">{stats.verifiedItems}</div>
                <div className="text-xs text-white/40">Partner brand items</div>
              </div>

              <div className="bg-gradient-to-br from-pink-500/10 to-red-500/10 backdrop-blur-md border border-pink-500/20 rounded-2xl p-6 hover:border-red-500/40 transition-all">
                <div className="text-sm text-pink-300 font-bold mb-2 tracking-wide">Total Items</div>
                <div className="text-5xl font-black mb-1 bg-gradient-to-r from-pink-300 to-red-300 bg-clip-text text-transparent">{fmt(stats.totalItems)}</div>
                <div className="text-xs text-white/40">Across all catalogs</div>
              </div>
            </div>
          </div>
        )}

        {/* CATALOGS TAB */}
        {activeTab === "catalogs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Your Catalogs</h2>
              <div className="text-sm text-white/50 font-medium">{catalogs.length} total</div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {catalogs.map((catalog, i) => (
                <div
                  key={catalog.id}
                  onClick={() => router.push(`/${catalog.slug}`)}
                  className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/40 hover:scale-105 transition-all cursor-pointer relative"
                >
                  {i < 3 && (
                    <div className="absolute top-4 left-4 z-10 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-black font-black text-sm shadow-xl">
                      {i + 1}
                    </div>
                  )}
                  <div className="aspect-square bg-white/5 overflow-hidden">
                    {catalog.image && (
                      <img src={catalog.image} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-3">{catalog.name}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="text-white/50 text-xs mb-1 font-medium">Clicks</div>
                        <div className="font-black text-lg">{fmt(catalog.totalClicks)}</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="text-white/50 text-xs mb-1 font-medium">Engagement</div>
                        <div className="font-black text-lg">{fmt(catalog.totalLikes + catalog.totalBookmarks)}</div>
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
              <h2 className="text-2xl font-black">All Items</h2>
              <div className="flex gap-2">
                {["clicks", "likes", "engagement"].map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setSortBy(sort as any)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      sortBy === sort
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                    }`}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-4">
              {getSortedItems().map((item, i) => (
                <div key={item.id} className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/40 hover:scale-105 transition-all relative">
                  {i < 3 && (
                    <div className="absolute top-2 left-2 z-10 w-7 h-7 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg">
                      {i + 1}
                    </div>
                  )}
                  {item.isVerified && (
                    <div className="absolute top-2 right-2 z-10 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4" fill="white" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                    </div>
                  )}
                  <div className="aspect-square bg-white/5 overflow-hidden">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-bold mb-2 truncate">{item.title}</div>
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-white/50">Clicks</span>
                      <span className="font-black">{fmt(item.clicks)}</span>
                    </div>
                    {item.canVerify && !item.isVerified && !item.verificationStatus && (
                      <button
                        onClick={() => requestItemVerification(item.id, item.seller || "")}
                        className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-xs font-bold transition-all shadow-lg"
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

        {/* MONETIZATION TAB */}
        {activeTab === "monetization" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-black mb-2">Monetization</h2>
              <p className="text-white/60">Partner brands: Diesel, Hat Club, Finish Line</p>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-6">
                <div className="text-sm text-green-300 font-bold mb-2">Verified Items</div>
                <div className="text-5xl font-black bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">{stats.verifiedItems}</div>
              </div>
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6">
                <div className="text-sm text-amber-300 font-bold mb-2">Pending</div>
                <div className="text-5xl font-black bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">{verificationRequests.filter(r => r.status === "pending").length}</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-2xl p-6">
                <div className="text-sm text-red-300 font-bold mb-2">Rejected</div>
                <div className="text-5xl font-black bg-gradient-to-r from-red-300 to-pink-300 bg-clip-text text-transparent">{verificationRequests.filter(r => r.status === "rejected").length}</div>
              </div>
            </div>

            {/* Requests */}
            <div>
              <h3 className="text-xl font-black mb-4">Your Requests</h3>
              {verificationRequests.length === 0 ? (
                <div className="text-center py-16 text-white/40 bg-white/5 rounded-2xl border border-white/10">
                  No verification requests yet
                </div>
              ) : (
                <div className="space-y-3">
                  {verificationRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-4 p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl hover:border-white/20 transition-all">
                      <div className="w-16 h-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={request.item.image} alt={request.item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold truncate">{request.item.title}</h4>
                        <p className="text-sm text-white/50">{request.brandName}</p>
                      </div>
                      <div className={`px-4 py-2 rounded-full text-xs font-bold ${
                        request.status === "pending" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                        request.status === "approved" ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                        "bg-red-500/20 text-red-300 border border-red-500/30"
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