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
  is_saved: boolean;
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
  const [currentPost, setCurrentPost] = useState<FeedPost | null>(null);
  const [nextPostData, setNextPostData] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);
  const [isOnboarded, setIsOnboarded] = useState(false);

  const [isAnimating, setIsAnimating] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [viewMode, setViewMode] = useState<'discover' | 'shop'>('discover');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Algorithm state
  const [seenPostIds, setSeenPostIds] = useState<Set<string>>(new Set());
  const [postHistory, setPostHistory] = useState<FeedPost[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  // Track time spent on post
  const postStartTime = useRef<number>(Date.now());
  const hasInteracted = useRef<boolean>(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    console.log('🎯 currentUserId changed:', currentUserId);
    // Load feed for both logged-in users AND guests
    if (currentUserId !== undefined) {
      console.log('✅ Loading initial post (user:', currentUserId || 'guest', ')');
      loadInitialPost();
    } else {
      console.log('⏳ Auth not checked yet...');
    }
  }, [currentUserId]);

  // Pre-load next post when current post loads
  useEffect(() => {
    if (currentPost && !nextPostData && !isAnimating) {
      preloadNextPost();
    }
  }, [currentPost, nextPostData, isAnimating]);

  // Track post view time
  useEffect(() => {
    if (currentPost) {
      postStartTime.current = Date.now();
      hasInteracted.current = false;

      return () => {
        const timeSpent = Date.now() - postStartTime.current;
        if (timeSpent > 1000) {
          logPostInteraction(currentPost.id, timeSpent);
        }
      };
    }
  }, [currentPost?.id]);

  async function loadCurrentUser() {
    console.log('🔐 Loading current user...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 User from Supabase:', user);

    if (user) {
      console.log('✅ User authenticated:', user.id);
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', user.id)
        .single();
      setIsOnboarded(profile?.is_onboarded || false);
      console.log('📋 Onboarded status:', profile?.is_onboarded);
    } else {
      console.log('❌ No user - guest mode');
      setCurrentUserId(null);
      setIsOnboarded(false);
    }
  }

  async function loadInitialPost() {
    console.log('🔄 Loading initial post...');
    setLoading(true);
    const post = await fetchNextPost(true);
    console.log('📦 Fetched post:', post);
    if (post) {
      setCurrentPost(post);
      setPostHistory([post]);
      setCurrentHistoryIndex(0);
      setSeenPostIds(new Set([post.id]));
      console.log('✅ Post loaded successfully');
    } else {
      console.log('❌ No post returned');
    }
    setLoading(false);
  }

  async function preloadNextPost() {
    const post = await fetchNextPost(false);
    if (post) {
      setNextPostData(post);
    }
  }

  async function fetchNextPost(isInitial: boolean = false): Promise<FeedPost | null> {
    try {
      // 🔥 BACKEND URL - Change before deploy! 🔥
      // LOCAL: http://localhost:8000
      // PRODUCTION: https://sourced-5ovn.onrender.com
      const BACKEND_URL = "https://sourced-5ovn.onrender.com";

      console.log('📡 Fetching from:', `${BACKEND_URL}/feed/next`);
      console.log('📤 Request data:', { exclude_ids: Array.from(seenPostIds), is_initial: isInitial, user_id: currentUserId });

      const response = await fetch(`${BACKEND_URL}/feed/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exclude_ids: Array.from(seenPostIds),
          is_initial: isInitial,
          user_id: currentUserId
        })
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        console.error('❌ Failed to fetch post:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (!data.post) {
        if (seenPostIds.size > 0 && !isInitial) {
          console.log('🔄 Resetting feed - all content seen');
          setSeenPostIds(new Set());
          return fetchNextPost(isInitial);
        }
        return null;
      }

      return data.post as FeedPost;
    } catch (error) {
      console.error('💥 Error fetching next post:', error);
      return null;
    }
  }

  async function logPostInteraction(postId: string, timeSpent: number) {
    if (!currentUserId) return;

    try {
      // 🔥 BACKEND URL - Change before deploy! 🔥
      const BACKEND_URL = "https://sourced-5ovn.onrender.com";

      await fetch(`${BACKEND_URL}/feed/log-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postId,
          time_spent: timeSpent,
          interacted: hasInteracted.current,
          user_id: currentUserId
        })
      });
    } catch (error) {
      console.error('Error logging interaction:', error);
    }
  }

  const goToNextPost = async () => {
    if (isAnimating) return;

    if (currentHistoryIndex < postHistory.length - 1) {
      setIsAnimating(true);
      setIsFading(true);

      setTimeout(() => {
        const nextIndex = currentHistoryIndex + 1;
        setCurrentPost(postHistory[nextIndex]);
        setCurrentHistoryIndex(nextIndex);
        setViewMode('discover');
        setIsFading(false);
        setTimeout(() => setIsAnimating(false), 50);
      }, 200);
    } else {
      if (!nextPostData) {
        const post = await fetchNextPost(false);
        if (!post) return;

        setIsAnimating(true);
        setIsFading(true);

        setTimeout(() => {
          setCurrentPost(post);
          setPostHistory(prev => [...prev, post]);
          setCurrentHistoryIndex(prev => prev + 1);
          setSeenPostIds(prev => new Set([...prev, post.id]));
          setNextPostData(null);
          setViewMode('discover');
          setIsFading(false);
          setTimeout(() => setIsAnimating(false), 50);
        }, 200);
      } else {
        setIsAnimating(true);
        setIsFading(true);

        setTimeout(() => {
          setCurrentPost(nextPostData);
          setPostHistory(prev => [...prev, nextPostData]);
          setCurrentHistoryIndex(prev => prev + 1);
          setSeenPostIds(prev => new Set([...prev, nextPostData.id]));
          setNextPostData(null);
          setViewMode('discover');
          setIsFading(false);
          setTimeout(() => setIsAnimating(false), 50);
        }, 200);
      }
    }
  };

  const goToPrevPost = () => {
    if (isAnimating || currentHistoryIndex <= 0) return;

    setIsAnimating(true);
    setIsFading(true);

    setTimeout(() => {
      const prevIndex = currentHistoryIndex - 1;
      setCurrentPost(postHistory[prevIndex]);
      setCurrentHistoryIndex(prevIndex);
      setViewMode('discover');
      setIsFading(false);
      setTimeout(() => setIsAnimating(false), 50);
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      if (showCommentsModal || viewMode === 'shop') return; // Don't interfere with modals/overlays

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPost();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPost();
      }
    };

    // Remove wheel event - too sensitive and causes auto-scroll
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnimating, currentHistoryIndex, postHistory, showCommentsModal, viewMode]);

  function handleTouchStart(e: React.TouchEvent) {
    if (isAnimating) return;
    if (viewMode === 'shop') return; // Don't interfere with shop overlay scrolling
    setTouchStart(e.targetTouches[0].clientY);
    setTouchEnd(e.targetTouches[0].clientY);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (isAnimating) return;
    if (viewMode === 'shop') return;
    setTouchEnd(e.targetTouches[0].clientY);
  }

  function handleTouchEnd() {
    if (isAnimating) return;
    if (viewMode === 'shop') return;

    const swipeDistance = touchStart - touchEnd;
    const minSwipeDistance = 150; // Increased from 100 for more intentional swipes

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        goToNextPost();
      } else {
        goToPrevPost();
      }
    }

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

    hasInteracted.current = true;

    try {
      if (currentlyLiked) {
        await supabase
          .from('liked_feed_posts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('feed_post_id', postId);

        if (currentPost && currentPost.id === postId) {
          setCurrentPost({
            ...currentPost,
            is_liked: false,
            like_count: Math.max(0, currentPost.like_count - 1)
          });
        }
      } else {
        await supabase
          .from('liked_feed_posts')
          .insert({
            user_id: currentUserId,
            feed_post_id: postId
          });

        if (currentPost && currentPost.id === postId) {
          setCurrentPost({
            ...currentPost,
            is_liked: true,
            like_count: currentPost.like_count + 1
          });
        }
      }
    } catch (error: any) {
      console.error('Toggle like failed:', error);
    }
  }

  function handleComment() {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to comment');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    hasInteracted.current = true;
    setShowCommentsModal(true);
  }

  async function toggleItemLike(itemId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to like items');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    hasInteracted.current = true;

    try {
      if (currentlyLiked) {
        await supabase
          .from('liked_feed_post_items')
          .delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);
      } else {
        await supabase
          .from('liked_feed_post_items')
          .insert({
            user_id: currentUserId,
            item_id: itemId
          });
      }

      if (currentPost) {
        setCurrentPost({
          ...currentPost,
          items: currentPost.items.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  is_liked: !currentlyLiked,
                  like_count: currentlyLiked ? Math.max(0, item.like_count - 1) : item.like_count + 1
                }
              : item
          )
        });
      }
    } catch (error) {
      console.error('Toggle item like failed:', error);
    }
  }

  async function toggleSave(postId: string, currentlySaved: boolean) {
    if (!currentUserId || !isOnboarded) {
      setToastMessage('Please log in to save posts');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    hasInteracted.current = true;

    try {
      if (currentlySaved) {
        await supabase
          .from('saved_feed_posts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('feed_post_id', postId);

        if (currentPost && currentPost.id === postId) {
          setCurrentPost({ ...currentPost, is_saved: false });
        }

        setToastMessage('Post removed from saved');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } else {
        await supabase
          .from('saved_feed_posts')
          .insert({
            user_id: currentUserId,
            feed_post_id: postId
          });

        if (currentPost && currentPost.id === postId) {
          setCurrentPost({ ...currentPost, is_saved: true });
        }

        setToastMessage('Post saved!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (error: any) {
      console.error('Toggle save failed:', error);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-white text-3xl font-black tracking-widest animate-pulse" style={{ fontFamily: 'Bebas Neue' }}>
            SOURCED
          </div>
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentPost) {
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

        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes fadeInContent {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
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

        .fade-out {
          animation: fadeOut 0.2s ease-out forwards;
        }

        .fade-in-content {
          animation: fadeInContent 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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

        {/* FEED Header */}
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

        {/* Main Content with Animation */}
        <div className={`relative h-full flex flex-col items-center justify-center px-3 pt-32 pb-24 ${isFading ? 'fade-out' : 'fade-in-content'}`}>

          {/* Image Card */}
          <div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-3"
            style={{
              minHeight: '64vh',
              maxHeight: '66vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
          >
            {/* Main Image */}
            <img
              key={currentPost.id}
              src={currentPost.image_url}
              alt=""
              className="w-full h-full object-cover"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
            />

            {/* Shop Overlay */}
            {viewMode === 'shop' && (
              <div className="absolute inset-0 z-30 flex flex-col">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${currentPost.image_url})`,
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

                  <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {currentPost.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className="bg-black border border-white/20 rounded-xl overflow-hidden shadow-xl slide-up hover:border-white/40 transition-all"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <div
                            className="aspect-square bg-neutral-900 overflow-hidden cursor-pointer relative"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.product_url) window.open(item.product_url, '_blank');
                            }}
                          >
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />

                            {/* Like Button Overlay */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemLike(item.id, item.is_liked);
                              }}
                              className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                            >
                              <svg
                                className="w-4 h-4 text-white"
                                fill={item.is_liked ? 'currentColor' : 'none'}
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
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

                            <div className="flex items-center justify-between mb-3">
                              {item.price && (
                                <p className="text-base font-black text-white" style={{ fontFamily: 'Archivo Black' }}>
                                  ${item.price}
                                </p>
                              )}

                              {/* Like Count */}
                              {item.like_count > 0 && (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                  </svg>
                                  <span className="text-xs text-white/60 font-black" style={{ fontFamily: 'Bebas Neue' }}>
                                    {item.like_count}
                                  </span>
                                </div>
                              )}
                            </div>

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
                className="px-4 py-2 bg-white/95 backdrop-blur-sm text-black font-black text-[11px] tracking-widest rounded-full hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-lg"
                style={{ fontFamily: 'Bebas Neue' }}
              >
                {viewMode === 'shop' ? 'CLOSE' : 'SHOP THE LOOK'}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="w-full max-w-lg flex items-center gap-5 mb-2">
            <button
              onClick={() => toggleLike(currentPost.id, currentPost.is_liked)}
              className="flex items-center gap-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <svg className="w-7 h-7 transition-all" fill={currentPost.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{currentPost.like_count}</span>
            </button>

            <button onClick={handleComment} className="flex items-center gap-2 text-white hover:scale-110 active:scale-95 transition-transform">
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
              className="flex items-center gap-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
              </svg>
            </button>

            {/* Save/Bookmark Button */}
            <button
              onClick={() => toggleSave(currentPost.id, currentPost.is_saved)}
              className="ml-auto flex items-center gap-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6 transition-all" fill={currentPost.is_saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
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

        {/* Swipe Indicator */}
        {currentHistoryIndex === 0 && (
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
            if (currentPost) {
              supabase
                .from('feed_posts')
                .select('comment_count')
                .eq('id', currentPost.id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setCurrentPost({
                      ...currentPost,
                      comment_count: data.comment_count || 0
                    });
                  }
                });
            }
          }}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}