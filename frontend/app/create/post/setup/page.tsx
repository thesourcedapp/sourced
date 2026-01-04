"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";
import { searchDeezerTracks } from "@/lib/deezer-api";

export default function CreatePostPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  // Image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Post data
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<any[]>([]);

  // Music state
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [searchingMusic, setSearchingMusic] = useState(false);

  // Item adding state - exactly like catalog
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        .select('username')
        .eq('id', user.id)
        .single();
      setCurrentUsername(profile?.username || null);
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
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
        setImagePreview(e.target?.result as string);
        // Reset crop/zoom when new image loaded
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    setCrop({ x: newX, y: newY });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - crop.x, y: touch.clientY - crop.y });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return;

    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;

    setCrop({ x: newX, y: newY });
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

    if (!url.trim()) {
      setItemPreviewUrl(null);
      return;
    }

    try {
      new URL(url);
      setItemPreviewUrl(url);
    } catch {
      setItemError("Invalid URL format");
      setItemPreviewUrl(null);
    }
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
      // Handle external URL - download and save to our bucket
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

      setItemCreatingStatus('Categorizing with AI...');

      const requestBody = {
        title: itemTitle.trim(),
        image_url: finalImageUrl,
        product_url: itemProductUrl.trim(),
        seller: itemSeller.trim() || null,
        price: itemPrice.trim() || null
      };

      // Call backend API with AI categorization
      const response = await fetch(`/api/create-feed-post-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create item');
      }

      // Add to items array
      setItems([...items, {
        temp_id: Date.now(),
        title: itemTitle.trim(),
        image_url: finalImageUrl,
        product_url: itemProductUrl.trim(),
        price: itemPrice.trim() || null,
        seller: itemSeller.trim() || null,
        category: data.category || null
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

  async function searchMusic() {
    if (!musicQuery.trim()) return;

    setSearchingMusic(true);
    try {
      const results = await searchDeezerTracks(musicQuery, 20);
      setMusicResults(results);
    } catch (error) {
      console.error('Music search error:', error);
    } finally {
      setSearchingMusic(false);
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
      // Upload image to Supabase storage
      const imageUrl = await uploadImageToStorage(selectedFile);

      // Create post
      const { data: postData, error: postError } = await supabase
        .from('feed_posts')
        .insert({
          owner_id: currentUserId,
          image_url: imageUrl,
          caption: caption.trim() || null,
          music_track_id: selectedTrack?.trackId || null,
          music_preview_url: selectedTrack?.previewUrl || null,
          music_track_name: selectedTrack?.trackName || null,
          music_artist: selectedTrack?.artist || null,
          music_album_art: selectedTrack?.albumArt || null
        })
        .select()
        .single();

      if (postError) throw postError;

      // Create items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, idx) => ({
          feed_post_id: postData.id,
          title: item.title,
          image_url: item.image_url,
          product_url: item.product_url,
          price: item.price,
          category: item.category,
          position_index: idx
        }));

        const { error: itemsError } = await supabase
          .from('feed_post_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Redirect to my posts
      router.push('/create/post');

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
        body { font-family: 'Bebas Neue', sans-serif; background: #000; color: #FFF; }

        .no-select {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>

      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-5xl md:text-7xl font-black text-white" style={{ fontFamily: 'Archivo Black' }}>
                CREATE POST
              </h1>
              <p className="text-white/60 text-lg mt-2" style={{ fontFamily: 'Bebas Neue' }}>
                Share your style with the community
              </p>
            </div>
            <button
              onClick={() => router.push('/create/post')}
              className="text-white/60 hover:text-white text-sm tracking-wider"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              ← BACK
            </button>
          </div>

          {/* Post Card Preview - Feed Style */}
          <div className="bg-neutral-900 rounded-3xl p-6 mb-8">

            {/* Username at top */}
            <div className="mb-4">
              <h2 className="text-2xl md:text-3xl text-white" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                @{currentUsername || 'username'}
              </h2>
            </div>

            {/* Image Upload Area with Dynamic Crop */}
            <div
              ref={containerRef}
              className="mb-6 relative bg-black rounded-xl overflow-hidden cursor-move no-select"
              style={{ aspectRatio: '9/16', maxHeight: '70vh' }}
              onMouseDown={imagePreview ? handleMouseDown : undefined}
              onMouseMove={imagePreview ? handleMouseMove : undefined}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={imagePreview ? handleTouchStart : undefined}
              onTouchMove={imagePreview ? handleTouchMove : undefined}
              onTouchEnd={handleTouchEnd}
            >
              {!imagePreview ? (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                  <svg className="w-16 h-16 text-white/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/60 text-sm font-black" style={{ fontFamily: 'Bebas Neue' }}>
                    Click to Upload Photo
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
                <div className="relative w-full h-full">
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

              {/* Music indicator overlay */}
              {selectedTrack && imagePreview && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full">
                  {selectedTrack.albumArt && (
                    <div className="w-8 h-8 rounded-full overflow-hidden animate-spin-slow">
                      <img src={selectedTrack.albumArt} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="text-white text-xs font-black leading-tight" style={{ fontFamily: 'Bebas Neue' }}>
                      {selectedTrack.trackName}
                    </p>
                    <p className="text-white/60 text-[10px] font-black leading-tight" style={{ fontFamily: 'Bebas Neue' }}>
                      {selectedTrack.artist}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Zoom/Position Controls */}
            {imagePreview && (
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-4">
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
                    className="px-4 py-2 border-2 border-white/20 text-white hover:border-white transition-all text-xs font-black"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    CHANGE PHOTO
                  </button>
                  <button
                    onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}
                    className="px-4 py-2 border-2 border-white/20 text-white hover:border-white transition-all text-xs font-black"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    RESET
                  </button>
                </div>
              </div>
            )}

            {/* Caption Input - In the card */}
            <div className="mb-6">
              <label className="block text-white/60 text-xs mb-2 font-black" style={{ fontFamily: 'Bebas Neue' }}>
                CAPTION
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                rows={3}
                className="w-full bg-black text-white border-2 border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-white resize-none"
                style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
              />
              <p className="text-white/40 text-xs mt-1">{caption.length} characters</p>
            </div>

            {/* Music Section */}
            <div className="mb-6">
              <label className="block text-white/60 text-xs mb-2 font-black" style={{ fontFamily: 'Bebas Neue' }}>
                ADD MUSIC
              </label>

              {!selectedTrack ? (
                <button
                  onClick={() => setShowMusicSearch(!showMusicSearch)}
                  className="w-full px-4 py-3 border-2 border-white/20 text-white hover:border-white rounded-xl flex items-center justify-center gap-2 font-black transition-all"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  {showMusicSearch ? 'CANCEL' : 'ADD MUSIC'}
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-black border-2 border-white/20 rounded-xl">
                  {selectedTrack.albumArt && <img src={selectedTrack.albumArt} className="w-12 h-12 rounded" />}
                  <div className="flex-1">
                    <p className="text-white text-sm font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>{selectedTrack.trackName}</p>
                    <p className="text-white/60 text-xs truncate" style={{ fontFamily: 'Bebas Neue' }}>{selectedTrack.artist}</p>
                  </div>
                  <button onClick={() => setSelectedTrack(null)} className="text-white/60 hover:text-white">✕</button>
                </div>
              )}

              {showMusicSearch && !selectedTrack && (
                <div className="mt-3 p-4 bg-black border-2 border-white/20 rounded-xl">
                  <div className="flex gap-2 mb-3">
                    <input
                      value={musicQuery}
                      onChange={(e) => setMusicQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchMusic()}
                      placeholder="Search music..."
                      className="flex-1 bg-neutral-900 text-white border-2 border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white"
                      style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
                    />
                    <button
                      onClick={searchMusic}
                      disabled={searchingMusic}
                      className="px-4 py-2 bg-white text-black font-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all rounded-lg disabled:opacity-50"
                      style={{ fontFamily: 'Bebas Neue' }}
                    >
                      {searchingMusic ? '...' : 'SEARCH'}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {musicResults.map(track => (
                      <button
                        key={track.trackId}
                        onClick={() => { setSelectedTrack(track); setShowMusicSearch(false); }}
                        className="w-full flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left transition-all"
                      >
                        {track.albumArt && <img src={track.albumArt} className="w-10 h-10 rounded" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>{track.trackName}</p>
                          <p className="text-white/60 text-xs truncate" style={{ fontFamily: 'Bebas Neue' }}>{track.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tagged Items Section - Exactly like catalog */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>
                  TAG ITEMS ({items.length})
                </label>
                <button
                  onClick={() => setShowItemForm(!showItemForm)}
                  className="px-3 py-1 border-2 border-white/20 text-white hover:border-white transition-all rounded-lg text-xs font-black"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  + ADD ITEM
                </button>
              </div>

              {showItemForm && (
                <div className="mb-4 p-4 bg-black border-2 border-white/20 rounded-xl">
                  <form onSubmit={handleAddItem} className="space-y-3">
                    {/* Title */}
                    <div className="space-y-1">
                      <label className="block text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>TITLE *</label>
                      <input
                        type="text"
                        value={itemTitle}
                        onChange={(e) => setItemTitle(e.target.value)}
                        placeholder="Item name"
                        className="w-full bg-neutral-900 text-white border-2 border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white"
                        style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
                        required
                      />
                    </div>

                    {/* Image Upload Method */}
                    <div className="space-y-2">
                      <label className="block text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>IMAGE *</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setItemUploadMethod('file'); setItemImageUrl(''); setItemPreviewUrl(null); }}
                          className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${itemUploadMethod === 'file' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'}`}
                          style={{ fontFamily: 'Bebas Neue' }}
                        >
                          UPLOAD FILE
                        </button>
                        <button
                          type="button"
                          onClick={() => { setItemUploadMethod('url'); setSelectedItemFile(null); setItemPreviewUrl(null); }}
                          className={`px-3 py-1.5 text-[10px] tracking-wider font-black transition-all ${itemUploadMethod === 'url' ? 'bg-white text-black' : 'border border-white text-white hover:bg-white/10'}`}
                          style={{ fontFamily: 'Bebas Neue' }}
                        >
                          IMAGE URL
                        </button>
                      </div>
                    </div>

                    {/* File Upload */}
                    {itemUploadMethod === 'file' && (
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleItemFileSelect}
                          className="w-full text-white text-xs file:mr-4 file:py-1 file:px-2 file:border-0 file:bg-white file:text-black file:text-[10px] file:tracking-wider file:font-black file:rounded"
                        />
                        <p className="text-white/40 text-[9px]">Max 5MB</p>
                      </div>
                    )}

                    {/* URL Input */}
                    {itemUploadMethod === 'url' && (
                      <div>
                        <input
                          type="url"
                          value={itemImageUrl}
                          onChange={(e) => handleItemImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full bg-neutral-900 text-white border-2 border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white"
                          style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
                        />
                      </div>
                    )}

                    {/* Image Preview */}
                    {((itemUploadMethod === 'url' && itemImageUrl && !itemError) || (itemUploadMethod === 'file' && itemPreviewUrl)) && (
                      <div className="flex items-center gap-3 p-2 border border-white/20 rounded">
                        <img
                          src={itemUploadMethod === 'url' ? itemImageUrl : itemPreviewUrl!}
                          alt="Preview"
                          className="w-12 h-12 border border-white object-cover rounded"
                        />
                        <span className="text-white/60 text-[10px]">Preview</span>
                      </div>
                    )}

                    {/* Product URL */}
                    <div className="space-y-1">
                      <label className="block text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>PRODUCT URL *</label>
                      <input
                        type="url"
                        value={itemProductUrl}
                        onChange={(e) => handleItemProductUrlChange(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-neutral-900 text-white border-2 border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white"
                        style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
                        required
                      />
                    </div>

                    {/* Seller (Auto-filled) */}
                    <div className="space-y-1">
                      <label className="block text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>SELLER (AUTO-FILLED)</label>
                      <input
                        type="text"
                        value={itemSeller}
                        onChange={(e) => setItemSeller(e.target.value)}
                        placeholder="Store name"
                        className="w-full bg-neutral-900 text-white border-2 border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white"
                        style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
                      />
                    </div>

                    {/* Price */}
                    <div className="space-y-1">
                      <label className="block text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>PRICE (OPTIONAL)</label>
                      <input
                        type="text"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        placeholder="$99"
                        className="w-full bg-neutral-900 text-white border-2 border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white"
                        style={{ fontFamily: 'Bebas Neue', fontSize: '14px' }}
                      />
                    </div>

                    {/* Errors & Status */}
                    {itemError && <p className="text-red-400 text-xs">{itemError}</p>}
                    {itemCreatingStatus && <p className="text-white/60 text-xs">{itemCreatingStatus}</p>}

                    {/* Buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={generatingItem || !itemTitle.trim() || !itemProductUrl.trim() || ((itemUploadMethod === 'file' && !selectedItemFile) && (itemUploadMethod === 'url' && !itemImageUrl.trim()))}
                        className="flex-1 px-4 py-2 bg-white text-black font-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all rounded-lg disabled:opacity-50"
                        style={{ fontFamily: 'Bebas Neue' }}
                      >
                        {generatingItem ? (itemCreatingStatus || 'ADDING...') : 'ADD ITEM'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowItemForm(false); resetItemForm(); }}
                        className="px-4 py-2 border-2 border-white/20 text-white hover:border-white transition-all rounded-lg font-black"
                        style={{ fontFamily: 'Bebas Neue' }}
                      >
                        CANCEL
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {items.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item, idx) => (
                    <div key={item.temp_id} className="relative bg-black border-2 border-white/20 rounded-lg p-2">
                      <button
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all z-10"
                      >
                        ✕
                      </button>
                      <img src={item.image_url} className="w-full aspect-square object-cover rounded mb-2" />
                      <p className="text-white text-xs font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>{item.title}</p>
                      {item.price && <p className="text-white/60 text-xs">${item.price}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Post Button */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border-2 border-red-500 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/create/post')}
              className="flex-1 px-6 py-4 border-2 border-white text-white hover:bg-white hover:text-black transition-all text-lg font-black rounded-xl"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              CANCEL
            </button>
            <button
              onClick={createPost}
              disabled={!canPost || creating}
              className="flex-1 px-6 py-4 bg-white text-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all text-lg font-black rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              {creating ? 'POSTING...' : 'POST'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </>
  );
}