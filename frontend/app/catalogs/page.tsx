"use client";

import { useEffect, useState } from "react";
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

async function checkImageSafety(imageUrl: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const response = await fetch('/api/check-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error checking image safety:', error);
    return { safe: false, error: "Failed to verify image safety" };
  }
}

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

export default function CatalogsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCatalogs, setUserCatalogs] = useState<UserCatalog[]>([]);
  const [filteredCatalogs, setFilteredCatalogs] = useState<UserCatalog[]>([]);
  const [loading, setLoading] = useState(true);

  // View options
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

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUserId) loadCatalogs();
  }, [currentUserId]);

  // Filter and sort catalogs
  useEffect(() => {
    let filtered = [...userCatalogs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cat =>
        cat.name.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
      );
    }

    // Visibility filter
    if (filterVisibility !== 'all') {
      filtered = filtered.filter(cat => cat.visibility === filterVisibility);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'items':
          return b.item_count - a.item_count;
        case 'bookmarks':
          return b.bookmark_count - a.bookmark_count;
        default:
          return 0;
      }
    });

    setFilteredCatalogs(filtered);
  }, [userCatalogs, searchQuery, filterVisibility, sortBy]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    setLoading(false);
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
        setUserCatalogs(data.map(cat => ({
          ...cat,
          item_count: cat.catalog_items?.[0]?.count || 0,
          bookmark_count: cat.bookmark_count || 0,
          profiles: Array.isArray(cat.profiles) ? cat.profiles[0] : cat.profiles
        })));
      }
    } catch (error) {
      console.error('Error loading catalogs:', error);
    }
  }

  async function toggleVisibility(catalogId: string, currentVisibility: string) {
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

    try {
      const { error } = await supabase
        .from('catalogs')
        .update({ visibility: newVisibility })
        .eq('id', catalogId)
        .eq('owner_id', currentUserId);

      if (error) throw error;

      setUserCatalogs(prev => prev.map(cat =>
        cat.id === catalogId ? { ...cat, visibility: newVisibility } : cat
      ));
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  }

  function toggleSelectCatalog(catalogId: string) {
    setSelectedCatalogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(catalogId)) {
        newSet.delete(catalogId);
      } else {
        newSet.add(catalogId);
      }
      return newSet;
    });
  }

  function selectAll() {
    if (selectedCatalogs.size === filteredCatalogs.length) {
      setSelectedCatalogs(new Set());
    } else {
      setSelectedCatalogs(new Set(filteredCatalogs.map(c => c.id)));
    }
  }

  async function deleteSelected() {
    if (selectedCatalogs.size === 0) return;

    setDeleteCount(selectedCatalogs.size);
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    try {
      const { error } = await supabase
        .from('catalogs')
        .delete()
        .in('id', Array.from(selectedCatalogs))
        .eq('owner_id', currentUserId);

      if (error) throw error;

      setUserCatalogs(prev => prev.filter(cat => !selectedCatalogs.has(cat.id)));
      setSelectedCatalogs(new Set());
      setEditMode(false);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting catalogs:', error);
      alert('Failed to delete catalogs');
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file');
      return;
    }

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

    try {
      new URL(url);
    } catch {
      setImageError("Invalid URL format");
      return;
    }

    setCheckingImage(true);

    setTimeout(() => {
      setCheckingImage(false);
      setPreviewUrl(url);
    }, 500);
  }

// Updated handleCreateCatalog function for catalogs page
// This saves external cover image URLs to your Supabase bucket

