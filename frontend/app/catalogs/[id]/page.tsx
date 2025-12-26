"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";

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
};

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

    // Get domain without www
    let domain = urlObj.hostname.replace(/^www\./i, '');

    // Get the main domain part (second-level domain)
    // Examples:
    // - "grailed.com" -> "grailed"
    // - "depop.com" -> "depop"
    // - "shop.nike.com" -> "nike"
    // - "ssense.com" -> "ssense"
    const parts = domain.split('.');
    let seller = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

    // Capitalize first letter
    return seller.charAt(0).toUpperCase() + seller.slice(1);
  } catch {
    return '';
  }
}



export default function CatalogDetailPage() {
  const router = useRouter();
  const params = useParams();
  const catalogId = params.id as string;

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<CatalogItem | null>(null);

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

  const isOwner = currentUserId === catalog?.owner_id;

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (catalogId) {
      loadCatalog();
      loadItems();
    }
  }, [catalogId, currentUserId]);

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
          id, name, description, image_url, visibility, owner_id, bookmark_count,
          profiles!catalogs_owner_id_fkey(username, full_name, avatar_url)
        `)
        .eq('id', catalogId)
        .single();

      if (error) throw error;

      const catalogData: CatalogData = {
        ...data,
        owner: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
      };

      setCatalog(catalogData);

      if (currentUserId) {
        const { data: bookmarkData } = await supabase
          .from('bookmarked_catalogs')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('catalog_id', catalogId)
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
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('catalog_id', catalogId)
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

  async function toggleBookmark() {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
      return;
    }

    try {
      if (isBookmarked) {
        await supabase.from('bookmarked_catalogs').delete()
          .eq('user_id', currentUserId).eq('catalog_id', catalogId);
      } else {
        await supabase.from('bookmarked_catalogs')
          .insert({ user_id: currentUserId, catalog_id: catalogId });
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

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be smaller than 5MB');
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

      if (!finalImageUrl) {
        setImageError('Image is required');
        setCreating(false);
        return;
      }

      setCreatingStatus('Categorizing with AI...');

      const requestBody = {
        catalog_id: catalogId,
        title: itemTitle.trim(),
        image_url: finalImageUrl,
        product_url: itemProductUrl.trim(),
        seller: itemSeller.trim() || null,
        price: itemPrice.trim() || null,
        user_id: currentUserId
      };

      console.log('Sending request:', requestBody);

      const response = await fetch(`https://sourced-5ovn.onrender.com/create-catalog-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);

      let result;
      try {
        result = await response.json();
        console.log('Response data:', result);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Server returned invalid response');
      }

      if (!response.ok) {
        throw new Error(result.detail || `Server error: ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to create item');
      }

      console.log('✅ Item created successfully!');
      console.log('AI Metadata:', result.metadata);

      resetAddItemForm();
      setShowAddItemModal(false);
      await loadItems();

    } catch (error: any) {
      console.error('❌ Error adding item:', error);

      let errorMessage = error.message || 'Failed to add item';

      if (errorMessage.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Make sure backend is running.';
      } else if (errorMessage.includes('Network')) {
        errorMessage = 'Network error. Check your connection.';
      }

      setImageError(errorMessage);
    } finally {
      setCreating(false);
      setCreatingStatus('');
    }
  }

  const canSubmit = itemTitle.trim() &&
                   itemProductUrl.trim() &&
                   ((uploadMethod === 'file' && selectedFile) ||
                    (uploadMethod === 'url' && itemImageUrl.trim()));

  if (loading) {
    return (
      <>
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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        input, textarea, select { font-size: 16px !important; }
      `}</style>

      <div className="min-h-screen bg-white text-black pb-24 md:pb-0">
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <button onClick={() => router.back()} className="mb-6 text-xs tracking-wider opacity-60 hover:opacity-100 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>← BACK</button>

            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-64 h-64 flex-shrink-0 border-2 border-black overflow-hidden">
                {catalog.image_url ? (
                  <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                    <span className="text-6xl opacity-20">✦</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{catalog.name}</h1>

                <div className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity w-fit" onClick={() => router.push(`/profiles/${catalog.owner_id}`)}>
                  <div className="w-10 h-10 border border-black overflow-hidden">
                    {catalog?.owner?.avatar_url ? (
                      <img src={catalog.owner.avatar_url} alt={catalog.owner.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-black/5 flex items-center justify-center">
                        <span className="text-xs opacity-20">👤</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>@{catalog?.owner?.username || 'Unknown'}</p>
                    {catalog?.owner?.full_name && <p className="text-xs opacity-60">{catalog.owner.full_name}</p>}
                  </div>
                </div>

                {catalog.description && <p className="text-sm leading-relaxed opacity-80 max-w-2xl">{catalog.description}</p>}

                <div className="flex items-center gap-6 text-xs tracking-wider opacity-60">
                  <span>{items.length} ITEMS</span>
                  <span>🔖 {catalog.bookmark_count} BOOKMARKS</span>
                  <span className={`px-2 py-1 ${catalog.visibility === 'public' ? 'bg-black text-white' : 'bg-black/10 text-black'} text-[8px] tracking-[0.3em]`}>{catalog.visibility.toUpperCase()}</span>
                </div>

                <div className="flex gap-3 pt-2">
                  {isOwner ? (
                    <>
                      <button onClick={() => setShowAddItemModal(true)} className="px-4 py-2 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ADD ITEM</button>
                      {selectedItems.size > 0 && (
                        <button onClick={deleteSelectedItems} className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DELETE ({selectedItems.size})</button>
                      )}
                    </>
                  ) : (
                    <button onClick={toggleBookmark} className={`px-4 py-2 border-2 transition-all text-xs tracking-[0.4em] font-black ${isBookmarked ? 'bg-black text-white border-black hover:bg-white hover:text-black' : 'border-black text-black hover:bg-black hover:text-white'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{isBookmarked ? '🔖 BOOKMARKED' : 'BOOKMARK'}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {items.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NO ITEMS YET</p>
                <p className="text-sm tracking-wide opacity-30 mt-2">{isOwner ? "Add your first item to get started" : "This catalog is empty"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {items.map((item) => (
                  <div key={item.id} className="group border border-black/20 hover:border-black transition-all relative">
                    {isOwner && (
                      <div className="absolute top-2 left-2 z-20">
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItemSelection(item.id)} className="w-5 h-5 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                      </div>
                    )}

                    <div className="aspect-square bg-white overflow-hidden cursor-pointer relative" onClick={() => { if (item.product_url) window.open(item.product_url, '_blank'); }}>
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      {item.like_count > 0 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">♥ {item.like_count}</div>
                      )}
                    </div>

                    <div className="p-3 bg-white border-t border-black/20 cursor-pointer hover:bg-black/5 transition-all hidden md:block" onClick={() => setExpandedItem(item)}>
                      <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</h3>
                      <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-2">
                        {item.seller && <span className="truncate">{item.seller}</span>}
                        {item.price && <span className="ml-auto">{item.price}</span>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleLike(item.id, item.is_liked); }} className="w-full py-1 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs">{item.is_liked ? '♥' : '♡'} LIKE</button>
                    </div>

                    <div className="md:hidden bg-white border-t border-black/20">
                      <div className="p-3">
                        <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</h3>
                        <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-2">
                          {item.seller && <span className="truncate">{item.seller}</span>}
                          {item.price && <span className="ml-auto">{item.price}</span>}
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
            )}
          </div>
        </div>

        {expandedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setExpandedItem(null)}>
            <div className="relative w-full max-w-sm md:max-w-3xl max-h-[85vh] md:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setExpandedItem(null)} className="absolute -top-8 md:-top-12 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>[ESC]</button>

              <div className="bg-white border-2 border-white overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="aspect-square bg-black/5 overflow-hidden cursor-pointer" onClick={() => { if (expandedItem.product_url) window.open(expandedItem.product_url, '_blank'); }}>
                    <img src={expandedItem.image_url} alt={expandedItem.title} className="w-full h-full object-contain" />
                  </div>

                  <div className="p-4 md:p-8 space-y-3 md:space-y-6">
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{expandedItem.title}</h2>
                    {expandedItem.seller && <p className="text-xs md:text-sm tracking-wider opacity-60">SELLER: {expandedItem.seller}</p>}
                    {expandedItem.price && <p className="text-lg md:text-2xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{expandedItem.price}</p>}

                    <div className="space-y-2 md:space-y-3">
                      <button onClick={() => toggleLike(expandedItem.id, expandedItem.is_liked)} className="w-full py-2 md:py-3 border-2 border-black hover:bg-black hover:text-white transition-all text-[10px] md:text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{expandedItem.is_liked ? '♥ LIKED' : '♡ LIKE'} ({expandedItem.like_count})</button>

                      {expandedItem.product_url && (
                        <button onClick={() => window.open(expandedItem.product_url!, '_blank')} className="w-full py-2 md:py-3 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-[10px] md:text-xs tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>VIEW PRODUCT ↗</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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