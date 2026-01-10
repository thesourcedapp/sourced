"use client";

import { useEffect, useState } from "react";
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

export default function PostPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [viewMode, setViewMode] = useState<'discover' | 'shop'>('discover');
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadPost();
  }, [params.id]);

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

  async function loadPost() {
    try {
      const { data: postData } = await supabase
        .from('feed_posts')
        .select(`
          id, image_url, caption, like_count, comment_count, music_preview_url, owner_id,
          profiles!feed_posts_owner_id_fkey(id, username, avatar_url, is_verified)
        `)
        .eq('id', params.id)
        .single();

      if (!postData) {
        setLoading(false);
        return;
      }

      // Check if current user liked this post
      let isLiked = false;
      if (currentUserId) {
        const { data: likedData } = await supabase
          .from('liked_feed_posts')
          .select('feed_post_id')
          .eq('user_id', currentUserId)
          .eq('feed_post_id', params.id)
          .single();
        isLiked = !!likedData;
      }

      // Get items for this post
      const { data: itemsData } = await supabase
        .from('feed_post_items')
        .select('id, title, image_url, product_url, price, seller, like_count')
        .eq('feed_post_id', params.id);

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

      const items = itemsData?.map(item => ({
        ...item,
        like_count: item.like_count || 0,
        is_liked: likedItemIds.has(item.id)
      })) || [];

      const owner = Array.isArray(postData.profiles) ? postData.profiles[0] : postData.profiles;

      setPost({
        id: postData.id,
        image_url: postData.image_url,
        caption: postData.caption,
        music_preview_url: postData.music_preview_url,
        like_count: postData.like_count,
        is_liked: isLiked,
        comment_count: postData.comment_count || 0,
        owner: {
          id: owner.id,
          username: owner.username,
          avatar_url: owner.avatar_url,
          is_verified: owner.is_verified || false
        },
        items
      });
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike() {
    if (!post || !currentUserId || !isOnboarded) {
      setToastMessage('Please log in to like posts');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    try {
      if (post.is_liked) {
        await supabase
          .from('liked_feed_posts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('feed_post_id', post.id);

        setPost(prev => prev ? { ...prev, is_liked: false, like_count: Math.max(0, prev.like_count - 1) } : null);
      } else {
        await supabase
          .from('liked_feed_posts')
          .insert({
            user_id: currentUserId,
            feed_post_id: post.id
          });

        setPost(prev => prev ? { ...prev, is_liked: true, like_count: prev.like_count + 1 } : null);
      }
    } catch (error) {
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

  if (!post) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-4" style={{ fontFamily: 'Archivo Black' }}>POST NOT FOUND</h1>
          <button
            onClick={() => router.push('/feed')}
            className="px-8 py-3 bg-white text-black hover:bg-black hover:text-white border-2 border-white transition-all font-black tracking-wider"
            style={{ fontFamily: 'Bebas Neue' }}
          >
            GO TO FEED
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`@${post.owner.username}'s Post | Sourced`}</title>
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

        .slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="fixed inset-0 bg-black overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 scale-110 blur-3xl opacity-10 transition-all duration-1000"
            style={{
              backgroundImage: `url(${post.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950"></div>
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-30 pt-3 pb-3">
          <div className="flex items-center justify-between px-4">
            <button
              onClick={() => router.push('/feed')}
              className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex flex-col items-center">
              <h1 className="text-white text-xl font-bold mb-1.5 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '-0.02em' }}>
                Post
              </h1>
              <div className="w-10 h-0.5 bg-white rounded-full"></div>
            </div>
            <div className="w-10"></div>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative h-full flex flex-col items-center justify-center px-3 pt-32 pb-24">
          {/* Image Card */}
          <div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-3"
            style={{
              minHeight: '64vh',
              maxHeight: '66vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
          >
            <img
              src={post.image_url}
              alt=""
              className="w-full h-full object-cover"
            />

            {/* Shop Overlay */}
            {viewMode === 'shop' && (
              <div className="absolute inset-0 z-30 flex flex-col">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${post.image_url})`,
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
                      onClick={() => setViewMode('discover')}
                      className="w-10 h-10 flex items-center justify-center text-white bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {post.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className="bg-black border border-white/20 rounded-xl overflow-hidden shadow-xl slide-up hover:border-white/40 transition-all"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <div
                            className="aspect-square bg-neutral-900 overflow-hidden cursor-pointer"
                            onClick={() => {
                              if (item.product_url) window.open(item.product_url, '_blank');
                            }}
                          >
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
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
                            {item.price && (
                              <p className="text-base font-black text-white mb-3" style={{ fontFamily: 'Archivo Black' }}>
                                ${item.price}
                              </p>
                            )}
                            {item.product_url && (
                              <button
                                onClick={() => window.open(item.product_url!, '_blank')}
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
              onClick={() => router.push(`/${post.owner.username}`)}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
            >
              <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-neutral-800">
                {post.owner.avatar_url ? (
                  <img src={post.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-sm">👤</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-lg tracking-wide" style={{ fontFamily: 'Bebas Neue' }}>
                  {post.owner.username}
                </span>
                {post.owner.is_verified && (
                  <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>

            {post.items.length > 0 && (
              <button
                onClick={() => setViewMode(viewMode === 'shop' ? 'discover' : 'shop')}
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
              onClick={toggleLike}
              className="flex items-center gap-2 text-white hover:scale-110 transition-transform"
            >
              <svg className="w-7 h-7" fill={post.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.like_count}</span>
            </button>

            <button onClick={handleComment} className="flex items-center gap-2 text-white hover:scale-110 transition-transform">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.comment_count}</span>
            </button>

            <button
              onClick={() => {
                const shareUrl = `${window.location.origin}/post/${post.id}`;
                if (navigator.share) {
                  navigator.share({
                    title: `@${post.owner.username} on Sourced`,
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
          {post.caption && (
            <div className="w-full max-w-lg mb-2">
              <p className="text-white/90 text-sm leading-relaxed">
                {post.caption}
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
      </div>

      {/* Comments Modal */}
      {currentUserId && (
        <CommentsModal
          postId={post.id}
          postOwnerId={post.owner.id}
          isOpen={showCommentsModal}
          onClose={() => {
            setShowCommentsModal(false);
            loadPost();
          }}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}