"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

type FeedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  items: Array<{
    id: string;
    title: string;
    image_url: string;
    product_url: string | null;
    price: string | null;
    seller: string | null;
  }>;
};

export default function MyPostsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editingItemsPostId, setEditingItemsPostId] = useState<string | null>(null);
  const [showEditItemsModal, setShowEditItemsModal] = useState(false);
  const [currentEditingPost, setCurrentEditingPost] = useState<FeedPost | null>(null);

  // Item form state
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [selectedItemFile, setSelectedItemFile] = useState<File | null>(null);
  const [itemPreviewUrl, setItemPreviewUrl] = useState<string | null>(null);
  const [itemUploadMethod, setItemUploadMethod] = useState<'url' | 'file'>('file');
  const [itemProductUrl, setItemProductUrl] = useState("");
  const [itemSeller, setItemSeller] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [itemError, setItemError] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUserId) loadPosts();
  }, [currentUserId]);

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
    setLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from('feed_posts')
      .select('*, feed_post_items(*)')
      .eq('owner_id', currentUserId)
      .order('created_at', { ascending: false });

    if (data) setPosts(data.map(p => ({ ...p, items: p.feed_post_items || [] })));
  }

  function togglePostSelection(postId: string) {
    setSelectedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) newSet.delete(postId);
      else newSet.add(postId);
      return newSet;
    });
  }

  function selectAll() {
    if (selectedPosts.size === posts.length) setSelectedPosts(new Set());
    else setSelectedPosts(new Set(posts.map(p => p.id)));
  }

  function deleteSelectedPosts() {
    if (selectedPosts.size === 0) return;
    setDeleteCount(selectedPosts.size);
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    try {
      await supabase.from('feed_posts').delete().in('id', Array.from(selectedPosts));
      setPosts(prev => prev.filter(p => !selectedPosts.has(p.id)));
      setSelectedPosts(new Set());
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting posts:', error);
    }
  }

  function handlePostClick(postId: string) {
    // Navigate to individual post page
    router.push(`/post/${postId}`);
  }

  function openEditItemsModal(post: FeedPost) {
    setCurrentEditingPost(post);
    setShowEditItemsModal(true);
    setShowItemForm(false);
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

  async function uploadItemImageToStorage(file: File): Promise<{ url: string | null; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `item-${currentUserId}-${Date.now()}.${fileExt}`;

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

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!currentEditingPost || !currentUserId) return;

    setAddingItem(true);
    setItemError('');

    try {
      if (!itemProductUrl.trim()) {
        setItemError('Product URL is required');
        setAddingItem(false);
        return;
      }

      try {
        new URL(itemProductUrl);
      } catch {
        setItemError('Please enter a valid URL');
        setAddingItem(false);
        return;
      }

      let finalImageUrl = itemImageUrl;

      if (itemUploadMethod === 'file' && selectedItemFile) {
        const uploadResult = await uploadItemImageToStorage(selectedItemFile);
        if (!uploadResult.url) {
          setItemError(uploadResult.error || "Failed to upload image");
          setAddingItem(false);
          return;
        }
        finalImageUrl = uploadResult.url;
      } else if (itemUploadMethod === 'url' && itemImageUrl) {
        try {
          const response = await fetch(itemImageUrl);
          if (!response.ok) throw new Error('Failed to fetch image');
          const blob = await response.blob();
          const file = new File([blob], `item-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
          const uploadResult = await uploadItemImageToStorage(file);
          if (!uploadResult.url) {
            setItemError(uploadResult.error || "Failed to save image");
            setAddingItem(false);
            return;
          }
          finalImageUrl = uploadResult.url;
        } catch (err: any) {
          setItemError("Failed to save image from URL");
          setAddingItem(false);
          return;
        }
      }

      if (!finalImageUrl) {
        setItemError('Image is required');
        setAddingItem(false);
        return;
      }

      // Add to database
      const { data: newItem, error } = await supabase
        .from('feed_post_items')
        .insert({
          feed_post_id: currentEditingPost.id,
          title: itemTitle.trim(),
          image_url: finalImageUrl,
          product_url: itemProductUrl.trim(),
          price: itemPrice.trim() || null,
          seller: itemSeller.trim() || null,
          position_index: currentEditingPost.items.length
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setCurrentEditingPost(prev => prev ? {
        ...prev,
        items: [...prev.items, { ...newItem, like_count: 0, is_liked: false }]
      } : null);

      setPosts(prev => prev.map(p =>
        p.id === currentEditingPost.id
          ? { ...p, items: [...p.items, { ...newItem, like_count: 0, is_liked: false }] }
          : p
      ));

      resetItemForm();
      setShowItemForm(false);
    } catch (error: any) {
      console.error('Error adding item:', error);
      setItemError(error.message || 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!currentEditingPost) return;

    try {
      await supabase
        .from('feed_post_items')
        .delete()
        .eq('id', itemId);

      // Update local state
      setCurrentEditingPost(prev => prev ? {
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
      } : null);

      setPosts(prev => prev.map(p =>
        p.id === currentEditingPost.id
          ? { ...p, items: p.items.filter(item => item.id !== itemId) }
          : p
      ));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl font-black tracking-widest animate-pulse" style={{ fontFamily: 'Bebas Neue' }}>
          SOURCED
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>My Posts | Sourced</title></Head>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        * {
          -webkit-tap-highlight-color: transparent;
        }

        body {
          font-family: 'Bebas Neue', sans-serif;
          background: #000;
        }

        .post-card-hover {
          transition: all 0.2s ease;
        }

        .post-card-hover:hover {
          transform: scale(1.02);
        }
      `}</style>

      <div className="min-h-screen bg-black py-6 px-4">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl md:text-5xl font-black text-white" style={{ fontFamily: 'Archivo Black' }}>MY POSTS</h1>
              <button
                onClick={() => router.push('/create/post')}
                className="text-white/60 hover:text-white text-sm font-black"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                ← BACK
              </button>
            </div>
            <p className="text-white/60 text-sm" style={{ fontFamily: 'Bebas Neue' }}>{posts.length} Posts</p>
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex gap-3 flex-wrap">
            <button
              onClick={() => router.push('/create/post/setup')}
              className="px-6 py-2 bg-white text-black hover:bg-black hover:text-white border-2 border-white transition-all text-xs tracking-wider font-black rounded-lg"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              + CREATE POST
            </button>

            <button
              onClick={() => {
                setEditMode(!editMode);
                if (editMode) {
                  setSelectedPosts(new Set());
                }
              }}
              className={`px-6 py-2 ${editMode ? 'bg-white text-black' : 'border-2 border-white text-white'} hover:bg-white hover:text-black transition-all text-xs tracking-wider font-black rounded-lg`}
              style={{ fontFamily: 'Bebas Neue' }}
            >
              {editMode ? 'DONE' : 'EDIT POSTS'}
            </button>

            {editMode && selectedPosts.size > 0 && (
              <>
                <button
                  onClick={selectAll}
                  className="px-6 py-2 border-2 border-white text-white hover:bg-white/10 transition-all text-xs tracking-wider font-black rounded-lg"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  {selectedPosts.size === posts.length ? 'DESELECT ALL' : 'SELECT ALL'}
                </button>
                <button
                  onClick={deleteSelectedPosts}
                  className="px-6 py-2 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black rounded-lg"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  DELETE ({selectedPosts.size})
                </button>
              </>
            )}
          </div>

          {/* Posts Grid - Instagram Style */}
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-20 h-20 mx-auto mb-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg tracking-wider text-white/40 mb-2" style={{ fontFamily: 'Bebas Neue' }}>NO POSTS YET</p>
              <p className="text-sm tracking-wide text-white/30 mb-6">Create your first post to get started</p>
              <button
                onClick={() => router.push('/create/post/setup')}
                className="px-8 py-3 bg-white text-black hover:bg-black hover:text-white border-2 border-white transition-all font-black tracking-wider rounded-lg"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                CREATE POST
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {posts.map(post => (
                <div
                  key={post.id}
                  className="relative cursor-pointer post-card-hover group bg-black rounded-2xl overflow-hidden border border-white/10"
                  style={{ aspectRatio: '3/4' }}
                  onClick={() => !editMode && handlePostClick(post.id)}
                >
                  {/* Selection Checkbox - Only show in edit mode */}
                  {editMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(post.id)}
                        onChange={() => togglePostSelection(post.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-6 h-6 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Edit Items Button - Only show in edit mode */}
                  {editMode && post.items.length > 0 && (
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditItemsModal(post);
                        }}
                        className="px-3 py-1.5 bg-white text-black hover:bg-white/90 transition-all text-xs font-black rounded-lg"
                        style={{ fontFamily: 'Bebas Neue' }}
                      >
                        EDIT ITEMS
                      </button>
                    </div>
                  )}

                  {/* Post Image */}
                  <div className="w-full h-full overflow-hidden">
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Hover Overlay */}
                  {!editMode && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                      <div className="flex items-center gap-2 text-white">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.like_count}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                        </svg>
                        <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.comment_count}</span>
                      </div>
                    </div>
                  )}

                  {/* Tagged Items Indicator - Bottom right */}
                  {post.items.length > 0 && !editMode && (
                    <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>
                      {post.items.length} ITEM{post.items.length !== 1 ? 'S' : ''}
                    </div>
                  )}

                  {/* Caption Preview (on hover, bottom) */}
                  {post.caption && !editMode && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs line-clamp-2">
                        {post.caption}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <div className="w-full max-w-md bg-black border-2 border-white rounded-2xl p-8">
            <h2 className="text-4xl font-black mb-2 text-white" style={{ fontFamily: 'Archivo Black' }}>DELETE POSTS?</h2>
            <p className="text-sm text-white/60 mb-6">You're about to delete {deleteCount} post{deleteCount > 1 ? 's' : ''}. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 border-2 border-white text-white hover:bg-white hover:text-black transition-all text-xs tracking-wider font-black rounded-lg"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-wider font-black rounded-lg"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Items Modal */}
      {showEditItemsModal && currentEditingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overflow-y-auto">
          <div className="w-full max-w-2xl bg-black border-2 border-white rounded-2xl p-6 my-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white" style={{ fontFamily: 'Archivo Black' }}>EDIT ITEMS</h2>
              <button
                onClick={() => {
                  setShowEditItemsModal(false);
                  setCurrentEditingPost(null);
                  resetItemForm();
                }}
                className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {currentEditingPost.items.map((item) => (
                <div key={item.id} className="relative bg-neutral-900 border border-white/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all z-10 text-xs font-black"
                  >
                    ✕
                  </button>
                  <div className="aspect-square">
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-white font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>{item.title}</p>
                    {item.price && <p className="text-xs text-white/60">${item.price}</p>}
                  </div>
                </div>
              ))}

              {/* Add Item Button */}
              <button
                onClick={() => setShowItemForm(true)}
                className="aspect-square border-2 border-dashed border-white/40 rounded-xl flex items-center justify-center hover:border-white hover:bg-white/5 transition-all"
              >
                <div className="text-center">
                  <svg className="w-12 h-12 text-white/40 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-xs text-white/60 font-black" style={{ fontFamily: 'Bebas Neue' }}>ADD ITEM</p>
                </div>
              </button>
            </div>

            {/* Add Item Form */}
            {showItemForm && (
              <form onSubmit={handleAddItem} className="space-y-4 p-4 bg-neutral-900 border border-white/20 rounded-xl">
                <h3 className="text-lg font-black text-white mb-4" style={{ fontFamily: 'Bebas Neue' }}>NEW ITEM</h3>

                <input
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="Item title"
                  className="w-full bg-black text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
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
                    className="w-full bg-black text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                    style={{ fontFamily: 'Bebas Neue' }}
                  />
                )}

                {itemPreviewUrl && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/20">
                    <img src={itemPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}

                <input
                  type="url"
                  value={itemProductUrl}
                  onChange={(e) => handleItemProductUrlChange(e.target.value)}
                  placeholder="Product URL"
                  className="w-full bg-black text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                  style={{ fontFamily: 'Bebas Neue' }}
                  required
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={itemSeller}
                    onChange={(e) => setItemSeller(e.target.value)}
                    placeholder="Seller"
                    className="w-full bg-black text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                    style={{ fontFamily: 'Bebas Neue' }}
                  />
                  <input
                    type="text"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="Price"
                    className="w-full bg-black text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-white text-sm"
                    style={{ fontFamily: 'Bebas Neue' }}
                  />
                </div>

                {itemError && <p className="text-red-400 text-xs">{itemError}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingItem || !itemTitle.trim() || !itemProductUrl.trim() || (itemUploadMethod === 'file' ? !selectedItemFile : !itemImageUrl.trim())}
                    className="flex-1 py-2 bg-white text-black hover:bg-white/90 transition-all text-sm font-black rounded-lg disabled:opacity-50"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    {addingItem ? 'ADDING...' : 'ADD ITEM'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowItemForm(false); resetItemForm(); }}
                    className="px-6 py-2 border-2 border-white text-white hover:bg-white/10 transition-all text-sm font-black rounded-lg"
                    style={{ fontFamily: 'Bebas Neue' }}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}