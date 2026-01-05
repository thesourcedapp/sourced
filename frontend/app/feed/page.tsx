"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

type FeedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  music_preview_url: string | null;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  owner: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  items: Array<{
    id: string;
    title: string;
    image_url: string;
    product_url: string | null;
    price: string | null;
    seller: string | null;
  }>;
};

export default function RunwayFeed() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Interactive states
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [viewMode, setViewMode] = useState<'discover' | 'shop'>('discover');
  const [isMuted, setIsMuted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    loadCurrentUser();
    loadFeedPosts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') nextPost();
      if (e.key === 'ArrowUp') prevPost();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, posts.length]);

  // Auto-play music
  useEffect(() => {
    if (posts[currentIndex]?.music_preview_url) {
      const audio = audioRefs.current[posts[currentIndex].id];
      if (audio) {
        audio.muted = isMuted;
        audio.play().catch(() => {});
      }
    }

    // Pause others
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (id !== posts[currentIndex]?.id) {
        audio.pause();
      }
    });
  }, [currentIndex, posts, isMuted]);

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
    }
  }

  async function loadFeedPosts() {
    try {
      const { data: postsData } = await supabase
        .from('feed_posts')
        .select(`
          id, image_url, caption, like_count, comment_count, music_preview_url, owner_id,
          profiles!feed_posts_owner_id_fkey(id, username, avatar_url, is_verified)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!postsData) {
        setPosts([]);
        setLoading(false);
        return;
      }

      let likedPostIds: Set<string> = new Set();
      if (currentUserId) {
        const { data: likedData } = await supabase
          .from('liked_feed_posts')
          .select('feed_post_id')
          .eq('user_id', currentUserId);
        if (likedData) {
          likedPostIds = new Set(likedData.map(like => like.feed_post_id));
        }
      }

      const postIds = postsData.map(p => p.id);
      const { data: itemsData } = await supabase
        .from('feed_post_items')
        .select('*')
        .in('feed_post_id', postIds);

      const itemsByPost = new Map<string, any[]>();
      if (itemsData) {
        itemsData.forEach((item: any) => {
          if (!itemsByPost.has(item.feed_post_id)) {
            itemsByPost.set(item.feed_post_id, []);
          }
          itemsByPost.get(item.feed_post_id)!.push(item);
        });
      }

      const feedPosts: FeedPost[] = postsData.map((post: any) => {
        const owner = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
        return {
          id: post.id,
          image_url: post.image_url,
          caption: post.caption,
          music_preview_url: post.music_preview_url,
          like_count: post.like_count,
          is_liked: likedPostIds.has(post.id),
          comment_count: post.comment_count || 0,
          owner: {
            id: owner.id,
            username: owner.username,
            avatar_url: owner.avatar_url,
            is_verified: owner.is_verified || false
          },
          items: itemsByPost.get(post.id) || []
        };
      });

      setPosts(feedPosts);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  }

  function nextPost() {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setViewMode('discover');
    }
  }

  function prevPost() {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setViewMode('discover');
    }
  }

  function toggleMute() {
    setIsMuted(prev => !prev);
  }

  function handleImageClick() {
    if (currentPost.music_preview_url) {
      toggleMute();
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    setDragOffset(diff);
  }

  function handleTouchEnd() {
    if (Math.abs(dragOffset) > 100) {
      if (dragOffset > 0) nextPost();
      else prevPost();
    }
    setDragOffset(0);
    setIsDragging(false);
  }

  async function toggleLike(postId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to like posts');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    try {
      if (currentlyLiked) {
        await supabase.from('liked_feed_posts').delete()
          .eq('user_id', currentUserId)
          .eq('feed_post_id', postId);
      } else {
        await supabase.from('liked_feed_posts')
          .insert({ user_id: currentUserId, feed_post_id: postId });
      }

      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, is_liked: !currentlyLiked, like_count: currentlyLiked ? post.like_count - 1 : post.like_count + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  function handleComment() {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to comment');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    // TODO: Open comments modal
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-2xl font-black tracking-widest animate-pulse" style={{ fontFamily: 'Bebas Neue' }}>
          SOURCED
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-4" style={{ fontFamily: 'Archivo Black' }}>NO POSTS YET</h1>
          <button
            onClick={() => router.push('/create/post')}
            className="px-8 py-3 bg-white text-black hover:bg-black hover:text-white border-2 border-white transition-all font-black tracking-wider"
            style={{ fontFamily: 'Bebas Neue' }}
          >
            CREATE FIRST POST
          </button>
        </div>
      </div>
    );
  }

  const currentPost = posts[currentIndex];

  return (
    <>
      <Head>
        <title>Discover | Sourced</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        * {
          -webkit-tap-highlight-color: transparent;
        }

        body {
          overflow: hidden;
          font-family: 'Bebas Neue', sans-serif;
          background: #000;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -30px); }
        }

        @keyframes float-delay {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-40px, 40px); }
        }

        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, 20px); }
        }

        .slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-float {
          animation: float 20s ease-in-out infinite;
        }

        .animate-float-delay {
          animation: float-delay 25s ease-in-out infinite;
        }

        .animate-float-slow {
          animation: float-slow 30s ease-in-out infinite;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div
        ref={containerRef}
        className="fixed inset-0 bg-black overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Audio */}
        {currentPost.music_preview_url && (
          <audio
            ref={(el) => { if (el) audioRefs.current[currentPost.id] = el; }}
            src={currentPost.music_preview_url}
            loop
            playsInline
          />
        )}

        {/* Animated Background - Noise Texture + Dark Gradient */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Blurred image layer */}
          <div
            className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000"
            style={{
              backgroundImage: `url(${currentPost.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          ></div>
          {/* Dark gradient base */}
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat'
            }}
          ></div>
        </div>

        {/* Floating Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-40 right-20 w-96 h-96 bg-white/3 rounded-full blur-3xl animate-float-delay"></div>
          <div className="absolute top-1/3 right-10 w-48 h-48 bg-white/4 rounded-full blur-3xl animate-float-slow"></div>
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        {/* Main Content Container */}
        <div className="relative h-full flex items-center justify-center pt-8">

          {/* TikTok-Style FEED Header - Top Center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
            <h1
              className="text-white text-xl font-black tracking-[0.3em] opacity-90"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              FEED
            </h1>
          </div>

          {/* Left Side - Progress Only */}
          <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block z-10">
            <div className="text-white/60">
              <p className="text-xs tracking-widest mb-2 font-black" style={{ fontFamily: 'Bebas Neue' }}>PROGRESS</p>
              <div className="w-1 h-48 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="w-full bg-white transition-all duration-300"
                  style={{ height: `${((currentIndex + 1) / posts.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 z-10">
            {/* Like */}
            <button
              onClick={() => toggleLike(currentPost.id, currentPost.is_liked)}
              className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all hover:scale-110 border border-white/20"
            >
              <svg className="w-7 h-7" fill={currentPost.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            <div className="text-white/60 text-xs font-black text-center" style={{ fontFamily: 'Bebas Neue' }}>
              {currentPost.like_count}
            </div>

            {/* Comments */}
            <button
              onClick={handleComment}
              className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all hover:scale-110 border border-white/20"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <div className="text-white/60 text-xs font-black text-center" style={{ fontFamily: 'Bebas Neue' }}>
              {currentPost.comment_count}
            </div>

            {/* Share - Arrow */}
            <button
              className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all hover:scale-110 border border-white/20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
              </svg>
            </button>
          </div>

          {/* Central Image - The Focus */}
          <div className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center p-3 gap-3">

            {/* Image Card with Glow - CLEAN, NO DOTS */}
            <div className="absolute inset-8 bg-white/5 rounded-3xl blur-2xl"></div>

            <div
              className="relative w-full max-w-2xl aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 border border-white/10 cursor-pointer"
              style={{
                transform: isDragging ? `translateY(${-dragOffset * 0.5}px) scale(${1 - Math.abs(dragOffset) * 0.0002})` : 'none',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 80px rgba(255, 255, 255, 0.05)'
              }}
              onClick={handleImageClick}
            >
              {/* Main Image - CLEAN */}
              <img
                src={currentPost.image_url}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Volume Button - SMALLER - Top Right Corner */}
              {currentPost.music_preview_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="absolute top-3 right-3 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-all z-10"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    {isMuted ? (
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    ) : (
                      <>
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                        <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </>
                    )}
                  </svg>
                </button>
              )}
            </div>

            {/* Username & Caption BELOW image */}
            <div className="w-full max-w-2xl space-y-2">
              {/* Username - Clickable */}
              <div
                onClick={() => router.push(`/${currentPost.owner.username}`)}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-neutral-800">
                  {currentPost.owner.avatar_url ? (
                    <img src={currentPost.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm">👤</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-lg tracking-wide" style={{ fontFamily: 'Bebas Neue' }}>
                    {currentPost.owner.username}
                  </span>
                  {currentPost.owner.is_verified && (
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Caption */}
              {currentPost.caption && (
                <p className="text-white/90 text-base leading-relaxed px-2">
                  {currentPost.caption}
                </p>
              )}

              {/* Mobile Actions Row */}
              <div className="lg:hidden flex items-center gap-5 px-2">
                <button
                  onClick={() => toggleLike(currentPost.id, currentPost.is_liked)}
                  className="flex items-center gap-2 text-white hover:scale-110 transition-transform"
                >
                  <svg className="w-7 h-7" fill={currentPost.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{currentPost.like_count}</span>
                </button>

                <button onClick={handleComment} className="flex items-center gap-2 text-white hover:scale-110 transition-transform">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{currentPost.comment_count}</span>
                </button>

                <button className="flex items-center gap-2 text-white hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
                  </svg>
                </button>
              </div>

              {/* Shop Items Carousel - BELOW image */}
              {currentPost.items.length > 0 && viewMode === 'discover' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-white font-black text-lg tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
                      SHOP THIS LOOK
                    </h3>
                    <button
                      onClick={() => setViewMode('shop')}
                      className="text-white/60 hover:text-white text-sm font-black transition-colors"
                      style={{ fontFamily: 'Bebas Neue' }}
                    >
                      SEE ALL →
                    </button>
                  </div>

                  {/* Horizontal Scroll Carousel */}
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-2">
                    {currentPost.items.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => item.product_url && window.open(item.product_url, '_blank')}
                        className="flex-shrink-0 w-40 bg-white/10 backdrop-blur-md rounded-xl p-3 cursor-pointer hover:bg-white/20 transition-all border border-white/20"
                      >
                        <div className="aspect-square bg-white/5 rounded-lg overflow-hidden mb-2">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-white text-xs font-black line-clamp-2 mb-1" style={{ fontFamily: 'Bebas Neue' }}>
                          {item.title}
                        </p>
                        {item.price && (
                          <p className="text-white/80 text-sm font-black" style={{ fontFamily: 'Archivo Black' }}>
                            ${item.price}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shop Mode - Full Screen Grid */}
            {viewMode === 'shop' && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-30 overflow-y-auto p-6 fade-in">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-black text-white" style={{ fontFamily: 'Archivo Black' }}>
                      SHOP THIS LOOK
                    </h2>
                    <button
                      onClick={() => setViewMode('discover')}
                      className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {currentPost.items.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => item.product_url && window.open(item.product_url, '_blank')}
                        className="bg-white rounded-2xl p-4 cursor-pointer hover:scale-105 transition-transform slide-up"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <div className="aspect-square bg-neutral-100 rounded-xl overflow-hidden mb-3">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-xs text-black/50 mb-1 uppercase tracking-wider font-black" style={{ fontFamily: 'Bebas Neue' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <h3 className="font-black text-sm mb-2 leading-tight line-clamp-2" style={{ fontFamily: 'Bebas Neue' }}>
                          {item.title}
                        </h3>
                        {item.price && (
                          <p className="text-xl font-black mb-1" style={{ fontFamily: 'Archivo Black' }}>
                            ${item.price}
                          </p>
                        )}
                        {item.seller && (
                          <p className="text-xs text-black/50 uppercase tracking-wider">{item.seller}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Toast */}
        {showToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 fade-in">
            <div className="bg-white text-black px-6 py-3 rounded-full shadow-2xl">
              <p className="font-black text-sm tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
                {toastMessage}
              </p>
            </div>
          </div>
        )}

        {/* Swipe Indicator (first post only) */}
        {currentIndex === 0 && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-white/40 text-center z-20 fade-in">
            <svg className="w-8 h-8 mx-auto mb-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <p className="text-xs tracking-widest font-black" style={{ fontFamily: 'Bebas Neue' }}>
              SWIPE TO DISCOVER
            </p>
          </div>
        )}
      </div>
    </>
  );
}