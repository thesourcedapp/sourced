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
  comment_count: number;
  created_at: string;
  owner: {
    id: string;
    username: string;
    full_name: string | null;
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
  is_following: boolean;
};

export default function VogueFeed() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [feedType, setFeedType] = useState<'for-you' | 'following'>('for-you');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showCommentsForPost, setShowCommentsForPost] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    loadCurrentUser();
    loadFeedPosts();
  }, []);

  useEffect(() => {
    if (currentUserId !== null) {
      setCurrentIndex(0);
      loadFeedPosts();
    }
  }, [feedType]);

  useEffect(() => {
    if (showCommentsForPost) {
      loadComments(showCommentsForPost);
    }
  }, [showCommentsForPost]);

  function showToastNotification(message: string) {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

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
      let query = supabase
        .from('feed_posts')
        .select(`
          id,
          image_url,
          caption,
          like_count,
          comment_count,
          created_at,
          owner_id,
          profiles!feed_posts_owner_id_fkey(id, username, full_name, avatar_url, is_verified)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (feedType === 'following' && currentUserId) {
        const { data: followingData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', currentUserId);

        if (followingData && followingData.length > 0) {
          const followingIds = followingData.map(f => f.following_id);
          query = query.in('owner_id', followingIds);
        } else {
          setPosts([]);
          setLoading(false);
          return;
        }
      }

      const { data: postsData, error: postsError } = await query;

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      let likedPostIds: Set<string> = new Set();
      let followingIds: Set<string> = new Set();

      if (currentUserId) {
        const [likedData, followingData] = await Promise.all([
          supabase.from('liked_feed_posts').select('feed_post_id').eq('user_id', currentUserId),
          supabase.from('followers').select('following_id').eq('follower_id', currentUserId)
        ]);

        if (likedData.data) {
          likedPostIds = new Set(likedData.data.map(like => like.feed_post_id));
        }
        if (followingData.data) {
          followingIds = new Set(followingData.data.map(f => f.following_id));
        }
      }

      const postIds = postsData.map(p => p.id);
      const { data: linkedItemsData } = await supabase
        .from('feed_post_items')
        .select('*')
        .in('feed_post_id', postIds);

      const itemsByPost = new Map<string, any[]>();
      if (linkedItemsData) {
        linkedItemsData.forEach((item: any) => {
          const postId = item.feed_post_id;
          if (!itemsByPost.has(postId)) {
            itemsByPost.set(postId, []);
          }
          itemsByPost.get(postId)!.push(item);
        });
      }

      const feedPosts: FeedPost[] = postsData.map((post: any) => {
        const owner = post.profiles;
        return {
          id: post.id,
          image_url: post.image_url,
          caption: post.caption,
          like_count: post.like_count,
          is_liked: likedPostIds.has(post.id),
          comment_count: post.comment_count || 0,
          created_at: post.created_at,
          owner: {
            id: owner.id,
            username: owner.username,
            full_name: owner.full_name,
            avatar_url: owner.avatar_url,
            is_verified: owner.is_verified || false
          },
          items: itemsByPost.get(post.id) || [],
          is_following: followingIds.has(owner.id)
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
    if (isTransitioning || currentIndex >= posts.length - 1) return;
    setDirection('next');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsTransitioning(false), 100);
    }, 700);
  }

  function prevPost() {
    if (isTransitioning || currentIndex <= 0) return;
    setDirection('prev');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => setIsTransitioning(false), 100);
    }, 700);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPost();
      else prevPost();
    }
  }

  async function toggleLike(postId: string, currentlyLiked: boolean) {
    if (!currentUserId || !isOnboarded) {
      showToastNotification('Please log in to like posts');
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

  async function toggleFollow(userId: string, currentlyFollowing: boolean) {
    if (!currentUserId || !isOnboarded) {
      showToastNotification('Please log in to follow users');
      return;
    }

    try {
      if (currentlyFollowing) {
        await supabase.from('followers').delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);
      } else {
        await supabase.from('followers')
          .insert({ follower_id: currentUserId, following_id: userId });
      }

      setPosts(prev => prev.map(post =>
        post.owner.id === userId
          ? { ...post, is_following: !currentlyFollowing }
          : post
      ));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  }

  async function loadComments(postId: string) {
    try {
      const { data, error } = await supabase
        .from('feed_post_comments')
        .select(`
          id,
          comment_text,
          created_at,
          user_id,
          profiles!feed_post_comments_user_id_fkey(id, username, avatar_url, is_verified)
        `)
        .eq('feed_post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  async function submitComment(postId: string) {
    if (!currentUserId || !isOnboarded || !commentText.trim()) return;

    try {
      const { error } = await supabase
        .from('feed_post_comments')
        .insert({
          feed_post_id: postId,
          user_id: currentUserId,
          comment_text: commentText.trim()
        });

      if (error) throw error;

      setCommentText('');
      loadComments(postId);

      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, comment_count: post.comment_count + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  }

  if (loading) {
    return (
      <>
        <Head><title>Feed | Sourced</title></Head>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <Head><title>Feed | Sourced</title></Head>
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-4xl font-black text-white mb-4">NO POSTS YET</h1>
            <button
              onClick={() => router.push('/create/post')}
              className="px-6 py-3 bg-white text-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all"
            >
              CREATE POST
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Sourced | Fashion</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        body {
          overflow: hidden;
          font-family: 'Bebas Neue', sans-serif;
          color: #FFFFFF;
        }

        @keyframes slideOutNext {
          0% { transform: translateX(0%) scale(1); opacity: 1; }
          100% { transform: translateX(-100%) scale(0.9); opacity: 0; }
        }

        @keyframes slideOutPrev {
          0% { transform: translateX(0%) scale(1); opacity: 1; }
          100% { transform: translateX(100%) scale(0.9); opacity: 0; }
        }

        @keyframes slideInNext {
          0% { transform: translateX(100%) scale(0.9); opacity: 0; }
          100% { transform: translateX(0%) scale(1); opacity: 1; }
        }

        @keyframes slideInPrev {
          0% { transform: translateX(-100%) scale(0.9); opacity: 0; }
          100% { transform: translateX(0%) scale(1); opacity: 1; }
        }

        .transition-out-next { animation: slideOutNext 0.7s cubic-bezier(0.76, 0, 0.24, 1) forwards; }
        .transition-out-prev { animation: slideOutPrev 0.7s cubic-bezier(0.76, 0, 0.24, 1) forwards; }
        .transition-in-next { animation: slideInNext 0.7s cubic-bezier(0.76, 0, 0.24, 1) forwards; }
        .transition-in-prev { animation: slideInPrev 0.7s cubic-bezier(0.76, 0, 0.24, 1) forwards; }

        @keyframes fadeIn {
          0% { opacity: 0; transform: translate(-50%, -10px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      <div
        className="fixed inset-0 bg-black overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* SOURCED Title - Scrolls Away */}
        <div className="text-center py-6 md:py-8 bg-black">
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            SOURCED
          </h1>
        </div>

        {/* For You / Following Tabs - Sticky */}
        <div className="sticky top-0 z-40 bg-black border-b border-white/20">
          <div className="flex items-center justify-center gap-8 py-4">
            <button
              onClick={() => setFeedType('for-you')}
              className={`text-lg md:text-2xl font-black tracking-tight transition-all ${
                feedType === 'for-you' ? 'text-white' : 'text-white/30'
              }`}
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              FOR YOU
              {feedType === 'for-you' && (
                <div className="h-0.5 bg-white mt-1"></div>
              )}
            </button>
            <div className="w-px h-6 bg-white/20"></div>
            <button
              onClick={() => setFeedType('following')}
              className={`text-lg md:text-2xl font-black tracking-tight transition-all ${
                feedType === 'following' ? 'text-white' : 'text-white/30'
              }`}
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              FOLLOWING
              {feedType === 'following' && (
                <div className="h-0.5 bg-white mt-1"></div>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Posts */}
        <div>
          {posts.map((post, idx) => (
            <div key={post.id} className="w-full bg-black mb-6">
              {/* Dark Grey Card Background */}
              <div className="w-full max-w-7xl mx-auto bg-neutral-900 rounded-3xl p-4 md:p-6">

                {/* Username Banner - Skinnier with Inward Triangles on Both Sides */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    onClick={() => router.push(`/@${post.owner.username}`)}
                    className="flex items-center gap-3 text-base md:text-xl bg-white text-black px-5 py-1 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{
                      clipPath: 'polygon(0 0, calc(100% - 8px) 0%, calc(100% - 0px) 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)'
                    }}
                  >
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-black">
                      {post.owner.avatar_url ? (
                        <img src={post.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-neutral-200 flex items-center justify-center text-sm text-black">👤</div>
                      )}
                    </div>
                    <span className="font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>@{post.owner.username}</span>
                    {post.owner.is_verified && (
                      <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Hole Punch Circle - Tag Style */}
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-4 border-neutral-700 bg-black"></div>
                </div>

                {/* Hero Image with Shop Overlay - Clickable */}
                <div className="mb-6 relative">
                  <img
                    src={post.image_url}
                    alt=""
                    onClick={() => post.items.length > 0 && setSelectedPostId(post.id === selectedPostId ? null : post.id)}
                    className={`w-full h-auto object-cover ${post.items.length > 0 ? 'cursor-pointer' : ''}`}
                    style={{ maxHeight: '80vh' }}
                  />

                  {/* Shop The Look Overlay */}
                  {selectedPostId === post.id && post.items.length > 0 && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col p-6 overflow-y-auto">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                          SHOP THE LOOK
                        </h2>
                        <button
                          onClick={() => setSelectedPostId(null)}
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
                            onClick={() => item.product_url && window.open(item.product_url, '_blank')}
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

                {/* Like + Comment + Share + Shop Buttons - Clean & Minimal */}
                <div className="flex items-center gap-5 mb-4 px-2">
                  <button
                    onClick={() => toggleLike(post.id, post.is_liked)}
                    className="flex items-center gap-1.5 hover:opacity-60 transition-opacity text-white"
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill={post.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="text-sm md:text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{post.like_count}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!currentUserId || !isOnboarded) {
                        showToastNotification('Please log in to comment');
                        return;
                      }
                      setShowCommentsForPost(post.id);
                    }}
                    className="flex items-center gap-1.5 text-white hover:opacity-60 transition-opacity"
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-sm md:text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{post.comment_count}</span>
                  </button>

                  {/* Share Arrow */}
                  <button className="text-white hover:opacity-60 transition-opacity">
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
                    </svg>
                  </button>

                  {/* Shop The Look - Realistic Barcode - Even Bigger */}
                  {post.items.length > 0 && (
                    <button
                      onClick={() => setSelectedPostId(post.id === selectedPostId ? null : post.id)}
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

                {/* Caption with Show More */}
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
              </div>
            </div>
          ))}
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-white text-black px-6 py-3 rounded-lg border-2 border-black shadow-lg">
              <p className="font-black text-sm" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {toastMessage}
              </p>
            </div>
          </div>
        )}

        {/* Comments Overlay Modal */}
        {showCommentsForPost && (() => {
          const post = posts.find(p => p.id === showCommentsForPost);
          if (!post) return null;

          return (
            <>
              <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                onClick={() => setShowCommentsForPost(null)}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="relative w-full max-w-2xl h-[80vh] bg-neutral-900 border-2 border-white rounded-2xl flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b-2 border-white">
                    <h2 className="text-xl font-black text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      COMMENTS
                    </h2>
                    <button
                      onClick={() => setShowCommentsForPost(null)}
                      className="w-8 h-8 flex items-center justify-center text-white hover:bg-white hover:text-black border border-white transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Comments List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {comments[showCommentsForPost]?.length > 0 ? (
                      comments[showCommentsForPost].map(comment => (
                        <div key={comment.id} className="mb-4 flex gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-white flex-shrink-0">
                            {comment.profiles.avatar_url ? (
                              <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-neutral-700 flex items-center justify-center text-xs text-white">👤</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-black text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {comment.profiles.username}
                              </span>
                              {comment.profiles.is_verified && (
                                <div className="flex items-center justify-center w-4 h-4 bg-blue-500 rounded-full">
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-xs text-white/40">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-white">{comment.comment_text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-white/60 text-center py-8">No comments yet. Be the first!</p>
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="p-4 border-t-2 border-white">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            submitComment(showCommentsForPost);
                          }
                        }}
                        placeholder="Add a comment..."
                        className="flex-1 bg-black text-white border-2 border-white px-4 py-2 focus:outline-none focus:border-white/60"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      />
                      <button
                        onClick={() => submitComment(showCommentsForPost)}
                        disabled={!commentText.trim()}
                        className="px-6 py-2 bg-white text-black font-black disabled:opacity-30 hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        POST
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </>
  );
}