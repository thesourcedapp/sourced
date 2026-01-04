"use client";

import { useEffect, useState, useRef } from "react";
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
    seller: string | null;
  }>;
};

export default function MyPostsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [currentUserVerified, setCurrentUserVerified] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());

  // Audio refs for each post
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

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
        .select('username, avatar_url, is_verified')
        .eq('id', user.id)
        .single();
      setCurrentUsername(profile?.username || null);
      setCurrentUserAvatar(profile?.avatar_url || null);
      setCurrentUserVerified(profile?.is_verified || false);
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

  function handlePostClick(post: FeedPost) {
    // Play music if available
    if (post.music_preview_url && audioRefs.current[post.id]) {
      const audio = audioRefs.current[post.id];
      if (audio.paused) {
        // Pause all other audios
        Object.values(audioRefs.current).forEach(a => a.pause());
        audio.play();
      } else {
        audio.pause();
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head><title>My Posts | Sourced</title></Head>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        body { font-family: 'Bebas Neue', sans-serif; background: #000; color: #FFF; }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>

      <div className="min-h-screen bg-black py-12 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-black mb-2 text-white" style={{ fontFamily: 'Archivo Black' }}>MY POSTS</h1>
            <p className="text-white/60 text-lg" style={{ fontFamily: 'Bebas Neue' }}>{posts.length} Posts</p>
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => router.push('/create/post/setup')}
              className="px-6 py-2 bg-white text-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all text-xs tracking-[0.4em] font-black"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              CREATE POST
            </button>

            {selectedPosts.size > 0 && (
              <>
                <button
                  onClick={selectAll}
                  className="px-6 py-2 border-2 border-white hover:bg-white/10 transition-all text-xs tracking-[0.4em] font-black text-white"
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

          {/* Posts Grid - EXACT Feed Card Style */}
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg tracking-wider opacity-40 text-white" style={{ fontFamily: 'Bebas Neue' }}>NO POSTS YET</p>
              <p className="text-sm tracking-wide opacity-30 mt-2 text-white">Create your first post to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map(post => (
                <div key={post.id} className="w-full bg-black relative">

                  {/* Selection Checkbox - Top Left */}
                  <div className="absolute top-6 left-6 z-30">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={() => togglePostSelection(post.id)}
                      className="w-6 h-6 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Dark Grey Card Background - EXACT FEED STYLE */}
                  <div className="w-full bg-neutral-900 rounded-3xl p-4 md:p-6">

                    {/* Username Banner - EXACT FEED STYLE */}
                    <div className="flex items-center justify-between mb-4">
                      <div
                        onClick={() => router.push(`/@${currentUsername}`)}
                        className="flex items-center gap-3 text-base md:text-xl bg-white text-black px-5 py-1 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          clipPath: 'polygon(0 0, calc(100% - 8px) 0%, calc(100% - 0px) 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)'
                        }}
                      >
                        <div className="w-7 h-7 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-black">
                          {currentUserAvatar ? (
                            <img src={currentUserAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-neutral-200 flex items-center justify-center text-sm text-black">👤</div>
                          )}
                        </div>
                        <span className="font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>@{currentUsername}</span>
                        {currentUserVerified && (
                          <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Hole Punch Circle - EXACT FEED STYLE */}
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-4 border-neutral-700 bg-black"></div>
                    </div>

                    {/* Hero Image - EXACT FEED STYLE */}
                    <div className="mb-6 relative" onClick={() => handlePostClick(post)}>
                      <img
                        src={post.image_url}
                        alt=""
                        className="w-full h-auto object-cover cursor-pointer"
                        style={{ maxHeight: '80vh' }}
                      />

                      {/* Music Label - EXACT FEED STYLE */}
                      {post.music_preview_url && (
                        <>
                          <audio
                            ref={(el) => { if (el) audioRefs.current[post.id] = el; }}
                            src={post.music_preview_url}
                            loop
                          />
                          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full">
                            {post.music_album_art && (
                              <div className="w-8 h-8 rounded-full overflow-hidden animate-spin-slow">
                                <img src={post.music_album_art} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div>
                              <p className="text-white text-xs font-black leading-tight" style={{ fontFamily: 'Bebas Neue' }}>
                                {post.music_track_name}
                              </p>
                              <p className="text-white/60 text-[10px] font-black leading-tight" style={{ fontFamily: 'Bebas Neue' }}>
                                {post.music_artist}
                              </p>
                            </div>
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                            </svg>
                          </div>
                        </>
                      )}

                      {/* Shop The Look Overlay - EXACT FEED STYLE */}
                      {selectedPostId === post.id && post.items.length > 0 && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col p-6 overflow-y-auto">
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                              SHOP THE LOOK
                            </h2>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedPostId(null); }}
                              className="w-10 h-10 flex items-center justify-center text-white hover:bg-white hover:text-black border-2 border-white transition-all"
                            >
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {post.items.map((item, itemIdx) => (
                              <div
                                key={item.id}
                                onClick={(e) => { e.stopPropagation(); if (item.product_url) window.open(item.product_url, '_blank'); }}
                                className="cursor-pointer border-2 border-white hover:bg-white hover:text-black transition-all p-3 group"
                              >
                                <div className="aspect-square overflow-hidden mb-2 border-2 border-white group-hover:border-black">
                                  <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                <p className="text-xs tracking-[0.2em] mb-1 opacity-60 font-black text-white group-hover:text-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {String(itemIdx + 1).padStart(2, '0')}
                                </p>
                                <h3 className="text-sm font-black mb-1 leading-tight line-clamp-2 text-white group-hover:text-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {item.title}
                                </h3>
                                {item.price && (
                                  <p className="text-lg font-black text-white group-hover:text-black" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                                    ${item.price}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - EXACT FEED STYLE */}
                    <div className="flex items-center gap-5 mb-4 px-2">
                      <div className="flex items-center gap-1.5 text-white">
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm md:text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{post.like_count}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-white">
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-sm md:text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{post.comment_count}</span>
                      </div>

                      {/* Share Arrow - EXACT FEED STYLE */}
                      <button className="text-white hover:opacity-60 transition-opacity">
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
                        </svg>
                      </button>

                      {/* Barcode - EXACT FEED STYLE - Bottom Right */}
                      {post.items.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPostId(post.id === selectedPostId ? null : post.id); }}
                          className="ml-auto text-white hover:opacity-60 transition-opacity"
                        >
                          <svg className="w-24 h-8 md:w-32 md:h-10" viewBox="0 0 160 40" fill="none">
                            <rect x="2" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="6" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="9" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="14" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="17" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="21" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="24" y="4" width="4" height="32" fill="currentColor"/>
                            <rect x="30" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="33" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="37" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="40" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="45" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="48" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="52" y="4" width="4" height="32" fill="currentColor"/>
                            <rect x="58" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="61" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="65" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="68" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="73" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="77" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="80" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="85" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="88" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="92" y="4" width="4" height="32" fill="currentColor"/>
                            <rect x="98" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="101" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="106" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="109" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="113" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="116" y="4" width="4" height="32" fill="currentColor"/>
                            <rect x="122" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="125" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="129" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="134" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="137" y="4" width="2" height="32" fill="currentColor"/>
                            <rect x="141" y="4" width="4" height="32" fill="currentColor"/>
                            <rect x="147" y="4" width="1" height="32" fill="currentColor"/>
                            <rect x="150" y="4" width="3" height="32" fill="currentColor"/>
                            <rect x="155" y="4" width="2" height="32" fill="currentColor"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Caption - EXACT FEED STYLE */}
                    {post.caption && (
                      <div className="px-2 mb-4">
                        <p className="text-sm text-white">
                          {expandedCaptions.has(post.id) ? (
                            <>
                              {post.caption}{' '}
                              <button
                                onClick={() => {
                                  const newSet = new Set(expandedCaptions);
                                  newSet.delete(post.id);
                                  setExpandedCaptions(newSet);
                                }}
                                className="text-white/60 font-black"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                              >
                                ...less
                              </button>
                            </>
                          ) : (
                            <>
                              {post.caption.length > 100 ? (
                                <>
                                  {post.caption.slice(0, 100)}...{' '}
                                  <button
                                    onClick={() => {
                                      const newSet = new Set(expandedCaptions);
                                      newSet.add(post.id);
                                      setExpandedCaptions(newSet);
                                    }}
                                    className="text-white/60 font-black"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                  >
                                    more
                                  </button>
                                </>
                              ) : (
                                post.caption
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Date */}
                    <div className="px-2">
                      <p className="text-white/40 text-xs" style={{ fontFamily: 'Bebas Neue' }}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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