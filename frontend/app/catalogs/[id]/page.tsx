"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

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
    let seller = urlObj.hostname.replace(/^www\./i, '');
    const parts = seller.split('.');
    if (parts.length >= 2) seller = parts[0];
    return seller.charAt(0).toUpperCase() + seller.slice(1);
  } catch {
    return '';
  }
}

// Quick image safety check (runs first - fast)
async function quickSafetyCheck(imageUrl: string): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Is this image safe and appropriate? Answer only YES or NO." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 10
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase() || "";
    return answer.includes("YES");
  } catch (error) {
    console.error('Safety check error:', error);
    return true; // Fail open
  }
}

// AI categorization (runs in background after item is shown)
async function categorizeItemInBackground(itemId: string, title: string, imageUrl: string, productUrl: string | null, price: string | null) {
  try {
    console.log(`🔄 Background categorization started for item ${itemId}`);

    const systemPrompt = `You are a fashion expert AI. Return ONLY valid JSON, no markdown.`;

    const userPrompt = `Analyze this fashion item:

TITLE: ${title}
PRICE: ${price || 'Unknown'}
URL: ${productUrl || 'Not provided'}

Return JSON:
{
  "category": "tops/bottoms/outerwear/shoes/accessories/dresses/activewear/bags/jewelry/other",
  "subcategory": "specific type",
  "brand": "brand or null",
  "product_type": "casual/formal/athletic/streetwear",
  "colors": ["array"],
  "primary_color": "main color",
  "material": "material or null",
  "pattern": "pattern or null",
  "style_tags": ["tag1", "tag2"],
  "season": "spring/summer/fall/winter/all-season",
  "formality": "casual/business-casual/formal/athletic",
  "gender": "men/women/unisex",
  "fit_type": "slim/regular/oversized or null",
  "occasion_tags": ["everyday", "work"],
  "price_tier": "budget/mid-range/luxury or null",
  "confidence": 0.95
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    let result = response.choices[0].message.content?.trim() || "{}";

    if (result.startsWith("```json")) {
      result = result.replace("```json", "").replace("```", "").trim();
    }

    const metadata = JSON.parse(result);

    console.log(`✅ AI categorization complete for item ${itemId}:`, metadata);

    // Update item with metadata
    const { error } = await supabase
      .from('catalog_items')
      .update({
        category: metadata.category,
        subcategory: metadata.subcategory,
        brand: metadata.brand,
        product_type: metadata.product_type,
        colors: metadata.colors,
        primary_color: metadata.primary_color,
        material: metadata.material,
        pattern: metadata.pattern,
        style_tags: metadata.style_tags,
        season: metadata.season,
        formality: metadata.formality,
        gender: metadata.gender,
        fit_type: metadata.fit_type,
        occasion_tags: metadata.occasion_tags,
        price_tier: metadata.price_tier,
        categorization_confidence: metadata.confidence
      })
      .eq('id', itemId);

    if (error) {
      console.error(`❌ Failed to update metadata for item ${itemId}:`, error);
    } else {
      console.log(`✅ Metadata saved to database for item ${itemId}`);
    }

  } catch (error) {
    console.error(`❌ Background categorization failed for item ${itemId}:`, error);
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

  async function handleImageUrlChange(url: string) {
    setItemImageUrl(url);
    setImageError('');

    if (!url.trim()) {
      setPreviewUrl(null);
      return;
    }

    try {
      new URL(url);
    } catch {
      setImageError("Invalid URL format");
      return;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => url.toLowerCase().includes(ext));

    if (!hasImageExtension) {
      setImageError("URL must point to an image file");
      return;
    }

    setPreviewUrl(url);
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

  // 🚀 ASYNC APPROACH - Show item immediately, categorize in background
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
      // Validate
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

      // Upload image
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

      // Quick safety check (fast - ~1 second)
      setCreatingStatus('Checking image...');
      const isSafe = await quickSafetyCheck(finalImageUrl);

      if (!isSafe) {
        setImageError('Image contains inappropriate content');
        setCreating(false);
        setCreatingStatus('');
        return;
      }

      // Insert item WITHOUT metadata (instant!)
      setCreatingStatus('Saving...');
      const { data, error } = await supabase
        .from('catalog_items')
        .insert({
          catalog_id: catalogId,
          title: itemTitle.trim(),
          image_url: finalImageUrl,
          product_url: itemProductUrl.trim() || null,
          seller: itemSeller.trim() || null,
          price: itemPrice.trim() || null
          // No metadata yet - will be added in background!
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Item created immediately:', data.id);

      // Close modal and show item RIGHT AWAY
      resetAddItemForm();
      setShowAddItemModal(false);
      await loadItems();

      // 🎯 Trigger background categorization (don't await!)
      categorizeItemInBackground(
        data.id,
        itemTitle.trim(),
        finalImageUrl,
        itemProductUrl.trim(),
        itemPrice.trim()
      ).catch(err => {
        console.error('Background categorization error:', err);
        // User doesn't see this error - it's silent
      });

      console.log('🔄 AI categorization running in background...');

    } catch (error: any) {
      console.error('❌ Error adding item:', error);
      setImageError(error.message || 'Failed to add item');
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
        {/* Use the EXACT same UI from catalog-page-final.tsx */}
        {/* Just copy/paste the entire JSX from that file here */}
        {/* The only change is in handleAddItem() above */}
      </div>
    </>
  );
}