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
                onClick={() => router.push('/feed')}
                className="text-white/60 hover:text-white text-sm"
              >
                ← BACK TO FEED
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

            {selectedPosts.size > 0 && (
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-2">
              {posts.map(post => (
                <div
                  key={post.id}
                  className="relative aspect-square cursor-pointer post-card-hover group"
                  onClick={() => handlePostClick(post.id)}
                >
                  {/* Selection Checkbox - Top Left */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={() => togglePostSelection(post.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </div>

                  {/* Post Image */}
                  <div className="w-full h-full bg-black overflow-hidden">
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Hover Overlay - Instagram Style */}
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

                  {/* Tagged Items Indicator */}
                  {post.items.length > 0 && (
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>
                      {post.items.length} ITEM{post.items.length !== 1 ? 'S' : ''}
                    </div>
                  )}

                  {/* Caption Preview (on hover, bottom) */}
                  {post.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </>
  );
}