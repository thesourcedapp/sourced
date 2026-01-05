"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";
import CommentsModal from "@/components/CommentsModal";

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

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [viewMode, setViewMode] = useState<'discover' | 'shop'>('discover');
  const [isMuted, setIsMuted] = useState(false);
  const [failedAudioPosts, setFailedAudioPosts] = useState<Set<string>>(new Set());
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

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

      // Get liked posts for current user
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
          is_liked: likedPostIds.has(post.id), // Check if current user liked it
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

  function handleImageClick() {
    // Just for potential future use
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
        // UNLIKE: Remove from liked_feed_posts
        const { error } = await supabase
          .from('liked_feed_posts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('feed_post_id', postId);

        if (error) {
          console.error('Unlike error:', error);
          throw error;
        }

        // Update local state
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: false, like_count: Math.max(0, post.like_count - 1) }
            : post
        ));
      } else {
        // LIKE: Add to liked_feed_posts
        const { error } = await supabase
          .from('liked_feed_posts')
          .insert({
            user_id: currentUserId,
            feed_post_id: postId
          });

        if (error) {
          console.error('Like error:', error);
          throw error;
        }

        // Update local state
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: true, like_count: post.like_count + 1 }
            : post
        ));
      }
    } catch (error: any) {
      console.error('Toggle like failed:', error);
      alert(`Failed to ${currentlyLiked ? 'unlike' : 'like'} post: ${error.message}`);
    }
  }

  function handleComment() {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to comment');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setShowCommentsModal(true);
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
        <title>Feed | Sourced</title>
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

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-scroll {
          animation: scroll 20s linear infinite;
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
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000"
            style={{
              backgroundImage: `url(${currentPost.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
        </div>

        {/* FEED Header - TikTok/IG Style with Indicator */}
        <div className="absolute top-0 left-0 right-0 z-30 pt-4 pb-2 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between px-4">
            <div className="w-10"></div>
            <div className="flex flex-col items-center">
              <h1 className="text-white text-lg font-semibold mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                Feed
              </h1>
              <div className="w-12 h-0.5 bg-white rounded-full"></div>
            </div>
            <button
              onClick={() => router.push('/create/post/setup')}
              className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative h-full flex flex-col items-center justify-center px-3 pt-20 pb-24">

          {/* Image Card - Slightly smaller now */}
          <div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 border border-white/10 cursor-pointer mb-3"
            style={{
              minHeight: '75vh',
              maxHeight: '78vh',
              transform: isDragging ? `translateY(${-dragOffset * 0.5}px) scale(${1 - Math.abs(dragOffset) * 0.0002})` : 'none',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
            onClick={handleImageClick}
          >
            {/* Main Image */}
            <img
              src={currentPost.image_url}
              alt=""
              className="w-full h-full object-cover"
            />

            {/* Shop Overlay - Blurred Photo Background */}
            {viewMode === 'shop' && (
              <div className="absolute inset-0 z-30 flex flex-col">
                {/* Blurred Background */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${currentPost.image_url})`,
                    filter: 'blur(40px)',
                    transform: 'scale(1.1)'
                  }}
                ></div>
                <div className="absolute inset-0 bg-black/60"></div>

                {/* Content */}
                <div className="relative flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-b from-black/50 to-transparent">
                    <h2 className="text-white text-2xl font-black tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
                      SHOP THE LOOK
                    </h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('discover');
                        setExpandedItem(null);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-white bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Items Grid or Expanded View */}
                  {!expandedItem ? (
                    <div className="flex-1 overflow-y-auto px-4 pb-6">
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {currentPost.items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl slide-up"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                          >
                            {/* Image */}
                            <div className="aspect-square bg-neutral-100 overflow-hidden">
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            </div>

                            {/* Content */}
                            <div className="p-3 space-y-2">
                              <h3 className="font-black text-xs leading-tight line-clamp-2 text-black" style={{ fontFamily: 'Bebas Neue' }}>
                                {item.title}
                              </h3>

                              {item.price && (
                                <p className="text-lg font-black text-black" style={{ fontFamily: 'Archivo Black' }}>
                                  ${item.price}
                                </p>
                              )}

                              {/* View Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedItem(item.id);
                                }}
                                className="w-full py-2.5 bg-black text-white font-black text-xs tracking-widest hover:bg-neutral-800 transition-colors rounded-lg"
                                style={{ fontFamily: 'Bebas Neue' }}
                              >
                                VIEW
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                      {(() => {
                        const item = currentPost.items.find(i => i.id === expandedItem);
                        if (!item) return null;

                        return (
                          <div className="w-full max-w-md mx-auto">
                            {/* Close Button - Prominent */}
                            <button
                              onClick={() => setExpandedItem(null)}
                              className="ml-auto mb-4 w-12 h-12 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-xl hover:bg-white transition-all hover:scale-110"
                            >
                              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>

                            <div className="bg-white/98 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl fade-in">
                              {/* Image - Modest Size */}
                              <div className="aspect-square bg-neutral-100 overflow-hidden">
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                              </div>

                              {/* Details */}
                              <div className="p-5 space-y-3">
                                {/* Title */}
                                <div>
                                  <h2 className="font-black text-xl leading-tight mb-1 text-black" style={{ fontFamily: 'Bebas Neue' }}>
                                    {item.title}
                                  </h2>
                                  {item.seller && (
                                    <p className="text-xs text-black/50 uppercase tracking-wider font-semibold">
                                      Sold by {item.seller}
                                    </p>
                                  )}
                                </div>

                                {/* Price */}
                                {item.price && (
                                  <div className="py-2">
                                    <p className="text-3xl font-black text-black" style={{ fontFamily: 'Archivo Black' }}>
                                      ${item.price}
                                    </p>
                                  </div>
                                )}

                                {/* Additional Details */}
                                <div className="pt-2 pb-1 space-y-2 border-t border-black/10">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-black/60 font-semibold">Product Type</span>
                                    <span className="text-black font-bold">Fashion Item</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-black/60 font-semibold">Availability</span>
                                    <span className="text-green-600 font-bold">In Stock</span>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-3">
                                  {item.product_url && (
                                    <button
                                      onClick={() => window.open(item.product_url!, '_blank')}
                                      className="w-full py-3.5 bg-black text-white font-black text-sm tracking-widest hover:bg-neutral-800 transition-colors rounded-xl"
                                      style={{ fontFamily: 'Bebas Neue' }}
                                    >
                                      BUY NOW
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setExpandedItem(null)}
                                    className="w-full py-3 bg-black/5 text-black font-black text-xs tracking-widest hover:bg-black/10 transition-colors rounded-xl"
                                    style={{ fontFamily: 'Bebas Neue' }}
                                  >
                                    BACK TO ALL ITEMS
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile + Shop Button */}
          <div className="w-full max-w-lg flex items-center justify-between mb-2">
            <div
              onClick={() => router.push(`/${currentPost.owner.username}`)}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
            >
              <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-neutral-800">
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

            {currentPost.items.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewMode(viewMode === 'shop' ? 'discover' : 'shop'); }}
                className="px-3 py-2 bg-white/90 backdrop-blur-sm text-black font-black text-[10px] tracking-widest rounded-full hover:bg-white transition-all"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                SHOP THE LOOK
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="w-full max-w-lg flex items-center gap-5 mb-2">
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

            <button
              onClick={() => {
                const shareUrl = `${window.location.origin}/post/${currentPost.id}`;
                if (navigator.share) {
                  navigator.share({
                    title: `@${currentPost.owner.username} on Sourced`,
                    url: shareUrl
                  });
                } else {
                  navigator.clipboard.writeText(shareUrl);
                  setToastMessage('Link copied!');
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 2000);
                }
              }}
              className="flex items-center gap-2 text-white hover:scale-110 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
              </svg>
            </button>
          </div>

          {/* Caption */}
          {currentPost.caption && (
            <div className="w-full max-w-lg mb-2">
              <p className="text-white/90 text-sm leading-relaxed">
                {currentPost.caption}
              </p>
            </div>
          )}
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

        {/* Swipe Indicator - MUCH LOWER */}
        {currentIndex === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-center z-20 fade-in">
            <svg className="w-8 h-8 mx-auto mb-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <p className="text-xs tracking-widest font-black" style={{ fontFamily: 'Bebas Neue' }}>
              SWIPE TO DISCOVER
            </p>
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {currentUserId && (
        <CommentsModal
          postId={currentPost.id}
          postOwnerId={currentPost.owner.id}
          isOpen={showCommentsModal}
          onClose={() => {
            setShowCommentsModal(false);
            // Reload comment count
            loadFeedPosts();
          }}
          currentUserId={currentUserId}
        />
      )}

      {/* Hide bottom nav when comments open */}
      <style jsx global>{`
        ${showCommentsModal ? `
          .mobile-bottom-nav {
            display: none !important;
          }
        ` : ''}
      `}</style>
    </>
  );
}