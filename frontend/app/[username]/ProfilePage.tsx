"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Cropper from 'react-easy-crop';

type Point = { x: number; y: number };
type Area = { x: number; y: number; width: number; height: number };

type ProfileData = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
  subscription_price: number | null;
  subscription_enabled: boolean;
  accent_color: string | null;
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
  is_private?: boolean;
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
  is_monetized: boolean;
};

type FeedPost = {
  id: string;
  image_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  is_pinned?: boolean;
  is_private?: boolean;
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

async function uploadImageToStorage(
  file: File,
  userId: string,
  bucket: string = 'avatars'
): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${bucket}-${userId}-${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (error) return { url: null, error: error.message };
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
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
        <a key={index} href={part} target="_blank" rel="noopener noreferrer"
          className="underline hover:opacity-70 transition-opacity"
          onClick={(e) => e.stopPropagation()}>
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
      if (!ctx) { reject(new Error('No 2d context')); return; }
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Canvas is empty')); },
        'image/jpeg', 0.95
      );
    };
    image.onerror = reject;
  });
}

const DEFAULT_ACCENT = '#ffffff';

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
  const [isSubscribed, setIsSubscribed] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState<'catalogs' | 'posts' | 'bookmarks' | 'liked' | 'saved'>('catalogs');
  const [expandedLikedItem, setExpandedLikedItem] = useState<LikedItem | null>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editSubscriptionPrice, setEditSubscriptionPrice] = useState('');
  const [editSubscriptionEnabled, setEditSubscriptionEnabled] = useState(false);
  const [editAccentColor, setEditAccentColor] = useState(DEFAULT_ACCENT);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');

  // Avatar cropping
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Subscribe modal
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // Followers modal
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowUser[]>([]);

  const isOwner = currentUserId === profileId;
  const accentColor = profile?.accent_color || DEFAULT_ACCENT;

  // Scroll listener for sticky header effect
  useEffect(() => {
    const handleScroll = () => setHeaderScrolled(window.scrollY > 220);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function initProfile() {
      await loadCurrentUser();
      if (username) await loadProfile();
    }
    initProfile();
  }, [username]);

  useEffect(() => {
    if (profileId) {
      loadUserCatalogs();
      loadBookmarkedCatalogs();
      loadLikedItems();
      loadFeedPosts();
      if (isOwner) loadSavedPosts();
      loadFollowers();
      loadFollowing();
      if (currentUserId && !isOwner) checkSubscription();
    }
  }, [profileId, isOwner]);

  useEffect(() => {
    if (currentUserId && username) loadProfile();
  }, [currentUserId, username]);

  useEffect(() => {
    const q = followersSearchQuery.toLowerCase();
    setFilteredFollowers(q ? followers.filter(u => u.username.toLowerCase().includes(q) || (u.full_name?.toLowerCase().includes(q))) : followers);
    setFilteredFollowing(q ? following.filter(u => u.username.toLowerCase().includes(q) || (u.full_name?.toLowerCase().includes(q))) : following);
  }, [followers, following, followersSearchQuery]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function checkSubscription() {
    if (!currentUserId || !profileId) return;
    // Placeholder — wire to subscriptions table when Stripe is ready
    // const { data } = await supabase.from('subscriptions').select('id').eq('subscriber_id', currentUserId).eq('creator_id', profileId).eq('status', 'active').single();
    // setIsSubscribed(!!data);
    setIsSubscribed(false);
  }

  async function loadProfile() {
    if (!username) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, banner_url, bio, followers_count, following_count, subscription_price, subscription_enabled, accent_color')
        .eq('username', username)
        .single();
      if (!error && data) {
        setProfileId(data.id);
        let profileWithFollowing = { ...data, is_following: false };
        if (currentUserId && currentUserId !== data.id) {
          const { data: followData } = await supabase
            .from('followers').select('id')
            .eq('follower_id', currentUserId).eq('following_id', data.id).single();
          profileWithFollowing.is_following = !!followData;
        }
        setProfile(profileWithFollowing);
        setEditFullName(data.full_name || '');
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.avatar_url || '');
        setEditBannerUrl(data.banner_url || '');
        setEditSubscriptionPrice(data.subscription_price ? String(data.subscription_price) : '');
        setEditSubscriptionEnabled(data.subscription_enabled || false);
        setEditAccentColor(data.accent_color || DEFAULT_ACCENT);
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
      const query = supabase
        .from('catalogs')
        .select(`id, name, description, image_url, created_at, bookmark_count, slug, owner_id, is_pinned, is_private, profiles!catalogs_owner_id_fkey(username), catalog_items(count)`)
        .eq('owner_id', profileId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!isOwner) query.eq('visibility', 'public');

      const { data, error } = await query;
      if (!error && data) {
        setCatalogs(data.map(catalog => {
          const owner = Array.isArray(catalog.profiles) ? catalog.profiles[0] : catalog.profiles;
          return {
            ...catalog,
            item_count: catalog.catalog_items?.[0]?.count || 0,
            bookmark_count: catalog.bookmark_count || 0,
            owner_username: owner?.username || 'unknown',
            is_pinned: catalog.is_pinned || false,
            is_private: catalog.is_private || false,
          };
        }));
      }
    } catch (error) { console.error('Error loading catalogs:', error); }
  }

  async function loadFeedPosts() {
    if (!profileId) return;
    try {
      const query = supabase
        .from('feed_posts')
        .select('id, image_url, caption, like_count, comment_count, created_at, is_pinned, is_private')
        .eq('owner_id', profileId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && data) {
        setFeedPosts(data.map(post => ({
          ...post,
          is_pinned: post.is_pinned || false,
          is_private: post.is_private || false,
        })));
      }
    } catch (error) { console.error('Error loading feed posts:', error); }
  }

  async function loadSavedPosts() {
    if (!profileId || !isOwner) return;
    try {
      const { data: savedData, error } = await supabase
        .from('saved_feed_posts').select('feed_post_id, created_at').eq('user_id', profileId);
      if (error || !savedData) return;
      const postIds = savedData.map(s => s.feed_post_id);
      if (postIds.length === 0) { setSavedPosts([]); return; }
      const { data: postsData, error: postsError } = await supabase
        .from('feed_posts').select('id, image_url, caption, like_count, comment_count, created_at').in('id', postIds);
      if (postsError || !postsData) return;
      setSavedPosts(
        postsData.map(post => {
          const saved = savedData.find(s => s.feed_post_id === post.id);
          return { ...post, saved_at: saved?.created_at || '' };
        }).sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
      );
    } catch (error) { console.error('Error loading saved posts:', error); }
  }

  async function loadBookmarkedCatalogs() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase
        .from('bookmarked_catalogs').select('catalog_id, created_at').eq('user_id', profileId);
      if (error || !data) return;
      const catalogIds = data.map(b => b.catalog_id);
      if (catalogIds.length === 0) { setBookmarkedCatalogs([]); return; }
      const { data: catalogsData, error: catalogsError } = await supabase
        .from('catalogs').select('id, name, description, image_url, bookmark_count, owner_id, visibility, slug, catalog_items(count)').in('id', catalogIds);
      if (catalogsError || !catalogsData) return;
      const ownerIds = [...new Set(catalogsData.map(c => c.owner_id))];
      const { data: ownersData } = await supabase.from('profiles').select('id, username, full_name').in('id', ownerIds);
      const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || []);
      setBookmarkedCatalogs(
        catalogsData
          .filter(catalog => catalog.visibility === 'public')
          .map(catalog => {
            const owner = ownersMap.get(catalog.owner_id);
            const bookmark = data.find(b => b.catalog_id === catalog.id);
            return {
              id: catalog.id, name: catalog.name, description: catalog.description,
              image_url: catalog.image_url, bookmark_count: catalog.bookmark_count || 0,
              username: owner?.username || 'unknown', full_name: owner?.full_name,
              item_count: catalog.catalog_items?.[0]?.count || 0,
              created_at: bookmark?.created_at || '', slug: catalog.slug || ''
            };
          }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    } catch (error) { console.error('Error loading bookmarked catalogs:', error); }
  }

  async function loadLikedItems() {
    if (!profileId) return;
    try {
      const { data: catalogLikes } = await supabase.from('liked_items').select('item_id, created_at').eq('user_id', profileId);
      const { data: feedPostLikes } = await supabase.from('liked_feed_post_items').select('item_id, created_at').eq('user_id', profileId);
      const catalogItemIds = catalogLikes?.map(l => l.item_id) || [];
      const feedItemIds = feedPostLikes?.map(l => l.item_id) || [];
      const transformedItems: LikedItem[] = [];
      if (catalogItemIds.length > 0) {
        const { data: catalogItemsData } = await supabase
          .from('catalog_items').select('id, title, image_url, product_url, price, seller, catalog_id, like_count, is_monetized').in('id', catalogItemIds);
        if (catalogItemsData) {
          const catalogIds = [...new Set(catalogItemsData.map(i => i.catalog_id))];
          const { data: catalogsData } = await supabase.from('catalogs').select('id, name, owner_id, visibility, slug').in('id', catalogIds);
          const catalogsMap = new Map(catalogsData?.map(c => [c.id, c]) || []);
          const ownerIds = [...new Set(catalogsData?.map(c => c.owner_id) || [])];
          const { data: ownersData } = await supabase.from('profiles').select('id, username').in('id', ownerIds);
          const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || []);
          catalogItemsData.filter(item => catalogsMap.get(item.catalog_id)?.visibility === 'public').forEach(item => {
            const catalog = catalogsMap.get(item.catalog_id);
            const owner = catalog ? ownersMap.get(catalog.owner_id) : null;
            const like = catalogLikes?.find(l => l.item_id === item.id);
            transformedItems.push({
              id: item.id, title: item.title, image_url: item.image_url,
              product_url: item.product_url, price: item.price, seller: item.seller,
              catalog_id: item.catalog_id, catalog_name: catalog?.name || 'Unknown',
              catalog_owner: owner?.username || 'unknown', catalog_slug: catalog?.slug || '',
              like_count: item.like_count || 0, created_at: like?.created_at || '',
              is_monetized: item.is_monetized || false
            });
          });
        }
      }
      if (feedItemIds.length > 0) {
        const { data: feedItemsData } = await supabase
          .from('feed_post_items').select('id, title, image_url, product_url, price, seller, feed_post_id, like_count').in('id', feedItemIds);
        if (feedItemsData) {
          feedItemsData.forEach(item => {
            const like = feedPostLikes?.find(l => l.item_id === item.id);
            transformedItems.push({
              id: item.id, title: item.title, image_url: item.image_url,
              product_url: item.product_url, price: item.price, seller: item.seller,
              catalog_id: item.feed_post_id, catalog_name: 'Feed Post',
              catalog_owner: 'feed', catalog_slug: item.feed_post_id,
              like_count: item.like_count || 0, created_at: like?.created_at || '',
              is_monetized: false
            });
          });
        }
      }
      setLikedItems(transformedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) { console.error('Error loading liked items:', error); }
  }

  async function loadFollowers() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.from('followers').select('follower_id, created_at').eq('following_id', profileId).order('created_at', { ascending: false });
      if (error || !data || data.length === 0) { setFollowers([]); return; }
      const followerIds = data.map(f => f.follower_id);
      const { data: profilesData } = await supabase.from('profiles').select('id, username, full_name, avatar_url, followers_count, following_count').in('id', followerIds);
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      setFollowers(data.map(follow => {
        const p = profilesMap.get(follow.follower_id);
        if (!p) return null;
        return { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, followers_count: p.followers_count || 0, following_count: p.following_count || 0, created_at: follow.created_at };
      }).filter((f): f is FollowUser => f !== null));
    } catch (error) { console.error('Error loading followers:', error); }
  }

  async function loadFollowing() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.from('followers').select('following_id, created_at').eq('follower_id', profileId).order('created_at', { ascending: false });
      if (error || !data || data.length === 0) { setFollowing([]); return; }
      const followingIds = data.map(f => f.following_id);
      const { data: profilesData } = await supabase.from('profiles').select('id, username, full_name, avatar_url, followers_count, following_count').in('id', followingIds);
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      setFollowing(data.map(follow => {
        const p = profilesMap.get(follow.following_id);
        if (!p) return null;
        return { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, followers_count: p.followers_count || 0, following_count: p.following_count || 0, created_at: follow.created_at };
      }).filter((f): f is FollowUser => f !== null));
    } catch (error) { console.error('Error loading following:', error); }
  }

  async function toggleFollow() {
    if (!currentUserId || !profile) return;
    try {
      if (profile.is_following) {
        await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', profileId);
      } else {
        await supabase.from('followers').insert({ follower_id: currentUserId, following_id: profileId });
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadProfile(); await loadFollowers(); await loadFollowing();
    } catch (error) { console.error('Error toggling follow:', error); }
  }

  async function handleShareProfile() {
    try {
      if (navigator.share) {
        await navigator.share({ url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShowShareCopied(true);
        setTimeout(() => setShowShareCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(window.location.href); setShowShareCopied(true); setTimeout(() => setShowShareCopied(false), 2000); } catch {}
      }
    }
  }

  async function togglePinCatalog(catalogId: string) {
    if (!isOwner) return;
    const catalog = catalogs.find(c => c.id === catalogId);
    if (!catalog) return;
    await supabase.from('catalogs').update({ is_pinned: !catalog.is_pinned }).eq('id', catalogId);
    await loadUserCatalogs();
  }

  async function togglePrivateCatalog(catalogId: string) {
    if (!isOwner) return;
    const catalog = catalogs.find(c => c.id === catalogId);
    if (!catalog) return;
    await supabase.from('catalogs').update({ is_private: !catalog.is_private }).eq('id', catalogId);
    await loadUserCatalogs();
  }

  async function togglePinPost(postId: string) {
    if (!isOwner) return;
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    await supabase.from('feed_posts').update({ is_pinned: !post.is_pinned }).eq('id', postId);
    await loadFeedPosts();
  }

  async function togglePrivatePost(postId: string) {
    if (!isOwner) return;
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    await supabase.from('feed_posts').update({ is_private: !post.is_private }).eq('id', postId);
    await loadFeedPosts();
  }

  async function toggleLike(itemId: string) {
    if (!currentUserId) return;
    try {
      const { data: existingLike } = await supabase.from('liked_items').select('id').eq('user_id', currentUserId).eq('item_id', itemId).single();
      if (existingLike) {
        await supabase.from('liked_items').delete().eq('user_id', currentUserId).eq('item_id', itemId);
        setLikedItems(prev => prev.filter(i => i.id !== itemId));
      } else {
        await supabase.from('liked_items').insert({ user_id: currentUserId, item_id: itemId });
        await loadLikedItems();
      }
    } catch (error) { console.error('Error toggling like:', error); }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner' = 'avatar') {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError('Please select an image file'); return; }
    setImageError('');
    if (type === 'avatar') {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => { setPreviewUrl(e.target?.result as string); setShowCropper(true); };
      reader.readAsDataURL(file);
    } else {
      setSelectedBannerFile(file);
      const reader = new FileReader();
      reader.onload = (e) => { setBannerPreviewUrl(e.target?.result as string); };
      reader.readAsDataURL(file);
    }
  }

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => { setCroppedAreaPixels(croppedAreaPixels); };

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    setSaving(true); setImageError('');
    try {
      let finalAvatarUrl = editAvatarUrl;
      let finalBannerUrl = editBannerUrl;

      // Avatar upload
      if (uploadMethod === 'file' && selectedFile && previewUrl && croppedAreaPixels) {
        const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
        const croppedFile = new File([croppedBlob], selectedFile.name, { type: 'image/jpeg' });
        const uploadResult = await uploadImageToStorage(croppedFile, currentUserId, 'avatars');
        if (!uploadResult.url) { setImageError(uploadResult.error || "Failed to upload image"); setSaving(false); return; }
        finalAvatarUrl = uploadResult.url;
        try {
          const mod = await fetch("/api/check-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: finalAvatarUrl }) });
          if (mod.ok) { const d = await mod.json(); if (d.safe === false) { setImageError("Image contains inappropriate content"); setSaving(false); return; } }
        } catch {}
      }

      // Banner upload
      if (selectedBannerFile && bannerPreviewUrl) {
        const uploadResult = await uploadImageToStorage(selectedBannerFile, currentUserId, 'banners');
        if (!uploadResult.url) { setImageError(uploadResult.error || "Failed to upload banner"); setSaving(false); return; }
        finalBannerUrl = uploadResult.url;
        try {
          const mod = await fetch("/api/check-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: finalBannerUrl }) });
          if (mod.ok) { const d = await mod.json(); if (d.safe === false) { setImageError("Banner contains inappropriate content"); setSaving(false); return; } }
        } catch {}
      }

      const { error } = await supabase.from('profiles').update({
        full_name: editFullName.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: finalAvatarUrl.trim() || null,
        banner_url: finalBannerUrl.trim() || null,
        subscription_price: editSubscriptionPrice ? parseFloat(editSubscriptionPrice) : null,
        subscription_enabled: editSubscriptionEnabled,
        accent_color: editAccentColor,
      }).eq('id', currentUserId);

      if (error) throw error;
      await loadProfile();
      setShowEditModal(false); setShowCropper(false);
    } catch (error) { console.error('Error updating profile:', error); alert('Failed to update profile'); } finally { setSaving(false); }
  }

  // Visibility helpers
  const visibleCatalogs = isOwner ? catalogs : catalogs.filter(c => !c.is_private || isSubscribed);
  const visiblePosts = isOwner ? feedPosts : feedPosts.filter(p => !p.is_private || isSubscribed);
  const privateCatalogCount = catalogs.filter(c => c.is_private).length;
  const privatePostCount = feedPosts.filter(p => p.is_private).length;

  const tabs = [
    { id: 'catalogs' as const, label: 'CATALOGS', count: isOwner ? catalogs.length : visibleCatalogs.length },
    { id: 'posts' as const, label: 'POSTS', count: isOwner ? feedPosts.length : visiblePosts.length },
    { id: 'bookmarks' as const, label: 'BOOKMARKS', count: bookmarkedCatalogs.length },
    { id: 'liked' as const, label: 'LIKED', count: likedItems.length },
    ...(isOwner ? [{ id: 'saved' as const, label: 'SAVED', count: savedPosts.length }] : [])
  ];

  if (loading) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>LOADING...</p>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>PROFILE NOT FOUND</h1>
            <button onClick={() => router.back()} className="px-6 py-2 border border-white hover:bg-white hover:text-black transition-all text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>GO BACK</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Archivo:wght@400;500&display=swap');
        input, textarea, select { font-size: 16px !important; }

        .sourced-profile { --accent: ${accentColor}; }

        /* Grain overlay on banner */
        .banner-grain::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E");
          pointer-events: none;
          mix-blend-mode: overlay;
        }

        /* Sticky tab bar */
        .tab-bar-sticky {
          position: sticky;
          top: 0;
          z-index: 40;
          transition: background 0.2s, backdrop-filter 0.2s;
        }

        /* Private content blur */
        .private-blur {
          filter: blur(8px);
          pointer-events: none;
          user-select: none;
        }

        /* Owner controls */
        .owner-control-bar {
          display: flex;
          gap: 6px;
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .group:hover .owner-control-bar { opacity: 1; }

        .owner-btn {
          padding: 4px 8px;
          font-size: 9px;
          letter-spacing: 0.1em;
          font-family: 'Bebas Neue', sans-serif;
          border: none;
          cursor: pointer;
          transition: all 0.1s;
        }

        .subscribe-wall {
          background: linear-gradient(to top, #000 60%, transparent);
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        .fade-up-1 { animation-delay: 0.05s; opacity: 0; }
        .fade-up-2 { animation-delay: 0.1s; opacity: 0; }
        .fade-up-3 { animation-delay: 0.15s; opacity: 0; }
        .fade-up-4 { animation-delay: 0.2s; opacity: 0; }
      `}</style>

      <div className="sourced-profile min-h-screen bg-black text-white">

        {/* ── BANNER ── */}
        <div className="relative w-full banner-grain" style={{ height: '280px' }}>
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{
              background: `repeating-linear-gradient(
                -45deg,
                #0a0a0a 0px, #0a0a0a 1px,
                transparent 1px, transparent 18px
              ), linear-gradient(to bottom right, #111, #000)`
            }} />
          )}

          {/* Gradient fade to black at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: 'linear-gradient(to top, #000 30%, transparent)' }} />

          {/* Platform label top-left */}
          <div className="absolute top-5 left-6 flex items-center gap-2">
            <button onClick={() => router.back()} className="text-[10px] tracking-[0.3em] text-white/40 hover:text-white/80 transition-colors" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>← BACK</button>
          </div>

          {/* Top-right controls */}
          <div className="absolute top-5 right-6 flex items-center gap-2">
            <button onClick={handleShareProfile} className="px-3 py-1.5 text-[10px] tracking-[0.25em] border border-white/20 text-white/60 hover:border-white hover:text-white transition-all backdrop-blur-sm bg-black/20" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {showShareCopied ? 'COPIED!' : 'SHARE'}
            </button>
            {isOwner && (
              <button onClick={() => setShowEditModal(true)} className="px-3 py-1.5 text-[10px] tracking-[0.25em] border border-white/30 text-white hover:bg-white hover:text-black transition-all backdrop-blur-sm bg-black/30" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                EDIT PROFILE
              </button>
            )}
          </div>
        </div>

        {/* ── IDENTITY BLOCK ── overlapping banner */}
        <div className="relative px-6 md:px-10 -mt-20">
          <div className="flex items-end gap-5 fade-up fade-up-1">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 overflow-hidden" style={{ borderColor: accentColor }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <span className="text-4xl font-black text-white/20" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {profile.username[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* Monetized dot */}
              {profile.subscription_enabled && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border flex items-center justify-center" style={{ borderColor: accentColor }}>
                  <span className="text-[8px] font-black" style={{ color: accentColor, fontFamily: 'Bebas Neue, sans-serif' }}>$</span>
                </div>
              )}
            </div>

            {/* Name + bio */}
            <div className="pb-2 flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.4em] opacity-40 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                SOURCED / CREATOR
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none truncate" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                @{profile.username}
              </h1>
              {profile.full_name && (
                <p className="text-sm tracking-wider mt-1 opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {profile.full_name}
                </p>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-4 max-w-2xl fade-up fade-up-2">
              <p className="text-sm leading-relaxed opacity-70" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {linkifyBio(profile.bio)}
              </p>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-5 fade-up fade-up-3">
            <button onClick={() => { setFollowersModalType('followers'); setShowFollowersModal(true); }} className="flex flex-col items-center hover:opacity-70 transition-opacity">
              <span className="text-xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{profile.followers_count}</span>
              <span className="text-[9px] tracking-[0.2em] opacity-40 mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>FOLLOWERS</span>
            </button>
            <div className="w-px h-6 bg-white/10" />
            <button onClick={() => { setFollowersModalType('following'); setShowFollowersModal(true); }} className="flex flex-col items-center hover:opacity-70 transition-opacity">
              <span className="text-xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{profile.following_count}</span>
              <span className="text-[9px] tracking-[0.2em] opacity-40 mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>FOLLOWING</span>
            </button>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{catalogs.length}</span>
              <span className="text-[9px] tracking-[0.2em] opacity-40 mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CATALOGS</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{feedPosts.length}</span>
              <span className="text-[9px] tracking-[0.2em] opacity-40 mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>POSTS</span>
            </div>
          </div>

          {/* CTA row — Follow + Subscribe */}
          {!isOwner && (
            <div className="flex gap-3 mt-5 fade-up fade-up-4">
              {currentUserId && (
                <button onClick={toggleFollow}
                  className="px-6 py-2.5 text-xs tracking-[0.3em] font-black border transition-all"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: profile.is_following ? 'transparent' : 'white',
                    color: profile.is_following ? 'white' : 'black',
                    borderColor: 'white'
                  }}>
                  {profile.is_following ? 'FOLLOWING' : 'FOLLOW'}
                </button>
              )}
              {profile.subscription_enabled && (
                <button onClick={() => setShowSubscribeModal(true)}
                  className="px-6 py-2.5 text-xs tracking-[0.3em] font-black transition-all"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: isSubscribed ? 'transparent' : accentColor,
                    color: isSubscribed ? 'white' : 'black',
                    border: `1px solid ${accentColor}`
                  }}>
                  {isSubscribed ? 'SUBSCRIBED' : `SUBSCRIBE${profile.subscription_price ? ` · $${profile.subscription_price}/MO` : ''}`}
                </button>
              )}
            </div>
          )}

          {/* Owner: private content indicator */}
          {isOwner && (privateCatalogCount > 0 || privatePostCount > 0) && (
            <div className="mt-4 flex items-center gap-2 fade-up fade-up-4">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span className="text-[10px] tracking-[0.2em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {privateCatalogCount + privatePostCount} PRIVATE ITEM{privateCatalogCount + privatePostCount !== 1 ? 'S' : ''} — VISIBLE ONLY TO SUBSCRIBERS
              </span>
            </div>
          )}
        </div>

        {/* ── STICKY TAB BAR ── */}
        <div className="tab-bar-sticky mt-8 border-b border-white/10 bg-black/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto gap-0" style={{ scrollbarWidth: 'none' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="py-4 px-5 text-xs tracking-[0.2em] font-black border-b-2 transition-all whitespace-nowrap"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    borderColor: activeTab === tab.id ? accentColor : 'transparent',
                    color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.3)'
                  }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">

          {/* CATALOGS */}
          {activeTab === 'catalogs' && (
            <div>
              {visibleCatalogs.length === 0 && !isOwner ? (
                <EmptyState message="NO PUBLIC CATALOGS YET" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visibleCatalogs.map((catalog) => (
                    <div key={catalog.id} className="group relative border border-white/10 hover:border-white/40 transition-all duration-200">
                      {/* Owner controls */}
                      {isOwner && (
                        <div className="owner-control-bar">
                          <button onClick={(e) => { e.stopPropagation(); togglePinCatalog(catalog.id); }} className="owner-btn bg-white text-black hover:bg-black hover:text-white hover:border hover:border-white">
                            {catalog.is_pinned ? 'UNPIN' : 'PIN'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); togglePrivateCatalog(catalog.id); }}
                            className="owner-btn"
                            style={{ background: catalog.is_private ? '#facc15' : 'rgba(255,255,255,0.15)', color: catalog.is_private ? 'black' : 'white' }}>
                            {catalog.is_private ? '🔒 PRIVATE' : 'PUBLIC'}
                          </button>
                        </div>
                      )}

                      {/* Pin badge */}
                      {catalog.is_pinned && (
                        <div className="absolute top-3 left-3 z-10 px-2 py-1 text-[9px] tracking-[0.15em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', background: accentColor, color: 'black' }}>
                          PINNED
                        </div>
                      )}

                      {/* Private badge (owner only) */}
                      {isOwner && catalog.is_private && (
                        <div className="absolute top-3 left-3 z-10 px-2 py-1 text-[9px] tracking-[0.15em] font-black bg-yellow-400 text-black" style={{ fontFamily: 'Bebas Neue, sans-serif', marginTop: catalog.is_pinned ? '28px' : '0' }}>
                          🔒 SUBSCRIBERS ONLY
                        </div>
                      )}

                      <div className="cursor-pointer" onClick={() => router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                        <div className="aspect-square bg-white/5 overflow-hidden">
                          {catalog.image_url
                            ? <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                            : <div className="w-full h-full flex items-center justify-center"><span className="text-5xl opacity-10">✦</span></div>
                          }
                        </div>
                        <div className="p-4 border-t border-white/10">
                          <h3 className="text-base font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{catalog.name}</h3>
                          {catalog.description && <p className="text-xs opacity-40 mt-1 line-clamp-2 leading-relaxed">{catalog.description}</p>}
                          <div className="flex items-center justify-between mt-3 text-[10px] tracking-wider opacity-30">
                            <span>🔖 {catalog.bookmark_count}</span>
                            <span>{catalog.item_count} ITEMS</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Locked catalogs preview for guests */}
                  {!isOwner && !isSubscribed && privateCatalogCount > 0 && profile.subscription_enabled && (
                    <SubscribeWallCard
                      count={privateCatalogCount}
                      type="catalog"
                      price={profile.subscription_price}
                      accentColor={accentColor}
                      onSubscribe={() => setShowSubscribeModal(true)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* POSTS */}
          {activeTab === 'posts' && (
            <div>
              {visiblePosts.length === 0 && !isOwner ? (
                <EmptyState message="NO POSTS YET" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {visiblePosts.map(post => (
                    <div key={post.id} className="group relative overflow-hidden cursor-pointer" style={{ aspectRatio: '3/4' }}
                      onClick={() => router.push(`/post/${post.id}`)}>
                      {/* Owner controls */}
                      {isOwner && (
                        <div className="owner-control-bar">
                          <button onClick={(e) => { e.stopPropagation(); togglePinPost(post.id); }} className="owner-btn bg-white text-black">
                            {post.is_pinned ? 'UNPIN' : 'PIN'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); togglePrivatePost(post.id); }}
                            className="owner-btn"
                            style={{ background: post.is_private ? '#facc15' : 'rgba(0,0,0,0.6)', color: post.is_private ? 'black' : 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                            {post.is_private ? '🔒' : 'PUBLIC'}
                          </button>
                        </div>
                      )}

                      {post.is_pinned && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[8px] tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', background: accentColor, color: 'black' }}>
                          PINNED
                        </div>
                      )}
                      {isOwner && post.is_private && (
                        <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 text-[8px] tracking-wider font-black bg-yellow-400 text-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          🔒 PRIVATE
                        </div>
                      )}

                      <img src={post.image_url} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-5">
                        <div className="flex items-center gap-1.5 text-white">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                          <span className="text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{post.like_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Locked posts wall */}
                  {!isOwner && !isSubscribed && privatePostCount > 0 && profile.subscription_enabled && (
                    <div className="col-span-2 md:col-span-3">
                      <SubscribeWallCard
                        count={privatePostCount}
                        type="post"
                        price={profile.subscription_price}
                        accentColor={accentColor}
                        onSubscribe={() => setShowSubscribeModal(true)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            <div>
              {bookmarkedCatalogs.length === 0 ? (
                <EmptyState message="NO BOOKMARKED CATALOGS YET" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {bookmarkedCatalogs.map(catalog => (
                    <div key={catalog.id} className="group border border-white/10 hover:border-white/30 transition-all cursor-pointer" onClick={() => router.push(`/${catalog.username}/${catalog.slug}`)}>
                      <div className="aspect-square bg-white/5 overflow-hidden">
                        {catalog.image_url
                          ? <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-10">✦</span></div>
                        }
                      </div>
                      <div className="p-3 border-t border-white/10">
                        <h3 className="text-sm font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{catalog.name}</h3>
                        <p className="text-[10px] opacity-40 mt-1">@{catalog.username}</p>
                        <div className="flex justify-between text-[9px] opacity-30 mt-2">
                          <span>{catalog.item_count} items</span>
                          <span>🔖 {catalog.bookmark_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LIKED */}
          {activeTab === 'liked' && (
            <div>
              {likedItems.length === 0 ? (
                <EmptyState message="NO LIKED ITEMS YET" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {likedItems.map(item => (
                    <div key={item.id} className="group border border-white/10 hover:border-white/30 transition-all bg-white/[0.02]">
                      <div className="aspect-square bg-white/5 overflow-hidden cursor-pointer relative" onClick={() => setExpandedLikedItem(item)}>
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
                        {item.is_monetized && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-[9px] font-black text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>$</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-white/10">
                        <p className="text-[11px] font-black tracking-wide uppercase leading-tight truncate mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.title}</p>
                        <div className="flex justify-between text-[9px] opacity-30 mb-2">
                          {item.seller && <span className="truncate">{item.seller}</span>}
                          {item.price && <span className="font-black">${item.price}</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => toggleLike(item.id)} className="flex-1 py-1.5 border border-white/20 text-[9px] tracking-wider font-black hover:bg-white hover:text-black transition-all" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            ♥ {item.like_count}
                          </button>
                          <button onClick={() => setExpandedLikedItem(item)} className="px-3 py-1.5 border border-white/10 hover:border-white/40 text-[9px] font-black tracking-wider transition-all" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            VIEW
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SAVED (owner only) */}
          {activeTab === 'saved' && isOwner && (
            <div>
              {savedPosts.length === 0 ? (
                <EmptyState message="NO SAVED POSTS YET" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {savedPosts.map(post => (
                    <div key={post.id} className="group relative overflow-hidden cursor-pointer" style={{ aspectRatio: '3/4' }} onClick={() => router.push(`/post/${post.id}`)}>
                      <img src={post.image_url} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-sm font-black tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>VIEW POST</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SUBSCRIBE MODAL ── */}
        {showSubscribeModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSubscribeModal(false)}>
            <div className="w-full md:max-w-md border border-white/20 bg-black p-8 md:p-12" onClick={e => e.stopPropagation()}>
              <div className="text-[10px] tracking-[0.4em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>SUBSCRIBE TO</div>
              <h2 className="text-4xl font-black tracking-tighter mb-1" style={{ fontFamily: 'Archivo Black, sans-serif' }}>@{profile.username}</h2>
              {profile.subscription_price && (
                <p className="text-3xl font-black mb-6" style={{ fontFamily: 'Bebas Neue, sans-serif', color: accentColor }}>
                  ${profile.subscription_price}<span className="text-base opacity-50">/MONTH</span>
                </p>
              )}
              <ul className="space-y-2 mb-8">
                {['Access all private catalogs', 'Exclusive styling posts', 'Direct access to creator knowledge', 'Cancel anytime'].map(benefit => (
                  <li key={benefit} className="flex items-center gap-3 text-sm opacity-60">
                    <span style={{ color: accentColor }}>✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-4 text-xs tracking-[0.3em] font-black transition-all hover:opacity-90"
                style={{ fontFamily: 'Bebas Neue, sans-serif', background: accentColor, color: 'black' }}
                onClick={() => {
                  // Stripe integration goes here
                  alert('Subscription payment coming soon — Stripe integration in progress.');
                  setShowSubscribeModal(false);
                }}>
                SUBSCRIBE NOW
              </button>
              <p className="text-[9px] tracking-wider opacity-30 text-center mt-4">
                Payments processed securely. Cancel anytime.
              </p>
              <button onClick={() => setShowSubscribeModal(false)} className="absolute top-4 right-5 text-white/40 hover:text-white text-sm">✕</button>
            </div>
          </div>
        )}

        {/* ── EDIT PROFILE MODAL ── */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-2xl relative max-h-[90vh]">
              <button onClick={() => { setShowEditModal(false); setShowCropper(false); }} className="absolute -top-10 right-0 text-[10px] tracking-[0.4em] text-white/40 hover:text-white transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>[ESC]</button>
              <div className="border border-white/20 p-6 md:p-10 bg-black overflow-y-auto max-h-[90vh]">
                <div className="text-[10px] tracking-[0.5em] opacity-40 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>EDIT PROFILE</div>
                <h2 className="text-4xl font-black tracking-tighter mb-8" style={{ fontFamily: 'Archivo Black, sans-serif' }}>CUSTOMIZE</h2>

                <form onSubmit={handleUpdateProfile} className="space-y-6">

                  {/* Full name */}
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>DISPLAY NAME</label>
                    <input type="text" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="w-full px-0 py-2 bg-transparent border-b border-white/20 focus:border-white focus:outline-none transition-all text-white" placeholder="Your name" />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>BIO</label>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} maxLength={300} className="w-full px-0 py-2 bg-transparent border-b border-white/20 focus:border-white focus:outline-none transition-all text-white placeholder-white/20 resize-none" placeholder="Your bio..." />
                    <p className="text-[9px] opacity-30 mt-1">{editBio.length}/300</p>
                  </div>

                  {/* Avatar */}
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>AVATAR</label>
                    <div className="flex gap-2 mb-3">
                      {(['file', 'url'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setUploadMethod(m)} className="px-3 py-1.5 text-[10px] tracking-wider font-black transition-all" style={{ fontFamily: 'Bebas Neue, sans-serif', background: uploadMethod === m ? 'white' : 'transparent', color: uploadMethod === m ? 'black' : 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                          {m === 'file' ? 'UPLOAD FILE' : 'IMAGE URL'}
                        </button>
                      ))}
                    </div>
                    {uploadMethod === 'file'
                      ? <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'avatar')} className="w-full text-sm text-white/60 file:mr-3 file:py-1 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:tracking-wider file:font-black" />
                      : <input type="url" value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} placeholder="https://..." className="w-full px-0 py-2 bg-transparent border-b border-white/20 focus:border-white focus:outline-none transition-all text-white placeholder-white/20" />
                    }
                    {showCropper && previewUrl && (
                      <div className="mt-4 space-y-3">
                        <div className="relative w-full h-56 bg-white/5">
                          <Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                        </div>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
                      </div>
                    )}
                  </div>

                  {/* Banner */}
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>BANNER IMAGE</label>
                    <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'banner')} className="w-full text-sm text-white/60 file:mr-3 file:py-1 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:tracking-wider file:font-black" />
                    {(bannerPreviewUrl || editBannerUrl) && (
                      <div className="mt-3 h-24 overflow-hidden border border-white/10">
                        <img src={bannerPreviewUrl || editBannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <p className="text-[9px] opacity-30 mt-1">Recommended: 1500×500px or wider</p>
                  </div>

                  {/* Accent color */}
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ACCENT COLOR</label>
                    <div className="flex items-center gap-4">
                      <input type="color" value={editAccentColor} onChange={(e) => setEditAccentColor(e.target.value)} className="w-10 h-10 rounded border border-white/20 bg-transparent cursor-pointer" />
                      <span className="text-sm opacity-50 font-mono">{editAccentColor}</span>
                      <button type="button" onClick={() => setEditAccentColor(DEFAULT_ACCENT)} className="text-[10px] tracking-wider opacity-30 hover:opacity-70 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>RESET</button>
                    </div>
                    <p className="text-[9px] opacity-30 mt-1">Used for your subscribe button, avatar ring, and tab indicator</p>
                  </div>

                  {/* Subscription */}
                  <div className="border border-white/10 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>SUBSCRIPTION</p>
                        <p className="text-[10px] opacity-40 mt-0.5">Allow fans to subscribe for exclusive content</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditSubscriptionEnabled(!editSubscriptionEnabled)}
                        className="w-12 h-6 rounded-full border border-white/20 transition-all relative"
                        style={{ background: editSubscriptionEnabled ? accentColor : 'transparent' }}>
                        <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full bg-white" style={{ left: editSubscriptionEnabled ? '26px' : '2px' }} />
                      </button>
                    </div>
                    {editSubscriptionEnabled && (
                      <div>
                        <label className="block text-[10px] tracking-[0.3em] opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>MONTHLY PRICE (USD)</label>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40">$</span>
                          <input type="number" value={editSubscriptionPrice} onChange={(e) => setEditSubscriptionPrice(e.target.value)} min="1" max="999" step="0.01" placeholder="9.99" className="w-full px-0 py-2 bg-transparent border-b border-white/20 focus:border-white focus:outline-none transition-all text-white placeholder-white/20" />
                          <span className="text-white/40 text-sm">/mo</span>
                        </div>
                        <p className="text-[9px] opacity-30 mt-2">You keep ~80% after platform fees. Stripe integration required to activate.</p>
                      </div>
                    )}
                  </div>

                  {imageError && <div className="p-3 border border-red-500/40 text-red-400 text-xs tracking-wide">{imageError}</div>}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setShowEditModal(false); setShowCropper(false); }} className="flex-1 py-3 border border-white/20 hover:border-white text-white transition-all text-[10px] tracking-[0.3em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>CANCEL</button>
                    <button type="submit" disabled={saving} className="flex-1 py-3 bg-white text-black hover:bg-black hover:text-white border border-white transition-all text-[10px] tracking-[0.3em] font-black disabled:opacity-30 disabled:cursor-not-allowed" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {saving ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── FOLLOWERS MODAL ── */}
        {showFollowersModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowFollowersModal(false)}>
            <div className="w-full md:max-w-sm border border-white/20 bg-black max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex gap-4">
                  {(['followers', 'following'] as const).map(t => (
                    <button key={t} onClick={() => setFollowersModalType(t)} className="text-xs tracking-[0.2em] font-black transition-all" style={{ fontFamily: 'Bebas Neue, sans-serif', color: followersModalType === t ? 'white' : 'rgba(255,255,255,0.3)' }}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowFollowersModal(false)} className="text-white/40 hover:text-white">✕</button>
              </div>
              <div className="p-4 border-b border-white/10">
                <input value={followersSearchQuery} onChange={e => setFollowersSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30" />
              </div>
              <div className="overflow-y-auto flex-1">
                {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).map(user => (
                  <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { setShowFollowersModal(false); router.push(`/@${user.username}`); }}>
                    <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                      {user.avatar_url ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-black opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{user.username[0].toUpperCase()}</div>}
                    </div>
                    <div>
                      <p className="text-sm font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>@{user.username}</p>
                      {user.full_name && <p className="text-[10px] opacity-40">{user.full_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LIKED ITEM DETAIL MODAL ── */}
        {expandedLikedItem && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setExpandedLikedItem(null)}>
            <div className="relative w-full md:max-w-md bg-black border border-white/20" style={{ borderRadius: '0' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setExpandedLikedItem(null)} className="absolute top-3 right-4 text-white/40 hover:text-white">✕</button>
              <div className="flex gap-0">
                <div className="w-28 h-28 md:w-40 md:h-40 flex-shrink-0 bg-white/5">
                  <img src={expandedLikedItem.image_url} alt={expandedLikedItem.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 p-4 flex flex-col gap-2">
                  <h2 className="text-base font-black tracking-tighter pr-6" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{expandedLikedItem.title}</h2>
                  {expandedLikedItem.seller && <p className="text-[10px] opacity-40 uppercase tracking-wider">{expandedLikedItem.seller}</p>}
                  {expandedLikedItem.price && <p className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>${expandedLikedItem.price}</p>}
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <button onClick={() => toggleLike(expandedLikedItem.id)} className="py-2 border border-white/20 text-[10px] tracking-[0.2em] font-black hover:bg-white hover:text-black transition-all" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      ♥ LIKED ({expandedLikedItem.like_count})
                    </button>
                    {expandedLikedItem.product_url && (
                      <button onClick={() => window.open(expandedLikedItem.product_url!, '_blank')} className="py-2 bg-white text-black text-[10px] tracking-[0.2em] font-black hover:bg-black hover:text-white border border-white transition-all" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        VIEW PRODUCT ↗
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── HELPER COMPONENTS ──

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-24">
      <p className="text-lg tracking-[0.3em] opacity-20" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{message}</p>
    </div>
  );
}

function SubscribeWallCard({
  count, type, price, accentColor, onSubscribe
}: {
  count: number;
  type: 'catalog' | 'post';
  price: number | null;
  accentColor: string;
  onSubscribe: () => void;
}) {
  return (
    <div className="border border-white/10 p-8 flex flex-col items-center justify-center text-center gap-4 bg-white/[0.02]" style={{ minHeight: '200px' }}>
      <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: accentColor }}>🔒</div>
      <div>
        <p className="text-base font-black tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {count} PRIVATE {type === 'catalog' ? 'CATALOG' : 'POST'}{count !== 1 ? 'S' : ''} LOCKED
        </p>
        <p className="text-xs opacity-40 mt-1">Subscribe to unlock exclusive content from this creator</p>
      </div>
      <button onClick={onSubscribe} className="px-8 py-2.5 text-xs tracking-[0.3em] font-black transition-all hover:opacity-80" style={{ fontFamily: 'Bebas Neue, sans-serif', background: accentColor, color: 'black' }}>
        SUBSCRIBE{price ? ` · $${price}/MO` : ''}
      </button>
    </div>
  );
}