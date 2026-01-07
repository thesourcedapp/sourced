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
    like_count: number;
    is_liked: boolean;
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
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    loadCurrentUser();
    loadFeedPosts();
  }, []);

  useEffect(() => {
    if (currentUserId && posts.length > 0 && posts[currentIndex]) {
      // Refresh likes for current post when it changes
      refreshCurrentPostLikes();
    }
  }, [currentUserId, currentIndex]);

  async function refreshCurrentPostLikes() {
    if (!currentUserId || posts.length === 0 || !posts[currentIndex]) return;

    try {
      const currentPostId = posts[currentIndex].id;

      // Check if current post is liked
      const { data: likedData } = await supabase
        .from('liked_feed_posts')
        .select('feed_post_id')
        .eq('user_id', currentUserId)
        .eq('feed_post_id', currentPostId)
        .single();

      // Update only the current post
      setPosts(prev => prev.map(post =>
        post.id === currentPostId
          ? { ...post, is_liked: !!likedData }
          : post
      ));
    } catch (error) {
      // If no data found, post is not liked - that's fine
      console.log('Post not liked');
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') nextPost();
      if (e.key === 'ArrowUp') prevPost();
    };

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 50) {
        if (e.deltaY > 0) {
          nextPost();
        } else {
          prevPost();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
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
        .select('id, feed_post_id, title, image_url, product_url, price, seller, like_count')
        .in('feed_post_id', postIds);

      // Get liked items for current user
      let likedItemIds: Set<string> = new Set();
      if (currentUserId && itemsData) {
        const itemIds = itemsData.map(item => item.id);
        const { data: likedItemsData } = await supabase
          .from('liked_items')
          .select('item_id')
          .eq('user_id', currentUserId)
          .in('item_id', itemIds);

        if (likedItemsData) {
          likedItemIds = new Set(likedItemsData.map(like => like.item_id));
        }
      }

      const itemsByPost = new Map<string, any[]>();
      if (itemsData) {
        itemsData.forEach((item: any) => {
          if (!itemsByPost.has(item.feed_post_id)) {
            itemsByPost.set(item.feed_post_id, []);
          }
          itemsByPost.get(item.feed_post_id)!.push({
            ...item,
            like_count: item.like_count || 0,
            is_liked: likedItemIds.has(item.id)
          });
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
    setTouchStart(e.targetTouches[0].clientY);
    setTouchEnd(e.targetTouches[0].clientY); // Reset end position
  }

  function handleTouchMove(e: React.TouchEvent) {
    setTouchEnd(e.targetTouches[0].clientY);
  }

  function handleTouchEnd() {
    const swipeDistance = touchStart - touchEnd;
    const minSwipeDistance = 100; // Minimum distance for a swipe (prevents taps from triggering)

    // Only trigger if it's actually a swipe, not just a tap
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swiped up
        nextPost();
      } else {
        // Swiped down
        prevPost();
      }
    }

    // Reset
    setTouchStart(0);
    setTouchEnd(0);
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
          return; // Silently fail
        }

        // Update local state
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: false, like_count: Math.max(0, post.like_count - 1) }
            : post
        ));

        // Refresh current post from database
        setTimeout(() => refreshCurrentPostLikes(), 100);
      } else {
        // LIKE: Add to liked_feed_posts
        const { error } = await supabase
          .from('liked_feed_posts')
          .insert({
            user_id: currentUserId,
            feed_post_id: postId
          });

        // Ignore duplicate key errors (user already liked it)
        if (error && !error.message.includes('duplicate')) {
          console.error('Like error:', error);
          return; // Silently fail
        }

        // Update local state
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: true, like_count: post.like_count + 1 }
            : post
        ));

        // Refresh current post from database
        setTimeout(() => refreshCurrentPostLikes(), 100);
      }
    } catch (error: any) {
      console.error('Toggle like failed:', error);
      // Silently fail - no alerts
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

  async function toggleItemLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to like items');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    try {
      if (currentlyLiked) {
        // Unlike
        const { error } = await supabase
          .from('liked_items')
          .delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);

        if (error) {
          console.error('Unlike item error:', error);
          return;
        }
      } else {
        // Like
        const { error } = await supabase
          .from('liked_items')
          .insert({
            user_id: currentUserId,
            item_id: itemId
          });

        if (error && !error.message.includes('duplicate')) {
          console.error('Like item error:', error);
          return;
        }
      }

      // Update items in current post
      setPosts(prev => prev.map(post =>
        post.id === currentPost.id
          ? {
              ...post,
              items: post.items.map(item =>
                item.id === itemId
                  ? {
                      ...item,
                      is_liked: !currentlyLiked,
                      like_count: currentlyLiked ? (item.like_count || 0) - 1 : (item.like_count || 0) + 1
                    }
                  : item
              )
            }
          : post
      ));
    } catch (error) {
      console.error('Toggle item like failed:', error);
    }
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

        {/* FEED Header - Raised and bolder */}
        <div className="absolute top-0 left-0 right-0 z-30 pt-3 pb-3">
          <div className="flex items-center justify-between px-4">
            <div className="w-10"></div>
            <div className="flex flex-col items-center">
              <h1 className="text-white text-xl font-bold mb-1.5 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '-0.02em' }}>
                Feed
              </h1>
              <div className="w-10 h-0.5 bg-white rounded-full"></div>
            </div>
            <button
              onClick={() => router.push('/create/post/setup')}
              className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content - Adjusted for raised header */}
        <div className="relative h-full flex flex-col items-center justify-center px-3 pt-32 pb-24">

          {/* Image Card - No drag, smooth */}
          <div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-3"
            style={{
              minHeight: '64vh',
              maxHeight: '66vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              touchAction: 'pan-y' // Smooth vertical scrolling only
            }}
          >
            {/* Main Image */}
            <img
              src={currentPost.image_url}
              alt=""
              className="w-full h-full object-cover"
            />

            {/* Shop Overlay - Grid like Discover page */}
            {viewMode === 'shop' && (
              <div className="absolute inset-0 z-30 flex flex-col">
                {/* Different Background - Darker with more contrast */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${currentPost.image_url})`,
                    filter: 'blur(50px) brightness(0.4)',
                    transform: 'scale(1.2)'
                  }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80"></div>

                {/* Content */}
                <div className="relative flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-5">
                    <h2 className="text-white text-2xl font-black tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
                      SHOP THE LOOK
                    </h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('discover');
                      }}
                      className="w-10 h-10 flex items-center justify-center text-white bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Items Grid - Black Cards */}
                  <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {currentPost.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className="bg-black border border-white/20 rounded-xl overflow-hidden shadow-xl slide-up hover:border-white/40 transition-all"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          {/* Image */}
                          <div
                            className="aspect-square bg-neutral-900 overflow-hidden cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.product_url) window.open(item.product_url, '_blank');
                            }}
                          >
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                          </div>

                          {/* Content - Black Card */}
                          <div className="p-3 bg-black border-t border-white/20">
                            {/* Seller */}
                            {item.seller && (
                              <p className="text-[9px] text-white/50 uppercase tracking-wider font-bold mb-1.5">
                                {item.seller}
                              </p>
                            )}

                            {/* Title */}
                            <h3 className="text-xs font-black tracking-wide uppercase leading-tight text-white mb-2 line-clamp-2" style={{ fontFamily: 'Bebas Neue' }}>
                              {item.title}
                            </h3>

                            {/* Price */}
                            {item.price && (
                              <p className="text-base font-black text-white mb-3" style={{ fontFamily: 'Archivo Black' }}>
                                ${item.price}
                              </p>
                            )}

                            {/* View Button */}
                            {item.product_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(item.product_url!, '_blank');
                                }}
                                className="w-full py-2 border border-white/40 hover:bg-white hover:text-black transition-all text-xs font-black text-white"
                                style={{ fontFamily: 'Bebas Neue' }}
                              >
                                VIEW PRODUCT
                              </button>
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
                  <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
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
    </>
  );
}