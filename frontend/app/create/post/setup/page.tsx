"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

// ── Tutorial steps ─────────────────────────────────────────────────────────────
const POST_TUTORIAL_STEPS = [
  {
    step: 1,
    title: 'Pick your photo',
    body: "Upload any photo from your camera roll. This is the main image people see in the feed — your fit, a haul, a mood shot, whatever you're posting.",
    example: 'Pro tip: Drag the image after uploading to frame it exactly how you want before moving to the next step.',
    hint: null,
  },
  {
    step: 2,
    title: 'Write a caption',
    body: "Say what you want to say. Keep it short and on-brand or write something longer — either works. The caption shows under your post in the feed.",
    example: 'Example: "Full Rick fit today. Links in the items below if you want to cop any of it."',
    hint: null,
  },
  {
    step: 3,
    title: 'Tag your items',
    body: "This is where it gets useful. Add up to 6 items from your post — each one gets an image, a product link, a title and a price. People can shop directly from your post.",
    example: "Wearing 3 pieces? Add all 3 with links so people can find them. The more complete your tags, the more clicks you get.",
    hint: null,
  },
  {
    step: 4,
    title: 'Post and get seen',
    body: "Hit POST and your photo goes into the community feed on Discover. Verified creators earn per click when people shop the items you tagged.",
    example: "Real talk: posts with tagged items get significantly more engagement than photo-only posts. Tag everything you can.",
    hint: null,
  },
];

