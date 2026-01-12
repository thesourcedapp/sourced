"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Head from "next/head";
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';

type ProfileData = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
};

type UserCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  item_count: number;
  bookmark_count: number;
  slug: string;
  owner_username: string;
  is_pinned?: boolean;
};

type BookmarkedCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bookmark_count: number;
  username: string;
  full_name: string | null;
  item_count: number;
  created_at: string;
  slug: string;
};

type LikedItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  catalog_id: string;
  catalog_name: string;
  catalog_owner: string;
  catalog_slug: string;
  like_count: number;
  created_at: string;
};

type FeedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  is_pinned?: boolean;
};

type SavedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  saved_at: string;
};

type FollowUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
};

async function uploadImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      return { url: null, error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return { url: publicUrl };
  } catch (error: any) {
    return { url: null, error: error.message };
  }
}

function linkifyBio(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-70 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      }, 'image/jpeg', 0.95);
    };
    image.onerror = reject;
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const [profileId, setProfileId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [catalogs, setCatalogs] = useState<UserCatalog[]>([]);
  const [bookmarkedCatalogs, setBookmarkedCatalogs] = useState<BookmarkedCatalog[]>([]);
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'catalogs' | 'bookmarks' | 'liked' | 'saved'>('posts');
  const [expandedItem, setExpandedItem] = useState<LikedItem | null>(null);

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');

  // Avatar cropping
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Followers/Following Modal
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowUser[]>([]);

  const isOwner = currentUserId === profileId;

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = profile ? `Sourced - ${profile.username}` : 'Sourced';
  const shareDescription = `@${username} on Sourced`;

  const ogImageUrl = profile
    ? `/api/og/profile?username=${encodeURIComponent(profile.username)}${profile.bio ? `&bio=${encodeURIComponent(profile.bio)}` : ''}&catalogs=${catalogs.length}&followers=${profile.followers_count || 0}${profile.avatar_url ? `&avatar=${encodeURIComponent(profile.avatar_url)}` : ''}`
    : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const shareImage = ogImageUrl;

  useEffect(() => {
    async function initProfile() {
      await loadCurrentUser();
      if (username) {
        await loadProfile();
      }
    }
    initProfile();
  }, [username]);

  useEffect(() => {
    if (profileId) {
      loadUserCatalogs();
      loadBookmarkedCatalogs();
      loadLikedItems();
      loadFeedPosts();
      if (isOwner) {
        loadSavedPosts();
      }
      loadFollowers();
      loadFollowing();
    }
  }, [profileId, isOwner]);

  useEffect(() => {
    if (currentUserId && username) {
      loadProfile();
    }
  }, [currentUserId, username]);

  useEffect(() => {
    if (followersSearchQuery.trim()) {
      setFilteredFollowers(
        followers.filter(user =>
          user.username.toLowerCase().includes(followersSearchQuery.toLowerCase()) ||
          (user.full_name && user.full_name.toLowerCase().includes(followersSearchQuery.toLowerCase()))
        )
      );
    } else {
      setFilteredFollowers(followers);
    }
  }, [followers, followersSearchQuery]);

  useEffect(() => {
    if (followersSearchQuery.trim()) {
      setFilteredFollowing(
        following.filter(user =>
          user.username.toLowerCase().includes(followersSearchQuery.toLowerCase()) ||
          (user.full_name && user.full_name.toLowerCase().includes(followersSearchQuery.toLowerCase()))
        )
      );
    } else {
      setFilteredFollowing(following);
    }
  }, [following, followersSearchQuery]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadProfile() {
    if (!username) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, followers_count, following_count')
        .eq('username', username)
        .single();

      if (!error && data) {
        setProfileId(data.id);

        let profileWithFollowing = { ...data, is_following: false };

        if (currentUserId && currentUserId !== data.id) {
          const { data: followData } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', currentUserId)
            .eq('following_id', data.id)
            .single();

          profileWithFollowing.is_following = !!followData;
        }

        setProfile(profileWithFollowing);
        setEditFullName(data.full_name || '');
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.avatar_url || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserCatalogs() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('catalogs')
        .select(`
          id, name, description, image_url, created_at, bookmark_count, slug, owner_id, is_pinned,
          profiles!catalogs_owner_id_fkey(username),
          catalog_items(count)
        `)
        .eq('owner_id', profileId)
        .eq('visibility', 'public')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        const catalogsWithCount = data.map(catalog => {
          const owner = Array.isArray(catalog.profiles) ? catalog.profiles[0] : catalog.profiles;
          return {
            ...catalog,
            item_count: catalog.catalog_items?.[0]?.count || 0,
            bookmark_count: catalog.bookmark_count || 0,
            owner_username: owner?.username || 'unknown',
            is_pinned: catalog.is_pinned || false
          };
        });
        setCatalogs(catalogsWithCount);
      }
    } catch (error) {
      console.error('Error loading catalogs:', error);
    }
  }

  async function loadFeedPosts() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, image_url, caption, like_count, comment_count, created_at, is_pinned')
        .eq('owner_id', profileId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFeedPosts(data.map(post => ({
          ...post,
          is_pinned: post.is_pinned || false
        })));
      }
    } catch (error) {
      console.error('Error loading feed posts:', error);
    }
  }

  async function loadSavedPosts() {
    if (!profileId || !isOwner) return;

    try {
      const { data: savedData, error } = await supabase
        .from('saved_feed_posts')
        .select('feed_post_id, created_at')
        .eq('user_id', profileId);

      if (error || !savedData) return;

      const postIds = savedData.map(s => s.feed_post_id);
      if (postIds.length === 0) {
        setSavedPosts([]);
        return;
      }

      const { data: postsData, error: postsError } = await supabase
        .from('feed_posts')
        .select('id, image_url, caption, like_count, comment_count, created_at')
        .in('id', postIds);

      if (postsError || !postsData) return;

      const transformedPosts: SavedPost[] = postsData.map(post => {
        const saved = savedData.find(s => s.feed_post_id === post.id);
        return {
          ...post,
          saved_at: saved?.created_at || ''
        };
      }).sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());

      setSavedPosts(transformedPosts);
    } catch (error) {
      console.error('Error loading saved posts:', error);
    }
  }

  async function togglePinCatalog(catalogId: string) {
    if (!isOwner) return;

    try {
      const catalog = catalogs.find(c => c.id === catalogId);
      if (!catalog) return;

      await supabase
        .from('catalogs')
        .update({ is_pinned: !catalog.is_pinned })
        .eq('id', catalogId);

      await loadUserCatalogs();
    } catch (error) {
      console.error('Error toggling pin catalog:', error);
    }
  }

  async function togglePinPost(postId: string) {
    if (!isOwner) return;

    try {
      const post = feedPosts.find(p => p.id === postId);
      if (!post) return;

      await supabase
        .from('feed_posts')
        .update({ is_pinned: !post.is_pinned })
        .eq('id', postId);

      await loadFeedPosts();
    } catch (error) {
      console.error('Error toggling pin post:', error);
    }
  }

  async function loadBookmarkedCatalogs() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('bookmarked_catalogs')
        .select('catalog_id, created_at')
        .eq('user_id', profileId);

      if (error || !data) {
        console.error('Error loading bookmarks:', error);
        return;
      }

      const catalogIds = data.map(b => b.catalog_id);

      if (catalogIds.length === 0) {
        setBookmarkedCatalogs([]);
        return;
      }

      const { data: catalogsData, error: catalogsError } = await supabase
        .from('catalogs')
        .select('id, name, description, image_url, bookmark_count, owner_id, visibility, slug, catalog_items(count)')
        .in('id', catalogIds);

      if (catalogsError || !catalogsData) {
        console.error('Error loading catalog details:', catalogsError);
        return;
      }

      const ownerIds = [...new Set(catalogsData.map(c => c.owner_id))];
      const { data: ownersData } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', ownerIds);

      const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || []);

      const transformedCatalogs: BookmarkedCatalog[] = catalogsData
        .filter(catalog => catalog.visibility === 'public')
        .map(catalog => {
          const owner = ownersMap.get(catalog.owner_id);
          const bookmark = data.find(b => b.catalog_id === catalog.id);

          return {
            id: catalog.id,
            name: catalog.name,
            description: catalog.description,
            image_url: catalog.image_url,
            bookmark_count: catalog.bookmark_count || 0,
            username: owner?.username || 'unknown',
            full_name: owner?.full_name,
            item_count: catalog.catalog_items?.[0]?.count || 0,
            created_at: bookmark?.created_at || '',
            slug: catalog.slug || '',
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBookmarkedCatalogs(transformedCatalogs);
    } catch (error) {
      console.error('Error loading bookmarked catalogs:', error);
    }
  }

  async function loadLikedItems() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('liked_items')
        .select('item_id, created_at')
        .eq('user_id', profileId);

      if (error || !data) {
        console.error('Error loading likes:', error);
        return;
      }

      const itemIds = data.map(l => l.item_id);

      if (itemIds.length === 0) {
        setLikedItems([]);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('catalog_items')
        .select('id, title, image_url, product_url, price, seller, catalog_id, like_count')
        .in('id', itemIds);

      if (itemsError || !itemsData) {
        console.error('Error loading item details:', itemsError);
        return;
      }

      const catalogIds = [...new Set(itemsData.map(i => i.catalog_id))];
      const { data: catalogsData } = await supabase
        .from('catalogs')
        .select('id, name, owner_id, visibility, slug')
        .in('id', catalogIds);

      const catalogsMap = new Map(catalogsData?.map(c => [c.id, c]) || []);

      const ownerIds = [...new Set(catalogsData?.map(c => c.owner_id) || [])];
      const { data: ownersData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ownerIds);

      const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || []);

      const transformedItems: LikedItem[] = itemsData
        .filter(item => {
          const catalog = catalogsMap.get(item.catalog_id);
          return catalog?.visibility === 'public';
        })
        .map(item => {
          const catalog = catalogsMap.get(item.catalog_id);
          const owner = catalog ? ownersMap.get(catalog.owner_id) : null;
          const like = data.find(l => l.item_id === item.id);

          return {
            id: item.id,
            title: item.title,
            image_url: item.image_url,
            product_url: item.product_url,
            price: item.price,
            seller: item.seller,
            catalog_id: item.catalog_id,
            catalog_name: catalog?.name || 'Unknown',
            catalog_owner: owner?.username || 'unknown',
            catalog_slug: catalog?.slug || '',
            like_count: item.like_count || 0,
            created_at: like?.created_at || '',
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLikedItems(transformedItems);
    } catch (error) {
      console.error('Error loading liked items:', error);
    }
  }

  async function loadFollowers() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('followers')
        .select(`
          follower_id,
          created_at
        `)
        .eq('following_id', profileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading followers:', error);
        return;
      }

      if (!data || data.length === 0) {
        setFollowers([]);
        return;
      }

      const followerIds = data.map(f => f.follower_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, followers_count, following_count')
        .in('id', followerIds);

      if (profilesError) {
        console.error('Error loading follower profiles:', profilesError);
        return;
      }

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const transformedFollowers: FollowUser[] = data
        .map(follow => {
          const profile = profilesMap.get(follow.follower_id);
          if (!profile) return null;

          return {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            followers_count: profile.followers_count || 0,
            following_count: profile.following_count || 0,
            created_at: follow.created_at,
          };
        })
        .filter((f): f is FollowUser => f !== null);

      setFollowers(transformedFollowers);
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  }

  async function loadFollowing() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('followers')
        .select(`
          following_id,
          created_at
        `)
        .eq('follower_id', profileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading following:', error);
        return;
      }

      if (!data || data.length === 0) {
        setFollowing([]);
        return;
      }

      const followingIds = data.map(f => f.following_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, followers_count, following_count')
        .in('id', followingIds);

      if (profilesError) {
        console.error('Error loading following profiles:', profilesError);
        return;
      }

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const transformedFollowing: FollowUser[] = data
        .map(follow => {
          const profile = profilesMap.get(follow.following_id);
          if (!profile) return null;

          return {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            followers_count: profile.followers_count || 0,
            following_count: profile.following_count || 0,
            created_at: follow.created_at,
          };
        })
        .filter((f): f is FollowUser => f !== null);

      setFollowing(transformedFollowing);
    } catch (error) {
      console.error('Error loading following:', error);
    }
  }

  async function handleShareProfile() {
    try {
      if (navigator.share) {
        await navigator.share({
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShowShareCopied(true);
        setTimeout(() => setShowShareCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setShowShareCopied(true);
          setTimeout(() => setShowShareCopied(false), 2000);
        } catch {
          console.error('Failed to copy link');
        }
      }
    }
  }

  async function toggleFollow() {
    if (!currentUserId || !profile) return;

    try {
      if (profile.is_following) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId);

        await new Promise(resolve => setTimeout(resolve, 200));

      } else {
        await supabase
          .from('followers')
          .insert({
            follower_id: currentUserId,
            following_id: profileId
          });

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await loadProfile();
      await loadFollowers();
      await loadFollowing();
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  }

  async function removeFollower(followerId: string) {
    if (!currentUserId || !isOwner) return;

    try {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', profileId);

      const follower = followers.find(f => f.id === followerId);
      if (follower) {
        await supabase
          .from('profiles')
          .update({ following_count: Math.max(0, follower.following_count - 1) })
          .eq('id', followerId);
      }

      if (profile) {
        await supabase
          .from('profiles')
          .update({ followers_count: Math.max(0, profile.followers_count - 1) })
          .eq('id', profileId);
      }

      await loadProfile();
      await loadFollowers();
    } catch (error) {
      console.error('Error removing follower:', error);
    }
  }

  async function unfollow(followingId: string) {
    if (!currentUserId || !isOwner) return;

    try {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', followingId);

      const followedUser = following.find(f => f.id === followingId);
      if (followedUser) {
        await supabase
          .from('profiles')
          .update({ followers_count: Math.max(0, followedUser.followers_count - 1) })
          .eq('id', followingId);
      }

      if (profile) {
        await supabase
          .from('profiles')
          .update({ following_count: Math.max(0, profile.following_count - 1) })
          .eq('id', currentUserId);
      }

      await loadProfile();
      await loadFollowing();
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  }

  async function toggleBookmark(catalogId: string) {
    if (!currentUserId) return;

    try {
      const { data: existingBookmark } = await supabase
        .from('bookmarked_catalogs')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('catalog_id', catalogId)
        .single();

      if (existingBookmark) {
        await supabase
          .from('bookmarked_catalogs')
          .delete()
          .eq('user_id', currentUserId)
          .eq('catalog_id', catalogId);

        setBookmarkedCatalogs(prev => prev.filter(c => c.id !== catalogId));
      } else {
        await supabase
          .from('bookmarked_catalogs')
          .insert({
            user_id: currentUserId,
            catalog_id: catalogId
          });

        await loadBookmarkedCatalogs();
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }

  async function toggleLike(itemId: string) {
    if (!currentUserId) return;

    try {
      const { data: existingLike } = await supabase
        .from('liked_items')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('item_id', itemId)
        .single();

      if (existingLike) {
        await supabase
          .from('liked_items')
          .delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);

        setLikedItems(prev => prev.filter(i => i.id !== itemId));
      } else {
        await supabase
          .from('liked_items')
          .insert({
            user_id: currentUserId,
            item_id: itemId
          });

        await loadLikedItems();
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setImageError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  }

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;

    setSaving(true);
    setImageError('');

    try {
      let finalAvatarUrl = editAvatarUrl;

      if (uploadMethod === 'file' && selectedFile && previewUrl && croppedAreaPixels) {
        console.log('🔄 Cropping and uploading image...');

        const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
        const croppedFile = new File([croppedBlob], selectedFile.name, { type: 'image/jpeg' });

        const uploadResult = await uploadImageToStorage(croppedFile, currentUserId);

        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to upload image");
          setSaving(false);
          return;
        }

        finalAvatarUrl = uploadResult.url;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const moderationResponse = await fetch("/api/check-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: finalAvatarUrl }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (moderationResponse.ok) {
            const moderationData = await moderationResponse.json();
            if (moderationData.safe === false) {
              setImageError("Image contains inappropriate content and cannot be used");
              setSaving(false);
              return;
            }
          }
        } catch (moderationError) {
          console.error("Image moderation error:", moderationError);
        }
      } else if (uploadMethod === 'url' && editAvatarUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const moderationResponse = await fetch("/api/check-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: editAvatarUrl }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (moderationResponse.ok) {
            const moderationData = await moderationResponse.json();
            if (moderationData.safe === false) {
              setImageError("Image contains inappropriate content and cannot be used");
              setSaving(false);
              return;
            }
          }
        } catch (moderationError) {
          console.error("Image moderation error:", moderationError);
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName.trim() || null,
          bio: editBio.trim() || null,
          avatar_url: finalAvatarUrl.trim() || null
        })
        .eq('id', currentUserId);

      if (error) throw error;

      await loadProfile();
      setShowEditModal(false);
      setShowCropper(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  function openFollowersModal(type: 'followers' | 'following') {
    setFollowersModalType(type);
    setFollowersSearchQuery('');
    setShowFollowersModal(true);
  }

  const tabs = [
    { id: 'posts' as const, label: 'POSTS', count: feedPosts.length },
    { id: 'catalogs' as const, label: 'CATALOGS', count: catalogs.length },
    { id: 'bookmarks' as const, label: 'BOOKMARKS', count: bookmarkedCatalogs.length },
    { id: 'liked' as const, label: 'LIKED', count: likedItems.length },
    ...(isOwner ? [{ id: 'saved' as const, label: 'SAVED', count: savedPosts.length }] : [])
  ];

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading... | Sourced</title>
        </Head>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            LOADING...
          </p>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Head>
          <title>Profile Not Found | Sourced</title>
        </Head>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              PROFILE NOT FOUND
            </h1>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 border-2 border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              GO BACK
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{shareTitle}</title>
        <meta name="description" content={shareDescription} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:width" content="400" />
        <meta property="og:image:height" content="400" />
        <meta property="twitter:card" content="summary" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={shareTitle} />
        <meta property="twitter:description" content={shareDescription} />
        <meta property="twitter:image" content={shareImage} />
        <meta property="og:site_name" content="Sourced" />
        <meta property="profile:username" content={profile.username} />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        input, textarea, select {
          font-size: 16px !important;
        }
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => router.back()}
              className="mb-6 text-xs tracking-wider opacity-60 hover:opacity-100 transition-opacity"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              ← BACK
            </button>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-32 h-32 rounded-full border-2 border-black overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                    <span className="text-6xl opacity-20">👤</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      @{profile.username}
                    </h1>
                    {profile.full_name && (
                      <p className="text-lg tracking-wider opacity-60 mt-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {profile.full_name}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleShareProfile}
                      className="px-4 py-2 border border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {showShareCopied ? 'COPIED!' : 'SHARE'}
                    </button>
                    {isOwner ? (
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="px-4 py-2 border border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        EDIT PROFILE
                      </button>
                    ) : currentUserId ? (
                      <button
                        onClick={toggleFollow}
                        className={`px-4 py-2 border-2 transition-all text-xs tracking-[0.4em] font-black ${
                          profile.is_following
                            ? 'border-black text-black hover:bg-black hover:text-white'
                            : 'bg-black text-white hover:bg-white hover:text-black border-black'
                        }`}
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {profile.is_following ? 'UNFOLLOW' : 'FOLLOW'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {profile.bio && (
                  <div className="max-w-2xl">
                    <p className="text-sm leading-relaxed opacity-80">
                      {linkifyBio(profile.bio)}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-6 text-sm">
                  <button
                    onClick={() => openFollowersModal('followers')}
                    className="hover:opacity-70 transition-opacity font-black tracking-wider"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {profile.followers_count} FOLLOWERS
                  </button>
                  <button
                    onClick={() => openFollowersModal('following')}
                    className="hover:opacity-70 transition-opacity font-black tracking-wider"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {profile.following_count} FOLLOWING
                  </button>
                  <span className="opacity-60 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {feedPosts.length} POSTS
                  </span>
                  <span className="opacity-60 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {catalogs.length} CATALOGS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-6 text-sm tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-black text-black'
                      : 'border-transparent text-black/40 hover:text-black/70'
                  }`}
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="space-y-6">
                {feedPosts.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NO POSTS YET
                    </p>
                    <p className="text-sm tracking-wide opacity-30 mt-2">
                      {isOwner ? "You haven't created any posts yet" : "This user hasn't created any posts yet"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {feedPosts.map(post => (
                      <div
                        key={post.id}
                        className="relative cursor-pointer post-card-hover group bg-black rounded-2xl overflow-hidden border border-white/10"
                        style={{ aspectRatio: '3/4' }}
                        onClick={() => router.push(`/post/${post.id}`)}
                      >
                        {/* Pinned Badge */}
                        {post.is_pinned && (
                          <div className="absolute top-3 left-3 z-10 bg-yellow-400 text-black px-2 py-1 text-xs font-black rounded-lg" style={{ fontFamily: 'Bebas Neue' }}>
                            📌 PINNED
                          </div>
                        )}

                        {/* Pin Button - Owner Only */}
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinPost(post.id);
                            }}
                            className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 text-xs font-black rounded-lg hover:bg-black transition-all"
                            style={{ fontFamily: 'Bebas Neue' }}
                          >
                            {post.is_pinned ? 'UNPIN' : 'PIN'}
                          </button>
                        )}

                        <div className="w-full h-full overflow-hidden">
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                          <div className="flex items-center gap-2 text-white">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.like_count}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                            </svg>
                            <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.comment_count}</span>
                          </div>
                        </div>

                        {post.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs line-clamp-2">
                              {post.caption}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Saved Posts Tab - Owner Only */}
            {activeTab === 'saved' && isOwner && (
              <div className="space-y-6">
                {savedPosts.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NO SAVED POSTS YET
                    </p>
                    <p className="text-sm tracking-wide opacity-30 mt-2">
                      Save posts to view them here
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {savedPosts.map(post => (
                      <div
                        key={post.id}
                        className="relative cursor-pointer post-card-hover group bg-black rounded-2xl overflow-hidden border border-white/10"
                        style={{ aspectRatio: '3/4' }}
                        onClick={() => router.push(`/post/${post.id}`)}
                      >
                        <div className="w-full h-full overflow-hidden">
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                          <div className="flex items-center gap-2 text-white">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.like_count}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                            </svg>
                            <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue' }}>{post.comment_count}</span>
                          </div>
                        </div>

                        {post.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs line-clamp-2">
                              {post.caption}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Catalogs Tab */}
            {activeTab === 'catalogs' && (
              <div className="space-y-6">
                {catalogs.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NO PUBLIC CATALOGS YET
                    </p>
                    <p className="text-sm tracking-wide opacity-30 mt-2">
                      {isOwner ? "You haven't created any public catalogs yet" : "This user hasn't created any public catalogs yet"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {catalogs.map((catalog) => (
                      <div
                        key={catalog.id}
                        className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200 relative"
                      >
                        {/* Pinned Badge */}
                        {catalog.is_pinned && (
                          <div className="absolute top-4 left-4 z-10 bg-yellow-400 text-black px-3 py-1 text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>
                            📌 PINNED
                          </div>
                        )}

                        {/* Pin Button - Owner Only */}
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinCatalog(catalog.id);
                            }}
                            className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm text-black px-3 py-1 text-xs font-black hover:bg-white transition-all"
                            style={{ fontFamily: 'Bebas Neue' }}
                          >
                            {catalog.is_pinned ? 'UNPIN' : 'PIN'}
                          </button>
                        )}

                        <div
                          className="cursor-pointer"
                          onClick={() => router.push(`/${catalog.owner_username}/${catalog.slug}`)}
                        >
                          <div className="aspect-square bg-white overflow-hidden">
                            {catalog.image_url ? (
                              <img
                                src={catalog.image_url}
                                alt={catalog.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                <span className="text-6xl opacity-20">✦</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 border-t border-black/20">
                            <h3 className="text-lg font-black tracking-wide uppercase truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {catalog.name}
                            </h3>

                            {catalog.description && (
                              <p className="text-xs opacity-60 mb-3 leading-relaxed line-clamp-2">
                                {catalog.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                              <span>🔖 {catalog.bookmark_count} bookmarks</span>
                              <span>{catalog.item_count} items</span>
                            </div>

                            <div className="mt-3 text-[10px] tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              CREATED {new Date(catalog.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bookmarked Catalogs and Liked Items tabs remain the same as before... */}
            {/* I'll continue in the next message due to length */}

          </div>
        </div>
      </div>
    </>
  );
}