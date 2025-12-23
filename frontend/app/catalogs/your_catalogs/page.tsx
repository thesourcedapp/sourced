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

// Function to check image safety via API
async function checkImageSafety(imageUrl: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const response = await fetch('/api/check-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking image safety:', error);
    return { safe: false, error: "Failed to verify image safety" };
  }
}

// Function to upload file to Supabase Storage
async function uploadImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `catalog-${userId}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('catalog-covers')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      return { url: null, error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('catalog-covers')
      .getPublicUrl(fileName);

    return { url: publicUrl };
  } catch (error: any) {
    return { url: null, error: error.message };
  }
}

export default function YourCatalogsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Your Catalogs
  const [userCatalogs, setUserCatalogs] = useState<UserCatalog[]>([]);
  const [userCatalogsLoading, setUserCatalogsLoading] = useState(true);

  // Create Catalog Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');
  const [catalogImageUrl, setCatalogImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [catalogVisibility, setCatalogVisibility] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [checkingImage, setCheckingImage] = useState(false);
  const [imageValid, setImageValid] = useState<boolean | null>(null);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadUserCatalogs();
    }
  }, [currentUserId]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadUserCatalogs() {
    if (!currentUserId) return;

    setUserCatalogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalogs')
        .select(`
          id,
          name,
          description,
          image_url,
          visibility,
          created_at,
          bookmark_count,
          catalog_items(count)
        `)
        .eq('owner_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const catalogsWithCount = data.map(catalog => ({
          ...catalog,
          item_count: catalog.catalog_items?.[0]?.count || 0,
          bookmark_count: catalog.bookmark_count || 0
        }));
        setUserCatalogs(catalogsWithCount);
      }
    } catch (error) {
      console.error('Error loading user catalogs:', error);
    } finally {
      setUserCatalogsLoading(false);
    }
  }

  async function deleteCatalog(catalogId: string, catalogName: string) {
    if (!confirm(`Are you sure you want to delete "${catalogName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('catalogs')
        .delete()
        .eq('id', catalogId)
        .eq('owner_id', currentUserId);

      if (error) throw error;

      // Remove from local state
      setUserCatalogs(prevCatalogs =>
        prevCatalogs.filter(catalog => catalog.id !== catalogId)
      );
    } catch (error) {
      console.error('Error deleting catalog:', error);
      alert('Failed to delete catalog');
    }
  }