async function handleCreateCatalog(e: React.FormEvent) {
  e.preventDefault();
  if (!currentUserId || !catalogName.trim()) return;

  setCreating(true);
  setImageError('');

  try {
    let finalImageUrl = '';

    // Handle file upload
    if (uploadMethod === 'file' && selectedFile) {
      const uploadResult = await uploadImageToStorage(selectedFile, currentUserId);
      if (!uploadResult.url) {
        setImageError(uploadResult.error || "Failed to upload image");
        setCreating(false);
        return;
      }

      finalImageUrl = uploadResult.url;
    }
    // Handle external URL - download and save to our bucket
    else if (uploadMethod === 'url' && catalogImageUrl.trim()) {
      setCheckingImage(true);
      try {
        // Fetch the external image
        const response = await fetch(catalogImageUrl);

        if (!response.ok) {
          throw new Error('Failed to fetch image');
        }

        const blob = await response.blob();

        // Create a file from the blob
        const file = new File([blob], `catalog-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

        // Upload to our bucket
        const uploadResult = await uploadImageToStorage(file, currentUserId);

        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to save image");
          setCreating(false);
          setCheckingImage(false);
          return;
        }

        finalImageUrl = uploadResult.url;
      } catch (err: any) {
        console.error('Error saving image:', err);
        setImageError("Failed to save image from URL. Make sure the URL is accessible.");
        setCreating(false);
        setCheckingImage(false);
        return;
      } finally {
        setCheckingImage(false);
      }
    }

    const slug = generateSlug(catalogName);

    const { data, error } = await supabase
      .from('catalogs')
      .insert({
        name: catalogName.trim(),
        slug: slug,
        description: catalogDescription.trim() || null,
        image_url: finalImageUrl || null, // Now this is always a Supabase storage URL
        visibility: catalogVisibility,
        owner_id: currentUserId
      })
      .select('*, profiles!catalogs_owner_id_fkey(username)')
      .single();

    if (error) throw error;

    setCatalogName('');
    setCatalogDescription('');
    setSelectedFile(null);
    setCatalogImageUrl('');
    setPreviewUrl(null);
    setCatalogVisibility('public');
    setUploadMethod('file');
    setShowCreateModal(false);

    await loadCatalogs();

    const owner = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
    router.push(`/${owner.username}/${slug}`);
  } catch (error) {
    console.error('Error creating catalog:', error);
    alert('Failed to create catalog');
  } finally {
    setCreating(false);
  }
}

  const totalItems = userCatalogs.reduce((sum, cat) => sum + cat.item_count, 0);
  const publicCount = userCatalogs.filter(cat => cat.visibility === 'public').length;

  if (loading) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo+Black&display=swap');`}</style>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>LOADING...</p>
        </div>
      </>
    );
  }

  if (!currentUserId) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo+Black&display=swap');`}</style>
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>LOGIN REQUIRED</h1>
            <p className="text-sm opacity-60">Sign in to manage your catalogs</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo+Black&display=swap');
        input, textarea { font-size: 16px !important; }
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-6">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
            {/* Desktop Layout */}
            <div className="hidden md:block">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                    YOUR CATALOGS
                  </h1>
                  <div className="flex items-center gap-4 text-xs opacity-40 mt-2">
                    <span>{userCatalogs.length} catalog{userCatalogs.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{publicCount} public</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!editMode ? (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="px-12 py-2.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-sm tracking-wider font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-12 py-2.5 bg-black text-white hover:bg-black/90 transition-all text-sm tracking-wider font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CREATE CATALOG
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={selectAll}
                        className="px-10 py-2.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-sm tracking-wider font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {selectedCatalogs.size === filteredCatalogs.length ? 'DESELECT ALL' : 'SELECT ALL'}
                      </button>
                      {selectedCatalogs.size > 0 && (
                        <button
                          onClick={deleteSelected}
                          className="px-10 py-2.5 bg-red-500 text-white hover:bg-red-600 transition-all text-sm tracking-wider font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          DELETE ({selectedCatalogs.size})
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setSelectedCatalogs(new Set());
                        }}
                        className="px-10 py-2.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-sm tracking-wider font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        DONE
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Search and Filters */}
              {userCatalogs.length > 0 && (
                <div className="flex items-center gap-3 mt-4">
                  {/* Search */}
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search catalogs..."
                      className="w-full px-4 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-sm"
                    />
                  </div>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-4 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-xs tracking-wider font-black bg-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    <option value="recent">RECENT</option>
                    <option value="oldest">OLDEST</option>
                    <option value="name">NAME</option>
                    <option value="items">MOST ITEMS</option>
                    <option value="bookmarks">MOST BOOKMARKED</option>
                  </select>

                  {/* Visibility Filter */}
                  <select
                    value={filterVisibility}
                    onChange={(e) => setFilterVisibility(e.target.value as 'all' | 'public' | 'private')}
                    className="px-4 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-xs tracking-wider font-black bg-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    <option value="all">ALL</option>
                    <option value="public">PUBLIC</option>
                    <option value="private">PRIVATE</option>
                  </select>

                  {/* View Mode */}
                  <div className="flex border border-black/10">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                      title="Grid view"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 border-l border-black/10 ${viewMode === 'list' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                      title="List view"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden">
              <h1 className="text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                YOUR CATALOGS
              </h1>
              <div className="flex items-center gap-3 text-[10px] opacity-40 mt-1 mb-3">
                <span>{userCatalogs.length} catalog{userCatalogs.length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{totalItems} items</span>
              </div>

              {/* Search and Action Buttons Row */}
              {userCatalogs.length > 0 ? (
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="flex-1 px-3 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-sm"
                  />
                  {!editMode ? (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="px-6 py-2 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-xs tracking-wider font-black flex-shrink-0"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-2 bg-black text-white hover:bg-black/90 transition-all text-xs tracking-wider font-black flex-shrink-0"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CREATE
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setSelectedCatalogs(new Set());
                      }}
                      className="px-6 py-2 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-xs tracking-wider font-black flex-shrink-0"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      DONE
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex justify-end gap-2 mb-2">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-8 py-2.5 bg-black text-white hover:bg-black/90 transition-all text-xs tracking-wider font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    CREATE
                  </button>
                </div>
              )}

              {/* Edit Mode Actions Row */}
              {editMode && (
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={selectAll}
                    className="flex-1 py-2 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-xs tracking-wider font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {selectedCatalogs.size === filteredCatalogs.length ? 'DESELECT' : 'SELECT ALL'}
                  </button>
                  {selectedCatalogs.size > 0 && (
                    <button
                      onClick={deleteSelected}
                      className="flex-1 py-2 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      DELETE ({selectedCatalogs.size})
                    </button>
                  )}
                </div>
              )}

              {/* Filters Row */}
              {userCatalogs.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="flex-1 px-3 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-xs tracking-wider font-black bg-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    <option value="recent">RECENT</option>
                    <option value="oldest">OLDEST</option>
                    <option value="name">NAME</option>
                    <option value="items">ITEMS</option>
                    <option value="bookmarks">BOOKMARKS</option>
                  </select>
                  <select
                    value={filterVisibility}
                    onChange={(e) => setFilterVisibility(e.target.value as 'all' | 'public' | 'private')}
                    className="flex-1 px-3 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-xs tracking-wider font-black bg-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    <option value="all">ALL</option>
                    <option value="public">PUBLIC</option>
                    <option value="private">PRIVATE</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Catalogs Content */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
          {filteredCatalogs.length === 0 ? (
            <div className="text-center py-20 md:py-32">
              <div className="text-6xl md:text-8xl opacity-5 mb-6">✦</div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-3" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                {userCatalogs.length === 0 ? 'NO CATALOGS YET' : 'NO RESULTS'}
              </h2>
              <p className="text-sm md:text-base opacity-40 mb-8">
                {userCatalogs.length === 0
                  ? 'Create your first catalog to get started'
                  : 'Try adjusting your filters or search query'
                }
              </p>
              {userCatalogs.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-10 py-3 bg-black text-white hover:bg-black/90 transition-all text-xs tracking-wider font-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  CREATE CATALOG
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {filteredCatalogs.map(catalog => (
                <div
                  key={catalog.id}
                  className={`group relative border transition-all ${
                    editMode && selectedCatalogs.has(catalog.id)
                      ? 'border-black bg-black/5'
                      : 'border-black/10 hover:border-black/30'
                  }`}
                >
                  {/* Selection Checkbox (Edit Mode) */}
                  {editMode && (
                    <div className="absolute top-2 left-2 z-20">
                      <button
                        onClick={() => toggleSelectCatalog(catalog.id)}
                        className={`w-6 h-6 md:w-7 md:h-7 border-2 flex items-center justify-center transition-all ${
                          selectedCatalogs.has(catalog.id)
                            ? 'bg-black border-black'
                            : 'bg-white border-black/30 hover:border-black'
                        }`}
                      >
                        {selectedCatalogs.has(catalog.id) && (
                          <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Catalog Card */}
                  <div
                    className={`${!editMode ? 'cursor-pointer' : ''}`}
                    onClick={() => !editMode && router.push(`/${catalog.profiles.username}/${catalog.slug}`)}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-black/5 overflow-hidden">
                      {catalog.image_url ? (
                        <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl md:text-6xl opacity-10">✦</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 md:p-4 space-y-2">
                      <h3 className="text-xs md:text-sm font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {catalog.name}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] md:text-xs opacity-50">
                        <span>{catalog.item_count} items</span>
                        <span>🔖 {catalog.bookmark_count}</span>
                      </div>
                    </div>
                  </div>

                  {/* Visibility Toggle */}
                  {!editMode && (
                    <div className="border-t border-black/10 p-2 md:p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisibility(catalog.id, catalog.visibility);
                        }}
                        className={`w-full py-1.5 md:py-2 text-[9px] md:text-[10px] tracking-wider font-black transition-all ${
                          catalog.visibility === 'public'
                            ? 'bg-black text-white hover:bg-black/90'
                            : 'border border-black/20 text-black hover:bg-black/5'
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
          ) : (
            /* List View */
            <div className="space-y-2">
              {filteredCatalogs.map(catalog => (
                <div
                  key={catalog.id}
                  className={`flex items-center gap-4 p-3 md:p-4 border transition-all ${
                    editMode && selectedCatalogs.has(catalog.id)
                      ? 'border-black bg-black/5'
                      : 'border-black/10 hover:border-black/30'
                  } ${!editMode ? 'cursor-pointer' : ''}`}
                  onClick={() => !editMode && router.push(`/${catalog.profiles.username}/${catalog.slug}`)}
                >
                  {/* Selection Checkbox */}
                  {editMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectCatalog(catalog.id);
                      }}
                      className={`w-6 h-6 md:w-7 md:h-7 border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedCatalogs.has(catalog.id)
                          ? 'bg-black border-black'
                          : 'bg-white border-black/30 hover:border-black'
                      }`}
                    >
                      {selectedCatalogs.has(catalog.id) && (
                        <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Image */}
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-black/5 flex-shrink-0">
                    {catalog.image_url ? (
                      <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl opacity-10">✦</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm md:text-base font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {catalog.name}
                    </h3>
                    {catalog.description && (
                      <p className="text-xs opacity-60 truncate">{catalog.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs opacity-40 mt-1">
                      <span>{catalog.item_count} items</span>
                      <span>🔖 {catalog.bookmark_count}</span>
                    </div>
                  </div>

                  {/* Visibility Badge */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editMode) toggleVisibility(catalog.id, catalog.visibility);
                      }}
                      disabled={editMode}
                      className={`px-4 py-1.5 text-[10px] tracking-wider font-black transition-all ${
                        catalog.visibility === 'public'
                          ? 'bg-black text-white'
                          : 'border border-black/20'
                      } ${!editMode && 'hover:opacity-80'}`}
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {catalog.visibility === 'public' ? 'PUBLIC' : 'PRIVATE'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white border-2 border-black p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                    NEW CATALOG
                  </h2>
                  <p className="text-xs opacity-40">Create a new collection</p>
                </div>

                <form onSubmit={handleCreateCatalog} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] tracking-wider font-black mb-2 opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NAME *
                    </label>
                    <input
                      type="text"
                      value={catalogName}
                      onChange={(e) => setCatalogName(e.target.value)}
                      placeholder="Summer Collection"
                      className="w-full px-0 py-2 border-b-2 border-black/20 focus:border-black focus:outline-none transition-all"
                      style={{ fontSize: '16px' }}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] tracking-wider font-black mb-2 opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      DESCRIPTION
                    </label>
                    <textarea
                      value={catalogDescription}
                      onChange={(e) => setCatalogDescription(e.target.value)}
                      placeholder="Optional description..."
                      className="w-full px-0 py-2 border-b-2 border-black/20 focus:border-black focus:outline-none resize-none h-20 transition-all"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  {/* Cover Image */}
                  <div>
                    <label className="block text-[10px] tracking-wider font-black mb-3 opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      COVER IMAGE
                    </label>

                    {/* Toggle between file and URL */}
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMethod('file');
                          setCatalogImageUrl('');
                          setPreviewUrl(null);
                          setImageError('');
                        }}
                        className={`flex-1 py-2 text-[10px] tracking-wider font-black transition-all ${
                          uploadMethod === 'file'
                            ? 'bg-black text-white'
                            : 'border border-black/20 hover:bg-black/5'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        UPLOAD FILE
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMethod('url');
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setImageError('');
                        }}
                        className={`flex-1 py-2 text-[10px] tracking-wider font-black transition-all ${
                          uploadMethod === 'url'
                            ? 'bg-black text-white'
                            : 'border border-black/20 hover:bg-black/5'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        IMAGE URL
                      </button>
                    </div>

                    {/* File upload */}
                    {uploadMethod === 'file' && (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-black file:text-white file:text-xs file:tracking-wider file:font-black hover:file:bg-black/90"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      />
                    )}

                    {/* URL input */}
                    {uploadMethod === 'url' && (
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={catalogImageUrl}
                          onChange={(e) => handleImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-0 py-2 border-b-2 border-black/20 focus:border-black focus:outline-none transition-all"
                          style={{ fontSize: '16px' }}
                        />
                        {checkingImage && (
                          <p className="text-xs opacity-40">Verifying image...</p>
                        )}
                      </div>
                    )}

                    {previewUrl && (
                      <div className="mt-3">
                        <img src={previewUrl} alt="Preview" className="w-full aspect-square object-cover border border-black/10" />
                      </div>
                    )}
                    {imageError && (
                      <p className="text-red-500 text-xs mt-2">{imageError}</p>
                    )}
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-[10px] tracking-wider font-black mb-3 opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      VISIBILITY
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCatalogVisibility('public')}
                        className={`flex-1 py-2.5 text-xs tracking-wider font-black transition-all ${
                          catalogVisibility === 'public'
                            ? 'bg-black text-white'
                            : 'border border-black/20 hover:bg-black/5'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        PUBLIC
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatalogVisibility('private')}
                        className={`flex-1 py-2.5 text-xs tracking-wider font-black transition-all ${
                          catalogVisibility === 'private'
                            ? 'bg-black text-white'
                            : 'border border-black/20 hover:bg-black/5'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        PRIVATE
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setCatalogName('');
                        setCatalogDescription('');
                        setSelectedFile(null);
                        setCatalogImageUrl('');
                        setPreviewUrl(null);
                        setImageError('');
                        setUploadMethod('file');
                      }}
                      className="flex-1 py-3 border border-black/20 hover:bg-black/5 transition-all text-xs tracking-wider font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !catalogName.trim() || checkingImage}
                      className="flex-1 py-3 bg-black text-white hover:bg-black/90 transition-all text-xs tracking-wider font-black disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {creating ? 'CREATING...' : 'CREATE'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white border-2 border-black p-6 md:p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                    DELETE CATALOGS?
                  </h2>
                  <p className="text-sm opacity-60">
                    You're about to delete {deleteCount} catalog{deleteCount > 1 ? 's' : ''}. This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-3 border border-black/20 hover:bg-black/5 transition-all text-xs tracking-wider font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    DELETE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}