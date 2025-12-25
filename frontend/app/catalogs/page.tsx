"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type UserCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  visibility: string;
  created_at: string;
  item_count: number;
  bookmark_count: number;
};

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
  const [loading, setLoading] = useState(true);

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
        .select(`id, name, description, image_url, visibility, created_at, bookmark_count, catalog_items(count)`)
        .eq('owner_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUserCatalogs(data.map(cat => ({
          ...cat,
          item_count: cat.catalog_items?.[0]?.count || 0,
          bookmark_count: cat.bookmark_count || 0
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
    if (selectedCatalogs.size === userCatalogs.length) {
      setSelectedCatalogs(new Set());
    } else {
      setSelectedCatalogs(new Set(userCatalogs.map(c => c.id)));
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

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be smaller than 5MB');
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

    setTimeout(async () => {
      const safetyCheck = await checkImageSafety(url);
      setCheckingImage(false);

      if (!safetyCheck.safe) {
        setImageError(safetyCheck.error || "Image contains inappropriate content");
      } else {
        setPreviewUrl(url);
      }
    }, 500);
  }

  async function handleCreateCatalog(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !catalogName.trim()) return;

    setCreating(true);
    setImageError('');

    try {
      let finalImageUrl = '';

      if (uploadMethod === 'file' && selectedFile) {
        const uploadResult = await uploadImageToStorage(selectedFile, currentUserId);
        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to upload image");
          setCreating(false);
          return;
        }

        finalImageUrl = uploadResult.url;

        const safetyCheck = await checkImageSafety(finalImageUrl);
        if (!safetyCheck.safe) {
          setImageError("Image contains inappropriate content");
          setCreating(false);
          return;
        }
      } else if (uploadMethod === 'url' && catalogImageUrl.trim()) {
        const safetyCheck = await checkImageSafety(catalogImageUrl);
        if (!safetyCheck.safe) {
          setImageError("Image contains inappropriate content");
          setCreating(false);
          return;
        }
        finalImageUrl = catalogImageUrl;
      }

      const { data, error } = await supabase
        .from('catalogs')
        .insert({
          name: catalogName.trim(),
          description: catalogDescription.trim() || null,
          image_url: finalImageUrl || null,
          visibility: catalogVisibility,
          owner_id: currentUserId
        })
        .select()
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
      router.push(`/catalogs/${data.id}`);
    } catch (error) {
      console.error('Error creating catalog:', error);
      alert('Failed to create catalog');
    } finally {
      setCreating(false);
    }
  }

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  YOUR CATALOGS
                </h1>
                <p className="text-xs md:text-sm opacity-40 mt-1">{userCatalogs.length} total</p>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                {!editMode ? (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 md:px-6 py-2.5 md:py-3 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-xs md:text-sm tracking-wider font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 md:px-6 py-2.5 md:py-3 bg-black text-white hover:bg-black/90 transition-all text-xs md:text-sm tracking-wider font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      + NEW
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={selectAll}
                      className="px-3 md:px-4 py-2 md:py-2.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-[10px] md:text-xs tracking-wider font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {selectedCatalogs.size === userCatalogs.length ? 'DESELECT ALL' : 'SELECT ALL'}
                    </button>
                    {selectedCatalogs.size > 0 && (
                      <button
                        onClick={deleteSelected}
                        className="px-3 md:px-4 py-2 md:py-2.5 bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] md:text-xs tracking-wider font-black"
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
                      className="px-3 md:px-4 py-2 md:py-2.5 border border-black/20 hover:border-black hover:bg-black/5 transition-all text-[10px] md:text-xs tracking-wider font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      DONE
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Catalogs Grid */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
          {userCatalogs.length === 0 ? (
            <div className="text-center py-20 md:py-32">
              <div className="text-6xl md:text-8xl opacity-5 mb-6">✦</div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-3" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                NO CATALOGS YET
              </h2>
              <p className="text-sm md:text-base opacity-40 mb-8">Create your first catalog to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-8 py-3 bg-black text-white hover:bg-black/90 transition-all text-xs tracking-wider font-black"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                CREATE CATALOG
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {userCatalogs.map(catalog => (
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
                    onClick={() => !editMode && router.push(`/catalogs/${catalog.id}`)}
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
                        <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover border border-black/10" />
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