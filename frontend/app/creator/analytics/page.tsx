"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  cover_image?: string;
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

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (currentUserId && isVerified) loadAnalytics(); }, [currentUserId, isVerified]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("is_verified, username, is_onboarded").eq("id", user.id).single();
    if (!profile?.is_onboarded) { router.push("/"); return; }
    setCurrentUserId(user.id);
    setCurrentUsername(profile.username);
    setIsVerified(profile?.is_verified || false);
    if (!profile?.is_verified) {
      const { data: application } = await supabase.from("verification_requests").select("status").eq("user_id", user.id).single();
      if (application) setHasApplied(true);
    }
    setLoading(false);
  }

  async function loadAnalytics() {
    setLoading(true);
    try { await Promise.all([loadOverviewStats(), loadCatalogAnalytics(), loadTopItems()]); }
    catch (error) { console.error("Error loading analytics:", error); }
    finally { setLoading(false); }
  }

  async function loadOverviewStats() {
    if (!currentUserId) return;
    const { count: catalogCount } = await supabase.from("catalogs").select("*", { count: "exact", head: true }).eq("owner_id", currentUserId);
    const { data: catalogItems } = await supabase.from("catalog_items").select("id, like_count, click_count, unique_click_count, catalogs!inner(owner_id)").eq("catalogs.owner_id", currentUserId);
    const { count: bookmarkCount } = await supabase.from("bookmarked_catalogs").select("*, catalogs!inner(owner_id)", { count: "exact", head: true }).eq("catalogs.owner_id", currentUserId);
    const totalLikes = catalogItems?.reduce((sum, item) => sum + (item.like_count || 0), 0) || 0;
    const totalClicks = catalogItems?.reduce((sum, item) => sum + (item.click_count || 0), 0) || 0;
    const totalUniqueClicks = catalogItems?.reduce((sum, item) => sum + (item.unique_click_count || 0), 0) || 0;
    const itemCount = catalogItems?.length || 0;
    setOverviewStats({ total_catalogs: catalogCount || 0, total_items: itemCount, total_likes: totalLikes, total_bookmarks: bookmarkCount || 0, total_clicks: totalClicks, total_unique_clicks: totalUniqueClicks, avg_likes_per_item: itemCount > 0 ? totalLikes / itemCount : 0, avg_clicks_per_item: itemCount > 0 ? totalClicks / itemCount : 0, click_through_rate: totalClicks > 0 ? (totalUniqueClicks / totalClicks) * 100 : 0 });
  }

  async function loadCatalogAnalytics() {
    if (!currentUserId) return;
    const { data: catalogs } = await supabase.from("catalogs").select("id, name, slug").eq("owner_id", currentUserId);
    if (!catalogs) return;
    const catalogAnalyticsData = await Promise.all(catalogs.map(async (catalog) => {
      const { data: items } = await supabase.from("catalog_items").select("id, title, image_url, product_url, seller, brand, like_count, click_count, unique_click_count").eq("catalog_id", catalog.id);
      const { count: bookmarkCount } = await supabase.from("bookmarked_catalogs").select("*", { count: "exact", head: true }).eq("catalog_id", catalog.id);
      const totalLikes = items?.reduce((sum, item) => sum + (item.like_count || 0), 0) || 0;
      const totalClicks = items?.reduce((sum, item) => sum + (item.click_count || 0), 0) || 0;
      const totalUniqueClicks = items?.reduce((sum, item) => sum + (item.unique_click_count || 0), 0) || 0;
      const topItems: ItemAnalytics[] = items?.map(item => ({ ...item, catalog_name: catalog.name, catalog_slug: catalog.slug })) || [];
      const coverImage = items?.[0]?.image_url;
      return { id: catalog.id, name: catalog.name, slug: catalog.slug, total_items: items?.length || 0, total_likes: totalLikes, total_bookmarks: bookmarkCount || 0, total_clicks: totalClicks, total_unique_clicks: totalUniqueClicks, top_items: topItems, cover_image: coverImage };
    }));
    setCatalogAnalytics(catalogAnalyticsData);
  }

  async function loadTopItems() {
    if (!currentUserId) return;
    const { data: items } = await supabase.from("catalog_items").select(`id, title, image_url, product_url, seller, brand, like_count, click_count, unique_click_count, catalogs!inner(owner_id, name, slug)`).eq("catalogs.owner_id", currentUserId).order("click_count", { ascending: false }).limit(50);
    const formattedItems: ItemAnalytics[] = items?.map((item: any) => ({ id: item.id, title: item.title, image_url: item.image_url, product_url: item.product_url, seller: item.seller, brand: item.brand, like_count: item.like_count || 0, click_count: item.click_count || 0, unique_click_count: item.unique_click_count || 0, catalog_name: item.catalogs.name, catalog_slug: item.catalogs.slug })) || [];
    setTopItems(formattedItems);
  }

  async function handleApplyForVerification() {
    setApplying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("verification_requests").insert({ user_id: user.id, status: "pending" });
    if (error) { console.error("Error applying for verification:", error); alert("Failed to submit application. Please try again."); }
    else { setHasApplied(true); alert("Application submitted! We will review your request soon."); }
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

  function fmt(n: number) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
          .loader { width: 32px; height: 32px; border: 2px solid #e5e5e5; border-top-color: #000; border-radius: 50%; animation: spin 0.8s linear infinite; }
        `}</style>
        <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
          <div className="loader" />
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "#999", letterSpacing: "0.05em" }}>Loading your analytics</p>
        </div>
      </>
    );
  }

  // ── VERIFICATION PAGE ──────────────────────────────────────────────────────
  if (!isVerified) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Syne:wght@700;800&display=swap');
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
          .card-float { animation: float 4s ease-in-out infinite; }
          .card-float-2 { animation: float 4s ease-in-out infinite 1.3s; }
          .card-float-3 { animation: float 4s ease-in-out infinite 2.6s; }
          .fade-1 { animation: fadeUp 0.6s ease forwards; opacity: 0; }
          .fade-2 { animation: fadeUp 0.6s ease 0.15s forwards; opacity: 0; }
          .fade-3 { animation: fadeUp 0.6s ease 0.3s forwards; opacity: 0; }
          .fade-4 { animation: fadeUp 0.6s ease 0.45s forwards; opacity: 0; }
          .fade-5 { animation: fadeUp 0.6s ease 0.6s forwards; opacity: 0; }
          .shimmer-text {
            background: linear-gradient(90deg, #000 0%, #555 40%, #000 60%, #000 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmer 3s linear infinite;
          }
          .apply-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
          .apply-btn { transition: all 0.2s ease; }
          .benefit-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.08); }
          .benefit-card { transition: all 0.25s ease; }

          @media (max-width: 768px) {
            .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
            .hero-heading { font-size: 36px !important; line-height: 1.15 !important; }
            .benefit-card { padding: 20px !important; }
            .sidebar { display: none !important; }
            .main-content { padding: 24px 20px !important; }
            .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
            .stat-card { padding: 18px !important; }
            .catalog-row { flex-direction: column !important; align-items: flex-start !important; }
            .catalog-stats { flex-direction: column !important; gap: 12px !important; width: 100% !important; }
            .item-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          }
        `}</style>

        <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f8f8f6 0%, #fff 50%, #f5f5f8 100%)", fontFamily: "DM Sans, sans-serif" }}>
          {/* Top nav bar */}
          <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em" }}>catalog</span>
            <button onClick={() => router.push(`/${currentUsername}`)} style={{ fontSize: "13px", color: "#666", background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              ← Back
            </button>
          </div>

          <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "60px 24px 100px" }}>
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}>

              {/* Left — copy */}
              <div>
                <div className="fade-1" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#000", color: "#fff", padding: "8px 16px", borderRadius: "100px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", marginBottom: "32px" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="5" fill="#4ade80"/></svg>
                  CREATOR PROGRAM
                </div>

                <h1 className="fade-2 hero-heading" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "clamp(36px, 5vw, 58px)", lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 24px", color: "#0a0a0a" }}>
                  Unlock your<br />
                  <span className="shimmer-text">creator tools.</span>
                </h1>

                <p className="fade-3" style={{ fontSize: "16px", color: "#666", lineHeight: 1.75, margin: "0 0 40px", fontWeight: 400, maxWidth: "480px" }}>
                  Get verified to access deep analytics, engagement insights, and a badge that sets your catalogs apart. Built for serious creators.
                </p>

                <div className="fade-4">
                  {hasApplied ? (
                    <div style={{ display: "inline-flex", flexDirection: "column", background: "#f5f5f5", borderRadius: "16px", padding: "24px 28px", gap: "8px", maxWidth: "400px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                        <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "15px", color: "#0a0a0a" }}>Application under review</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "14px", color: "#888", paddingLeft: "20px", lineHeight: 1.6 }}>We'll reach out once we've reviewed your profile.</p>
                    </div>
                  ) : (
                    <button
                      className="apply-btn"
                      onClick={handleApplyForVerification}
                      disabled={applying}
                      style={{ background: "#0a0a0a", color: "#fff", border: "none", borderRadius: "14px", padding: "18px 36px", fontSize: "15px", fontWeight: 600, fontFamily: "DM Sans, sans-serif", cursor: applying ? "not-allowed" : "pointer", opacity: applying ? 0.6 : 1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}
                    >
                      {applying ? "Submitting…" : "Apply for verification →"}
                    </button>
                  )}
                </div>

                <p className="fade-5" style={{ fontSize: "13px", color: "#aaa", marginTop: "20px" }}>
                  Free to apply · Reviewed within 48 hours
                </p>
              </div>

              {/* Right — visual benefit cards */}
              <div className="fade-3" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

                <div className="benefit-card card-float" style={{ background: "#fff", borderRadius: "20px", padding: "24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: "18px", alignItems: "flex-start" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 8px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", color: "#0a0a0a", lineHeight: 1.3 }}>Real-time analytics</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "#888", lineHeight: 1.65 }}>Track every click, like, and bookmark across all your catalogs and items.</p>
                  </div>
                </div>

                <div className="benefit-card card-float-2" style={{ background: "#fff", borderRadius: "20px", padding: "24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: "18px", alignItems: "flex-start" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg, #f093fb, #f5576c)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 8px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", color: "#0a0a0a", lineHeight: 1.3 }}>Verified badge</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "#888", lineHeight: 1.65 }}>Stand out on the platform with a badge that signals trust and authenticity.</p>
                  </div>
                </div>

                <div className="benefit-card card-float-3" style={{ background: "#fff", borderRadius: "20px", padding: "24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: "18px", alignItems: "flex-start" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg, #4facfe, #00f2fe)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 8px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", color: "#0a0a0a", lineHeight: 1.3 }}>Performance insights</p>
                    <p style={{ margin: 0, fontSize: "14px", color: "#888", lineHeight: 1.65 }}>See which items resonate most and optimize your catalogs for engagement.</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── ANALYTICS DASHBOARD ────────────────────────────────────────────────────
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Syne:wght@700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.5s ease forwards; }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-card { transition: transform 0.2s ease; }
        .item-card:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.1); transform: translateY(-3px); }
        .item-card { transition: all 0.25s ease; }
        .catalog-row:hover { background: #f9f9f9; }
        .catalog-row { transition: background 0.15s ease; }
        .tab-btn { transition: all 0.2s ease; }
        .sort-pill:hover { background: #000; color: #fff; }
        .sort-pill { transition: all 0.15s ease; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }

        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .main-content { padding: 24px 20px 120px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 14px !important; }
          .stat-card { padding: 20px !important; }
          .stat-card p:first-child { font-size: 10px !important; margin-bottom: 10px !important; }
          .stat-card p:nth-child(2) { font-size: 28px !important; }
          .stat-card p:last-child { font-size: 11px !important; }
          .catalog-row { flex-direction: column !important; align-items: flex-start !important; padding: 18px !important; }
          .catalog-stats { flex-direction: row !important; gap: 16px !important; width: 100% !important; margin-top: 16px !important; flex-wrap: wrap !important; }
          .catalog-stat { text-align: left !important; }
          .catalog-stat p:first-child { font-size: 20px !important; }
          .item-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 14px !important; }
          .item-card { border-radius: 16px !important; }
          .item-card > div:last-child { padding: 14px !important; }
          .item-card p:first-child { font-size: 14px !important; }
          .item-card p:nth-child(2) { font-size: 12px !important; }
          .mobile-nav { display: flex !important; }
          .desktop-only { display: none !important; }
          .engagement-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }

        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "DM Sans, sans-serif", color: "#0a0a0a" }}>

        {/* ── SIDEBAR + MAIN LAYOUT ── */}
        <div style={{ display: "flex", minHeight: "100vh" }}>

          {/* Sidebar */}
          <aside className="sidebar" style={{ width: "220px", background: "#fff", borderRight: "1px solid rgba(0,0,0,0.08)", padding: "28px 20px", flexShrink: 0, position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ marginBottom: "32px", paddingLeft: "12px" }}>
              <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "17px", letterSpacing: "-0.02em" }}>catalog</span>
            </div>

            <p style={{ fontSize: "10px", fontWeight: 600, color: "#aaa", letterSpacing: "0.1em", paddingLeft: "12px", marginBottom: "8px" }}>ANALYTICS</p>

            {(["overview", "catalogs", "items"] as const).map(tab => (
              <button
                key={tab}
                className="tab-btn"
                onClick={() => setActiveTab(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "none", cursor: "pointer", textAlign: "left", fontSize: "13px", fontWeight: activeTab === tab ? 600 : 400, fontFamily: "DM Sans, sans-serif",
                  background: activeTab === tab ? "#0a0a0a" : "transparent",
                  color: activeTab === tab ? "#fff" : "#555",
                }}
              >
                {tab === "overview" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                {tab === "catalogs" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                {tab === "items" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                {tab === "overview" ? "Overview" : tab === "catalogs" ? "Catalogs" : "Top Items"}
              </button>
            ))}

            <div style={{ marginTop: "auto", padding: "12px", borderRadius: "12px", background: "#f5f5f5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px", fontWeight: 700 }}>
                  {currentUsername[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 600 }}>@{currentUsername}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "1px" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#4ade80"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span style={{ fontSize: "10px", color: "#666" }}>Verified</span>
                  </div>
                </div>
              </div>
              <button onClick={() => router.push(`/${currentUsername}`)} style={{ width: "100%", padding: "7px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", color: "#333", fontWeight: 500 }}>
                View profile →
              </button>
            </div>
          </aside>

          {/* Mobile bottom nav */}
          <div className="mobile-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid rgba(0,0,0,0.08)", padding: "14px 16px", zIndex: 100, display: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", gap: "8px" }}>
              {(["overview", "catalogs", "items"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: "10px 16px", borderRadius: "12px", backgroundColor: activeTab === tab ? "#f5f5f5" : "transparent", flex: 1 }}
                >
                  {tab === "overview" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeTab === tab ? "#0a0a0a" : "#999"} strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                  {tab === "catalogs" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeTab === tab ? "#0a0a0a" : "#999"} strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                  {tab === "items" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeTab === tab ? "#0a0a0a" : "#999"} strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                  <span style={{ fontSize: "11px", fontWeight: activeTab === tab ? 600 : 500, color: activeTab === tab ? "#0a0a0a" : "#999", fontFamily: "DM Sans, sans-serif", letterSpacing: "-0.01em" }}>
                    {tab === "overview" ? "Overview" : tab === "catalogs" ? "Catalogs" : "Items"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <main className="main-content" style={{ flex: 1, padding: "36px 40px", overflow: "auto", paddingBottom: "100px" }}>

            {/* Page header */}
            <div style={{ marginBottom: "36px" }}>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "28px", letterSpacing: "-0.03em", margin: "0 0 4px" }}>
                {activeTab === "overview" ? "Overview" : activeTab === "catalogs" ? "Catalogs" : "Top Items"}
              </h1>
              <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>
                {activeTab === "overview" ? "Your performance at a glance" : activeTab === "catalogs" ? "Performance by catalog" : "Your best performing items"}
              </p>
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                {/* Primary stats row */}
                <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                  {[
                    { label: "Total Clicks", value: fmt(overviewStats.total_clicks), sub: "All time", highlight: true },
                    { label: "Unique Clicks", value: fmt(overviewStats.total_unique_clicks), sub: "Distinct visitors", highlight: true },
                    { label: "Total Likes", value: fmt(overviewStats.total_likes), sub: "Across all items", highlight: false },
                    { label: "Bookmarks", value: fmt(overviewStats.total_bookmarks), sub: "Catalog saves", highlight: false },
                  ].map(s => (
                    <div key={s.label} className="stat-card" style={{ background: s.highlight ? "#0a0a0a" : "#fff", color: s.highlight ? "#fff" : "#0a0a0a", borderRadius: "18px", padding: "28px", border: s.highlight ? "none" : "1px solid rgba(0,0,0,0.08)", boxShadow: s.highlight ? "0 8px 32px rgba(0,0,0,0.12)" : "none" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", opacity: s.highlight ? 0.6 : 0.5, color: "inherit" }}>{s.label.toUpperCase()}</p>
                      <p style={{ margin: "0 0 6px", fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "42px", letterSpacing: "-0.03em", color: "inherit", lineHeight: 1 }}>{s.value}</p>
                      <p style={{ margin: 0, fontSize: "12px", opacity: 0.5, color: "inherit" }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Secondary stats row */}
                <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                  {[
                    { label: "Catalogs", value: overviewStats.total_catalogs },
                    { label: "Total Items", value: overviewStats.total_items },
                    { label: "Avg Likes / Item", value: overviewStats.avg_likes_per_item.toFixed(1) },
                    { label: "Avg Clicks / Item", value: overviewStats.avg_clicks_per_item.toFixed(1) },
                  ].map(s => (
                    <div key={s.label} className="stat-card" style={{ background: "#fff", borderRadius: "18px", padding: "24px", border: "1px solid rgba(0,0,0,0.08)" }}>
                      <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "#aaa" }}>{s.label.toUpperCase()}</p>
                      <p style={{ margin: 0, fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "32px", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Engagement metrics */}
                <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "18px", margin: "0 0 28px", letterSpacing: "-0.02em" }}>Engagement</h2>
                  <div className="engagement-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "36px" }}>
                    {[
                      { label: "Click-through rate", value: overviewStats.click_through_rate.toFixed(1) + "%", note: "Unique / total clicks", color: "#667eea" },
                      { label: "Engagement rate", value: overviewStats.total_items > 0 ? ((overviewStats.total_likes / overviewStats.total_items) * 100).toFixed(1) + "%" : "0%", note: "Likes per item ratio", color: "#f5576c" },
                      { label: "Total reach", value: fmt(overviewStats.total_unique_clicks + overviewStats.total_bookmarks), note: "Unique clicks + saves", color: "#4facfe" },
                    ].map(m => (
                      <div key={m.label}>
                        <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: m.color, marginBottom: "16px" }} />
                        <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#aaa", fontWeight: 500 }}>{m.label}</p>
                        <p style={{ margin: "0 0 6px", fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "36px", letterSpacing: "-0.02em", lineHeight: 1 }}>{m.value}</p>
                        <p style={{ margin: 0, fontSize: "12px", color: "#bbb" }}>{m.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ── CATALOGS ── */}
            {activeTab === "catalogs" && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {catalogAnalytics.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0", color: "#bbb", fontSize: "14px" }}>No catalogs found</div>
                ) : catalogAnalytics.map(catalog => (
                  <div key={catalog.id} className="catalog-row" style={{ background: "#fff", borderRadius: "20px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "20px 24px" }}>

                      {/* Cover image strip */}
                      <div className="desktop-only" style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                        {catalog.top_items.slice(0, 3).map((item, i) => (
                          <div key={i} style={{ width: "52px", height: "52px", borderRadius: "10px", overflow: "hidden", background: "#f5f5f5", flexShrink: 0 }}>
                            {item.image_url && <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                          </div>
                        ))}
                        {catalog.top_items.length === 0 && (
                          <div style={{ width: "52px", height: "52px", borderRadius: "10px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          </div>
                        )}
                      </div>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "17px", letterSpacing: "-0.01em" }}>{catalog.name}</p>
                        <p style={{ margin: 0, fontSize: "13px", color: "#aaa" }}>{catalog.total_items} items</p>
                      </div>

                      {/* Stats inline */}
                      <div className="catalog-stats desktop-only" style={{ display: "flex", gap: "28px", alignItems: "center" }}>
                        {[
                          { l: "Likes", v: fmt(catalog.total_likes) },
                          { l: "Bookmarks", v: fmt(catalog.total_bookmarks) },
                          { l: "Clicks", v: fmt(catalog.total_clicks) },
                          { l: "Unique", v: fmt(catalog.total_unique_clicks) },
                        ].map(s => (
                          <div key={s.l} className="catalog-stat" style={{ textAlign: "right" }}>
                            <p style={{ margin: "0 0 3px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "20px", lineHeight: 1 }}>{s.v}</p>
                            <p style={{ margin: 0, fontSize: "11px", color: "#aaa", fontWeight: 500, letterSpacing: "0.04em" }}>{s.l.toUpperCase()}</p>
                          </div>
                        ))}
                      </div>

                      <button onClick={() => router.push(`/${currentUsername}/${catalog.slug}`)} style={{ background: "#0a0a0a", color: "#fff", border: "none", borderRadius: "10px", padding: "11px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", flexShrink: 0, whiteSpace: "nowrap" }}>
                        View →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TOP ITEMS ── */}
            {activeTab === "items" && (
              <div className="fade-in">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#aaa", marginRight: "4px" }}>Sort by</span>
                  {(["clicks", "unique_clicks", "likes"] as const).map(opt => (
                    <button
                      key={opt}
                      className="sort-pill"
                      onClick={() => setSortBy(opt)}
                      style={{ padding: "6px 16px", borderRadius: "100px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "12px", fontWeight: 500, fontFamily: "DM Sans, sans-serif", cursor: "pointer", background: sortBy === opt ? "#0a0a0a" : "#fff", color: sortBy === opt ? "#fff" : "#333" }}
                    >
                      {opt === "clicks" ? "Clicks" : opt === "unique_clicks" ? "Unique clicks" : "Likes"}
                    </button>
                  ))}
                </div>

                {topItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0", color: "#bbb", fontSize: "14px" }}>No items found</div>
                ) : (
                  <div className="item-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "18px" }}>
                    {getSortedItems(topItems).map((item, idx) => (
                      <div key={item.id} className="item-card" style={{ background: "#fff", borderRadius: "18px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
                        <div style={{ position: "relative", aspectRatio: "1", background: "#f5f5f5" }}>
                          {item.image_url && <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                          <div style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", color: "#fff", borderRadius: "8px", padding: "3px 9px", fontSize: "11px", fontWeight: 700, fontFamily: "Syne, sans-serif" }}>
                            #{idx + 1}
                          </div>
                        </div>
                        <div style={{ padding: "16px" }}>
                          <p style={{ margin: "0 0 5px", fontWeight: 600, fontSize: "14px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</p>
                          <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#aaa" }}>{item.catalog_name}{item.seller && ` · ${item.seller}`}</p>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                            {[
                              { l: "Likes", v: fmt(item.like_count) },
                              { l: "Clicks", v: fmt(item.click_count) },
                              { l: "Unique", v: fmt(item.unique_click_count) },
                            ].map(s => (
                              <div key={s.l} style={{ background: "#f7f7f7", borderRadius: "10px", padding: "10px 0", textAlign: "center" }}>
                                <p style={{ margin: "0 0 2px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", lineHeight: 1 }}>{s.v}</p>
                                <p style={{ margin: 0, fontSize: "9px", color: "#aaa", fontWeight: 600, letterSpacing: "0.05em" }}>{s.l.toUpperCase()}</p>
                              </div>
                            ))}
                          </div>

                          {item.product_url && (
                            <a href={item.product_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "10px", background: "#0a0a0a", color: "#fff", borderRadius: "10px", fontSize: "12px", fontWeight: 600, textDecoration: "none", letterSpacing: "0.01em" }}>
                              Shop product ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}