async function toggleCatalogVisibility(catalogId: string, currentVisibility: string) {
  const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

  try {
    const { error } = await supabase
      .from('catalogs')
      .update({ visibility: newVisibility })
      .eq('id', catalogId)
      .eq('owner_id', currentUserId);

    if (error) throw error;

    // Update local state
    setUserCatalogs(prevCatalogs =>
      prevCatalogs.map(catalog =>
        catalog.id === catalogId
          ? { ...catalog, visibility: newVisibility }
          : catalog
      )
    );
  } catch (error) {
    console.error('Error toggling visibility:', error);
    alert('Failed to update visibility');
  }
}

  async function checkText(text: string, fieldName: string) {
    if (!text.trim()) return { valid: true, error: '' };

    try {
      const response = await fetch('/api/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: text })
      });

      const result = await response.json();

      if (!result.safe) {
        return { valid: false, error: `${fieldName} contains inappropriate content` };
      }

      return { valid: true, error: '' };
    } catch (error) {
      console.error(`Error checking ${fieldName}:`, error);
      return { valid: false, error: `Error validating ${fieldName}` };
    }
  }

  async function validateCatalogName(name: string) {
    if (!name.trim()) {
      setNameError('Name is required');
      return false;
    }

    if (name.length < 3) {
      setNameError('Name must be at least 3 characters');
      return false;
    }

    const validation = await checkText(name, 'name');
    setNameError(validation.error);
    return validation.valid;
  }

  async function validateDescription(description: string) {
    if (!description.trim()) {
      setDescriptionError('');
      return true;
    }

    const validation = await checkText(description, 'description');
    setDescriptionError(validation.error);
    return validation.valid;
  }

  // Handle file selection
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
    setImageValid(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Handle URL image changes
  async function handleImageUrlChange(url: string) {
    setCatalogImageUrl(url);
    setImageValid(null);
    setImageError('');
    setPreviewUrl(null);
    setSelectedFile(null);

    if (!url.trim()) return;

    try {
      new URL(url);
    } catch {
      setImageValid(false);
      setImageError("Invalid URL format");
      return;
    }

    setCheckingImage(true);

    setTimeout(async () => {
      const safetyCheck = await checkImageSafety(url);
      setCheckingImage(false);

      if (!safetyCheck.safe) {
        setImageValid(false);
        setImageError(safetyCheck.error || "Image contains inappropriate content");
      } else {
        setImageValid(true);
      }
    }, 500);
  }

  function resetCreateForm() {
    setCatalogName('');
    setCatalogDescription('');
    setCatalogImageUrl('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setCatalogVisibility('public');
    setNameError('');
    setDescriptionError('');
    setImageError('');
    setImageValid(null);
    setUploadMethod('file');
  }

  async function handleCreateCatalog(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUserId) return;

    // Validate all fields
    const nameValid = await validateCatalogName(catalogName);
    const descValid = await validateDescription(catalogDescription);

    if (!nameValid || !descValid) return;

    setCreating(true);

    try {
      let finalImageUrl = catalogImageUrl;

      // Handle file upload
      if (uploadMethod === 'file' && selectedFile) {
        const uploadResult = await uploadImageToStorage(selectedFile, currentUserId);

        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to upload image");
          setCreating(false);
          return;
        }

        finalImageUrl = uploadResult.url;

        // Check uploaded image safety
        const safetyCheck = await checkImageSafety(finalImageUrl);
        if (!safetyCheck.safe) {
          setImageError(safetyCheck.error || "Image contains inappropriate content");
          setCreating(false);
          return;
        }
      } else if (uploadMethod === 'url' && catalogImageUrl.trim()) {
        // Final safety check for URL method
        const safetyCheck = await checkImageSafety(catalogImageUrl);
        if (!safetyCheck.safe) {
          setImageError(safetyCheck.error || "Image contains inappropriate content");
          setCreating(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('catalogs')
        .insert({
          name: catalogName.trim(),
          description: catalogDescription.trim() || null,
          image_url: finalImageUrl.trim() || null,
          visibility: catalogVisibility,
          owner_id: currentUserId
        })
        .select()
        .single();

      if (error) throw error;

      // Reset form and close modal
      resetCreateForm();
      setShowCreateModal(false);

      // Refresh user catalogs
      await loadUserCatalogs();

      // Navigate to the new catalog
      router.push(`/catalogs/${data.id}`);
    } catch (error) {
      console.error('Error creating catalog:', error);
      alert('Failed to create catalog');
    } finally {
      setCreating(false);
    }
  }

  const canSubmit = (uploadMethod === 'file' && selectedFile) ||
                   (uploadMethod === 'url' && (!catalogImageUrl.trim() || (imageValid === true && !checkingImage))) ||
                   (!catalogImageUrl.trim() && !selectedFile);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              YOUR CATALOGS
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => router.push('/catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                SEARCH CATALOGS
              </button>
              <button
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-black text-black"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                YOUR CATALOGS
              </button>
              <button
                onClick={() => router.push('/catalogs/liked_items')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                LIKED ITEMS
              </button>
              <button
                onClick={() => router.push('/catalogs/bookmarked_catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                BOOKMARKED
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm tracking-wider opacity-60">
                  {userCatalogsLoading ? 'Loading...' : `${userCatalogs.length} catalogs`}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-2 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-xs tracking-[0.4em] font-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  CREATE CATALOG
                </button>
              </div>

              {userCatalogsLoading ? (
                <div className="text-center py-20">
                  <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    LOADING...
                  </p>
                </div>
              ) : userCatalogs.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    NO CATALOGS YET
                  </p>
                  <p className="text-sm tracking-wide opacity-30 mt-2">
                    Create your first catalog to get started
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userCatalogs.map((catalog) => (
                    <div key={catalog.id} className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200 relative">
                      <div
                        className="cursor-pointer"
                        onClick={() => router.push(`/catalogs/${catalog.id}`)}
                      >
                        <div className="aspect-square bg-white overflow-hidden">
                          {catalog.image_url ? (
                            <img
                              src={catalog.image_url}
                              alt={catalog.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-black/5 flex items-center justify-center">
                              <span className="text-6xl opacity-20">✦</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4 border-t border-black/20">
                          <h3 className="text-lg font-black tracking-wide uppercase truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {catalog.name}
                          </h3>
                          <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                            <span className={`px-2 py-1 ${catalog.visibility === 'public' ? 'bg-black text-white' : 'bg-black/10 text-black'} text-[8px] tracking-[0.3em]`}>
                              {catalog.visibility.toUpperCase()}
                            </span>
                            <span>{catalog.item_count} items</span>
                          </div>
                        </div>
                      </div>

                      {/* Delete button - Desktop (hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCatalog(catalog.id, catalog.name);
                        }}
                        className="hidden md:flex absolute top-2 right-2 w-8 h-8 items-center justify-center bg-red-500/80 hover:bg-red-500 border border-red-600 text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                      >
                        <span className="text-xs">✕</span>
                      </button>

                      {/* Delete button - Mobile (always visible) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCatalog(catalog.id, catalog.name);
                        }}
                        className="md:hidden absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-500/90 hover:bg-red-500 border border-red-600 text-white transition-all z-10"
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Catalog Modal - keeping existing modal code */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-2xl relative">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="absolute -top-16 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="border-2 border-white p-8 md:p-12 bg-black relative text-white max-h-[80vh] overflow-y-auto">
                <div className="absolute -top-1 -left-1 w-full h-full border border-white opacity-50 pointer-events-none"></div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NEW CATALOG
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      CREATE
                    </h2>
                  </div>

                  <form onSubmit={handleCreateCatalog} className="space-y-6">
                    {/* Catalog Name */}
                    <div className="space-y-2">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        CATALOG NAME *
                      </label>
                      <input
                        type="text"
                        value={catalogName}
                        onChange={(e) => setCatalogName(e.target.value)}
                        onBlur={() => catalogName && validateCatalogName(catalogName)}
                        placeholder="My Amazing Catalog"
                        className={`w-full px-0 py-3 bg-transparent border-b-2 focus:outline-none transition-all text-white placeholder-white/40 ${
                          nameError ? 'border-red-400' : 'border-white focus:border-white'
                        }`}
                        required
                      />
                      {nameError && (
                        <p className="text-red-400 text-xs tracking-wide">{nameError}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        DESCRIPTION (OPTIONAL)
                      </label>
                      <textarea
                        value={catalogDescription}
                        onChange={(e) => setCatalogDescription(e.target.value)}
                        onBlur={() => catalogDescription && validateDescription(catalogDescription)}
                        placeholder="Describe your catalog..."
                        className={`w-full px-0 py-3 bg-transparent border-b-2 focus:outline-none transition-all text-white placeholder-white/40 h-20 resize-none ${
                          descriptionError ? 'border-red-400' : 'border-white focus:border-white'
                        }`}
                      />
                      {descriptionError && (
                        <p className="text-red-400 text-xs tracking-wide">{descriptionError}</p>
                      )}
                    </div>

                    {/* Upload Method Selection */}
                    <div className="space-y-3">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        COVER IMAGE (OPTIONAL)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setUploadMethod('file')}
                          className={`px-4 py-2 text-xs tracking-wider font-black transition-all ${
                            uploadMethod === 'file'
                              ? 'bg-white text-black'
                              : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          UPLOAD FILE
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMethod('url')}
                          className={`px-4 py-2 text-xs tracking-wider font-black transition-all ${
                            uploadMethod === 'url'
                              ? 'bg-white text-black'
                              : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          IMAGE URL
                        </button>
                      </div>
                    </div>

                    {/* File Upload */}
                    {uploadMethod === 'file' && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="w-full px-0 py-3 bg-transparent border-b-2 border-white focus:outline-none text-white file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:tracking-wider file:font-black"
                        />
                        <p className="text-[9px] tracking-wider opacity-40">
                          JPG, PNG, or GIF. Max size 5MB.
                        </p>
                      </div>
                    )}

                    {/* URL Input */}
                    {uploadMethod === 'url' && (
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={catalogImageUrl}
                          onChange={(e) => handleImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className={`w-full px-0 py-3 bg-transparent border-b-2 focus:outline-none transition-all text-white placeholder-white/40 ${
                            catalogImageUrl && imageValid === false
                              ? 'border-red-400'
                              : catalogImageUrl && imageValid === true
                              ? 'border-green-400'
                              : 'border-white focus:border-white'
                          }`}
                        />

                        <div className="flex items-center justify-between">
                          <p className="text-[9px] tracking-wider opacity-40">
                            Paste a link to your cover image
                          </p>
                          {checkingImage && (
                            <span className="text-xs tracking-wider opacity-40">verifying...</span>
                          )}
                        </div>

                        {catalogImageUrl && !checkingImage && imageValid === false && (
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 text-xs">✗</span>
                            <p className="text-red-400 text-xs tracking-wide">{imageError}</p>
                          </div>
                        )}

                        {catalogImageUrl && !checkingImage && imageValid === true && (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 text-xs">✓</span>
                            <p className="text-green-400 text-xs tracking-wide">Image verified</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview */}
                    {((uploadMethod === 'url' && catalogImageUrl && imageValid === true) ||
                      (uploadMethod === 'file' && previewUrl)) && (
                      <div className="space-y-3">
                        <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          PREVIEW
                        </label>
                        <div className="flex items-center gap-4 p-4 border border-white/20">
                          <img
                            src={uploadMethod === 'url' ? catalogImageUrl : previewUrl!}
                            alt="Preview"
                            className="w-16 h-16 border-2 border-white object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="text-xs opacity-60">
                            This is how your cover will appear
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {imageError && (
                      <div className="p-3 border border-red-400 text-red-400 text-xs tracking-wide">
                        {imageError}
                      </div>
                    )}

                    {/* Visibility */}
                    <div className="space-y-3">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        VISIBILITY
                      </label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setCatalogVisibility('public')}
                          className={`px-6 py-3 border-2 transition-all text-sm tracking-wider font-black ${
                            catalogVisibility === 'public'
                              ? 'bg-white text-black border-white'
                              : 'bg-transparent text-white border-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          PUBLIC
                        </button>
                        <button
                          type="button"
                          onClick={() => setCatalogVisibility('private')}
                          className={`px-6 py-3 border-2 transition-all text-sm tracking-wider font-black ${
                            catalogVisibility === 'private'
                              ? 'bg-white text-black border-white'
                              : 'bg-transparent text-white border-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          PRIVATE
                        </button>
                      </div>
                      <p className="text-xs tracking-wide opacity-60">
                        {catalogVisibility === 'public' ? 'Anyone can discover and view this catalog' : 'Only you can view this catalog'}
                      </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          resetCreateForm();
                        }}
                        className="flex-1 py-4 border-2 border-white text-white hover:bg-white hover:text-black transition-all text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CANCEL
                      </button>

                      <button
                        type="submit"
                        disabled={creating || !!nameError || !!descriptionError || !catalogName.trim() || !canSubmit}
                        className="flex-1 py-4 bg-white text-black hover:bg-black hover:text-white hover:border-white border-2 border-white transition-all text-xs tracking-[0.4em] font-black disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {creating ? 'CREATING...' : 'CREATE CATALOG'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}