export default function CreatePostPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Tutorial state
  const [showPostTutorial, setShowPostTutorial] = useState(false);
  const [postTutorialStep, setPostTutorialStep] = useState(0);

  // Step management
  const [step, setStep] = useState<'upload' | 'details'>('upload');

  // Image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.2);

  // Crop position — stored in refs so drag updates go straight to DOM,
  // bypassing React re-renders for buttery smooth movement
  const cropRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

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

  // (drag state moved to refs above for performance)

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url, is_verified, has_seen_post_tutorial')
        .eq('id', user.id)
        .single();
      setCurrentUsername(profile?.username || null);
      setCurrentUserAvatar(profile?.avatar_url || null);
      setIsVerified(profile?.is_verified || false);

      // Show tutorial on first visit
      if (!profile?.has_seen_post_tutorial) {
        setShowPostTutorial(true);
      }
    }
  }

  async function dismissPostTutorial() {
    setShowPostTutorial(false);
    if (currentUserId) {
      await supabase
        .from('profiles')
        .update({ has_seen_post_tutorial: true })
        .eq('id', currentUserId);
    }
  }

  function nextPostTutorialStep() {
    if (postTutorialStep < POST_TUTORIAL_STEPS.length - 1) {
      setPostTutorialStep(s => s + 1);
    } else {
      dismissPostTutorial();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    setSelectedFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => { setImagePreview(e.target?.result as string); cropRef.current = { x: 0, y: 0 }; setZoom(1.2); if (imageRef.current) imageRef.current.style.transform = "translate(0px, 0px) scale(1.2)"; };
    reader.readAsDataURL(file);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!imagePreview) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - cropRef.current.x, y: e.clientY - cropRef.current.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDraggingRef.current) return;
    const x = e.clientX - dragStartRef.current.x;
    const y = e.clientY - dragStartRef.current.y;
    cropRef.current = { x, y };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { if (imageRef.current) imageRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`; });
  }

  function handleMouseUp() { isDraggingRef.current = false; }

  function handleTouchStart(e: React.TouchEvent) {
    if (!imagePreview) return;
    e.preventDefault();
    const touch = e.touches[0];
    isDraggingRef.current = true;
    dragStartRef.current = { x: touch.clientX - cropRef.current.x, y: touch.clientY - cropRef.current.y };
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const x = touch.clientX - dragStartRef.current.x;
    const y = touch.clientY - dragStartRef.current.y;
    cropRef.current = { x, y };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { if (imageRef.current) imageRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`; });
  }

  function handleTouchEnd() { isDraggingRef.current = false; }

  function handleItemFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setItemError('Please select an image file'); return; }
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
    setItemTitle(''); setItemImageUrl(''); setSelectedItemFile(null); setItemPreviewUrl(null);
    setItemProductUrl(''); setItemSeller(''); setItemPrice(''); setItemError('');
    setItemUploadMethod('file'); setItemCreatingStatus('');
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) { setItemError('You must be logged in'); return; }
    setGeneratingItem(true);
    setItemError('');

    try {
      if (!itemProductUrl.trim()) { setItemError('Product URL is required'); setGeneratingItem(false); return; }
      try { new URL(itemProductUrl); } catch { setItemError('Please enter a valid URL'); setGeneratingItem(false); return; }

      let finalImageUrl = itemImageUrl;

      if (itemUploadMethod === 'file' && selectedItemFile) {
        setItemCreatingStatus('Uploading image...');
        const uploadResult = await uploadItemImageToStorage(selectedItemFile, currentUserId);
        if (!uploadResult.url) { setItemError(uploadResult.error || "Failed to upload image"); setGeneratingItem(false); setItemCreatingStatus(''); return; }
        finalImageUrl = uploadResult.url;
      } else if (itemUploadMethod === 'url' && itemImageUrl) {
        setItemCreatingStatus('Saving image to storage...');
        try {
          const response = await fetch(itemImageUrl);
          if (!response.ok) throw new Error('Failed to fetch image');
          const blob = await response.blob();
          const file = new File([blob], `item-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
          const uploadResult = await uploadItemImageToStorage(file, currentUserId);
          if (!uploadResult.url) { setItemError(uploadResult.error || "Failed to save image"); setGeneratingItem(false); setItemCreatingStatus(''); return; }
          finalImageUrl = uploadResult.url;
        } catch (err: any) {
          setItemError("Failed to save image from URL. Make sure the URL is accessible.");
          setGeneratingItem(false); setItemCreatingStatus(''); return;
        }
      }

      if (!finalImageUrl) { setItemError('Image is required'); setGeneratingItem(false); return; }

      setItemCreatingStatus('Adding item...');
      setItems([...items, { temp_id: Date.now(), title: itemTitle.trim(), image_url: finalImageUrl, product_url: itemProductUrl.trim(), price: itemPrice.trim() || null, seller: itemSeller.trim() || null, category: null }]);
      resetItemForm();
      setShowItemForm(false);
    } catch (error: any) {
      setItemError(error.message || 'Failed to add item');
    } finally {
      setGeneratingItem(false);
      setItemCreatingStatus('');
    }
  }

  async function uploadImageToStorage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(fileName);
    return publicUrl;
  }

  async function uploadItemImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `item-${userId}-${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('post-items').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) return { url: null, error: error.message };
      const { data: { publicUrl } } = supabase.storage.from('post-items').getPublicUrl(fileName);
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
    } catch { return ''; }
  }

  async function createPost() {
    if (!selectedFile || !currentUserId) { setError('Please select an image'); return; }
    setCreating(true);
    setError('');
    try {
      const imageUrl = await uploadImageToStorage(selectedFile);
      const { data: postData, error: postError } = await supabase
        .from('feed_posts')
        .insert({ owner_id: currentUserId, image_url: imageUrl, caption: caption.trim() || null, music_track_id: null, music_preview_url: null, music_track_name: null, music_artist: null, music_album_art: null })
        .select().single();
      if (postError) throw postError;
      if (items.length > 0) {
        const itemsToInsert = items.map((item, idx) => ({ feed_post_id: postData.id, title: item.title, image_url: item.image_url, product_url: item.product_url, price: item.price, seller: item.seller, category: item.category, position_index: idx }));
        const { error: itemsError } = await supabase.from('feed_post_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
      router.push('/feed');
    } catch (error: any) {
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
        * { -webkit-tap-highlight-color: transparent; }
        body { font-family: 'Bebas Neue', sans-serif; background: #000; overflow: hidden; }
        .no-select { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @keyframes postTutSlide {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .post-tut-in { animation: postTutSlide 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* STEP 1: UPLOAD & ADJUST IMAGE */}
      {step === 'upload' && (
        <div className="fixed inset-0 bg-black flex flex-col">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {imagePreview && (
              <>
                <div className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000" style={{ backgroundImage: `url(${imagePreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
              </>
            )}
          </div>

          <div className="relative z-30 bg-black">
            <div className="flex items-center justify-between px-4 pt-3 pb-3">
              <button onClick={() => router.push('/feed')} className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex flex-col items-center">
                <h1 className="text-white text-xl font-bold mb-1.5 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '-0.02em' }}>New Post</h1>
                <div className="w-10 h-0.5 bg-white rounded-full"></div>
              </div>
              <button onClick={() => { if (imagePreview) setStep('details'); }} disabled={!imagePreview} className="px-4 py-2 bg-white text-black font-black text-sm tracking-wider rounded-full hover:bg-white/90 transition-all disabled:opacity-30" style={{ fontFamily: 'Bebas Neue' }}>NEXT</button>
            </div>
          </div>

          <div className="relative flex-1 flex flex-col items-center justify-center px-3">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-4 touch-none" style={{ minHeight: '64vh', maxHeight: '66vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
              {!imagePreview ? (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-neutral-900 hover:bg-neutral-800 transition-all">
                  <svg className="w-20 h-20 text-white/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-white/60 text-lg font-black mb-2" style={{ fontFamily: 'Bebas Neue' }}>TAP TO ADD PHOTO</span>
                  <span className="text-white/40 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>REQUIRED</span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              ) : (
                <div className="relative w-full h-full no-select" style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                  <img ref={imageRef} src={imagePreview} alt="Preview" className="absolute pointer-events-none" style={{ transform: `translate(0px, 0px) scale(${zoom})`, transformOrigin: 'center center', objectFit: 'contain', maxWidth: 'none', height: '100%', willChange: 'transform', WebkitBackfaceVisibility: 'hidden' as any }} />
                </div>
              )}
            </div>

            {imagePreview && (
              <div className="w-full max-w-lg">
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-white/60 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>ZOOM</span>
                    <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={(e) => { const z = parseFloat(e.target.value); setZoom(z); if (imageRef.current) imageRef.current.style.transform = `translate(${cropRef.current.x}px, ${cropRef.current.y}px) scale(${z})`; }} className="flex-1" />
                    <span className="text-white text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>{zoom.toFixed(1)}x</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 border border-white/40 text-white hover:bg-white hover:text-black transition-all text-xs font-black rounded-lg" style={{ fontFamily: 'Bebas Neue' }}>CHANGE PHOTO</button>
                    <button onClick={() => { cropRef.current = { x: 0, y: 0 }; setZoom(1.2); if (imageRef.current) imageRef.current.style.transform = "translate(0px, 0px) scale(1.2)"; }} className="flex-1 py-2 border border-white/40 text-white hover:bg-white hover:text-black transition-all text-xs font-black rounded-lg" style={{ fontFamily: 'Bebas Neue' }}>RESET</button>
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
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000" style={{ backgroundImage: `url(${imagePreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
          </div>

          <div className="relative z-30 bg-black">
            <div className="flex items-center justify-between px-4 pt-3 pb-3">
              <button onClick={() => setStep('upload')} className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex flex-col items-center">
                <h1 className="text-white text-xl font-bold mb-1.5 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '-0.02em' }}>New Post</h1>
                <div className="w-10 h-0.5 bg-white rounded-full"></div>
              </div>
              <button onClick={createPost} disabled={!canPost || creating} className="px-4 py-2 bg-white text-black font-black text-sm tracking-wider rounded-full hover:bg-white/90 transition-all disabled:opacity-30" style={{ fontFamily: 'Bebas Neue' }}>{creating ? 'POSTING...' : 'POST'}</button>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col items-center px-3 py-6 pb-20">
              <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-3" style={{ minHeight: '64vh', maxHeight: '66vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
                <div className="relative w-full h-full bg-black">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  {showShopPreview && items.length > 0 && (
                    <div className="absolute inset-0 z-30 flex flex-col">
                      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imagePreview})`, filter: 'blur(50px) brightness(0.4)', transform: 'scale(1.2)' }}></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80"></div>
                      <div className="relative flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-5">
                          <h2 className="text-white text-2xl font-black tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>SHOP THE LOOK</h2>
                          <button onClick={() => setShowShopPreview(false)} className="w-10 h-10 flex items-center justify-center text-white bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            {items.map((item) => (
                              <div key={item.temp_id} className="bg-black border border-white/20 rounded-xl overflow-hidden shadow-xl">
                                <div className="aspect-square bg-neutral-900 overflow-hidden"><img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /></div>
                                <div className="p-3 bg-black border-t border-white/20">
                                  {item.seller && <p className="text-[9px] text-white/50 uppercase tracking-wider font-bold mb-1.5">{item.seller}</p>}
                                  <h3 className="text-xs font-black tracking-wide uppercase leading-tight text-white mb-2 line-clamp-2" style={{ fontFamily: 'Bebas Neue' }}>{item.title}</h3>
                                  {item.price && <p className="text-base font-black text-white" style={{ fontFamily: 'Archivo Black' }}>${item.price}</p>}
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

              <div className="w-full max-w-lg flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-neutral-800">
                    {currentUserAvatar ? <img src={currentUserAvatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white text-sm">👤</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-lg tracking-wide" style={{ fontFamily: 'Bebas Neue' }}>{currentUsername || 'username'}</span>
                    {isVerified && <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  </div>
                </div>
                {items.length > 0 && (
                  <button onClick={() => setShowShopPreview(!showShopPreview)} className="px-3 py-2 bg-white/90 backdrop-blur-sm text-black font-black text-[10px] tracking-widest rounded-full hover:bg-white transition-all" style={{ fontFamily: 'Bebas Neue' }}>{showShopPreview ? 'BACK' : 'PREVIEW ITEMS'}</button>
                )}
              </div>

              <div className="w-full max-w-lg mb-3">
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." rows={2} className="w-full bg-transparent text-white placeholder-white/40 focus:outline-none resize-none text-sm" style={{ fontFamily: 'Bebas Neue' }} />
                </div>
              </div>

              <div className="w-full max-w-lg">
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white text-sm font-black" style={{ fontFamily: 'Bebas Neue' }}>TAGGED ITEMS ({items.length})</span>
                    <button onClick={() => setShowItemForm(!showItemForm)} className="px-3 py-1.5 bg-white text-black hover:bg-white/90 transition-all text-xs font-black rounded-full" style={{ fontFamily: 'Bebas Neue' }}>{showItemForm ? 'CANCEL' : '+ ADD'}</button>
                  </div>

                  {showItemForm && (
                    <form onSubmit={handleAddItem} className="space-y-3 mb-4 p-3 bg-black/60 rounded-xl border border-white/20">
                      <input type="text" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder="Item title" className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm" style={{ fontFamily: 'Bebas Neue' }} required />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setItemUploadMethod('file'); setItemImageUrl(''); setItemPreviewUrl(null); }} className={`flex-1 px-3 py-2 text-xs font-black transition-all rounded-lg ${itemUploadMethod === 'file' ? 'bg-white text-black' : 'border border-white/40 text-white'}`} style={{ fontFamily: 'Bebas Neue' }}>FILE</button>
                        <button type="button" onClick={() => { setItemUploadMethod('url'); setSelectedItemFile(null); setItemPreviewUrl(null); }} className={`flex-1 px-3 py-2 text-xs font-black transition-all rounded-lg ${itemUploadMethod === 'url' ? 'bg-white text-black' : 'border border-white/40 text-white'}`} style={{ fontFamily: 'Bebas Neue' }}>URL</button>
                      </div>
                      {itemUploadMethod === 'file' ? (
                        <input type="file" accept="image/*" onChange={handleItemFileSelect} className="w-full text-white text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:font-black file:rounded-lg" />
                      ) : (
                        <input type="url" value={itemImageUrl} onChange={(e) => handleItemImageUrlChange(e.target.value)} placeholder="https://example.com/image.jpg" className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm" style={{ fontFamily: 'Bebas Neue' }} />
                      )}
                      {itemPreviewUrl && <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/20"><img src={itemPreviewUrl} alt="Preview" className="w-full h-full object-cover" /></div>}
                      <input type="url" value={itemProductUrl} onChange={(e) => handleItemProductUrlChange(e.target.value)} placeholder="Product URL" className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm" style={{ fontFamily: 'Bebas Neue' }} required />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={itemSeller} onChange={(e) => setItemSeller(e.target.value)} placeholder="Seller" className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm" style={{ fontFamily: 'Bebas Neue' }} />
                        <input type="text" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="Price" className="w-full bg-neutral-900 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm" style={{ fontFamily: 'Bebas Neue' }} />
                      </div>
                      {itemError && <p className="text-red-400 text-xs">{itemError}</p>}
                      {itemCreatingStatus && <p className="text-white/60 text-xs">{itemCreatingStatus}</p>}
                      <button type="submit" disabled={generatingItem || !itemTitle.trim() || !itemProductUrl.trim() || (itemUploadMethod === 'file' ? !selectedItemFile : !itemImageUrl.trim())} className="w-full py-2 bg-white text-black hover:bg-white/90 transition-all text-sm font-black rounded-lg disabled:opacity-50" style={{ fontFamily: 'Bebas Neue' }}>
                        {generatingItem ? (itemCreatingStatus || 'ADDING...') : 'ADD ITEM'}
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(6)].map((_, idx) => {
                      const item = items[idx];
                      return (
                        <div key={idx} className="relative">
                          {item ? (
                            <>
                              <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center hover:bg-red-500 transition-all z-10 text-xs shadow-lg">✕</button>
                              <div className="aspect-square rounded-lg overflow-hidden border-2 border-white/20 bg-neutral-900"><img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /></div>
                            </>
                          ) : (
                            <div className="aspect-square rounded-lg border-2 border-dashed border-white/20 bg-neutral-900/50 flex items-center justify-center">
                              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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

      {/* ── FIRST-TIME TUTORIAL ─────────────────────────────────────────────────── */}
      {showPostTutorial && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)' }}>
          <div className="post-tut-in w-full md:max-w-sm bg-neutral-950 border border-white/10" style={{ borderRadius: '16px 16px 0 0' }}>

            {/* Progress bar */}
            <div className="flex gap-1 p-5 pb-0">
              {POST_TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= postTutorialStep ? 'bg-white' : 'bg-white/15'}`}
                />
              ))}
            </div>

            <div className="p-6 md:p-8">
              {/* Step counter */}
              <p className="text-xs tracking-[0.3em] font-black mb-5" style={{ fontFamily: 'Bebas Neue, sans-serif', color: 'rgba(255,255,255,0.4)' }}>
                {POST_TUTORIAL_STEPS[postTutorialStep].step} / {POST_TUTORIAL_STEPS.length}
              </p>

              {/* Step number badge */}
              <div className="inline-flex items-center justify-center w-10 h-10 border-2 border-white/25 mb-4">
                <span className="text-sm font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#ffffff' }}>
                  0{POST_TUTORIAL_STEPS[postTutorialStep].step}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-4 leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>
                {POST_TUTORIAL_STEPS[postTutorialStep].title}
              </h2>

              {/* Body */}
              <p className="text-base leading-relaxed mb-3" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 400, color: 'rgba(255,255,255,0.72)' }}>
                {POST_TUTORIAL_STEPS[postTutorialStep].body}
              </p>

              {/* Example block */}
              {(POST_TUTORIAL_STEPS[postTutorialStep] as any).example && (
                <div className="border border-white/15 bg-white/5 p-3 mb-3">
                  <p className="text-[10px] tracking-[0.2em] font-black mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', color: 'rgba(255,255,255,0.4)' }}>FOR EXAMPLE</p>
                  <p className="text-sm leading-relaxed" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 400, color: 'rgba(255,255,255,0.65)' }}>
                    {(POST_TUTORIAL_STEPS[postTutorialStep] as any).example}
                  </p>
                </div>
              )}

              {/* Hint */}
              {POST_TUTORIAL_STEPS[postTutorialStep].hint && (
                <div className="border border-white/15 p-3 mb-3">
                  <p className="text-xs leading-relaxed" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
                    {POST_TUTORIAL_STEPS[postTutorialStep].hint}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={dismissPostTutorial}
                  className="px-5 py-3.5 border border-white/20 text-xs tracking-[0.2em] font-black hover:bg-white/10 transition-all"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', color: 'rgba(255,255,255,0.5)' }}
                >
                  SKIP
                </button>
                <button
                  onClick={nextPostTutorialStep}
                  className="flex-1 py-3.5 bg-white text-black hover:bg-white/90 transition-all text-xs tracking-[0.2em] font-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  {postTutorialStep < POST_TUTORIAL_STEPS.length - 1 ? 'NEXT →' : 'START POSTING →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}