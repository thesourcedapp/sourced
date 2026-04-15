"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { generateSlug } from '@/lib/utils/slug';

type UserCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  visibility: string;
  created_at: string;
  updated_at?: string;
  item_count: number;
  bookmark_count: number;
  slug: string;
  profiles: { username: string };
};

type SortOption = 'recent' | 'oldest' | 'name' | 'items' | 'bookmarks';
type ViewMode = 'grid' | 'list';

// ── Tutorial steps ────────────────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    step: 1,
    icon: '✦',
    title: 'NAME YOUR CATALOG',
    body: 'Give it a theme that means something. "Rick Season", "Quiet Luxury Summer", "Off-White Archive". The name sets the vibe.',
    hint: null,
  },
  {
    step: 2,
    icon: '◈',
    title: 'ADD A COVER IMAGE',
    body: 'Upload from your camera roll or paste an image link. Use images you own or have rights to — your own photos, product shots, mood imagery.',
    hint: '⚖ Do not use brand editorial photos or copyrighted imagery you don\'t own.',
  },
  {
    step: 3,
    icon: '◆',
    title: 'ADD ITEMS',
    body: 'Open your catalog and start building. Paste a product link and image, set a title and price. Each item can link out to where people can buy it.',
    hint: null,
  },
  {
    step: 4,
    icon: '●',
    title: 'GO PUBLIC & EARN',
    body: 'Set it public so the community discovers it. Link to affiliate partner brands and earn a commission every time someone shops through your catalog.',
    hint: null,
  },
];

