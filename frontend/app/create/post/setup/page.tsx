"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

export default function CreatePostPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Step management
  const [step, setStep] = useState<'upload' | 'details'>('upload');

  // Image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Post data
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<any[]>([]);

  // Item adding state
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [selectedItemFile, setSelectedItemFile] = useState<File | null>(null);
  const [itemPreviewUrl, setItemPreviewUrl] = useState<string | null>(null);
  const [itemUploadMethod, setItemUploadMethod] = useState<'url' | 'file'>('file');
  const [itemProductUrl, setItemProductUrl] = useState("");
  const [itemSeller, setItemSeller] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [generatingItem, setGeneratingItem] = useState(false);
  const [itemError, setItemError] = useState("");
  const [itemCreatingStatus, setItemCreatingStatus] = useState("");

  // UI state
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showShopPreview, setShowShopPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Drag state for panning
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url, is_verified')
        .eq('id', user.id)
        .single();
      setCurrentUsername(profile?.username || null);
      setCurrentUserAvatar(profile?.avatar_url || null);
      setIsVerified(profile?.is_verified || false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!imagePreview) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setCrop({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (!imagePreview) return;
    e.preventDefault(); // Prevent page scroll
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - crop.x, y: touch.clientY - crop.y });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return;
    e.preventDefault(); // Prevent page scroll
    const touch = e.touches[0];
    setCrop({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
  }

  function handleTouchEnd() {
    setIsDragging(false);
  }

  function handleItemFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setItemError('Please select an image file');
      return;
    }

    setSelectedItemFile(file);
    setItemError('');

    const reader = new FileReader();
    reader.onload = (e) => setItemPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleItemImageUrlChange(url: string) {
    setItemImageUrl(url);
    setItemError('');
    setItemPreviewUrl(url.trim() ? url : null);
  }

  function handleItemProductUrlChange(url: string) {
    setItemProductUrl(url);
    setItemError('');

    if (url.trim()) {
      const extractedSeller = extractSellerFromUrl(url);
      if (extractedSeller) setItemSeller(extractedSeller);
    }
  }

  function resetItemForm() {
    setItemTitle('');
    setItemImageUrl('');
    setSelectedItemFile(null);
    setItemPreviewUrl(null);
    setItemProductUrl('');
    setItemSeller('');
    setItemPrice('');
    setItemError('');
    setItemUploadMethod('file');
    setItemCreatingStatus('');
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUserId) {
      setItemError('You must be logged in');
      return;
    }

    setGeneratingItem(true);
    setItemError('');

    try {
      if (!itemProductUrl.trim()) {
        setItemError('Product URL is required');
        setGeneratingItem(false);
        return;
      }

      try {
        new URL(itemProductUrl);
      } catch {
        setItemError('Please enter a valid URL');
        setGeneratingItem(false);
        return;
      }

      let finalImageUrl = itemImageUrl;

      // Handle file upload
      if (itemUploadMethod === 'file' && selectedItemFile) {
        setItemCreatingStatus('Uploading image...');
        const uploadResult = await uploadItemImageToStorage(selectedItemFile, currentUserId);

        if (!uploadResult.url) {
          setItemError(uploadResult.error || "Failed to upload image");
          setGeneratingItem(false);
          setItemCreatingStatus('');
          return;
        }

        finalImageUrl = uploadResult.url;
      }
      // Handle external URL
      else if (itemUploadMethod === 'url' && itemImageUrl) {
        setItemCreatingStatus('Saving image to storage...');
        try {
          const response = await fetch(itemImageUrl);

          if (!response.ok) {
            throw new Error('Failed to fetch image');
          }

          const blob = await response.blob();
          const file = new File([blob], `item-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

          const uploadResult = await uploadItemImageToStorage(file, currentUserId);

          if (!uploadResult.url) {
            setItemError(uploadResult.error || "Failed to save image");
            setGeneratingItem(false);
            setItemCreatingStatus('');
            return;
          }

          finalImageUrl = uploadResult.url;
        } catch (err: any) {
          console.error('Error saving image:', err);
          setItemError("Failed to save image from URL. Make sure the URL is accessible.");
          setGeneratingItem(false);
          setItemCreatingStatus('');
          return;
        }
      }

      if (!finalImageUrl) {
        setItemError('Image is required');
        setGeneratingItem(false);
        return;
      }

      setItemCreatingStatus('Adding item...');

      // Add to items array
      setItems([...items, {
        temp_id: Date.now(),
        title: itemTitle.trim(),
        image_url: finalImageUrl,
        product_url: itemProductUrl.trim(),
        price: itemPrice.trim() || null,
        seller: itemSeller.trim() || null,
        category: null
      }]);

      resetItemForm();
      setShowItemForm(false);

    } catch (error: any) {
      console.error('Error adding item:', error);
      setItemError(error.message || 'Failed to add item');
    } finally {
      setGeneratingItem(false);
      setItemCreatingStatus('');
    }
  }

  async function uploadImageToStorage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);

    return publicUrl;
  }

  async function uploadItemImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `item-${userId}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('post-items')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) return { url: null, error: error.message };

      const { data: { publicUrl } } = supabase.storage
        .from('post-items')
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

  async function createPost() {
    if (!selectedFile || !currentUserId) {
      setError('Please select an image');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const imageUrl = await uploadImageToStorage(selectedFile);

      const { data: postData, error: postError } = await supabase
        .from('feed_posts')
        .insert({
          owner_id: currentUserId,
          image_url: imageUrl,
          caption: caption.trim() || null,
          music_track_id: null,
          music_preview_url: null,
          music_track_name: null,
          music_artist: null,
          music_album_art: null
        })
        .select()
        .single();

      if (postError) throw postError;

      if (items.length > 0) {
        const itemsToInsert = items.map((item, idx) => ({
          feed_post_id: postData.id,
          title: item.title,
          image_url: item.image_url,
          product_url: item.product_url,
          price: item.price,
          seller: item.seller,
          category: item.category,
          position_index: idx
        }));

        const { error: itemsError } = await supabase
          .from('feed_post_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      router.push('/feed');

    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message || 'Failed to create post');
    } finally {
      setCreating(false);
    }
  }

  const canPost = selectedFile && currentUserId;

  return (
    <>
      <Head><title>Create Post | Sourced</title></Head>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        * {
          -webkit-tap-highlight-color: transparent;
        }

        body {
          font-family: 'Bebas Neue', sans-serif;
          background: #000;
          overflow: hidden;
        }

        .no-select {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* STEP 1: UPLOAD & ADJUST IMAGE */}
      {step === 'upload' && (
        <div className="fixed inset-0 bg-black flex flex-col">
          {/* Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {imagePreview && (
              <>
                <div
                  className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000"
                  style={{
                    backgroundImage: `url(${imagePreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
              </>
            )}
          </div>

          {/* Header */}
          <div className="relative z-30 bg-black">
            <div className="flex items-center justify-between px-4 pt-3 pb-3">
              <button
                onClick={() => router.push('/feed')}
                className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col items-center">
                <h1 className="text-white text-xl font-bold mb-1.5 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '-0.02em' }}>
                  New Post
                </h1>
                <div className="w-10 h-0.5 bg-white rounded-full"></div>
              </div>
              <button
                onClick={() => {
                  if (imagePreview) {
                    setStep('details');
                  }
                }}
                disabled={!imagePreview}
                className="px-4 py-2 bg-white text-black font-black text-sm tracking-wider rounded-full hover:bg-white/90 transition-all disabled:opacity-30"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                NEXT
              </button>
            </div>
          </div>

          {/* Main Content - Centered */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-3">

            {/* Image Card */}
            <div
              className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-4 touch-none"
              style={{
                minHeight: '64vh',
                maxHeight: '66vh',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
              }}
            >
              {!imagePreview ? (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-neutral-900 hover:bg-neutral-800 transition-all">
                  <svg className="w-20 h-20 text-white/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/60 text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>
                    TAP TO ADD PHOTO
                  </span>
                  <span className="text-white/40 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>
                    REQUIRED
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              ) : (
                <div
                  className="relative w-full h-full cursor-move no-select"
                  style={{ touchAction: 'none' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    ref={imageRef}
                    src={imagePreview}
                    alt="Preview"
                    className="absolute pointer-events-none"
                    style={{
                      transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      objectFit: 'contain',
                      maxWidth: 'none',
                      height: '100%'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Image Controls - Only show when image uploaded */}
            {imagePreview && (
              <div className="w-full max-w-lg">
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>ZOOM</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-white text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>{zoom.toFixed(1)}x</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 border border-white/40 text-white hover:bg-white hover:text-black transition-all text-xs font-black rounded-lg"
                      style={{ fontFamily: 'Bebas Neue' }}
                    >
                      CHANGE PHOTO
                    </button>
                    <button
                      onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}
                      className="flex-1 py-2 border border-white/40 text-white hover:bg-white hover:text-black transition-all text-xs font-black rounded-lg"
                      style={{ fontFamily: 'Bebas Neue' }}
                    >
                      RESET
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: DETAILS & POST */}
      {step === 'details' && imagePreview && (
        <div className="fixed inset-0 bg-black flex flex-col">
          {/* Background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000"
              style={{
                backgroundImage: `url(${imagePreview})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
          </div>

          {/* Header - Fixed */}
          <div className="relative z-30 bg-black">
            <div className="flex items-center justify-between px-4 pt-3 pb-3">
              <button
                onClick={() => setStep('upload')}
                className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex flex-col items-center">
                <h1 className="text-white text-xl font-bold mb-1.5 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '-0.02em' }}>
                  New Post
                </h1>
                <div className="w-10 h-0.5 bg-white rounded-full"></div>
              </div>
              <button
                onClick={createPost}
                disabled={!canPost || creating}
                className="px-4 py-2 bg-white text-black font-black text-sm tracking-wider rounded-full hover:bg-white/90 transition-all disabled:opacity-30"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                {creating ? 'POSTING...' : 'POST'}
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="relative flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col items-center px-3 py-6 pb-20">

              {/* Image Preview (non-editable) */}
              <div
                className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-3"
                style={{
                  minHeight: '64vh',
                  maxHeight: '66vh',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
                }}
              >
                <div className="relative w-full h-full">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="absolute"
                    style={{
                      transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      objectFit: 'contain',
                      maxWidth: 'none',
                      height: '100%'
                    }}
                  />

                  {/* Shop Preview Overlay */}
                  {showShopPreview && items.length > 0 && (
                    <div className="absolute inset-0 z-30 flex flex-col">
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${imagePreview})`,
                          filter: 'blur(50px) brightness(0.4)',
                          transform: 'scale(1.2)'
                        }}
                      ></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80"></div>

                      <div className="relative flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-5">
                          <h2 className="text-white text-2xl font-black tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
                            SHOP THE LOOK
                          </h2>
                          <button
                            onClick={() => setShowShopPreview(false)}
                            className="w-10 h-10 flex items-center justify-center text-white bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            {items.map((item) => (
                              <div
                                key={item.temp_id}
                                className="bg-black border border-white/20 rounded-xl overflow-hidden shadow-xl"
                              >
                                <div className="aspect-square bg-neutral-900 overflow-hidden">
                                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                </div>
                                <div className="p-3 bg-black border-t border-white/20">
                                  {item.seller && (
                                    <p className="text-[9px] text-white/50 uppercase tracking-wider font-bold mb-1.5">
                                      {item.seller}
                                    </p>
                                  )}
                                  <h3 className="text-xs font-black tracking-wide uppercase leading-tight text-white mb-2 line-clamp-2" style={{ fontFamily: 'Bebas Neue' }}>
                                    {item.title}
                                  </h3>
                                  {item.price && (
                                    <p className="text-base font-black text-white" style={{ fontFamily: 'Archivo Black' }}>
                                      ${item.price}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile + Shop Preview Button */}
              <div className="w-full max-w-lg flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-neutral-800">
                    {currentUserAvatar ? (
                      <img src={currentUserAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-sm">👤</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-lg tracking-wide" style={{ fontFamily: 'Bebas Neue' }}>
                      {currentUsername || 'username'}
                    </span>
                    {isVerified && (
                      <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <button
                    onClick={() => setShowShopPreview(!showShopPreview)}
                    className="px-3 py-2 bg-white/90 backdrop-blur-sm text-black font-black text-[10px] tracking-widest rounded-full hover:bg-white transition-all"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    {showShopPreview ? 'BACK' : 'PREVIEW ITEMS'}
                  </button>
                )}
              </div>

              {/* Caption */}
              <div className="w-full max-w-lg mb-3">
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write a caption..."
                    rows={2}
                    className="w-full bg-transparent text-white placeholder-white/40 focus:outline-none resize-none text-sm"
                    style={{ fontFamily: 'Bebas Neue' }}
                  />
                </div>
              </div>

              {/* Tagged Items */}
              <div className="w-full max-w-lg">
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white text-sm font-black" style={{ fontFamily: 'Bebas Neue' }}>
                      TAGGED ITEMS ({items.length})
                    </span>
                    <button
                      onClick={() => setShowItemForm(!showItemForm)}
                      className="px-3 py-1.5 bg-white text-black hover:bg-white/90 transition-all text-xs font-black rounded-full"
                      style={{ fontFamily: 'Bebas Neue' }}
                    >
                      {showItemForm ? 'CANCEL' : '+ ADD'}
                    </button>
                  </div>

                  {/* Item Form */}
                  {showItemForm && (
                    <form onSubmit={handleAddItem} className="space-y-3 mb-4 p-3 bg-black/60 rounded-xl border border-white/20">
                      <input
                        type="text"
                        value={itemTitle}
                        onChange={(e) => setItemTitle(e.target.value)}
                        placeholder="Item title"
                        className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                        style={{ fontFamily: 'Bebas Neue' }}
                        required
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setItemUploadMethod('file'); setItemImageUrl(''); setItemPreviewUrl(null); }}
                          className={`flex-1 px-3 py-2 text-xs font-black transition-all rounded-lg ${itemUploadMethod === 'file' ? 'bg-white text-black' : 'border border-white/40 text-white'}`}
                          style={{ fontFamily: 'Bebas Neue' }}
                        >
                          FILE
                        </button>
                        <button
                          type="button"
                          onClick={() => { setItemUploadMethod('url'); setSelectedItemFile(null); setItemPreviewUrl(null); }}
                          className={`flex-1 px-3 py-2 text-xs font-black transition-all rounded-lg ${itemUploadMethod === 'url' ? 'bg-white text-black' : 'border border-white/40 text-white'}`}
                          style={{ fontFamily: 'Bebas Neue' }}
                        >
                          URL
                        </button>
                      </div>

                      {itemUploadMethod === 'file' ? (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleItemFileSelect}
                          className="w-full text-white text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:font-black file:rounded-lg"
                        />
                      ) : (
                        <input
                          type="url"
                          value={itemImageUrl}
                          onChange={(e) => handleItemImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                          style={{ fontFamily: 'Bebas Neue' }}
                        />
                      )}

                      {itemPreviewUrl && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/20">
                          <img src={itemPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <input
                        type="url"
                        value={itemProductUrl}
                        onChange={(e) => handleItemProductUrlChange(e.target.value)}
                        placeholder="Product URL"
                        className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                        style={{ fontFamily: 'Bebas Neue' }}
                        required
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={itemSeller}
                          onChange={(e) => setItemSeller(e.target.value)}
                          placeholder="Seller"
                          className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                          style={{ fontFamily: 'Bebas Neue' }}
                        />
                        <input
                          type="text"
                          value={itemPrice}
                          onChange={(e) => setItemPrice(e.target.value)}
                          placeholder="Price"
                          className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                          style={{ fontFamily: 'Bebas Neue' }}
                        />
                      </div>

                      {itemError && <p className="text-red-400 text-xs">{itemError}</p>}
                      {itemCreatingStatus && <p className="text-white/60 text-xs">{itemCreatingStatus}</p>}

                      <button
                        type="submit"
                        disabled={generatingItem || !itemTitle.trim() || !itemProductUrl.trim() || (itemUploadMethod === 'file' ? !selectedItemFile : !itemImageUrl.trim())}
                        className="w-full py-2 bg-white text-black hover:bg-white/90 transition-all text-sm font-black rounded-lg disabled:opacity-50"
                        style={{ fontFamily: 'Bebas Neue' }}
                      >
                        {generatingItem ? (itemCreatingStatus || 'ADDING...') : 'ADD ITEM'}
                      </button>
                    </form>
                  )}

                  {/* Items Grid */}
                  {items.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((item, idx) => (
                        <div key={item.temp_id} className="relative">
                          <button
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center hover:bg-red-500 transition-all z-10 text-xs"
                          >
                            ✕
                          </button>
                          <div className="aspect-square rounded-lg overflow-hidden border border-white/20">
                            <img src={item.image_url} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="w-full max-w-lg mt-3 p-3 bg-red-500/20 border border-red-500 rounded-xl">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}