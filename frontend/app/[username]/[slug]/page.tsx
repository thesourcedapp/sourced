"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Head from "next/head";

type CatalogData = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  visibility: string;
  owner_id: string;
  bookmark_count: number;
  owner: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

type CatalogItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  category?: string;
  brand?: string;
  primary_color?: string;
  style_tags?: string[];
  click_count?: number;
};

type SortOption = 'recent' | 'oldest' | 'most_liked' | 'title';
type ViewMode = 'grid' | 'compact';

async function uploadImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `item-${userId}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('catalog-items')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) return { url: null, error: error.message };

    const { data: { publicUrl } } = supabase.storage
      .from('catalog-items')
      .getPublicUrl(fileName);

    return { url: publicUrl };
  } catch (error: any) {
    return { url: null, error: error.message };
  }
}

function extractSellerFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace(/^www\./i, '');
    const parts = domain.split('.');
    let seller = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return seller.charAt(0).toUpperCase() + seller.slice(1);
  } catch {
    return '';
  }
}

export default function CatalogDetailPage() {
  const router = useRouter();
  const params = useParams();
  const username = (params.username as string).replace('@', '');
  const slug = params.slug as string;

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<CatalogItem | null>(null);

  // Filters and sorting
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [itemProductUrl, setItemProductUrl] = useState('');
  const [itemSeller, setItemSeller] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingStatus, setCreatingStatus] = useState('');
  const [imageError, setImageError] = useState('');
  const [productUrlError, setProductUrlError] = useState('');

  // Edit catalog state
  const [showEditCatalogModal, setShowEditCatalogModal] = useState(false);
  const [editCatalogName, setEditCatalogName] = useState('');
  const [editCatalogDescription, setEditCatalogDescription] = useState('');
  const [editCatalogImageUrl, setEditCatalogImageUrl] = useState('');
  const [editCatalogFile, setEditCatalogFile] = useState<File | null>(null);
  const [editCatalogPreview, setEditCatalogPreview] = useState<string | null>(null);
  const [editCatalogMethod, setEditCatalogMethod] = useState<'url' | 'file' | 'keep'>('keep');
  const [editingCatalog, setEditingCatalog] = useState(false);
  const [editCatalogError, setEditCatalogError] = useState('');

  const isOwner = currentUserId === catalog?.owner_id;

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (username && slug) {
      loadCatalog();
    }
  }, [username, slug, currentUserId]);

  useEffect(() => {
    if (catalog) {
      loadItems();
    }
  }, [catalog?.id, currentUserId]);

  useEffect(() => {
    let filtered = [...items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.seller?.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_liked':
          return b.like_count - a.like_count;
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredItems(filtered);
  }, [items, searchQuery, sortBy]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', user.id)
        .single();

      setIsOnboarded(profile?.is_onboarded || false);
    } else {
      setCurrentUserId(null);
      setIsOnboarded(false);
    }
  }

  async function loadCatalog() {
    try {
      const { data, error } = await supabase
        .from('catalogs')
        .select(`
          id, name, description, image_url, visibility, owner_id, bookmark_count, slug,
          profiles!catalogs_owner_id_fkey(username, full_name, avatar_url)
        `)
        .eq('slug', slug)
        .single();

      if (error) throw error;

      const owner = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      if (owner.username !== username) {
        throw new Error('Username mismatch');
      }

      const catalogData: CatalogData = {
        ...data,
        owner: owner
      };

      setCatalog(catalogData);

      if (currentUserId) {
        const { data: bookmarkData } = await supabase
          .from('bookmarked_catalogs')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('catalog_id', data.id)
          .single();

        setIsBookmarked(!!bookmarkData);
      }
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadItems() {
    if (!catalog) return;

    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('catalog_id', catalog.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let likedItemIds: Set<string> = new Set();
      if (currentUserId) {
        const { data: likedData } = await supabase
          .from('liked_items')
          .select('item_id')
          .eq('user_id', currentUserId);

        if (likedData) {
          likedItemIds = new Set(likedData.map(like => like.item_id));
        }
      }

      const itemsWithLikes = data.map(item => ({
        ...item,
        is_liked: likedItemIds.has(item.id)
      }));

      setItems(itemsWithLikes);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }

  // Track click function
  async function trackClick(itemId: string) {
    try {
      await fetch('/api/track-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          itemType: 'catalog'
        }),
      });
    } catch (error) {
      console.error('Error tracking click:', error);
      // Don't block navigation if tracking fails
    }
  }

  // Handle item click with tracking
  async function handleItemClick(item: CatalogItem, e?: React.MouseEvent) {
    if (e) {
      e.stopPropagation();
    }

    if (item.product_url) {
      // Track the click (fire and forget)
      trackClick(item.id);

      // Open the link
      window.open(item.product_url, '_blank');
    }
  }

  async function toggleBookmark() {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
      return;
    }

    if (!catalog) return;

    try {
      if (isBookmarked) {
        await supabase.from('bookmarked_catalogs').delete()
          .eq('user_id', currentUserId)
          .eq('catalog_id', catalog.id);
      } else {
        await supabase.from('bookmarked_catalogs')
          .insert({ user_id: currentUserId, catalog_id: catalog.id });
      }

      await loadCatalog();
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }

  async function toggleLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
      return;
    }

    try {
      if (currentlyLiked) {
        await supabase.from('liked_items').delete()
          .eq('user_id', currentUserId).eq('item_id', itemId);
      } else {
        await supabase.from('liked_items')
          .insert({ user_id: currentUserId, item_id: itemId });
      }

      await loadItems();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }

  function selectAll() {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  }

  function deleteSelectedItems() {
    if (selectedItems.size === 0) return;
    setDeleteCount(selectedItems.size);
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    try {
      const { error } = await supabase
        .from('catalog_items')
        .delete()
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setItems(prevItems => prevItems.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting items:', error);
      setImageError('Failed to delete items');
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setImageError('');

    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleImageUrlChange(url: string) {
    setItemImageUrl(url);
    setImageError('');

    if (!url.trim()) {
      setPreviewUrl(null);
      return;
    }

    try {
      new URL(url);
      setPreviewUrl(url);
    } catch {
      setImageError("Invalid URL format");
      setPreviewUrl(null);
    }
  }

  function handleProductUrlChange(url: string) {
    setItemProductUrl(url);
    setProductUrlError('');

    if (url.trim()) {
      const extractedSeller = extractSellerFromUrl(url);
      if (extractedSeller) setItemSeller(extractedSeller);
    }
  }

  function resetAddItemForm() {
    setItemTitle('');
    setItemImageUrl('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setItemProductUrl('');
    setItemSeller('');
    setItemPrice('');
    setImageError('');
    setProductUrlError('');
    setUploadMethod('file');
    setCreatingStatus('');
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUserId) {
      setImageError('You must be logged in');
      return;
    }

    if (!catalog) {
      setImageError('Catalog not loaded');
      return;
    }

    setCreating(true);
    setImageError('');
    setProductUrlError('');

    try {
      if (!itemProductUrl.trim()) {
        setProductUrlError('Product URL is required');
        setCreating(false);
        return;
      }

      try {
        new URL(itemProductUrl);
      } catch {
        setProductUrlError('Please enter a valid URL');
        setCreating(false);
        return;
      }

      let finalImageUrl = itemImageUrl;

      // Handle file upload
      if (uploadMethod === 'file' && selectedFile) {
        setCreatingStatus('Uploading image...');
        const uploadResult = await uploadImageToStorage(selectedFile, currentUserId);

        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to upload image");
          setCreating(false);
          setCreatingStatus('');
          return;
        }

        finalImageUrl = uploadResult.url;
      }
      // Handle external URL - download and save to our bucket
      else if (uploadMethod === 'url' && itemImageUrl) {
        setCreatingStatus('Saving image to storage...');
        try {
          // Fetch the external image
          const response = await fetch(itemImageUrl);

          if (!response.ok) {
            throw new Error('Failed to fetch image');
          }

          const blob = await response.blob();

          // Create a file from the blob
          const file = new File([blob], `item-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

          // Upload to our bucket
          const uploadResult = await uploadImageToStorage(file, currentUserId);

          if (!uploadResult.url) {
            setImageError(uploadResult.error || "Failed to save image");
            setCreating(false);
            setCreatingStatus('');
            return;
          }

          finalImageUrl = uploadResult.url;
        } catch (err: any) {
          console.error('Error saving image:', err);
          setImageError("Failed to save image from URL. Make sure the URL is accessible.");
          setCreating(false);
          setCreatingStatus('');
          return;
        }
      }

      if (!finalImageUrl) {
        setImageError('Image is required');
        setCreating(false);
        return;
      }

      setCreatingStatus('Categorizing with AI...');

      const requestBody = {
        catalog_id: catalog.id,
        title: itemTitle.trim(),
        image_url: finalImageUrl,
        product_url: itemProductUrl.trim(),
        seller: itemSeller.trim() || null,
        price: itemPrice.trim() || null,
        user_id: currentUserId
      };

      // Call backend API with AI categorization
      const response = await fetch(`https://sourced-5ovn.onrender.com/create-catalog-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Server returned invalid response');
      }

      if (!response.ok) {
        // If it's a duplicate error (item already exists), consider it success
        if (result.detail && result.detail.includes('duplicate') || result.detail.includes('already exists')) {
          console.log('Item already exists, treating as success');
          resetAddItemForm();
          setShowAddItemModal(false);
          await loadItems();
          return;
        }
        throw new Error(result.detail || `Server error: ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to create item');
      }

      resetAddItemForm();
      setShowAddItemModal(false);
      await loadItems();

    } catch (error: any) {
      console.error('❌ Error adding item:', error);

      let errorMessage = error.message || 'Failed to add item';

      // Better error handling for common issues
      if (errorMessage.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Make sure backend is running.';
      } else if (errorMessage.includes('Network')) {
        errorMessage = 'Network error. Check your connection.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        errorMessage = 'Request timed out. The item may have been added - please check before retrying.';
      }

      setImageError(errorMessage);
    } finally {
      setCreating(false);
      setCreatingStatus('');
    }
  }

  // Edit Catalog Functions
  function openEditCatalogModal() {
    if (!catalog) return;
    setEditCatalogName(catalog.name);
    setEditCatalogDescription(catalog.description || '');
    setEditCatalogImageUrl(catalog.image_url || '');
    setEditCatalogPreview(catalog.image_url);
    setEditCatalogMethod('keep');
    setEditCatalogFile(null);
    setEditCatalogError('');
    setShowEditCatalogModal(true);
  }

  async function handleEditCatalogFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditCatalogError('Please select an image file');
      return;
    }

    setEditCatalogFile(file);
    setEditCatalogError('');

    const reader = new FileReader();
    reader.onload = (e) => setEditCatalogPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleEditCatalogImageUrlChange(url: string) {
    setEditCatalogImageUrl(url);
    setEditCatalogError('');

    if (!url.trim()) {
      setEditCatalogPreview(catalog?.image_url || null);
      return;
    }

    try {
      new URL(url);
      setEditCatalogPreview(url);
    } catch {
      setEditCatalogError("Invalid URL format");
      setEditCatalogPreview(catalog?.image_url || null);
    }
  }

  async function handleEditCatalog(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUserId || !catalog) return;

    setEditingCatalog(true);
    setEditCatalogError('');

    try {
      let finalImageUrl = catalog.image_url;

      // Handle image update
      if (editCatalogMethod === 'file' && editCatalogFile) {
        // Upload new image
        const uploadResult = await uploadImageToStorage(editCatalogFile, currentUserId);

        if (!uploadResult.url) {
          setEditCatalogError(uploadResult.error || "Failed to upload image");
          setEditingCatalog(false);
          return;
        }

        finalImageUrl = uploadResult.url;

      } else if (editCatalogMethod === 'url' && editCatalogImageUrl.trim()) {
        finalImageUrl = editCatalogImageUrl;
      }

      // Update catalog in database
      const { error } = await supabase
        .from('catalogs')
        .update({
          name: editCatalogName.trim(),
          description: editCatalogDescription.trim() || null,
          image_url: finalImageUrl
        })
        .eq('id', catalog.id);

      if (error) throw error;

      // Reload catalog
      await loadCatalog();
      setShowEditCatalogModal(false);

    } catch (error: any) {
      console.error('Error updating catalog:', error);
      setEditCatalogError(error.message || 'Failed to update catalog');
    } finally {
      setEditingCatalog(false);
    }
  }

  const canSubmit = itemTitle.trim() &&
                   itemProductUrl.trim() &&
                   ((uploadMethod === 'file' && selectedFile) ||
                    (uploadMethod === 'url' && itemImageUrl.trim()));

  const totalLikes = items.reduce((sum, item) => sum + item.like_count, 0);

  // Generate share metadata with dynamic OG image
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = catalog ? `Sourced - ${catalog.name}` : 'Sourced';
  const shareDescription = `${catalog?.name || 'Catalog'} on Sourced`;

  // Generate dynamic OG image URL
  const ogImageUrl = catalog
    ? `/api/og/catalog?catalog=${encodeURIComponent(catalog.name)}&username=${encodeURIComponent(catalog.owner.username)}&items=${items.length}${catalog.image_url ? `&image=${encodeURIComponent(catalog.image_url)}` : ''}`
    : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const shareImage = ogImageUrl;

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading... | Sourced</title>
        </Head>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>LOADING...</p>
        </div>
      </>
    );
  }

  if (!catalog) {
    return (
      <>
        <Head>
          <title>Catalog Not Found | Sourced</title>
        </Head>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>CATALOG NOT FOUND</h1>
            <button onClick={() => router.back()} className="px-6 py-2 border-2 border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>GO BACK</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{shareTitle}</title>
        <meta name="description" content={shareDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={shareTitle} />
        <meta property="twitter:description" content={shareDescription} />
        <meta property="twitter:image" content={shareImage} />

        {/* Additional meta tags */}
        <meta property="og:site_name" content="Sourced" />
        <meta name="twitter:site" content="@sourced" />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        input, textarea, select { font-size: 16px !important; }
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-0">
        {/* Header */}
        <div className="border-b border-black/20 p-4 md:p-10">
          <div className="max-w-7xl mx-auto">
            <button onClick={() => router.back()} className="mb-4 md:mb-6 text-xs tracking-wider opacity-60 hover:opacity-100 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>← BACK</button>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <div className="w-full md:w-64 aspect-square md:h-64 flex-shrink-0 border-2 border-black overflow-hidden relative group">
                {catalog.image_url ? (
                  <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                    <span className="text-6xl opacity-20">✦</span>
                  </div>
                )}
                {isOwner && (
                  <button
                    onClick={openEditCatalogModal}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <span className="text-white text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>EDIT</span>
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-3 md:space-y-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tighter flex-1" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{catalog.name}</h1>
                  {isOwner && (
                    <button
                      onClick={openEditCatalogModal}
                      className="px-3 md:px-4 py-1.5 md:py-2 border-2 border-black/20 hover:border-black hover:bg-black/5 transition-all text-[10px] md:text-xs tracking-[0.3em] font-black flex-shrink-0"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      EDIT
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity w-fit" onClick={() => router.push(`/${catalog.owner.username}`)}>
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-black overflow-hidden">
                    {catalog?.owner?.avatar_url ? (
                      <img src={catalog.owner.avatar_url} alt={catalog.owner.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-black/5 flex items-center justify-center">
                        <span className="text-xs opacity-20">👤</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>@{catalog?.owner?.username || 'Unknown'}</p>
                    {catalog?.owner?.full_name && <p className="text-[10px] md:text-xs opacity-60">{catalog.owner.full_name}</p>}
                  </div>
                </div>

                {catalog.description && <p className="text-xs md:text-sm leading-relaxed opacity-80 max-w-2xl">{catalog.description}</p>}

                <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-xs tracking-wider opacity-60">
                  <span>{items.length} ITEMS</span>
                  <span>♥ {totalLikes}</span>
                  <span>🔖 {catalog.bookmark_count}</span>
                  <span className={`px-2 py-1 ${catalog.visibility === 'public' ? 'bg-black text-white' : 'bg-black/10 text-black'} text-[8px] tracking-[0.3em]`}>{catalog.visibility.toUpperCase()}</span>
                </div>

                <div className="flex gap-2 md:gap-3 pt-2">
                  {isOwner ? (
                    <>
                      <button onClick={() => setShowAddItemModal(true)} className="px-4 md:px-6 py-2 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-[10px] md:text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ADD ITEM</button>
                      {selectedItems.size > 0 && (
                        <>
                          <button onClick={selectAll} className="px-4 md:px-6 py-2 border-2 border-black hover:bg-black/5 transition-all text-[10px] md:text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {selectedItems.size === filteredItems.length ? 'DESELECT' : 'SELECT ALL'}
                          </button>
                          <button onClick={deleteSelectedItems} className="px-4 md:px-6 py-2 bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] md:text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DELETE ({selectedItems.size})</button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <button onClick={toggleBookmark} className={`px-4 md:px-6 py-2 border-2 transition-all text-[10px] md:text-xs tracking-[0.4em] font-black ${isBookmarked ? 'bg-black text-white border-black hover:bg-white hover:text-black' : 'border-black text-black hover:bg-black hover:text-white'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{isBookmarked ? '🔖 BOOKMARKED' : 'BOOKMARK'}</button>
                    </>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        if (navigator.share) {
                          // Try to share with image for Instagram/Snapchat
                          if (catalog?.image_url && navigator.canShare) {
                            try {
                              console.log('🖼️ Attempting to share with image:', catalog.image_url);

                              // Fetch the image
                              const response = await fetch(catalog.image_url, {
                                mode: 'cors',
                                credentials: 'omit'
                              });
                              console.log('✅ Image fetched, status:', response.status);

                              const blob = await response.blob();
                              console.log('✅ Blob created, type:', blob.type, 'size:', blob.size);

                              const file = new File([blob], `${catalog.name.replace(/[^a-z0-9]/gi, '-')}.jpg`, {
                                type: 'image/jpeg'
                              });
                              console.log('✅ File created:', file.name);

                              // Check if we can share files
                              const canShareFiles = navigator.canShare({ files: [file] });
                              console.log('📤 Can share files?', canShareFiles);

                              if (canShareFiles) {
                                console.log('🚀 Sharing with image...');
                                await navigator.share({
                                  files: [file],
                                  title: shareTitle,
                                  text: shareDescription,
                                  url: window.location.href,
                                });
                                console.log('✅ Share completed!');
                                return;
                              } else {
                                console.log('❌ Cannot share files on this platform');
                              }
                            } catch (imageError) {
                              console.error('❌ Image share failed:', imageError);
                            }
                          }

                          // Fallback to URL-only share
                          console.log('📤 Sharing URL only...');
                          await navigator.share({
                            url: window.location.href,
                          });
                        } else {
                          // Desktop fallback
                          await navigator.clipboard.writeText(window.location.href);
                          alert('Link copied to clipboard!');
                        }
                      } catch (err) {
                        console.error('❌ Share error:', err);
                        if (err instanceof Error && err.name !== 'AbortError') {
                          try {
                            await navigator.clipboard.writeText(window.location.href);
                            alert('Link copied to clipboard!');
                          } catch {
                            console.error('Failed to copy link');
                          }
                        }
                      }
                    }}
                    className="px-4 md:px-6 py-2 border-2 border-black hover:bg-black hover:text-white transition-all text-[10px] md:text-xs tracking-[0.4em] font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    SHARE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        {items.length > 0 && (
          <div className="border-b border-black/10 bg-white/95 backdrop-blur-md sticky top-0 z-30">
            <div className="max-w-7xl mx-auto p-3 md:p-4">
              <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <div className="flex-1 md:max-w-md">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search items..."
                    className="w-full px-3 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-sm"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 border border-black/10 focus:border-black/30 focus:outline-none text-xs tracking-wider font-black bg-white"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  <option value="recent">RECENT</option>
                  <option value="oldest">OLDEST</option>
                  <option value="most_liked">MOST LIKED</option>
                  <option value="title">TITLE</option>
                </select>

                <div className="hidden md:flex border border-black/10">
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
                    onClick={() => setViewMode('compact')}
                    className={`p-2 border-l border-black/10 ${viewMode === 'compact' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                    title="Compact view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {searchQuery && (
                <p className="text-[10px] opacity-40 mt-2">
                  {filteredItems.length} of {items.length} items
                </p>
              )}
            </div>
          </div>
        )}

        {/* Items Grid */}
        <div className="p-4 md:p-10">
          <div className="max-w-7xl mx-auto">
            {filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {items.length === 0 ? 'NO ITEMS YET' : 'NO RESULTS'}
                </p>
                <p className="text-sm tracking-wide opacity-30 mt-2">
                  {items.length === 0
                    ? (isOwner ? "Add your first item to get started" : "This catalog is empty")
                    : "Try adjusting your search"
                  }
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="group border border-black/20 hover:border-black transition-all relative">
                    {isOwner && (
                      <div className="absolute top-2 left-2 z-20">
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItemSelection(item.id)} className="w-5 h-5 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                      </div>
                    )}

                    <div
                      className="aspect-square bg-white overflow-hidden cursor-pointer relative"
                      onClick={() => handleItemClick(item)}
                    >
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      {item.like_count > 0 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">♥ {item.like_count}</div>
                      )}
                    </div>

                    <div className="p-3 bg-white border-t border-black/20 cursor-pointer hover:bg-black/5 transition-all hidden md:block" onClick={() => setExpandedItem(item)}>
                      <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</h3>
                      <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-2">
                        {item.seller && <span className="truncate">{item.seller}</span>}
                        {item.price && <span className="ml-auto">${item.price}</span>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleLike(item.id, item.is_liked); }} className="w-full py-1 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs">{item.is_liked ? '♥' : '♡'} LIKE</button>
                    </div>

                    <div className="md:hidden bg-white border-t border-black/20">
                      <div className="p-3">
                        <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</h3>
                        <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-2">
                          {item.seller && <span className="truncate">{item.seller}</span>}
                          {item.price && <span className="ml-auto">${item.price}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleLike(item.id, item.is_liked); }} className="flex-1 py-1 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs">{item.is_liked ? '♥' : '♡'}</button>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }} className="px-3 py-1 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs">⊕</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 md:gap-4 p-2 md:p-3 border border-black/10 hover:border-black/30 transition-all"
                  >
                    {isOwner && (
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="w-5 h-5 cursor-pointer flex-shrink-0"
                      />
                    )}

                    <div
                      className="w-12 h-12 md:w-16 md:h-16 bg-black/5 flex-shrink-0 cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs md:text-sm font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</h3>
                      <div className="flex items-center gap-3 text-[10px] opacity-60">
                        {item.seller && <span>{item.seller}</span>}
                        {item.price && <span>${item.price}</span>}
                        <span>♥ {item.like_count}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleLike(item.id, item.is_liked)}
                        className="px-3 py-1 border border-black/20 hover:border-black text-xs"
                      >
                        {item.is_liked ? '♥' : '♡'}
                      </button>
                      <button
                        onClick={() => setExpandedItem(item)}
                        className="px-3 py-1 border border-black/20 hover:border-black text-xs"
                      >
                        ⊕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Edit Catalog Modal */}
        {showEditCatalogModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm md:max-w-md relative">
              <button
                onClick={() => setShowEditCatalogModal(false)}
                className="absolute -top-8 md:-top-10 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="border border-white p-4 md:p-6 bg-black relative text-white max-h-[80vh] overflow-y-auto">
                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-1">
                    <div className="text-[9px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>EDIT CATALOG</div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>UPDATE DETAILS</h2>
                  </div>

                  <form onSubmit={handleEditCatalog} className="space-y-3 md:space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NAME *</label>
                      <input
                        type="text"
                        value={editCatalogName}
                        onChange={(e) => setEditCatalogName(e.target.value)}
                        placeholder="Catalog name"
                        className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none transition-all text-white placeholder-white/40 text-sm"
                        style={{ fontSize: '16px' }}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DESCRIPTION</label>
                      <textarea
                        value={editCatalogDescription}
                        onChange={(e) => setEditCatalogDescription(e.target.value)}
                        placeholder="Catalog description..."
                        rows={3}
                        className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none transition-all text-white placeholder-white/40 text-sm resize-none"
                        style={{ fontSize: '16px' }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>COVER IMAGE</label>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditCatalogMethod('keep');
                            setEditCatalogImageUrl('');
                            setEditCatalogFile(null);
                            setEditCatalogPreview(catalog.image_url);
                          }}
                          className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${
                            editCatalogMethod === 'keep' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          KEEP CURRENT
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCatalogMethod('file');
                            setEditCatalogImageUrl('');
                            setEditCatalogPreview(null);
                          }}
                          className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${
                            editCatalogMethod === 'file' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          UPLOAD NEW
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCatalogMethod('url');
                            setEditCatalogFile(null);
                            setEditCatalogPreview(null);
                          }}
                          className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${
                            editCatalogMethod === 'url' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          IMAGE URL
                        </button>
                      </div>
                    </div>

                    {editCatalogMethod === 'file' && (
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditCatalogFileSelect}
                          className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none text-white text-xs file:mr-4 file:py-1 file:px-2 file:border-0 file:bg-white file:text-black file:text-[10px] file:tracking-wider file:font-black"
                        />
                        <p className="text-[9px] tracking-wider opacity-40">Max 5MB</p>
                      </div>
                    )}

                    {editCatalogMethod === 'url' && (
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={editCatalogImageUrl}
                          onChange={(e) => handleEditCatalogImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none transition-all text-white placeholder-white/40 text-sm"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                    )}

                    {editCatalogPreview && (
                      <div className="flex items-center gap-3 p-2 border border-white/20">
                        <img
                          src={editCatalogPreview}
                          alt="Preview"
                          className="w-16 h-16 border border-white object-cover"
                        />
                        <span className="text-[10px] opacity-60">Preview</span>
                      </div>
                    )}

                    {editCatalogError && (
                      <p className="text-red-400 text-xs tracking-wide">{editCatalogError}</p>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowEditCatalogModal(false)}
                        className="flex-1 py-2.5 border border-white text-white hover:bg-white hover:text-black transition-all text-[10px] tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CANCEL
                      </button>

                      <button
                        type="submit"
                        disabled={editingCatalog || !editCatalogName.trim()}
                        className="flex-1 py-2.5 bg-white text-black hover:bg-black hover:text-white hover:border hover:border-white transition-all text-[10px] tracking-[0.4em] font-black disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {editingCatalog ? 'UPDATING...' : 'UPDATE'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Item Modal */}
        {expandedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setExpandedItem(null)}>
            <div className="relative w-full max-w-sm md:max-w-3xl max-h-[85vh] md:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setExpandedItem(null)} className="absolute -top-8 md:-top-12 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>[ESC]</button>

              <div className="bg-white border-2 border-white overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  <div
                    className="aspect-square bg-black/5 overflow-hidden cursor-pointer"
                    onClick={() => handleItemClick(expandedItem)}
                  >
                    <img src={expandedItem.image_url} alt={expandedItem.title} className="w-full h-full object-contain" />
                  </div>

                  <div className="p-4 md:p-8 space-y-3 md:space-y-6">
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{expandedItem.title}</h2>
                    {expandedItem.seller && <p className="text-xs md:text-sm tracking-wider opacity-60">SELLER: {expandedItem.seller}</p>}
                    {expandedItem.price && <p className="text-lg md:text-2xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>${expandedItem.price}</p>}

                    <div className="space-y-2 md:space-y-3">
                      <button onClick={() => toggleLike(expandedItem.id, expandedItem.is_liked)} className="w-full py-2 md:py-3 border-2 border-black hover:bg-black hover:text-white transition-all text-[10px] md:text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{expandedItem.is_liked ? '♥ LIKED' : '♡ LIKE'} ({expandedItem.like_count})</button>

                      {expandedItem.product_url && (
                        <button
                          onClick={() => handleItemClick(expandedItem)}
                          className="w-full py-2 md:py-3 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-[10px] md:text-xs tracking-[0.4em] font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          VIEW PRODUCT ↗
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Item Modal */}
        {showAddItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm md:max-w-md relative">
              <button onClick={() => { setShowAddItemModal(false); resetAddItemForm(); }} className="absolute -top-8 md:-top-10 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>[ESC]</button>

              <div className="border border-white p-4 md:p-6 bg-black relative text-white max-h-[80vh] overflow-y-auto">
                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-1">
                    <div className="text-[9px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ADD ITEM</div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>NEW ITEM</h2>
                  </div>

                  <form onSubmit={handleAddItem} className="space-y-3 md:space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>TITLE *</label>
                      <input type="text" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder="Item name" className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none transition-all text-white placeholder-white/40 text-sm" style={{ fontSize: '16px' }} required />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>IMAGE *</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setUploadMethod('file'); setItemImageUrl(''); setPreviewUrl(null); }} className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${uploadMethod === 'file' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>UPLOAD FILE</button>
                        <button type="button" onClick={() => { setUploadMethod('url'); setSelectedFile(null); setPreviewUrl(null); }} className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${uploadMethod === 'url' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>IMAGE URL</button>
                      </div>
                    </div>

                    {uploadMethod === 'file' && (
                      <div className="space-y-2">
                        <input type="file" accept="image/*" onChange={handleFileSelect} className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none text-white text-xs file:mr-4 file:py-1 file:px-2 file:border-0 file:bg-white file:text-black file:text-[10px] file:tracking-wider file:font-black" />
                        <p className="text-[9px] tracking-wider opacity-40">Max 5MB</p>
                      </div>
                    )}

                    {uploadMethod === 'url' && (
                      <div className="space-y-2">
                        <input type="url" value={itemImageUrl} onChange={(e) => handleImageUrlChange(e.target.value)} placeholder="https://example.com/image.jpg" className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none transition-all text-white placeholder-white/40 text-sm" style={{ fontSize: '16px' }} />
                      </div>
                    )}

                    {((uploadMethod === 'url' && itemImageUrl && !imageError) || (uploadMethod === 'file' && previewUrl)) && (
                      <div className="flex items-center gap-3 p-2 border border-white/20">
                        <img src={uploadMethod === 'url' ? itemImageUrl : previewUrl!} alt="Preview" className="w-12 h-12 border border-white object-cover" />
                        <span className="text-[10px] opacity-60">Preview</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>PRODUCT URL *</label>
                      <input type="url" value={itemProductUrl} onChange={(e) => handleProductUrlChange(e.target.value)} placeholder="https://..." className={`w-full px-0 py-2 bg-transparent border-b focus:outline-none text-white placeholder-white/40 text-sm ${productUrlError ? 'border-red-400' : 'border-white'}`} style={{ fontSize: '16px' }} required />
                      {productUrlError && <p className="text-red-400 text-[10px] tracking-wide">{productUrlError}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>SELLER (AUTO-FILLED)</label>
                      <input type="text" value={itemSeller} onChange={(e) => setItemSeller(e.target.value)} placeholder="Store name" className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none transition-all text-white placeholder-white/40 text-sm" style={{ fontSize: '16px' }} />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>PRICE (OPTIONAL)</label>
                      <input type="text" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="$99" className="w-full px-0 py-2 bg-transparent border-b border-white focus:outline-none text-white placeholder-white/40 text-sm" style={{ fontSize: '16px' }} />
                    </div>

                    {imageError && <p className="text-red-400 text-xs tracking-wide">{imageError}</p>}
                    {creatingStatus && <p className="text-white/60 text-xs tracking-wide">{creatingStatus}</p>}

                    <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => { setShowAddItemModal(false); resetAddItemForm(); }} className="flex-1 py-2.5 border border-white text-white hover:bg-white hover:text-black transition-all text-[10px] tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CANCEL</button>

                      <button type="submit" disabled={creating || !canSubmit} className="flex-1 py-2.5 bg-white text-black hover:bg-black hover:text-white hover:border hover:border-white transition-all text-[10px] tracking-[0.4em] font-black disabled:opacity-30 disabled:cursor-not-allowed" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {creating ? (creatingStatus || 'ADDING...') : 'ADD ITEM'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white border-2 border-black p-6 md:p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>DELETE ITEMS?</h2>
                  <p className="text-sm opacity-60">You're about to delete {deleteCount} item{deleteCount > 1 ? 's' : ''}. This action cannot be undone.</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 border border-black/20 hover:bg-black/5 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CANCEL</button>
                  <button onClick={confirmDelete} className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DELETE</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Message */}
        {showLoginMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 md:top-auto md:bottom-6 md:right-6 md:left-auto md:translate-x-0 z-[9999] w-[calc(100%-2rem)] max-w-sm">
            <div className="bg-black border-2 border-white p-4 shadow-lg relative">
              <button onClick={() => setShowLoginMessage(false)} className="absolute top-2 right-2 text-white hover:opacity-50 transition-opacity text-lg leading-none">✕</button>
              <p className="text-white text-sm tracking-wide pr-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>YOU MUST BE LOGGED IN TO ACCESS LIKES AND BOOKMARKS</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}