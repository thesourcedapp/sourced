"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Cropper from 'react-easy-crop';

type Point = { x: number; y: number };
type Area = { x: number; y: number; width: number; height: number };

// ─── Theme System ────────────────────────────────────────────────────────────
type ThemeKey = 'opium' | 'bone' | 'slate' | 'blush' | 'void';
type Theme = {
  name: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  tag: string;
};

const THEMES: Record<ThemeKey, Theme> = {
  opium: {
    name: 'OPIUM',
    bg: '#0a0a0a',
    surface: '#111111',
    border: '#222222',
    text: '#ffffff',
    muted: '#555555',
    accent: '#ffffff',
    accentText: '#000000',
    tag: '#1a1a1a',
  },
  bone: {
    name: 'BONE',
    bg: '#f5f0e8',
    surface: '#ede8de',
    border: '#d4cfc4',
    text: '#1a1714',
    muted: '#8a8278',
    accent: '#1a1714',
    accentText: '#f5f0e8',
    tag: '#e8e3d8',
  },
  slate: {
    name: 'SLATE',
    bg: '#0f1117',
    surface: '#161a24',
    border: '#252d3d',
    text: '#e8eaf2',
    muted: '#4a5268',
    accent: '#4f6ef7',
    accentText: '#ffffff',
    tag: '#1c2030',
  },
  blush: {
    name: 'BLUSH',
    bg: '#fdf6f0',
    surface: '#f9ede4',
    border: '#e8d5c8',
    text: '#2a1a14',
    muted: '#9a7a6e',
    accent: '#c4614a',
    accentText: '#ffffff',
    tag: '#f4e4da',
  },
  void: {
    name: 'VOID',
    bg: '#000000',
    surface: '#0a0a0a',
    border: '#1a1a1a',
    text: '#ffffff',
    muted: '#333333',
    accent: '#ff3366',
    accentText: '#ffffff',
    tag: '#111111',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileData = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  theme: ThemeKey | null;
  social_instagram: string | null;
  social_tiktok: string | null;
  social_url: string | null;
  subscription_price: number | null;
  subscription_enabled: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadImageToStorage(file: File, userId: string, bucket: string = 'avatars'): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${bucket}-${userId}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: true });
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
          className="underline hover:opacity-70 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Canvas is empty')); }, 'image/jpeg', 0.95);
    };
    image.onerror = reject;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
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

  // Viewer role — shell for subscriber system
  // isOwner: viewing your own page
  // isSubscriber: paid subscriber (shell — always false until Stripe is wired)
  // isPublicViewer: everyone else
  const [isSubscriber] = useState(false); // TODO: wire to Stripe subscription check

  const [activeTab, setActiveTab] = useState<'catalogs' | 'posts' | 'bookmarks' | 'liked' | 'saved'>('catalogs');
  const [expandedLikedItem, setExpandedLikedItem] = useState<LikedItem | null>(null);

  // Theme
  const [activeTheme, setActiveTheme] = useState<ThemeKey>('opium');
  const t = THEMES[activeTheme];

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

  // Customize drawer
  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'theme' | 'banner' | 'links' | 'subscription'>('theme');

  // Banner
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Social links (edit state)
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editSocialUrl, setEditSocialUrl] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);

  // Subscription shell
  const [editSubPrice, setEditSubPrice] = useState('');
  const [editSubEnabled, setEditSubEnabled] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  // Followers modal
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowUser[]>([]);

  const isOwner = currentUserId === profileId;

  // ─── Init ──────────────────────────────────────────────────────────────────
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
    }
  }, [profileId, isOwner]);

  useEffect(() => {
    if (currentUserId && username) loadProfile();
  }, [currentUserId, username]);

  useEffect(() => {
    const q = followersSearchQuery.toLowerCase();
    setFilteredFollowers(q ? followers.filter(u => u.username.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)) : followers);
    setFilteredFollowing(q ? following.filter(u => u.username.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)) : following);
  }, [followers, following, followersSearchQuery]);

  // ─── Data Loaders ─────────────────────────────────────────────────────────
  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadProfile() {
    if (!username) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, banner_url, theme, social_instagram, social_tiktok, social_url, subscription_price, subscription_enabled, followers_count, following_count')
        .eq('username', username)
        .single();

      if (!error && data) {
        setProfileId(data.id);
        setBannerUrl(data.banner_url || null);
        if (data.theme && THEMES[data.theme as ThemeKey]) setActiveTheme(data.theme as ThemeKey);
        setEditInstagram(data.social_instagram || '');
        setEditTiktok(data.social_tiktok || '');
        setEditSocialUrl(data.social_url || '');
        setEditSubPrice(data.subscription_price ? String(data.subscription_price) : '');
        setEditSubEnabled(data.subscription_enabled || false);

        let profileWithFollowing = { ...data, is_following: false };
        if (currentUserId && currentUserId !== data.id) {
          const { data: followData } = await supabase.from('followers').select('id').eq('follower_id', currentUserId).eq('following_id', data.id).single();
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
      const { data, error } = await supabase.from('catalogs')
        .select(`id, name, description, image_url, created_at, bookmark_count, slug, owner_id, is_pinned, profiles!catalogs_owner_id_fkey(username), catalog_items(count)`)
        .eq('owner_id', profileId).eq('visibility', 'public')
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      if (!error && data) {
        setCatalogs(data.map(catalog => {
          const owner = Array.isArray(catalog.profiles) ? catalog.profiles[0] : catalog.profiles;
          return { ...catalog, item_count: catalog.catalog_items?.[0]?.count || 0, bookmark_count: catalog.bookmark_count || 0, owner_username: owner?.username || 'unknown', is_pinned: catalog.is_pinned || false };
        }));
      }
    } catch (error) { console.error('Error loading catalogs:', error); }
  }

  async function loadFeedPosts() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.from('feed_posts')
        .select('id, image_url, caption, like_count, comment_count, created_at, is_pinned')
        .eq('owner_id', profileId)
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      if (!error && data) setFeedPosts(data.map(post => ({ ...post, is_pinned: post.is_pinned || false })));
    } catch (error) { console.error('Error loading feed posts:', error); }
  }

  async function loadSavedPosts() {
    if (!profileId || !isOwner) return;
    try {
      const { data: savedData, error } = await supabase.from('saved_feed_posts').select('feed_post_id, created_at').eq('user_id', profileId);
      if (error || !savedData) return;
      const postIds = savedData.map(s => s.feed_post_id);
      if (postIds.length === 0) { setSavedPosts([]); return; }
      const { data: postsData, error: postsError } = await supabase.from('feed_posts').select('id, image_url, caption, like_count, comment_count, created_at').in('id', postIds);
      if (postsError || !postsData) return;
      const transformedPosts: SavedPost[] = postsData.map(post => {
        const saved = savedData.find(s => s.feed_post_id === post.id);
        return { ...post, saved_at: saved?.created_at || '' };
      }).sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
      setSavedPosts(transformedPosts);
    } catch (error) { console.error('Error loading saved posts:', error); }
  }

  async function loadBookmarkedCatalogs() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.from('bookmarked_catalogs').select('catalog_id, created_at').eq('user_id', profileId);
      if (error || !data) return;
      const catalogIds = data.map(b => b.catalog_id);
      if (catalogIds.length === 0) { setBookmarkedCatalogs([]); return; }
      const { data: catalogsData, error: catalogsError } = await supabase.from('catalogs')
        .select('id, name, description, image_url, bookmark_count, owner_id, visibility, slug, catalog_items(count)').in('id', catalogIds);
      if (catalogsError || !catalogsData) return;
      const ownerIds = [...new Set(catalogsData.map(c => c.owner_id))];
      const { data: ownersData } = await supabase.from('profiles').select('id, username, full_name').in('id', ownerIds);
      const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || []);
      setBookmarkedCatalogs(
        catalogsData.filter(c => c.visibility === 'public').map(catalog => {
          const owner = ownersMap.get(catalog.owner_id);
          const bookmark = data.find(b => b.catalog_id === catalog.id);
          return { id: catalog.id, name: catalog.name, description: catalog.description, image_url: catalog.image_url, bookmark_count: catalog.bookmark_count || 0, username: owner?.username || 'unknown', full_name: owner?.full_name, item_count: catalog.catalog_items?.[0]?.count || 0, created_at: bookmark?.created_at || '', slug: catalog.slug || '' };
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
        const { data: catalogItemsData } = await supabase.from('catalog_items').select('id, title, image_url, product_url, price, seller, catalog_id, like_count, is_monetized').in('id', catalogItemIds);
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
            transformedItems.push({ id: item.id, title: item.title, image_url: item.image_url, product_url: item.product_url, price: item.price, seller: item.seller, catalog_id: item.catalog_id, catalog_name: catalog?.name || 'Unknown', catalog_owner: owner?.username || 'unknown', catalog_slug: catalog?.slug || '', like_count: item.like_count || 0, created_at: like?.created_at || '', is_monetized: item.is_monetized || false });
          });
        }
      }
      if (feedItemIds.length > 0) {
        const { data: feedItemsData } = await supabase.from('feed_post_items').select('id, title, image_url, product_url, price, seller, feed_post_id, like_count').in('id', feedItemIds);
        if (feedItemsData) {
          feedItemsData.forEach(item => {
            const like = feedPostLikes?.find(l => l.item_id === item.id);
            transformedItems.push({ id: item.id, title: item.title, image_url: item.image_url, product_url: item.product_url, price: item.price, seller: item.seller, catalog_id: item.feed_post_id, catalog_name: 'Feed Post', catalog_owner: 'feed', catalog_slug: item.feed_post_id, like_count: item.like_count || 0, created_at: like?.created_at || '', is_monetized: false });
          });
        }
      }
      transformedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLikedItems(transformedItems);
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

  // ─── Actions ───────────────────────────────────────────────────────────────
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

  async function togglePinCatalog(catalogId: string) {
    if (!isOwner) return;
    const catalog = catalogs.find(c => c.id === catalogId);
    if (!catalog) return;
    await supabase.from('catalogs').update({ is_pinned: !catalog.is_pinned }).eq('id', catalogId);
    await loadUserCatalogs();
  }

  async function togglePinPost(postId: string) {
    if (!isOwner) return;
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    await supabase.from('feed_posts').update({ is_pinned: !post.is_pinned }).eq('id', postId);
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError('Please select an image file'); return; }
    setSelectedFile(file); setImageError('');
    const reader = new FileReader();
    reader.onload = (e) => { setPreviewUrl(e.target?.result as string); setShowCropper(true); };
    reader.readAsDataURL(file);
  }

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => { setCroppedAreaPixels(croppedAreaPixels); };

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    setSaving(true); setImageError('');
    try {
      let finalAvatarUrl = editAvatarUrl;
      if (uploadMethod === 'file' && selectedFile && previewUrl && croppedAreaPixels) {
        const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
        const croppedFile = new File([croppedBlob], selectedFile.name, { type: 'image/jpeg' });
        const uploadResult = await uploadImageToStorage(croppedFile, currentUserId, 'avatars');
        if (!uploadResult.url) { setImageError(uploadResult.error || "Failed to upload image"); setSaving(false); return; }
        finalAvatarUrl = uploadResult.url;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const moderationResponse = await fetch("/api/check-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: finalAvatarUrl }), signal: controller.signal });
          clearTimeout(timeoutId);
          if (moderationResponse.ok) { const moderationData = await moderationResponse.json(); if (moderationData.safe === false) { setImageError("Image contains inappropriate content and cannot be used"); setSaving(false); return; } }
        } catch {}
      }
      const { error } = await supabase.from('profiles').update({ full_name: editFullName.trim() || null, bio: editBio.trim() || null, avatar_url: finalAvatarUrl.trim() || null }).eq('id', currentUserId);
      if (error) throw error;
      await loadProfile();
      setShowEditModal(false); setShowCropper(false);
    } catch (error) { console.error('Error updating profile:', error); alert('Failed to update profile'); } finally { setSaving(false); }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setBannerUploading(true);
    try {
      const result = await uploadImageToStorage(file, currentUserId, 'banners');
      if (result.url) {
        await supabase.from('profiles').update({ banner_url: result.url }).eq('id', currentUserId);
        setBannerUrl(result.url);
      }
    } catch (error) { console.error('Error uploading banner:', error); }
    setBannerUploading(false);
  }

  async function handleSaveTheme(themeKey: ThemeKey) {
    if (!currentUserId) return;
    setActiveTheme(themeKey);
    await supabase.from('profiles').update({ theme: themeKey }).eq('id', currentUserId);
  }

  async function handleSaveLinks() {
    if (!currentUserId) return;
    setSavingLinks(true);
    await supabase.from('profiles').update({ social_instagram: editInstagram.trim() || null, social_tiktok: editTiktok.trim() || null, social_url: editSocialUrl.trim() || null }).eq('id', currentUserId);
    await loadProfile();
    setSavingLinks(false);
  }

  async function handleSaveSubscription() {
    if (!currentUserId) return;
    setSavingSub(true);
    // Shell — saves price/enabled flag but payment processing not wired yet
    await supabase.from('profiles').update({ subscription_price: editSubPrice ? parseFloat(editSubPrice) : null, subscription_enabled: editSubEnabled }).eq('id', currentUserId);
    await loadProfile();
    setSavingSub(false);
  }

  async function removeFollower(followerId: string) {
    if (!currentUserId || !isOwner) return;
    try {
      await supabase.from('followers').delete().eq('follower_id', followerId).eq('following_id', profileId);
      const follower = followers.find(f => f.id === followerId);
      if (follower) await supabase.from('profiles').update({ following_count: Math.max(0, follower.following_count - 1) }).eq('id', followerId);
      if (profile) await supabase.from('profiles').update({ followers_count: Math.max(0, profile.followers_count - 1) }).eq('id', profileId);
      await loadProfile(); await loadFollowers();
    } catch (error) { console.error('Error removing follower:', error); }
  }

  async function unfollow(followingId: string) {
    if (!currentUserId || !isOwner) return;
    try {
      await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', followingId);
      const followedUser = following.find(f => f.id === followingId);
      if (followedUser) await supabase.from('profiles').update({ followers_count: Math.max(0, followedUser.followers_count - 1) }).eq('id', followingId);
      if (profile) await supabase.from('profiles').update({ following_count: Math.max(0, profile.following_count - 1) }).eq('id', currentUserId);
      await loadProfile(); await loadFollowing();
    } catch (error) { console.error('Error unfollowing user:', error); }
  }

  function openFollowersModal(type: 'followers' | 'following') {
    setFollowersModalType(type); setFollowersSearchQuery(''); setShowFollowersModal(true);
  }

  // ─── Derived ───────────────────────────────────────────────────────────────
  const pinnedCatalogs = catalogs.filter(c => c.is_pinned);
  const subEnabled = profile?.subscription_enabled;
  const subPrice = profile?.subscription_price;

  // Content visibility: locked catalogs for subscriber-only (shell logic)
  // In production: catalogs marked subscription_only would be gated
  // For now: last 2 catalogs are shown as locked to non-subscribers if sub is enabled
  const publicCatalogs = catalogs;
  const lockedCatalogs: UserCatalog[] = []; // TODO: filter by subscription_only flag

  const tabs = [
    { id: 'catalogs' as const, label: 'CATALOGS', count: catalogs.length },
    { id: 'posts' as const, label: 'POSTS', count: feedPosts.length },
    { id: 'bookmarks' as const, label: 'BOOKMARKS', count: bookmarkedCatalogs.length },
    { id: 'liked' as const, label: 'LIKED', count: likedItems.length },
    ...(isOwner ? [{ id: 'saved' as const, label: 'SAVED', count: savedPosts.length }] : [])
  ];

  // ─── Loading / 404 ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '13px', letterSpacing: '0.4em', color: '#555' }}>LOADING...</p>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style>
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '40px', color: '#fff', marginBottom: '16px' }}>PROFILE NOT FOUND</h1>
            <button onClick={() => router.back()} style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '12px', letterSpacing: '0.4em', padding: '10px 24px', border: '2px solid #fff', background: 'transparent', color: '#fff', cursor: 'pointer' }}>GO BACK</button>
          </div>
        </div>
      </>
    );
  }

  // ─── CSS vars injected via style tag so theme affects whole page ───────────
  const themeVars = `
    :root {
      --p-bg: ${t.bg};
      --p-surface: ${t.surface};
      --p-border: ${t.border};
      --p-text: ${t.text};
      --p-muted: ${t.muted};
      --p-accent: ${t.accent};
      --p-accent-text: ${t.accentText};
      --p-tag: ${t.tag};
    }
  `;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Archivo:wght@400;500&display=swap');
        ${themeVars}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, select { font-size: 16px !important; }
        body { background: var(--p-bg); }

        .profile-page { min-height: 100vh; background: var(--p-bg); color: var(--p-text); font-family: 'Archivo', sans-serif; }

        /* Banner */
        .banner-wrap { position: relative; width: 100%; height: 260px; overflow: hidden; background: var(--p-surface); }
        .banner-img { width: 100%; height: 100%; object-fit: cover; }
        .banner-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .banner-grid { position: absolute; inset: 0; background-image: repeating-linear-gradient(0deg, transparent, transparent 39px, var(--p-border) 39px, var(--p-border) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, var(--p-border) 39px, var(--p-border) 40px); opacity: 0.4; }
        .banner-label { position: absolute; top: 20px; left: 20px; font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 3px; color: var(--p-muted); }
        .banner-upload-btn { position: absolute; bottom: 16px; right: 16px; background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 16px; font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.15s; }
        .banner-upload-btn:hover { background: rgba(0,0,0,0.9); }
        .banner-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 80px; background: linear-gradient(to top, var(--p-bg), transparent); }

        /* Identity */
        .identity-section { padding: 0 24px 0; margin-top: -52px; position: relative; z-index: 2; }
        .identity-row { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .avatar-wrap { position: relative; flex-shrink: 0; }
        .avatar-circle { width: 96px; height: 96px; border-radius: 50%; border: 3px solid var(--p-bg); overflow: hidden; background: var(--p-surface); display: flex; align-items: center; justify-content: center; }
        .avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-placeholder { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: var(--p-muted); }
        .identity-meta { padding-bottom: 8px; flex: 1; min-width: 200px; }
        .creator-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 2px; color: var(--p-muted); margin-bottom: 4px; }
        .creator-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
        .username-line { font-family: 'Archivo Black', sans-serif; font-size: clamp(28px, 5vw, 48px); color: var(--p-text); line-height: 1; letter-spacing: -1px; }
        .full-name-line { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: var(--p-muted); letter-spacing: 2px; margin-top: 4px; }
        .identity-actions { display: flex; gap: 8px; padding-bottom: 8px; flex-wrap: wrap; }
        .btn-primary { padding: 10px 20px; background: var(--p-accent); color: var(--p-accent-text); border: none; font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; cursor: pointer; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.85; }
        .btn-outline { padding: 10px 20px; background: transparent; color: var(--p-text); border: 1px solid var(--p-border); font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; cursor: pointer; transition: all 0.15s; }
        .btn-outline:hover { border-color: var(--p-text); }

        /* Bio */
        .bio-section { padding: 20px 24px 0; max-width: 680px; }
        .bio-text { font-size: 13px; line-height: 1.7; color: var(--p-text); opacity: 0.75; }
        .social-links { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .social-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid var(--p-border); font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1.5px; color: var(--p-muted); text-decoration: none; transition: all 0.15s; }
        .social-pill:hover { border-color: var(--p-text); color: var(--p-text); }

        /* Stats bar */
        .stats-bar { display: flex; border-top: 1px solid var(--p-border); border-bottom: 1px solid var(--p-border); margin: 20px 0 0; }
        .stat-cell { flex: 1; padding: 16px 8px; text-align: center; border-right: 1px solid var(--p-border); cursor: pointer; transition: background 0.15s; }
        .stat-cell:last-child { border-right: none; }
        .stat-cell:hover { background: var(--p-surface); }
        .stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: var(--p-text); line-height: 1; }
        .stat-label { font-size: 9px; letter-spacing: 1.5px; color: var(--p-muted); margin-top: 3px; text-transform: uppercase; }

        /* Subscription CTA */
        .sub-cta { margin: 0 24px; border: 1px solid var(--p-border); padding: 20px 24px; display: flex; align-items: center; gap: 16px; background: var(--p-surface); }
        .sub-cta-text { flex: 1; }
        .sub-cta-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; color: var(--p-text); }
        .sub-cta-desc { font-size: 12px; color: var(--p-muted); margin-top: 2px; }
        .sub-cta-price { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: var(--p-text); flex-shrink: 0; }

        /* Pinned strip */
        .section-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 12px; }
        .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 3px; color: var(--p-muted); }
        .section-action { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; color: var(--p-muted); cursor: pointer; transition: color 0.15s; }
        .section-action:hover { color: var(--p-text); }
        .pinned-strip { display: flex; gap: 12px; padding: 0 24px 20px; overflow-x: auto; scrollbar-width: none; }
        .pinned-strip::-webkit-scrollbar { display: none; }
        .pinned-card { flex-shrink: 0; width: 140px; border: 1px solid var(--p-border); cursor: pointer; transition: all 0.15s; position: relative; overflow: hidden; }
        .pinned-card:hover { border-color: var(--p-text); transform: translateY(-2px); }
        .pinned-card-img { width: 100%; height: 170px; background: var(--p-tag); overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .pinned-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .pinned-card-info { padding: 10px 12px; background: var(--p-surface); }
        .pinned-card-name { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 1px; color: var(--p-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pinned-card-count { font-size: 10px; color: var(--p-muted); margin-top: 2px; }
        .pinned-new-badge { position: absolute; top: 8px; left: 8px; background: var(--p-accent); color: var(--p-accent-text); font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1.5px; padding: 3px 6px; }

        /* Tabs */
        .tabs-wrap { border-bottom: 1px solid var(--p-border); margin-top: 8px; }
        .tabs-inner { display: flex; overflow-x: auto; scrollbar-width: none; padding: 0 24px; }
        .tabs-inner::-webkit-scrollbar { display: none; }
        .tab-btn { padding: 16px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 12px; letter-spacing: 2px; border-bottom: 2px solid transparent; color: var(--p-muted); background: none; border-top: none; border-left: none; border-right: none; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .tab-btn.active { border-bottom-color: var(--p-accent); color: var(--p-text); }
        .tab-btn:hover:not(.active) { color: var(--p-text); }

        /* Content */
        .content-wrap { padding: 24px; }

        /* Catalog grid */
        .catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        .catalog-card { border: 1px solid var(--p-border); cursor: pointer; position: relative; transition: all 0.15s; overflow: hidden; }
        .catalog-card:hover { border-color: var(--p-text); transform: translateY(-2px); }
        .catalog-img { aspect-ratio: 1; background: var(--p-surface); overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .catalog-img img { width: 100%; height: 100%; object-fit: cover; }
        .catalog-placeholder-icon { font-size: 48px; opacity: 0.1; }
        .catalog-info { padding: 14px 16px; border-top: 1px solid var(--p-border); background: var(--p-surface); }
        .catalog-name { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 1px; color: var(--p-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .catalog-desc { font-size: 11px; color: var(--p-muted); margin-top: 4px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .catalog-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 10px; color: var(--p-muted); letter-spacing: 0.5px; }
        .pin-badge { position: absolute; top: 10px; left: 10px; background: #f59e0b; color: #000; font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1px; padding: 3px 8px; }
        .pin-toggle { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #fff; border: none; font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1px; padding: 4px 8px; cursor: pointer; opacity: 0; transition: opacity 0.15s; backdrop-filter: blur(4px); }
        .catalog-card:hover .pin-toggle { opacity: 1; }

        /* Locked card */
        .catalog-card-locked { border: 1px solid var(--p-border); position: relative; overflow: hidden; opacity: 0.6; }
        .lock-overlay { position: absolute; inset: 0; background: var(--p-bg); opacity: 0.7; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
        .lock-icon { font-size: 24px; }
        .lock-text { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; color: var(--p-muted); }

        /* Posts grid */
        .posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
        .post-cell { aspect-ratio: 3/4; position: relative; overflow: hidden; cursor: pointer; background: var(--p-surface); }
        .post-cell img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .post-cell:hover img { transform: scale(1.04); }
        .post-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 20px; }
        .post-cell:hover .post-overlay { opacity: 1; }
        .post-stat { display: flex; align-items: center; gap: 6px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 16px; }
        .post-pin-badge { position: absolute; top: 8px; left: 8px; background: #f59e0b; color: #000; font-family: 'Bebas Neue', sans-serif; font-size: 9px; padding: 2px 6px; border-radius: 2px; }
        .post-pin-toggle { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #fff; border: none; font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1px; padding: 3px 8px; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
        .post-cell:hover .post-pin-toggle { opacity: 1; }

        /* Liked / bookmarks grid */
        .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        .item-card { border: 1px solid var(--p-border); background: var(--p-surface); transition: border-color 0.15s; }
        .item-card:hover { border-color: var(--p-text); }
        .item-img { aspect-ratio: 1; overflow: hidden; cursor: pointer; background: var(--p-tag); }
        .item-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .item-img:hover img { transform: scale(1.04); }
        .item-info { padding: 10px 12px; border-top: 1px solid var(--p-border); }
        .item-title { font-family: 'Bebas Neue', sans-serif; font-size: 12px; letter-spacing: 1px; color: var(--p-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--p-muted); margin-top: 4px; }
        .item-actions { display: flex; gap: 6px; margin-top: 8px; }
        .item-btn { flex: 1; padding: 6px 0; font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1px; border: 1px solid var(--p-border); background: transparent; color: var(--p-text); cursor: pointer; transition: all 0.15s; }
        .item-btn:hover { background: var(--p-accent); color: var(--p-accent-text); border-color: var(--p-accent); }
        .monetized-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #22c55e; margin-right: 4px; }

        /* Empty state */
        .empty-state { text-align: center; padding: 80px 20px; }
        .empty-title { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 3px; color: var(--p-muted); }
        .empty-sub { font-size: 12px; color: var(--p-muted); margin-top: 8px; opacity: 0.6; }

        /* Customize drawer */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; backdrop-filter: blur(4px); }
        .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; max-width: 100vw; background: var(--p-surface); border-left: 1px solid var(--p-border); z-index: 101; display: flex; flex-direction: column; overflow: hidden; }
        .drawer-header { padding: 20px 24px; border-bottom: 1px solid var(--p-border); display: flex; align-items: center; justify-content: space-between; }
        .drawer-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: var(--p-text); }
        .drawer-close { background: none; border: none; color: var(--p-muted); font-size: 18px; cursor: pointer; padding: 4px; }
        .drawer-close:hover { color: var(--p-text); }
        .drawer-tabs { display: flex; border-bottom: 1px solid var(--p-border); }
        .drawer-tab { flex: 1; padding: 12px 8px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1.5px; color: var(--p-muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s; }
        .drawer-tab.active { color: var(--p-text); border-bottom-color: var(--p-accent); }
        .drawer-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }
        .drawer-label { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; color: var(--p-muted); margin-bottom: 8px; }
        .theme-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .theme-swatch { height: 48px; border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 8px; letter-spacing: 1px; }
        .theme-swatch.selected { border-color: var(--p-accent); }
        .drawer-input { width: 100%; padding: 10px 0; background: transparent; border: none; border-bottom: 1px solid var(--p-border); color: var(--p-text); font-size: 13px; outline: none; transition: border-color 0.15s; }
        .drawer-input:focus { border-bottom-color: var(--p-text); }
        .drawer-input::placeholder { color: var(--p-muted); }
        .sub-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--p-border); }
        .sub-toggle-label { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 1px; color: var(--p-text); }
        .toggle-btn { width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; transition: background 0.2s; }
        .toggle-btn.on { background: var(--p-accent); }
        .toggle-btn.off { background: var(--p-border); }
        .toggle-knob { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; }
        .toggle-btn.on .toggle-knob { left: 23px; }
        .toggle-btn.off .toggle-knob { left: 3px; }
        .sub-coming-soon { font-size: 11px; color: var(--p-muted); background: var(--p-tag); padding: 12px; border: 1px solid var(--p-border); line-height: 1.6; }

        /* Customize FAB */
        .customize-fab { position: fixed; bottom: 28px; right: 28px; z-index: 50; background: var(--p-accent); color: var(--p-accent-text); border: none; padding: 14px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 12px; letter-spacing: 2px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.4); transition: transform 0.15s, opacity 0.15s; }
        .customize-fab:hover { transform: translateY(-2px); }

        /* Follow modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(8px); }
        .modal-box { width: 100%; max-width: 440px; background: var(--p-surface); border: 1px solid var(--p-border); max-height: 80vh; display: flex; flex-direction: column; }
        .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--p-border); display: flex; align-items: center; justify-content: space-between; }
        .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 2px; color: var(--p-text); }
        .modal-search { margin: 12px 24px; padding: 10px 0; background: transparent; border: none; border-bottom: 1px solid var(--p-border); color: var(--p-text); font-size: 13px; outline: none; width: calc(100% - 48px); }
        .modal-search::placeholder { color: var(--p-muted); }
        .modal-list { overflow-y: auto; flex: 1; }
        .modal-user-row { display: flex; align-items: center; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--p-border); cursor: pointer; transition: background 0.1s; }
        .modal-user-row:hover { background: var(--p-tag); }
        .modal-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--p-tag); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; color: var(--p-muted); }
        .modal-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .modal-user-name { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 1px; color: var(--p-text); }
        .modal-user-sub { font-size: 11px; color: var(--p-muted); margin-top: 1px; }
        .modal-remove-btn { margin-left: auto; padding: 4px 12px; border: 1px solid var(--p-border); background: transparent; color: var(--p-muted); font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1px; cursor: pointer; transition: all 0.15s; }
        .modal-remove-btn:hover { border-color: var(--p-text); color: var(--p-text); }

        /* Edit profile modal */
        .edit-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(12px); }
        .edit-modal-box { width: 100%; max-width: 520px; background: #000; border: 2px solid var(--p-text); padding: 40px; max-height: 90vh; overflow-y: auto; position: relative; }
        .edit-modal-close { position: absolute; top: -40px; right: 0; background: none; border: none; color: rgba(255,255,255,0.5); font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 3px; cursor: pointer; }
        .edit-modal-label { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; color: rgba(255,255,255,0.5); margin-bottom: 8px; }
        .edit-modal-input { width: 100%; background: transparent; border: none; border-bottom: 2px solid rgba(255,255,255,0.3); color: #fff; padding: 8px 0; font-size: 14px; outline: none; transition: border-color 0.15s; }
        .edit-modal-input:focus { border-bottom-color: #fff; }
        .edit-modal-input::placeholder { color: rgba(255,255,255,0.3); }
        .method-toggle { display: flex; gap: 8px; margin-bottom: 12px; }
        .method-btn { padding: 6px 16px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1.5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: rgba(255,255,255,0.5); transition: all 0.15s; }
        .method-btn.active { background: #fff; color: #000; border-color: #fff; }
        .save-btn { width: 100%; padding: 16px; background: #fff; color: #000; border: 2px solid #fff; font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 3px; cursor: pointer; transition: all 0.15s; }
        .save-btn:hover { background: transparent; color: #fff; }
        .save-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .cancel-btn { flex: 1; padding: 14px; background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.3); font-family: 'Bebas Neue', sans-serif; font-size: 12px; letter-spacing: 2px; cursor: pointer; transition: all 0.15s; }
        .cancel-btn:hover { border-color: #fff; }

        /* Liked item modal */
        .item-modal-overlay { position: fixed; inset: 0; z-index: 500; display: flex; align-items: flex-end; }
        @media (min-width: 768px) { .item-modal-overlay { align-items: center; justify-content: center; } }
        .item-modal-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.75); }
        .item-modal-box { position: relative; width: 100%; max-width: 440px; background: var(--p-surface); border-top: 1px solid var(--p-border); border-radius: 14px 14px 0 0; max-height: 65vh; overflow: hidden; display: flex; flex-direction: column; }
        @media (min-width: 768px) { .item-modal-box { border-radius: 0; border: 1px solid var(--p-border); } }
        .drag-handle { display: flex; justify-content: center; padding: 10px 0 6px; cursor: pointer; }
        .drag-bar { width: 40px; height: 4px; border-radius: 2px; background: var(--p-border); }
        .item-modal-content { display: flex; gap: 0; overflow: hidden; flex: 1; }
        .item-modal-img { width: 120px; height: 120px; flex-shrink: 0; background: var(--p-tag); margin: 12px; object-fit: cover; }
        .item-modal-info { flex: 1; padding: 12px 12px 12px 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .item-modal-title { font-family: 'Archivo Black', sans-serif; font-size: 14px; color: var(--p-text); line-height: 1.2; padding-right: 24px; }
        .item-modal-price { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--p-text); }
        .item-modal-seller { font-size: 10px; color: var(--p-muted); letter-spacing: 1px; }
        .item-modal-btn { padding: 10px; font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 1.5px; border: 1px solid var(--p-border); background: var(--p-accent); color: var(--p-accent-text); cursor: pointer; transition: opacity 0.15s; }
        .item-modal-btn:hover { opacity: 0.85; }
        .item-modal-btn-ghost { padding: 8px; font-family: 'Bebas Neue', sans-serif; font-size: 9px; letter-spacing: 1px; border: 1px solid var(--p-border); background: transparent; color: var(--p-muted); cursor: pointer; transition: all 0.15s; }
        .item-modal-btn-ghost:hover { color: var(--p-text); border-color: var(--p-text); }
        .item-modal-close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: var(--p-muted); font-size: 16px; cursor: pointer; padding: 4px; }

        @media (max-width: 640px) {
          .identity-section { padding: 0 16px; }
          .bio-section { padding: 16px 16px 0; }
          .stats-bar { overflow-x: auto; }
          .stat-cell { min-width: 80px; }
          .content-wrap { padding: 16px; }
          .posts-grid { gap: 1px; }
          .drawer { width: 100vw; }
          .sub-cta { margin: 0 16px; }
          .section-head { padding: 16px 16px 10px; }
          .pinned-strip { padding: 0 16px 16px; }
        }
      `}</style>

      <div className="profile-page">

        {/* ── Banner ─────────────────────────────────────────────────────── */}
        <div className="banner-wrap">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Profile banner" className="banner-img" />
          ) : (
            <div className="banner-placeholder">
              <div className="banner-grid" />
              <span className="banner-label">SOURCED / {profile.username.toUpperCase()}</span>
            </div>
          )}
          <div className="banner-fade" />
          {isOwner && (
            <>
              <button className="banner-upload-btn" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}>
                {bannerUploading ? 'UPLOADING...' : '+ CHANGE BANNER'}
              </button>
              <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
            </>
          )}
        </div>

        {/* ── Identity ───────────────────────────────────────────────────── */}
        <div className="identity-section">
          <div className="identity-row">
            <div className="avatar-wrap">
              <div className="avatar-circle">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} /> : <span className="avatar-placeholder">{profile.username[0].toUpperCase()}</span>}
              </div>
            </div>
            <div className="identity-meta">
              <div className="creator-badge">
                <span className="creator-badge-dot" />
                SOURCED CREATOR
              </div>
              <h1 className="username-line">@{profile.username}</h1>
              {profile.full_name && <p className="full-name-line">{profile.full_name}</p>}
            </div>
            <div className="identity-actions">
              <button className="btn-outline" onClick={handleShareProfile} style={{ minWidth: 80 }}>
                {showShareCopied ? 'COPIED!' : 'SHARE'}
              </button>
              {isOwner ? (
                <button className="btn-outline" onClick={() => setShowEditModal(true)}>EDIT PROFILE</button>
              ) : currentUserId ? (
                <button
                  className="btn-primary"
                  onClick={toggleFollow}
                  style={profile.is_following ? { background: 'transparent', color: 't.text', border: `1px solid ${t.border}` } : {}}
                >
                  {profile.is_following ? 'UNFOLLOW' : 'FOLLOW'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Bio + Social Links ─────────────────────────────────────────── */}
        <div className="bio-section">
          {profile.bio && <p className="bio-text">{linkifyBio(profile.bio)}</p>}
          <div className="social-links">
            {profile.social_instagram && (
              <a href={`https://instagram.com/${profile.social_instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-pill">
                IG / @{profile.social_instagram.replace('@', '')}
              </a>
            )}
            {profile.social_tiktok && (
              <a href={`https://tiktok.com/@${profile.social_tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-pill">
                TT / @{profile.social_tiktok.replace('@', '')}
              </a>
            )}
            {profile.social_url && (
              <a href={profile.social_url.startsWith('http') ? profile.social_url : `https://${profile.social_url}`} target="_blank" rel="noopener noreferrer" className="social-pill">
                ↗ LINK
              </a>
            )}
          </div>
        </div>

        {/* ── Stats Bar ─────────────────────────────────────────────────── */}
        <div className="stats-bar">
          <div className="stat-cell" onClick={() => openFollowersModal('followers')}>
            <div className="stat-num">{profile.followers_count.toLocaleString()}</div>
            <div className="stat-label">FOLLOWERS</div>
          </div>
          <div className="stat-cell" onClick={() => openFollowersModal('following')}>
            <div className="stat-num">{profile.following_count.toLocaleString()}</div>
            <div className="stat-label">FOLLOWING</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">{catalogs.length}</div>
            <div className="stat-label">CATALOGS</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">{feedPosts.length}</div>
            <div className="stat-label">POSTS</div>
          </div>
          {isOwner && (
            <div className="stat-cell" title="Total affiliate clicks across all items">
              <div className="stat-num">—</div>
              <div className="stat-label">CLICKS</div>
            </div>
          )}
        </div>

        {/* ── Subscription CTA ──────────────────────────────────────────── */}
        {subEnabled && subPrice && !isOwner && (
          <div style={{ padding: '20px 24px 0' }}>
            <div className="sub-cta">
              <div className="sub-cta-text">
                <div className="sub-cta-title">SUBSCRIBE FOR FULL ACCESS</div>
                <div className="sub-cta-desc">Unlock all catalogs, styling guides, and exclusive drops</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div className="sub-cta-price">${subPrice}<span style={{ fontSize: 12, fontFamily: 'Archivo, sans-serif', opacity: 0.5 }}>/mo</span></div>
                <button className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  SUBSCRIBE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show sub CTA to owner so they can see how it looks */}
        {subEnabled && subPrice && isOwner && (
          <div style={{ padding: '20px 24px 0' }}>
            <div className="sub-cta" style={{ borderStyle: 'dashed', opacity: 0.6 }}>
              <div className="sub-cta-text">
                <div className="sub-cta-title">SUBSCRIPTION PREVIEW</div>
                <div className="sub-cta-desc">Fans will see a subscribe button here — ${subPrice}/month</div>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: t.muted }}>PREVIEW ONLY</div>
            </div>
          </div>
        )}

        {/* ── Pinned Catalogs Strip ─────────────────────────────────────── */}
        {pinnedCatalogs.length > 0 && (
          <>
            <div className="section-head">
              <span className="section-title">PINNED</span>
              <span className="section-action" onClick={() => setActiveTab('catalogs')}>SEE ALL →</span>
            </div>
            <div className="pinned-strip">
              {pinnedCatalogs.map((catalog, i) => (
                <div key={catalog.id} className="pinned-card" onClick={() => router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                  <div className="pinned-card-img">
                    {catalog.image_url ? <img src={catalog.image_url} alt={catalog.name} /> : <span style={{ fontSize: 32, opacity: 0.1 }}>✦</span>}
                  </div>
                  {i === 0 && <span className="pinned-new-badge">TOP</span>}
                  <div className="pinned-card-info">
                    <div className="pinned-card-name">{catalog.name}</div>
                    <div className="pinned-card-count">{catalog.item_count} items</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="tabs-wrap">
          <div className="tabs-inner">
            {tabs.map(tab => (
              <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────────── */}
        <div className="content-wrap">

          {/* CATALOGS */}
          {activeTab === 'catalogs' && (
            catalogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">NO CATALOGS YET</div>
                <div className="empty-sub">{isOwner ? "Create your first catalog to start sharing your style" : "This creator hasn't published any catalogs yet"}</div>
              </div>
            ) : (
              <div className="catalog-grid">
                {catalogs.map(catalog => (
                  <div key={catalog.id} className="catalog-card">
                    {catalog.is_pinned && <span className="pin-badge">📌 PINNED</span>}
                    {isOwner && (
                      <button className="pin-toggle" onClick={(e) => { e.stopPropagation(); togglePinCatalog(catalog.id); }}>
                        {catalog.is_pinned ? 'UNPIN' : 'PIN'}
                      </button>
                    )}
                    <div className="catalog-img" onClick={() => router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                      {catalog.image_url ? <img src={catalog.image_url} alt={catalog.name} /> : <span className="catalog-placeholder-icon">✦</span>}
                    </div>
                    <div className="catalog-info" onClick={() => router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                      <div className="catalog-name">{catalog.name}</div>
                      {catalog.description && <div className="catalog-desc">{catalog.description}</div>}
                      <div className="catalog-meta">
                        <span>🔖 {catalog.bookmark_count}</span>
                        <span>{catalog.item_count} ITEMS</span>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Locked catalog shell — shown when subscription enabled and viewer isn't subscriber */}
                {subEnabled && !isSubscriber && !isOwner && [1, 2].map(i => (
                  <div key={`locked-${i}`} className="catalog-card catalog-card-locked">
                    <div className="catalog-img" style={{ position: 'relative' }}>
                      <span className="catalog-placeholder-icon">✦</span>
                      <div className="lock-overlay">
                        <span className="lock-icon">🔒</span>
                        <span className="lock-text">SUBSCRIBERS ONLY</span>
                      </div>
                    </div>
                    <div className="catalog-info">
                      <div className="catalog-name" style={{ color: t.muted }}>PRIVATE CATALOG</div>
                      <div className="catalog-meta"><span style={{ color: t.muted }}>Subscribe to unlock</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* POSTS */}
          {activeTab === 'posts' && (
            feedPosts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">NO POSTS YET</div>
                <div className="empty-sub">{isOwner ? "Share your first post to the feed" : "No posts yet"}</div>
              </div>
            ) : (
              <div className="posts-grid">
                {feedPosts.map(post => (
                  <div key={post.id} className="post-cell" onClick={() => router.push(`/post/${post.id}`)}>
                    <img src={post.image_url} alt="" />
                    {post.is_pinned && <span className="post-pin-badge">📌</span>}
                    {isOwner && (
                      <button className="post-pin-toggle" onClick={(e) => { e.stopPropagation(); togglePinPost(post.id); }}>
                        {post.is_pinned ? 'UNPIN' : 'PIN'}
                      </button>
                    )}
                    <div className="post-overlay">
                      <div className="post-stat">
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        {post.like_count}
                      </div>
                      <div className="post-stat">
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        {post.comment_count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            bookmarkedCatalogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">NO BOOKMARKS YET</div>
                <div className="empty-sub">{isOwner ? "Bookmark catalogs to save them here" : "No bookmarked catalogs"}</div>
              </div>
            ) : (
              <div className="items-grid">
                {bookmarkedCatalogs.map(catalog => (
                  <div key={catalog.id} className="item-card" onClick={() => router.push(`/${catalog.username}/${catalog.slug}`)}>
                    <div className="item-img">
                      {catalog.image_url ? <img src={catalog.image_url} alt={catalog.name} /> : <span style={{ fontSize: 32, opacity: 0.1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>✦</span>}
                    </div>
                    <div className="item-info">
                      <div className="item-title">{catalog.name}</div>
                      <div className="item-meta">
                        <span>@{catalog.username}</span>
                        <span>{catalog.item_count} items</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* LIKED */}
          {activeTab === 'liked' && (
            likedItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">NO LIKED ITEMS</div>
                <div className="empty-sub">{isOwner ? "Like items to save them here" : "No liked items"}</div>
              </div>
            ) : (
              <div className="items-grid">
                {likedItems.map(item => (
                  <div key={item.id} className="item-card">
                    <div className="item-img" onClick={() => setExpandedLikedItem(item)}>
                      <img src={item.image_url} alt={item.title} loading="lazy" />
                    </div>
                    <div className="item-info">
                      <div className="item-title">{item.title}</div>
                      <div className="item-meta">
                        {item.is_monetized && <span><span className="monetized-dot" />AFFILIATE</span>}
                        {item.price && <span>${item.price}</span>}
                      </div>
                      <div className="item-actions">
                        <button className="item-btn" onClick={() => toggleLike(item.id)}>♥ {item.like_count}</button>
                        <button className="item-btn" onClick={() => setExpandedLikedItem(item)}>VIEW</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* SAVED */}
          {activeTab === 'saved' && isOwner && (
            savedPosts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">NO SAVED POSTS</div>
                <div className="empty-sub">Save posts to view them here</div>
              </div>
            ) : (
              <div className="posts-grid">
                {savedPosts.map(post => (
                  <div key={post.id} className="post-cell" onClick={() => router.push(`/post/${post.id}`)}>
                    <img src={post.image_url} alt="" />
                    <div className="post-overlay">
                      <div className="post-stat"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>{post.like_count}</div>
                      <div className="post-stat"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>{post.comment_count}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* ── Customize FAB ─────────────────────────────────────────────── */}
        {isOwner && (
          <button className="customize-fab" onClick={() => setShowCustomizeDrawer(true)}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.94s-.03-.64-.07-1l2.15-1.68c.19-.15.24-.42.12-.64l-2.04-3.53c-.12-.22-.39-.3-.61-.22l-2.53 1.02c-.52-.4-1.08-.73-1.69-.98L14.5 3.5c-.04-.24-.24-.5-.5-.5h-4c-.26 0-.46.26-.5.5l-.38 2.61c-.61.25-1.17.59-1.69.98L4.9 5.57c-.22-.08-.49 0-.61.22L2.25 9.32c-.13.22-.07.49.12.64l2.15 1.68c-.04.36-.07.7-.07 1s.03.62.07.94l-2.15 1.68c-.19.15-.24.42-.12.64l2.04 3.53c.12.22.39.3.61.22l2.53-1.02c.52.4 1.08.73 1.69.98l.38 2.61c.04.24.24.5.5.5h4c.26 0 .46-.26.5-.5l.38-2.61c.61-.25 1.17-.58 1.69-.98l2.53 1.02c.22.08.49 0 .61-.22l2.04-3.53c.12-.22.07-.49-.12-.64l-2.15-1.68z"/></svg>
            CUSTOMIZE PAGE
          </button>
        )}

        {/* ── Customize Drawer ──────────────────────────────────────────── */}
        {showCustomizeDrawer && (
          <>
            <div className="drawer-overlay" onClick={() => setShowCustomizeDrawer(false)} />
            <div className="drawer">
              <div className="drawer-header">
                <span className="drawer-title">CUSTOMIZE</span>
                <button className="drawer-close" onClick={() => setShowCustomizeDrawer(false)}>✕</button>
              </div>
              <div className="drawer-tabs">
                {(['theme', 'banner', 'links', 'subscription'] as const).map(tab => (
                  <button key={tab} className={`drawer-tab ${drawerTab === tab ? 'active' : ''}`} onClick={() => setDrawerTab(tab)}>
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="drawer-body">

                {drawerTab === 'theme' && (
                  <>
                    <div>
                      <div className="drawer-label">CHOOSE A THEME</div>
                      <div className="theme-grid">
                        {(Object.entries(THEMES) as [ThemeKey, Theme][]).map(([key, theme]) => (
                          <div
                            key={key}
                            className={`theme-swatch ${activeTheme === key ? 'selected' : ''}`}
                            style={{ background: theme.bg, border: `2px solid ${activeTheme === key ? theme.accent : theme.border}` }}
                            onClick={() => handleSaveTheme(key)}
                          >
                            <span style={{ color: theme.muted, fontSize: 8, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 1 }}>{theme.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.6, padding: '12px', background: t.tag, border: `1px solid ${t.border}` }}>
                      Theme changes save instantly. Your followers will see your chosen theme when they visit your profile.
                    </div>
                  </>
                )}

                {drawerTab === 'banner' && (
                  <>
                    <div>
                      <div className="drawer-label">BANNER IMAGE</div>
                      <div style={{ width: '100%', height: 120, background: t.tag, border: `1px solid ${t.border}`, overflow: 'hidden', marginBottom: 12 }}>
                        {bannerUrl ? <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontFamily: 'Bebas Neue, sans-serif', fontSize: 12, letterSpacing: 2 }}>NO BANNER SET</div>}
                      </div>
                      <button className="btn-outline" style={{ width: '100%' }} onClick={() => bannerInputRef.current?.click()}>
                        {bannerUploading ? 'UPLOADING...' : '+ UPLOAD BANNER'}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.6 }}>
                      Recommended: 1500 × 500px. JPG or PNG. This is the first thing people see — make it yours.
                    </div>
                    {bannerUrl && (
                      <button className="btn-outline" onClick={async () => { await supabase.from('profiles').update({ banner_url: null }).eq('id', currentUserId!); setBannerUrl(null); }} style={{ color: t.muted, borderColor: t.border }}>
                        REMOVE BANNER
                      </button>
                    )}
                  </>
                )}

                {drawerTab === 'links' && (
                  <>
                    <div>
                      <div className="drawer-label">INSTAGRAM</div>
                      <input className="drawer-input" placeholder="@yourhandle" value={editInstagram} onChange={e => setEditInstagram(e.target.value)} style={{ color: t.text, borderBottomColor: t.border }} />
                    </div>
                    <div>
                      <div className="drawer-label">TIKTOK</div>
                      <input className="drawer-input" placeholder="@yourhandle" value={editTiktok} onChange={e => setEditTiktok(e.target.value)} style={{ color: t.text, borderBottomColor: t.border }} />
                    </div>
                    <div>
                      <div className="drawer-label">PERSONAL LINK</div>
                      <input className="drawer-input" placeholder="https://yoursite.com" value={editSocialUrl} onChange={e => setEditSocialUrl(e.target.value)} style={{ color: t.text, borderBottomColor: t.border }} />
                    </div>
                    <button className="btn-primary" style={{ width: '100%' }} onClick={handleSaveLinks} disabled={savingLinks}>
                      {savingLinks ? 'SAVING...' : 'SAVE LINKS'}
                    </button>
                  </>
                )}

                {drawerTab === 'subscription' && (
                  <>
                    <div className="sub-coming-soon" style={{ color: t.muted, background: t.tag, borderColor: t.border }}>
                      ⚡ Payment processing coming soon. Set your price now and activate when Stripe is connected.
                    </div>
                    <div className="sub-toggle-row" style={{ borderBottomColor: t.border }}>
                      <span className="sub-toggle-label" style={{ color: t.text }}>ENABLE SUBSCRIPTIONS</span>
                      <button className={`toggle-btn ${editSubEnabled ? 'on' : 'off'}`} onClick={() => setEditSubEnabled(!editSubEnabled)} style={editSubEnabled ? { background: t.accent } : { background: t.border }}>
                        <div className="toggle-knob" />
                      </button>
                    </div>
                    <div>
                      <div className="drawer-label">MONTHLY PRICE (USD)</div>
                      <input
                        className="drawer-input"
                        type="number"
                        placeholder="9.99"
                        min="1"
                        max="99"
                        step="0.01"
                        value={editSubPrice}
                        onChange={e => setEditSubPrice(e.target.value)}
                        style={{ color: t.text, borderBottomColor: t.border }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.6, padding: '12px', background: t.tag, border: `1px solid ${t.border}` }}>
                      You keep 80% of all subscription revenue. Payouts via CashApp once payments are live. Suggested price: $5–$15/month.
                    </div>
                    <button className="btn-primary" style={{ width: '100%' }} onClick={handleSaveSubscription} disabled={savingSub}>
                      {savingSub ? 'SAVING...' : 'SAVE SUBSCRIPTION SETTINGS'}
                    </button>
                  </>
                )}

              </div>
            </div>
          </>
        )}

        {/* ── Edit Profile Modal ────────────────────────────────────────── */}
        {showEditModal && (
          <div className="edit-modal-overlay">
            <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
              <button className="edit-modal-close" onClick={() => { setShowEditModal(false); setShowCropper(false); }}>[ESC] CLOSE</button>
              <div className="edit-modal-box">
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 11, letterSpacing: '0.5em', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>EDIT PROFILE</div>
                  <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 40, color: '#fff', lineHeight: 1 }}>UPDATE</h2>
                </div>
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <label className="edit-modal-label">FULL NAME (OPTIONAL)</label>
                    <input type="text" value={editFullName} onChange={e => setEditFullName(e.target.value)} className="edit-modal-input" placeholder="Your display name" />
                  </div>
                  <div>
                    <label className="edit-modal-label">BIO (OPTIONAL)</label>
                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4} maxLength={300} className="edit-modal-input" placeholder="Tell us about your style..." style={{ resize: 'none' }} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginTop: 4 }}>{editBio.length}/300</div>
                  </div>
                  <div>
                    <label className="edit-modal-label">AVATAR (OPTIONAL)</label>
                    <div className="method-toggle">
                      <button type="button" className={`method-btn ${uploadMethod === 'file' ? 'active' : ''}`} onClick={() => setUploadMethod('file')}>UPLOAD FILE</button>
                      <button type="button" className={`method-btn ${uploadMethod === 'url' ? 'active' : ''}`} onClick={() => setUploadMethod('url')}>IMAGE URL</button>
                    </div>
                    {uploadMethod === 'file' && (
                      <input type="file" accept="image/*" onChange={handleFileSelect} className="edit-modal-input" style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                    )}
                    {uploadMethod === 'url' && (
                      <input type="url" value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} className="edit-modal-input" placeholder="https://example.com/image.jpg" />
                    )}
                  </div>
                  {showCropper && previewUrl && (
                    <div>
                      <label className="edit-modal-label">CROP AVATAR</label>
                      <div style={{ position: 'relative', width: '100%', height: 240, background: '#111', borderRadius: 8, overflow: 'hidden' }}>
                        <Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 6 }}>ZOOM</div>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                    </div>
                  )}
                  {imageError && <div style={{ padding: 12, border: '1px solid #ef4444', color: '#ef4444', fontSize: 12 }}>{imageError}</div>}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" className="cancel-btn" onClick={() => { setShowEditModal(false); setShowCropper(false); }}>CANCEL</button>
                    <button type="submit" className="save-btn" disabled={saving}>{saving ? 'SAVING...' : 'SAVE CHANGES'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Followers / Following Modal ───────────────────────────────── */}
        {showFollowersModal && (
          <div className="modal-overlay" onClick={() => setShowFollowersModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', gap: 16 }}>
                  <button className={`tab-btn ${followersModalType === 'followers' ? 'active' : ''}`} style={{ padding: '0 0 8px', marginRight: 16 }} onClick={() => setFollowersModalType('followers')}>FOLLOWERS ({followers.length})</button>
                  <button className={`tab-btn ${followersModalType === 'following' ? 'active' : ''}`} style={{ padding: '0 0 8px' }} onClick={() => setFollowersModalType('following')}>FOLLOWING ({following.length})</button>
                </div>
                <button onClick={() => setShowFollowersModal(false)} style={{ background: 'none', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <input className="modal-search" placeholder="Search..." value={followersSearchQuery} onChange={e => setFollowersSearchQuery(e.target.value)} style={{ color: t.text, borderBottomColor: t.border }} />
              <div className="modal-list">
                {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).map(user => (
                  <div key={user.id} className="modal-user-row" onClick={() => { setShowFollowersModal(false); router.push(`/@${user.username}`); }}>
                    <div className="modal-avatar">
                      {user.avatar_url ? <img src={user.avatar_url} alt={user.username} /> : user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="modal-user-name">@{user.username}</div>
                      {user.full_name && <div className="modal-user-sub">{user.full_name}</div>}
                    </div>
                    {isOwner && (
                      <button className="modal-remove-btn" onClick={(e) => { e.stopPropagation(); followersModalType === 'followers' ? removeFollower(user.id) : unfollow(user.id); }}>
                        {followersModalType === 'followers' ? 'REMOVE' : 'UNFOLLOW'}
                      </button>
                    )}
                  </div>
                ))}
                {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).length === 0 && (
                  <div style={{ padding: '40px 24px', textAlign: 'center', color: t.muted, fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: 2 }}>
                    {followersSearchQuery ? 'NO RESULTS' : followersModalType === 'followers' ? 'NO FOLLOWERS YET' : 'NOT FOLLOWING ANYONE'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Liked Item Detail Modal ───────────────────────────────────── */}
        {expandedLikedItem && (
          <div className="item-modal-overlay">
            <div className="item-modal-bg" onClick={() => setExpandedLikedItem(null)} />
            <div className="item-modal-box">
              <div className="drag-handle" onClick={() => setExpandedLikedItem(null)}>
                <div className="drag-bar" />
              </div>
              <button className="item-modal-close" onClick={() => setExpandedLikedItem(null)}>✕</button>
              <div className="item-modal-content">
                <img src={expandedLikedItem.image_url} alt={expandedLikedItem.title} className="item-modal-img" />
                <div className="item-modal-info">
                  <div className="item-modal-title">{expandedLikedItem.title}</div>
                  {expandedLikedItem.is_monetized && <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: 'Bebas Neue, sans-serif', color: '#22c55e' }}>● CREATOR EARNS COMMISSION</div>}
                  {expandedLikedItem.seller && <div className="item-modal-seller">FROM {expandedLikedItem.seller.toUpperCase()}</div>}
                  {expandedLikedItem.price && <div className="item-modal-price">${expandedLikedItem.price}</div>}
                  {expandedLikedItem.product_url && (
                    <button className="item-modal-btn" onClick={() => window.open(expandedLikedItem.product_url!, '_blank')}>
                      VIEW PRODUCT ↗
                    </button>
                  )}
                  <button className="item-modal-btn" style={{ background: 'transparent', color: t.text, border: `1px solid ${t.border}` }} onClick={() => toggleLike(expandedLikedItem.id)}>
                    ♥ LIKED ({expandedLikedItem.like_count})
                  </button>
                  {expandedLikedItem.catalog_name !== 'Feed Post' ? (
                    <button className="item-modal-btn-ghost" onClick={() => { setExpandedLikedItem(null); router.push(`/${expandedLikedItem.catalog_owner}/${expandedLikedItem.catalog_slug}`); }}>
                      IN: {expandedLikedItem.catalog_name} →
                    </button>
                  ) : (
                    <button className="item-modal-btn-ghost" onClick={() => { setExpandedLikedItem(null); router.push(`/post/${expandedLikedItem.catalog_slug}`); }}>
                      VIEW POST →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}