async function uploadImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `catalog-${userId}-${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('catalog-covers')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) return { url: null, error: error.message };
    const { data: { publicUrl } } = supabase.storage.from('catalog-covers').getPublicUrl(fileName);
    return { url: publicUrl };
  } catch (error: any) {
    return { url: null, error: error.message };
  }
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="border border-black/8 animate-pulse">
      <div className="aspect-square bg-black/5" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-black/8 w-3/4" />
        <div className="h-2.5 bg-black/5 w-1/2" />
      </div>
      <div className="border-t border-black/8 p-2">
        <div className="h-7 bg-black/5" />
      </div>
    </div>
  );
}

export default function CatalogsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCatalogs, setUserCatalogs] = useState<UserCatalog[]>([]);
  const [filteredCatalogs, setFilteredCatalogs] = useState<UserCatalog[]>([]);

  // loading: true until BOTH auth + initial catalog fetch complete
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // View
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [selectedCatalogs, setSelectedCatalogs] = useState<Set<string>>(new Set());

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');
  const [catalogVisibility, setCatalogVisibility] = useState<'public' | 'private'>('public');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [catalogImageUrl, setCatalogImageUrl] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [imageError, setImageError] = useState('');
  const [checkingImage, setCheckingImage] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  // ── Init: load user + catalogs together ────────────────────────────────────
  useEffect(() => {
    initPage();
  }, []);

  async function initPage() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Fetch catalogs and check tutorial flag in parallel
      const [catalogsResult, profileResult] = await Promise.all([
        supabase
          .from('catalogs')
          .select(`id, name, description, image_url, visibility, created_at, updated_at, bookmark_count, slug, profiles!catalogs_owner_id_fkey(username), catalog_items(count)`)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('has_seen_catalog_tutorial')
          .eq('id', user.id)
          .single(),
      ]);

      if (catalogsResult.data) {
        const formatted = catalogsResult.data.map((cat: any) => ({
          ...cat,
          item_count: cat.catalog_items?.[0]?.count || 0,
          bookmark_count: cat.bookmark_count || 0,
          profiles: Array.isArray(cat.profiles) ? cat.profiles[0] : cat.profiles,
        }));
        setUserCatalogs(formatted);

        // Show tutorial if first time AND no catalogs yet
        const hasSeenTutorial = profileResult.data?.has_seen_catalog_tutorial;
        if (!hasSeenTutorial && formatted.length === 0) {
          setIsNewUser(true);
          setShowTutorial(true);
        }
      }
    } catch (err) {
      console.error('initPage error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogs() {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('catalogs')
        .select(`id, name, description, image_url, visibility, created_at, updated_at, bookmark_count, slug, profiles!catalogs_owner_id_fkey(username), catalog_items(count)`)
        .eq('owner_id', currentUserId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setUserCatalogs(data.map((cat: any) => ({
          ...cat,
          item_count: cat.catalog_items?.[0]?.count || 0,
          bookmark_count: cat.bookmark_count || 0,
          profiles: Array.isArray(cat.profiles) ? cat.profiles[0] : cat.profiles,
        })));
      }
    } catch (err) {
      console.error('loadCatalogs error:', err);
    }
  }

  // Filter + sort
  useEffect(() => {
    let filtered = [...userCatalogs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
      );
    }
    if (filterVisibility !== 'all') {
      filtered = filtered.filter(c => c.visibility === filterVisibility);
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':   return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':   return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':     return a.name.localeCompare(b.name);
        case 'items':    return b.item_count - a.item_count;
        case 'bookmarks':return b.bookmark_count - a.bookmark_count;
        default:         return 0;
      }
    });
    setFilteredCatalogs(filtered);
  }, [userCatalogs, searchQuery, filterVisibility, sortBy]);

  // ── Tutorial helpers ────────────────────────────────────────────────────────
  async function dismissTutorial() {
    setShowTutorial(false);
    // Mark as seen so it never shows again
    if (currentUserId) {
      await supabase
        .from('profiles')
        .update({ has_seen_catalog_tutorial: true })
        .eq('id', currentUserId);
    }
  }

  function nextTutorialStep() {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(s => s + 1);
    } else {
      dismissTutorial();
      setShowCreateModal(true);
    }
  }

  // ── Catalog actions ─────────────────────────────────────────────────────────
  async function toggleVisibility(catalogId: string, current: string) {
    const next = current === 'public' ? 'private' : 'public';
    try {
      await supabase.from('catalogs').update({ visibility: next }).eq('id', catalogId).eq('owner_id', currentUserId);
      setUserCatalogs(prev => prev.map(c => c.id === catalogId ? { ...c, visibility: next } : c));
    } catch (err) { console.error(err); }
  }

  function toggleSelectCatalog(id: string) {
    setSelectedCatalogs(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function selectAll() {
    setSelectedCatalogs(
      selectedCatalogs.size === filteredCatalogs.length
        ? new Set()
        : new Set(filteredCatalogs.map(c => c.id))
    );
  }

  function handleDeleteSelected() {
    if (!selectedCatalogs.size) return;
    setDeleteCount(selectedCatalogs.size);
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    try {
      await supabase.from('catalogs').delete().in('id', Array.from(selectedCatalogs)).eq('owner_id', currentUserId);
      setUserCatalogs(prev => prev.filter(c => !selectedCatalogs.has(c.id)));
      setSelectedCatalogs(new Set());
      setEditMode(false);
      setShowDeleteModal(false);
    } catch (err) { console.error(err); alert('Failed to delete catalogs'); }
  }

  // ── Image helpers ───────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError('Please select an image file'); return; }
    setSelectedFile(file);
    setImageError('');
    setCatalogImageUrl('');
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleImageUrlChange(url: string) {
    setCatalogImageUrl(url);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageError('');
    if (!url.trim()) return;
    try { new URL(url); } catch { setImageError('Invalid URL format'); return; }
    setCheckingImage(true);
    setTimeout(() => { setCheckingImage(false); setPreviewUrl(url); }, 500);
  }

  // ── Create catalog ──────────────────────────────────────────────────────────
  async function handleCreateCatalog(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !catalogName.trim()) return;
    setCreating(true);
    setImageError('');

    try {
      let finalImageUrl = '';

      if (uploadMethod === 'file' && selectedFile) {
        const result = await uploadImageToStorage(selectedFile, currentUserId);
        if (!result.url) { setImageError(result.error || 'Failed to upload image'); setCreating(false); return; }
        finalImageUrl = result.url;
      } else if (uploadMethod === 'url' && catalogImageUrl.trim()) {
        setCheckingImage(true);
        try {
          const res = await fetch(catalogImageUrl);
          if (!res.ok) throw new Error('Failed to fetch image');
          const blob = await res.blob();
          const file = new File([blob], `catalog-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
          const result = await uploadImageToStorage(file, currentUserId);
          if (!result.url) { setImageError(result.error || 'Failed to save image'); setCreating(false); setCheckingImage(false); return; }
          finalImageUrl = result.url;
        } catch (err: any) {
          setImageError('Failed to save image from URL. Make sure the URL is accessible.');
          setCreating(false); setCheckingImage(false); return;
        } finally {
          setCheckingImage(false);
        }
      }

      const slug = generateSlug(catalogName);
      const { data, error } = await supabase
        .from('catalogs')
        .insert({ name: catalogName.trim(), slug, description: catalogDescription.trim() || null, image_url: finalImageUrl || null, visibility: catalogVisibility, owner_id: currentUserId })
        .select('*, profiles!catalogs_owner_id_fkey(username)')
        .single();

      if (error) throw error;

      // Mark tutorial as seen on first catalog creation
      if (isNewUser) {
        await supabase.from('profiles').update({ has_seen_catalog_tutorial: true }).eq('id', currentUserId);
        setIsNewUser(false);
      }

      resetCreateForm();
      setShowCreateModal(false);
      await loadCatalogs();

      const owner = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      router.push(`/${owner.username}/${slug}`);
    } catch (err) {
      console.error(err); alert('Failed to create catalog');
    } finally {
      setCreating(false);
    }
  }

  function resetCreateForm() {
    setCatalogName(''); setCatalogDescription(''); setSelectedFile(null);
    setCatalogImageUrl(''); setPreviewUrl(null); setCatalogVisibility('public');
    setUploadMethod('file'); setImageError('');
  }

  const totalItems = userCatalogs.reduce((s, c) => s + c.item_count, 0);
  const publicCount = userCatalogs.filter(c => c.visibility === 'public').length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo+Black&display=swap');
        input, textarea, select { font-size: 16px !important; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: fadeUp 0.3s ease both; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tutorial-in { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-6">

        {/* ── Sticky Header ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 bg-white/96 backdrop-blur-sm border-b border-black/8">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-5">

            {/* Desktop */}
            <div className="hidden md:flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  YOUR CATALOGS
                </h1>
                {!loading && (
                  <div className="flex items-center gap-3 text-[10px] opacity-30 mt-1 tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    <span>{userCatalogs.length} CATALOG{userCatalogs.length !== 1 ? 'S' : ''}</span>
                    <span>·</span>
                    <span>{totalItems} ITEMS</span>
                    <span>·</span>
                    <span>{publicCount} PUBLIC</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <>
                    {userCatalogs.length > 0 && (
                      <button onClick={() => setEditMode(true)} className="px-5 py-2 border border-black/15 hover:border-black hover:bg-black/5 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        EDIT
                      </button>
                    )}
                    <button onClick={() => setShowCreateModal(true)} className="px-5 py-2 bg-black text-white hover:bg-black/85 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      + CREATE CATALOG
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={selectAll} className="px-4 py-2 border border-black/15 hover:border-black hover:bg-black/5 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {selectedCatalogs.size === filteredCatalogs.length ? 'DESELECT ALL' : 'SELECT ALL'}
                    </button>
                    {selectedCatalogs.size > 0 && (
                      <button onClick={handleDeleteSelected} className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        DELETE ({selectedCatalogs.size})
                      </button>
                    )}
                    <button onClick={() => { setEditMode(false); setSelectedCatalogs(new Set()); }} className="px-4 py-2 border border-black/15 hover:border-black hover:bg-black/5 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      DONE
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>YOUR CATALOGS</h1>
                  {!loading && (
                    <p className="text-[9px] opacity-30 tracking-wider font-black mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {userCatalogs.length} CATALOG{userCatalogs.length !== 1 ? 'S' : ''} · {totalItems} ITEMS
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!editMode ? (
                    <>
                      {userCatalogs.length > 0 && (
                        <button onClick={() => setEditMode(true)} className="px-4 py-2 border border-black/15 text-xs tracking-wider font-black hover:bg-black/5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>EDIT</button>
                      )}
                      <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-black text-white text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CREATE</button>
                    </>
                  ) : (
                    <button onClick={() => { setEditMode(false); setSelectedCatalogs(new Set()); }} className="px-4 py-2 border border-black/15 text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DONE</button>
                  )}
                </div>
              </div>

              {editMode && selectedCatalogs.size > 0 && (
                <div className="flex gap-2 mb-3">
                  <button onClick={selectAll} className="flex-1 py-2 border border-black/15 text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {selectedCatalogs.size === filteredCatalogs.length ? 'DESELECT' : 'SELECT ALL'}
                  </button>
                  <button onClick={handleDeleteSelected} className="flex-1 py-2 bg-red-500 text-white text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    DELETE ({selectedCatalogs.size})
                  </button>
                </div>
              )}
            </div>

            {/* Filters — only when there are catalogs */}
            {!loading && userCatalogs.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search catalogs..."
                  className="flex-1 min-w-0 px-3 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-sm"
                />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="px-3 py-2 border border-black/10 text-xs tracking-wider font-black bg-white focus:outline-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  <option value="recent">RECENT</option>
                  <option value="oldest">OLDEST</option>
                  <option value="name">NAME</option>
                  <option value="items">MOST ITEMS</option>
                  <option value="bookmarks">MOST SAVED</option>
                </select>
                <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value as any)} className="px-3 py-2 border border-black/10 text-xs tracking-wider font-black bg-white focus:outline-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  <option value="all">ALL</option>
                  <option value="public">PUBLIC</option>
                  <option value="private">PRIVATE</option>
                </select>
                <div className="flex border border-black/10">
                  <button onClick={() => setViewMode('grid')} className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-black text-white' : 'hover:bg-black/5'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </button>
                  <button onClick={() => setViewMode('list')} className={`px-3 py-2 border-l border-black/10 ${viewMode === 'list' ? 'bg-black text-white' : 'hover:bg-black/5'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">

          {/* Loading skeletons */}
          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state — only shown after loading is complete */}
          {!loading && userCatalogs.length === 0 && !showTutorial && (
            <div className="text-center py-20 md:py-32 anim-in">
              <div className="text-7xl opacity-4 mb-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>✦</div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-3" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                NO CATALOGS YET
              </h2>
              <p className="text-sm opacity-40 mb-8 max-w-xs mx-auto">
                Create your first catalog to start curating pieces and earning commissions.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
                  className="px-8 py-3 border-2 border-black hover:bg-black hover:text-white transition-all text-xs tracking-wider font-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  HOW IT WORKS
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-8 py-3 bg-black text-white hover:bg-black/85 transition-all text-xs tracking-wider font-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  CREATE CATALOG
                </button>
              </div>
            </div>
          )}

          {/* No results from filter */}
          {!loading && userCatalogs.length > 0 && filteredCatalogs.length === 0 && (
            <div className="text-center py-20 anim-in">
              <h2 className="text-xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>NO RESULTS</h2>
              <p className="text-sm opacity-40">Try adjusting your search or filters</p>
            </div>
          )}

          {/* Grid View */}
          {!loading && filteredCatalogs.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 anim-in">
              {filteredCatalogs.map(catalog => (
                <div
                  key={catalog.id}
                  className={`group relative border transition-all duration-150 ${
                    editMode && selectedCatalogs.has(catalog.id)
                      ? 'border-black bg-black/4'
                      : 'border-black/8 hover:border-black/30'
                  }`}
                >
                  {editMode && (
                    <div className="absolute top-2 left-2 z-20">
                      <button
                        onClick={() => toggleSelectCatalog(catalog.id)}
                        className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${
                          selectedCatalogs.has(catalog.id) ? 'bg-black border-black' : 'bg-white border-black/30 hover:border-black'
                        }`}
                      >
                        {selectedCatalogs.has(catalog.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  <div
                    className={!editMode ? 'cursor-pointer' : ''}
                    onClick={() => !editMode && router.push(`/${catalog.profiles.username}/${catalog.slug}`)}
                  >
                    <div className="aspect-square bg-black/4 overflow-hidden">
                      {catalog.image_url ? (
                        <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl md:text-5xl opacity-8">✦</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <h3 className="text-xs font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{catalog.name}</h3>
                      <div className="flex items-center justify-between text-[9px] opacity-40">
                        <span>{catalog.item_count} items</span>
                        <span>🔖 {catalog.bookmark_count}</span>
                      </div>
                    </div>
                  </div>
                  {!editMode && (
                    <div className="border-t border-black/8 p-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleVisibility(catalog.id, catalog.visibility); }}
                        className={`w-full py-1.5 text-[9px] tracking-wider font-black transition-all ${
                          catalog.visibility === 'public'
                            ? 'bg-black text-white hover:bg-black/85'
                            : 'border border-black/15 hover:bg-black/5'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {catalog.visibility === 'public' ? '● PUBLIC' : '○ PRIVATE'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {!loading && filteredCatalogs.length > 0 && viewMode === 'list' && (
            <div className="space-y-2 anim-in">
              {filteredCatalogs.map(catalog => (
                <div
                  key={catalog.id}
                  className={`flex items-center gap-3 p-3 md:p-4 border transition-all duration-150 ${
                    editMode && selectedCatalogs.has(catalog.id) ? 'border-black bg-black/4' : 'border-black/8 hover:border-black/30'
                  } ${!editMode ? 'cursor-pointer' : ''}`}
                  onClick={() => !editMode && router.push(`/${catalog.profiles.username}/${catalog.slug}`)}
                >
                  {editMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelectCatalog(catalog.id); }}
                      className={`w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 ${selectedCatalogs.has(catalog.id) ? 'bg-black border-black' : 'bg-white border-black/30'}`}
                    >
                      {selectedCatalogs.has(catalog.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                  )}
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-black/4 flex-shrink-0 overflow-hidden">
                    {catalog.image_url ? <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-xl opacity-10">✦</span></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{catalog.name}</h3>
                    {catalog.description && <p className="text-xs opacity-50 truncate">{catalog.description}</p>}
                    <div className="flex items-center gap-3 text-[9px] opacity-35 mt-0.5"><span>{catalog.item_count} items</span><span>🔖 {catalog.bookmark_count}</span></div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!editMode) toggleVisibility(catalog.id, catalog.visibility); }}
                    disabled={editMode}
                    className={`flex-shrink-0 px-3 py-1.5 text-[9px] tracking-wider font-black transition-all ${catalog.visibility === 'public' ? 'bg-black text-white' : 'border border-black/15'} ${!editMode && 'hover:opacity-75'}`}
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {catalog.visibility === 'public' ? 'PUBLIC' : 'PRIVATE'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TUTORIAL MODAL ──────────────────────────────────────────────────── */}
      {showTutorial && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="tutorial-in w-full md:max-w-sm bg-white" style={{ borderRadius: '16px 16px 0 0' }}>
            {/* Progress bar */}
            <div className="flex gap-1 p-4 pb-0">
              {TUTORIAL_STEPS.map((_, i) => (
                <div key={i} className={`flex-1 h-0.5 transition-all duration-300 ${i <= tutorialStep ? 'bg-black' : 'bg-black/10'}`} />
              ))}
            </div>

            <div className="p-6 md:p-8">
              {/* Step indicator */}
              <p className="text-[9px] tracking-[0.4em] opacity-30 mb-4 font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                STEP {TUTORIAL_STEPS[tutorialStep].step} OF {TUTORIAL_STEPS.length}
              </p>

              {/* Icon */}
              <div className="text-4xl mb-4 opacity-80" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TUTORIAL_STEPS[tutorialStep].icon}
              </div>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-3 leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                {TUTORIAL_STEPS[tutorialStep].title}
              </h2>

              {/* Body */}
              <p className="text-sm opacity-60 leading-relaxed mb-4">
                {TUTORIAL_STEPS[tutorialStep].body}
              </p>

              {/* Legal hint */}
              {TUTORIAL_STEPS[tutorialStep].hint && (
                <div className="border border-black/10 p-3 mb-4">
                  <p className="text-[9px] tracking-wider opacity-40 leading-relaxed" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {TUTORIAL_STEPS[tutorialStep].hint}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={dismissTutorial}
                  className="px-4 py-2.5 border border-black/15 text-[10px] tracking-wider font-black hover:bg-black/5 transition-all"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  SKIP
                </button>
                <button
                  onClick={nextTutorialStep}
                  className="flex-1 py-2.5 bg-black text-white hover:bg-black/85 transition-all text-[10px] tracking-wider font-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'NEXT →' : 'CREATE MY FIRST CATALOG →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE MODAL ─────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full md:max-w-md bg-white md:border-2 md:border-black max-h-[92vh] overflow-y-auto" style={{ borderRadius: '16px 16px 0 0' }}>
            <div className="p-6 md:p-8 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>NEW CATALOG</h2>
                  <p className="text-[10px] opacity-35 mt-0.5 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>GIVE IT A NAME AND A VIBE</p>
                </div>
                <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }} className="w-7 h-7 flex items-center justify-center bg-black/6 hover:bg-black/12 transition-colors text-xs font-black rounded-full mt-0.5">✕</button>
              </div>

              <form onSubmit={handleCreateCatalog} className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-[9px] tracking-[0.3em] font-black mb-2 opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NAME *</label>
                  <input
                    type="text"
                    value={catalogName}
                    onChange={(e) => setCatalogName(e.target.value)}
                    placeholder="e.g. Rick Season, Quiet Luxury, My Grails"
                    className="w-full px-0 py-2 border-b-2 border-black/15 focus:border-black focus:outline-none transition-all"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[9px] tracking-[0.3em] font-black mb-2 opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DESCRIPTION</label>
                  <textarea
                    value={catalogDescription}
                    onChange={(e) => setCatalogDescription(e.target.value)}
                    placeholder="Optional — what's the vibe?"
                    className="w-full px-0 py-2 border-b-2 border-black/15 focus:border-black focus:outline-none resize-none h-16 transition-all"
                  />
                </div>

                {/* Cover image */}
                <div>
                  <label className="block text-[9px] tracking-[0.3em] font-black mb-3 opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>COVER IMAGE</label>

                  <div className="flex gap-2 mb-3">
                    {(['file', 'url'] as const).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => { setUploadMethod(method); setCatalogImageUrl(''); setSelectedFile(null); setPreviewUrl(null); setImageError(''); }}
                        className={`flex-1 py-2 text-[9px] tracking-wider font-black transition-all ${uploadMethod === method ? 'bg-black text-white' : 'border border-black/15 hover:bg-black/5'}`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {method === 'file' ? 'UPLOAD FILE' : 'IMAGE URL'}
                      </button>
                    ))}
                  </div>

                  {uploadMethod === 'file' ? (
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-black file:text-white file:text-[9px] file:tracking-wider file:font-black hover:file:bg-black/85" style={{ fontFamily: 'Bebas Neue, sans-serif' }} />
                  ) : (
                    <div>
                      <input type="url" value={catalogImageUrl} onChange={(e) => handleImageUrlChange(e.target.value)} placeholder="https://example.com/image.jpg" className="w-full px-0 py-2 border-b-2 border-black/15 focus:border-black focus:outline-none transition-all" />
                      {checkingImage && <p className="text-[9px] opacity-35 mt-1 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>VERIFYING...</p>}
                    </div>
                  )}

                  {/* Legal notice */}
                  <p className="text-[8px] opacity-25 mt-2 leading-relaxed" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    ONLY USE IMAGES YOU OWN OR HAVE PERMISSION TO USE. DO NOT UPLOAD BRAND EDITORIAL PHOTOGRAPHY OR COPYRIGHTED ARTWORK.
                  </p>

                  {previewUrl && <img src={previewUrl} alt="Preview" className="w-full aspect-square object-cover border border-black/8 mt-3" />}
                  {imageError && <p className="text-red-500 text-xs mt-2">{imageError}</p>}
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-[9px] tracking-[0.3em] font-black mb-3 opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>VISIBILITY</label>
                  <div className="flex gap-2">
                    {(['public', 'private'] as const).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCatalogVisibility(v)}
                        className={`flex-1 py-2.5 text-[9px] tracking-wider font-black transition-all ${catalogVisibility === v ? 'bg-black text-white' : 'border border-black/15 hover:bg-black/5'}`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] opacity-25 mt-2 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {catalogVisibility === 'public' ? 'VISIBLE ON YOUR PROFILE AND DISCOVER — REQUIRED TO EARN COMMISSIONS' : 'ONLY YOU CAN SEE THIS CATALOG'}
                  </p>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowCreateModal(false); resetCreateForm(); }} className="flex-1 py-3 border border-black/15 hover:bg-black/5 transition-all text-[9px] tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CANCEL</button>
                  <button type="submit" disabled={creating || !catalogName.trim() || checkingImage} className="flex-1 py-3 bg-black text-white hover:bg-black/85 transition-all text-[9px] tracking-wider font-black disabled:opacity-30 disabled:cursor-not-allowed" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {creating ? 'CREATING...' : 'CREATE →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ────────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm bg-white p-6 md:p-8">
            <h2 className="text-2xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>DELETE CATALOGS?</h2>
            <p className="text-sm opacity-50 mb-6">
              Deleting {deleteCount} catalog{deleteCount > 1 ? 's' : ''} and all their items. This can't be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 border border-black/15 hover:bg-black/5 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CANCEL</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DELETE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}