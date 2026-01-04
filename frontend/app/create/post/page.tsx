"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

type FeedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  music_track_id: string | null;
  music_preview_url: string | null;
  music_track_name: string | null;
  music_artist: string | null;
  music_album_art: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  items: Array<{
    id: string;
    title: string;
    image_url: string;
    product_url: string | null;
    price: string | null;
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
  const [expandedPost, setExpandedPost] = useState<FeedPost | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head><title>My Posts | Sourced</title></Head>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        body { font-family: 'Bebas Neue', sans-serif; background: #FFF; color: #000; }
      `}</style>

      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-black mb-2" style={{ fontFamily: 'Archivo Black' }}>MY POSTS</h1>
            <p className="text-black/60 text-lg" style={{ fontFamily: 'Bebas Neue' }}>{posts.length} Posts</p>
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => router.push('/create/post/setup')}
              className="px-6 py-2 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-xs tracking-[0.4em] font-black"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              CREATE POST
            </button>

            {selectedPosts.size > 0 && (
              <>
                <button
                  onClick={selectAll}
                  className="px-6 py-2 border-2 border-black hover:bg-black/5 transition-all text-xs tracking-[0.4em] font-black"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  {selectedPosts.size === posts.length ? 'DESELECT' : 'SELECT ALL'}
                </button>
                <button
                  onClick={deleteSelectedPosts}
                  className="px-6 py-2 bg-red-500 text-white hover:bg-red-600 transition-all text-xs tracking-[0.4em] font-black"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  DELETE ({selectedPosts.size})
                </button>
              </>
            )}
          </div>

          {/* Posts Grid - Feed Card Style, 2 per row on mobile */}
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue' }}>NO POSTS YET</p>
              <p className="text-sm tracking-wide opacity-30 mt-2">Create your first post to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {posts.map(post => (
                <div key={post.id} className="relative group">
                  {/* Selection Checkbox */}
                  <div className="absolute top-2 left-2 z-20">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={() => togglePostSelection(post.id)}
                      className="w-5 h-5 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Mini Feed Card */}
                  <div
                    className="bg-neutral-900 rounded-2xl p-3 cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => setExpandedPost(post)}
                  >

                    {/* Username at top */}
                    <div className="mb-2">
                      <p className="text-sm text-white truncate" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                        @{currentUsername}
                      </p>
                    </div>

                    {/* Image */}
                    <div className="mb-2 relative rounded-lg overflow-hidden aspect-[9/16]">
                      <img src={post.image_url} className="w-full h-full object-cover" />

                      {/* Music indicator */}
                      {post.music_album_art && (
                        <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full border border-white overflow-hidden">
                          <img src={post.music_album_art} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mb-2 text-white text-xs">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.like_count}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.comment_count}</span>
                      </div>
                      {post.items.length > 0 && (
                        <div className="ml-auto text-white/60" style={{ fontFamily: 'Bebas Neue' }}>
                          {post.items.length}
                        </div>
                      )}
                    </div>

                    {/* Caption preview - 1 line */}
                    {post.caption && (
                      <p className="text-white text-[10px] truncate">{post.caption}</p>
                    )}

                    {/* Date */}
                    <p className="text-white/40 text-[9px] mt-1" style={{ fontFamily: 'Bebas Neue' }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Post Modal */}
      {expandedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setExpandedPost(null)}>
          <div className="relative w-full max-w-2xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setExpandedPost(null)} className="absolute -top-10 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50" style={{ fontFamily: 'Bebas Neue' }}>[ESC]</button>

            <div className="bg-neutral-900 rounded-3xl p-6 overflow-y-auto max-h-[85vh]">
              {/* Username */}
              <div className="mb-4">
                <h2 className="text-2xl text-white" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                  @{currentUsername}
                </h2>
              </div>

              {/* Image */}
              <div className="mb-4 rounded-xl overflow-hidden">
                <img src={expandedPost.image_url} className="w-full h-auto object-cover" />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 mb-4">
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{expandedPost.like_count} LIKES</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{expandedPost.comment_count} COMMENTS</span>
                </div>
              </div>

              {/* Caption */}
              {expandedPost.caption && (
                <div className="mb-4">
                  <p className="text-white/60 text-xs mb-1" style={{ fontFamily: 'Bebas Neue' }}>CAPTION</p>
                  <p className="text-white text-sm">{expandedPost.caption}</p>
                </div>
              )}

              {/* Music */}
              {expandedPost.music_track_name && (
                <div className="mb-4 p-3 bg-black/40 rounded-lg">
                  <p className="text-white/60 text-xs mb-1" style={{ fontFamily: 'Bebas Neue' }}>MUSIC</p>
                  <p className="text-white font-black" style={{ fontFamily: 'Bebas Neue' }}>{expandedPost.music_track_name}</p>
                  <p className="text-white/60 text-sm">{expandedPost.music_artist}</p>
                </div>
              )}

              {/* Tagged Items */}
              {expandedPost.items.length > 0 && (
                <div>
                  <p className="text-white/60 text-xs mb-3" style={{ fontFamily: 'Bebas Neue' }}>TAGGED ITEMS ({expandedPost.items.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {expandedPost.items.map(item => (
                      <div key={item.id} className="bg-black border-2 border-white/20 rounded-lg p-2">
                        <img src={item.image_url} className="w-full aspect-square object-cover rounded mb-2" />
                        <p className="text-white text-xs font-black truncate" style={{ fontFamily: 'Bebas Neue' }}>{item.title}</p>
                        {item.price && <p className="text-white/60 text-xs">${item.price}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              <p className="text-white/40 text-xs mt-4" style={{ fontFamily: 'Bebas Neue' }}>
                Posted {new Date(expandedPost.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <div className="w-full max-w-md bg-white border-2 border-black p-8">
            <h2 className="text-4xl font-black mb-2" style={{ fontFamily: 'Archivo Black' }}>DELETE POSTS?</h2>
            <p className="text-sm opacity-60 mb-6">You're about to delete {deleteCount} post{deleteCount > 1 ? 's' : ''}. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 border border-black/20 hover:bg-black/5 text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue' }}>CANCEL</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 text-xs tracking-wider font-black" style={{ fontFamily: 'Bebas Neue' }}>DELETE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}