"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Head from "next/head";

type FeedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  owner: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
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
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

  useEffect(() => {
    loadCurrentUser();
    loadFeedPosts();
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, posts.length]);

  // Handle touch gestures
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let endY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      touchStartY.current = startY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isScrolling.current) return;
      endY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      if (isScrolling.current) return;

      const diff = touchStartY.current - endY;

      if (diff > 50) {
        goToNext();
      } else if (diff < -50) {
        goToPrevious();
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
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
      console.log('📸 Loading feed posts...');

      // Get all feed posts with owner info
      const { data: postsData, error: postsError } = await supabase
        .from('feed_posts')
        .select(`
          id,
          image_url,
          caption,
          like_count,
          created_at,
          owner_id,
          profiles!feed_posts_owner_id_fkey(id, username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) {
        console.error('❌ Error loading posts:', postsError);
        throw postsError;
      }

      if (!postsData || postsData.length === 0) {
        console.log('📭 No feed posts yet');
        setPosts([]);
        setLoading(false);
        return;
      }

      console.log(`✅ Found ${postsData.length} posts`);

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

      // Get linked items for each post
      const postIds = postsData.map(p => p.id);
      const { data: linkedItemsData } = await supabase
        .from('feed_post_items')
        .select(`
          feed_post_id,
          catalog_items!inner(
            id,
            title,
            image_url,
            product_url,
            price,
            seller
          )
        `)
        .in('feed_post_id', postIds);

      // Group items by post
      const itemsByPost = new Map<string, any[]>();
      if (linkedItemsData) {
        linkedItemsData.forEach((link: any) => {
          const postId = link.feed_post_id;
          const item = link.catalog_items;

          if (!itemsByPost.has(postId)) {
            itemsByPost.set(postId, []);
          }
          itemsByPost.get(postId)!.push(item);
        });
      }

      // Build feed posts
      const feedPosts: FeedPost[] = postsData.map((post: any) => {
        const owner = post.profiles;

        return {
          id: post.id,
          image_url: post.image_url,
          caption: post.caption,
          like_count: post.like_count,
          is_liked: likedPostIds.has(post.id),
          created_at: post.created_at,
          owner: {
            id: owner.id,
            username: owner.username,
            full_name: owner.full_name,
            avatar_url: owner.avatar_url
          },
          items: itemsByPost.get(post.id) || []
        };
      });

      console.log('✅ Feed loaded:', feedPosts.length, 'posts');
      setPosts(feedPosts);
    } catch (error) {
      console.error('❌ Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  }

  function goToNext() {
    if (currentIndex < posts.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      scrollToIndex(newIndex);
    }
  }

  function goToPrevious() {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      scrollToIndex(newIndex);
    }
  }

  function scrollToIndex(index: number) {
    const container = containerRef.current;
    if (!container) return;

    isScrolling.current = true;

    container.scrollTo({
      top: index * window.innerHeight,
      behavior: 'smooth'
    });

    setTimeout(() => {
      isScrolling.current = false;
    }, 500);
  }

  async function toggleLike(postId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      setShowLoginMessage(true);
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

      // Update local state
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
              ...post,
              is_liked: !currentlyLiked,
              like_count: currentlyLiked ? post.like_count - 1 : post.like_count + 1
            }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  if (loading) {
    return (
      <>
        <Head><title>Feed | Sourced</title></Head>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>LOADING...</p>
        </div>
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <Head><title>Feed | Sourced</title></Head>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>NO POSTS YET</h1>
            <p className="text-xs tracking-wider opacity-60 mb-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Be the first to post</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-white text-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all text-xs tracking-[0.4em] font-black"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              GO HOME
            </button>
          </div>
        </div>
      </>
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

        body {
          overflow: hidden;
        }

        .feed-container::-webkit-scrollbar {
          display: none;
        }

        .feed-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div
        ref={containerRef}
        className="feed-container fixed inset-0 bg-black overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            className="relative w-full h-screen flex items-center justify-center"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src={post.image_url}
                alt={post.caption || 'Feed post'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
            </div>

            {/* Content Overlay */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between p-4 safe-area-inset">
              {/* Top Bar */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => router.push('/')}
                  className="text-white text-2xl font-black tracking-tighter"
                  style={{ fontFamily: 'Archivo Black, sans-serif' }}
                >
                  SOURCED
                </button>

                <div className="text-white/40 text-[10px] tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {currentIndex + 1} / {posts.length}
                </div>
              </div>

              {/* Bottom Content */}
              <div className="space-y-4 pb-8">
                {/* User Info */}
                <div
                  className="flex items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
                  onClick={() => router.push(`/${post.owner.username}`)}
                >
                  <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden flex-shrink-0">
                    {post.owner.avatar_url ? (
                      <img src={post.owner.avatar_url} alt={post.owner.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      @{post.owner.username}
                    </p>
                    {post.owner.full_name && (
                      <p className="text-white/60 text-xs">{post.owner.full_name}</p>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {post.caption && (
                  <div className="max-w-md">
                    <p className="text-white text-sm leading-relaxed">
                      {post.caption}
                    </p>
                  </div>
                )}

                {/* Linked Items */}
                {post.items.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {post.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => item.product_url && window.open(item.product_url, '_blank')}
                        className="flex-shrink-0 w-24 cursor-pointer group"
                      >
                        <div className="w-24 h-24 bg-white/10 border border-white/30 overflow-hidden mb-1 group-hover:border-white transition-all">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-white text-[10px] font-black truncate tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          {item.title}
                        </p>
                        {item.price && (
                          <p className="text-white/60 text-[9px]">${item.price}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Side Actions */}
              <div className="absolute right-4 bottom-32 md:bottom-40 flex flex-col gap-5">
                {/* Like Button */}
                <button
                  onClick={() => toggleLike(post.id, post.is_liked)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    post.is_liked
                      ? 'bg-white text-black border-white'
                      : 'bg-black/40 backdrop-blur-sm text-white border-white/40'
                  }`}>
                    <span className="text-2xl">{post.is_liked ? '♥' : '♡'}</span>
                  </div>
                  <span className="text-white text-xs font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {post.like_count}
                  </span>
                </button>
              </div>

              {/* Navigation Hint */}
              {currentIndex < posts.length - 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
                  <div className="text-white/40 text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    ↓ SWIPE
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Login Message */}
      {showLoginMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm">
          <div className="bg-black border-2 border-white p-4 shadow-lg relative">
            <button
              onClick={() => setShowLoginMessage(false)}
              className="absolute top-2 right-2 text-white hover:opacity-50 transition-opacity text-lg leading-none"
            >
              ✕
            </button>
            <p className="text-white text-sm tracking-wide pr-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              LOG IN TO LIKE POSTS
            </p>
          </div>
        </div>
      )}
    </>
  );
}