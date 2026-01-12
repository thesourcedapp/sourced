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

  // Improved swipe tracking
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const lastSwipeTime = useRef(0);

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
    if (currentUserId !== undefined) {
      loadInitialPost();
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
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', user.id)
        .single();

      setIsOnboarded(profile?.is_onboarded || false);
    } else {
      setCurrentUserId(null);
    }
  }

  async function loadInitialPost() {
    setLoading(true);
    try {
      const post = await fetchNextPost(true);
      if (post) {
        setCurrentPost(post);
        setPostHistory([post]);
        setCurrentHistoryIndex(0);
        setSeenPostIds(new Set([post.id]));
      }
    } catch (error) {
      console.error('Error loading initial post:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNextPost(isInitial: boolean): Promise<FeedPost | null> {
    try {
      const excludeIds = Array.from(seenPostIds);

      const response = await fetch('https://sourced-5ovn.onrender.com/feed/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId || null,
          exclude_ids: excludeIds,
          is_initial: isInitial
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.post) return null;

      const post = data.post;

      // Check like/save status
      if (currentUserId && isOnboarded) {
        const [likedRes, savedRes] = await Promise.all([
          supabase.from('liked_feed_posts').select('id').eq('user_id', currentUserId).eq('feed_post_id', post.id).single(),
          supabase.from('saved_feed_posts').select('id').eq('user_id', currentUserId).eq('feed_post_id', post.id).single()
        ]);

        post.is_liked = !!likedRes.data;
        post.is_saved = !!savedRes.data;

        // Check liked items
        if (post.items && post.items.length > 0) {
          const itemIds = post.items.map((item: any) => item.id);
          const { data: likedItems } = await supabase
            .from('liked_feed_post_items')
            .select('item_id')
            .eq('user_id', currentUserId)
            .in('item_id', itemIds);

          const likedItemIds = new Set(likedItems?.map(li => li.item_id) || []);
          post.items = post.items.map((item: any) => ({
            ...item,
            is_liked: likedItemIds.has(item.id)
          }));
        }
      } else {
        post.is_liked = false;
        post.is_saved = false;
        if (post.items) {
          post.items = post.items.map((item: any) => ({ ...item, is_liked: false }));
        }
      }

      return post;
    } catch (error) {
      console.error('Error fetching next post:', error);
      return null;
    }
  }

  async function preloadNextPost() {
    const post = await fetchNextPost(false);
    if (post) {
      setNextPostData(post);
    }
  }

  async function logPostInteraction(postId: string, timeSpent: number) {
    if (!currentUserId || !isOnboarded) return;

    try {
      await fetch('https://sourced-5ovn.onrender.com/feed/log-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          post_id: postId,
          time_spent: timeSpent,
          interacted: hasInteracted.current
        }),
      });
    } catch (error) {
      console.error('Error logging interaction:', error);
    }
  }

  const goToNextPost = async () => {
    if (isAnimating) return;

    // Debounce: prevent rapid swipes (300ms cooldown)
    const now = Date.now();
    if (now - lastSwipeTime.current < 300) return;
    lastSwipeTime.current = now;

    if (currentHistoryIndex < postHistory.length - 1) {
      setIsAnimating(true);
      setIsFading(true);

      setTimeout(() => {
        const nextIndex = currentHistoryIndex + 1;
        setCurrentPost(postHistory[nextIndex]);
        setCurrentHistoryIndex(nextIndex);
        setViewMode('discover');
        setIsFading(false);
        setTimeout(() => setIsAnimating(false), 30);
      }, 120);
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
          setTimeout(() => setIsAnimating(false), 30);
        }, 120);
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
          setTimeout(() => setIsAnimating(false), 30);
        }, 120);
      }
    }
  };

  const goToPrevPost = () => {
    if (isAnimating || currentHistoryIndex <= 0) return;

    // Debounce
    const now = Date.now();
    if (now - lastSwipeTime.current < 300) return;
    lastSwipeTime.current = now;

    setIsAnimating(true);
    setIsFading(true);

    setTimeout(() => {
      const prevIndex = currentHistoryIndex - 1;
      setCurrentPost(postHistory[prevIndex]);
      setCurrentHistoryIndex(prevIndex);
      setViewMode('discover');
      setIsFading(false);
      setTimeout(() => setIsAnimating(false), 30);
    }, 120);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      if (showCommentsModal || viewMode === 'shop') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPost();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPost();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnimating, currentHistoryIndex, postHistory, showCommentsModal, viewMode]);

  function handleTouchStart(e: React.TouchEvent) {
    if (isAnimating || viewMode === 'shop') return;

    setTouchStartY(e.targetTouches[0].clientY);
    setTouchStartTime(Date.now());
  }

  function handleTouchMove(e: React.TouchEvent) {
    // Allow native scroll behavior
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (isAnimating || viewMode === 'shop') return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();

    const distance = touchStartY - touchEndY;
    const duration = touchEndTime - touchStartTime;
    const velocity = Math.abs(distance / duration); // pixels per ms

    // Smart swipe: distance OR velocity
    const minSwipeDistance = 80;
    const minVelocity = 0.3;

    const isFastSwipe = velocity > minVelocity && Math.abs(distance) > 40;
    const isFullSwipe = Math.abs(distance) > minSwipeDistance;

    if (isFastSwipe || isFullSwipe) {
      if (distance > 0) {
        goToNextPost();
      } else {
        goToPrevPost();
      }
    }

    setTouchStartY(0);
    setTouchStartTime(0);
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
              ? { ...item, is_liked: !currentlyLiked, like_count: item.like_count + (currentlyLiked ? -1 : 1) }
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
          setCurrentPost({
            ...currentPost,
            is_saved: false
          });
        }
      } else {
        await supabase
          .from('saved_feed_posts')
          .insert({
            user_id: currentUserId,
            feed_post_id: postId
          });

        if (currentPost && currentPost.id === postId) {
          setCurrentPost({
            ...currentPost,
            is_saved: true
          });
        }
      }
    } catch (error) {
      console.error('Toggle save failed:', error);
    }
  }

  async function handleShare() {
    if (!currentPost) return;

    hasInteracted.current = true;

    const shareUrl = `${window.location.origin}/post/${currentPost.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this post on Sourced',
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setToastMessage('Link copied to clipboard!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✦</div>
          <p className="text-white text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue' }}>LOADING...</p>
        </div>
      </div>
    );
  }

  if (!currentPost) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6 opacity-20">✦</div>
          <h2 className="text-white text-2xl font-black tracking-tighter mb-3" style={{ fontFamily: 'Archivo Black' }}>
            NO POSTS YET
          </h2>
          <p className="text-white/60 text-sm mb-6">Be the first to create a post!</p>
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

        .fade-in {
          animation: fadeIn 0.15s ease-out;
        }

        .fade-out {
          animation: fadeOut 0.12s ease-out forwards;
        }

        .fade-in-content {
          animation: fadeInContent 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      <div
        className="relative h-screen w-screen bg-black overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Image with Blur */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${currentPost.image_url})`,
            filter: 'blur(40px)',
            transform: 'scale(1.1)',
            opacity: 0.3
          }}
        />

        {/* Main Content */}
        <div className={`relative h-full flex flex-col items-center justify-center px-3 pt-32 pb-24 ${isFading ? 'fade-out' : 'fade-in-content'}`}>
          {/* Post Image */}
          <div
            key={currentPost.id}
            className="relative max-w-md w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
            onClick={() => {
              if (viewMode === 'discover') {
                router.push(`/post/${currentPost.id}`);
              }
            }}
          >
            <img
              src={currentPost.image_url}
              alt="Post"
              className="w-full h-full object-cover"
            />

            {/* Shop Overlay */}
            {viewMode === 'shop' && currentPost.items && currentPost.items.length > 0 && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-sm overflow-y-auto p-4">
                <div className="space-y-3">
                  {currentPost.items.map((item) => (
                    <div key={item.id} className="flex gap-3 bg-white/10 rounded-lg p-3">
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white text-sm font-black truncate">{item.title}</h4>
                        {item.seller && <p className="text-white/60 text-xs truncate">{item.seller}</p>}
                        {item.price && <p className="text-white text-sm font-black mt-1">${item.price}</p>}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => toggleItemLike(item.id, item.is_liked)}
                            className={`text-xs px-3 py-1 rounded ${item.is_liked ? 'bg-red-500 text-white' : 'bg-white/20 text-white'}`}
                          >
                            {item.is_liked ? '♥' : '♡'} {item.like_count}
                          </button>
                          {item.product_url && (
                            <button
                              onClick={() => window.open(item.product_url!, '_blank')}
                              className="text-xs px-3 py-1 bg-white text-black rounded font-black"
                            >
                              SHOP
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Post Info */}
          <div className="mt-4 max-w-md w-full">
            {/* User Info */}
            <div
              className="flex items-center gap-3 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push(`/${currentPost.owner.username}`)}
            >
              <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                {currentPost.owner.avatar_url ? (
                  <img src={currentPost.owner.avatar_url} alt={currentPost.owner.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-sm tracking-wide">@{currentPost.owner.username}</p>
              </div>
            </div>

            {/* Caption */}
            {currentPost.caption && (
              <p className="text-white text-sm leading-relaxed mb-3">{currentPost.caption}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleLike(currentPost.id, currentPost.is_liked)}
                className="flex items-center gap-2 text-white hover:opacity-70 transition-opacity"
              >
                <span className="text-2xl">{currentPost.is_liked ? '♥' : '♡'}</span>
                <span className="text-sm font-black">{currentPost.like_count}</span>
              </button>

              <button
                onClick={handleComment}
                className="flex items-center gap-2 text-white hover:opacity-70 transition-opacity"
              >
                <span className="text-2xl">💬</span>
                <span className="text-sm font-black">{currentPost.comment_count}</span>
              </button>

              <button
                onClick={() => toggleSave(currentPost.id, currentPost.is_saved)}
                className="flex items-center gap-2 text-white hover:opacity-70 transition-opacity"
              >
                <span className="text-2xl">{currentPost.is_saved ? '🔖' : '📑'}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-2 text-white hover:opacity-70 transition-opacity ml-auto"
              >
                <span className="text-2xl">↗</span>
              </button>

              {currentPost.items && currentPost.items.length > 0 && (
                <button
                  onClick={() => setViewMode(viewMode === 'discover' ? 'shop' : 'discover')}
                  className="px-4 py-2 bg-white text-black rounded-full text-xs font-black tracking-wider hover:bg-white/90 transition-all"
                  style={{ fontFamily: 'Bebas Neue' }}
                >
                  {viewMode === 'discover' ? '🛍️ SHOP' : 'CLOSE'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Toast */}
        {showToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-lg z-50">
            <p className="text-sm font-black tracking-wide" style={{ fontFamily: 'Bebas Neue' }}>{toastMessage}</p>
          </div>
        )}

        {/* Comments Modal */}
        {showCommentsModal && currentPost && (
          <CommentsModal
            postId={currentPost.id}
            onClose={() => setShowCommentsModal(false)}
          />
        )}
      </div>
    </>
  );
}