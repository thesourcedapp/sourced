"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Head from "next/head";

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

type FollowUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
};

// Function to upload file to Supabase Storage
async function uploadImageToStorage(file: File, userId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
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

// Function to linkify bio text
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

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const [profileId, setProfileId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [catalogs, setCatalogs] = useState<UserCatalog[]>([]);
  const [bookmarkedCatalogs, setBookmarkedCatalogs] = useState<BookmarkedCatalog[]>([]);
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalogs' | 'bookmarks' | 'liked'>('catalogs');
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

  // Followers/Following Modal
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowUser[]>([]);

  const isOwner = currentUserId === profileId;

  // Generate share metadata
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = profile ? `Sourced - ${profile.username}` : 'Sourced';
  const shareDescription = profile?.bio || `Check out @${username}'s profile on Sourced`;
  const shareImage = profile?.avatar_url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // Black 1x1 pixel

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
      loadFollowers();
      loadFollowing();
    }
  }, [profileId]);

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
          id, name, description, image_url, created_at, bookmark_count, slug, owner_id,
          profiles!catalogs_owner_id_fkey(username),
          catalog_items(count)
        `)
        .eq('owner_id', profileId)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const catalogsWithCount = data.map(catalog => {
          const owner = Array.isArray(catalog.profiles) ? catalog.profiles[0] : catalog.profiles;
          return {
            ...catalog,
            item_count: catalog.catalog_items?.[0]?.count || 0,
            bookmark_count: catalog.bookmark_count || 0,
            owner_username: owner?.username || 'unknown'
          };
        });
        setCatalogs(catalogsWithCount);
      }
    } catch (error) {
      console.error('Error loading catalogs:', error);
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

  function handleShareProfile() {
    const profileUrl = `${window.location.origin}/${username}`;
    navigator.clipboard.writeText(profileUrl);
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 2000);
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

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be smaller than 5MB');
      return;
    }

    setSelectedFile(file);
    setImageError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;

    setSaving(true);
    setImageError('');

    try {
      let finalAvatarUrl = editAvatarUrl;

      if (uploadMethod === 'file' && selectedFile) {
        console.log('🔄 Starting file upload...');
        const uploadResult = await uploadImageToStorage(selectedFile, currentUserId);

        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to upload image");
          setSaving(false);
          return;
        }

        finalAvatarUrl = uploadResult.url;
        console.log('✅ Image uploaded to:', finalAvatarUrl);

        try {
          console.log('🔍 Checking image safety...');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const moderationResponse = await fetch("/api/check-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: finalAvatarUrl }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log('📡 Moderation response status:', moderationResponse.status);

          if (moderationResponse.ok) {
            const moderationData = await moderationResponse.json();
            console.log('📦 Moderation data:', moderationData);

            if (moderationData.safe === false) {
              console.log('❌ Image flagged as unsafe');
              setImageError("Image contains inappropriate content and cannot be used");
              setSaving(false);
              return;
            }
            console.log('✅ Image is safe');
          } else {
            console.error("Moderation check failed, proceeding anyway");
          }
        } catch (moderationError) {
          console.error("Image moderation error:", moderationError);
        }
      } else if (uploadMethod === 'url' && editAvatarUrl) {
        console.log('🔍 Checking URL-based image:', editAvatarUrl);
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
          console.log('📡 Moderation response status:', moderationResponse.status);

          if (moderationResponse.ok) {
            const moderationData = await moderationResponse.json();
            console.log('📦 Moderation data:', moderationData);

            if (moderationData.safe === false) {
              console.log('❌ Image flagged as unsafe');
              setImageError("Image contains inappropriate content and cannot be used");
              setSaving(false);
              return;
            }
            console.log('✅ Image is safe');
          } else {
            console.error("Moderation check failed, proceeding anyway");
          }
        } catch (moderationError) {
          console.error("Image moderation error:", moderationError);
        }
      }

      console.log('💾 Saving profile update...');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName.trim() || null,
          bio: editBio.trim() || null,
          avatar_url: finalAvatarUrl.trim() || null
        })
        .eq('id', currentUserId);

      if (error) throw error;

      console.log('✅ Profile updated successfully');
      await loadProfile();
      setShowEditModal(false);
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
    { id: 'catalogs' as const, label: 'PUBLIC CATALOGS', count: catalogs.length },
    { id: 'bookmarks' as const, label: 'BOOKMARKED', count: bookmarkedCatalogs.length },
    { id: 'liked' as const, label: 'LIKED ITEMS', count: likedItems.length }
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

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:width" content="400" />
        <meta property="og:image:height" content="400" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={shareTitle} />
        <meta property="twitter:description" content={shareDescription} />
        <meta property="twitter:image" content={shareImage} />

        {/* Additional meta tags */}
        <meta property="og:site_name" content="Sourced" />
        <meta property="profile:username" content={profile.username} />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        /* Prevent zoom on mobile inputs - CRITICAL for iOS */
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
              {/* Profile Avatar */}
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

              {/* Profile Info */}
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
                      <>
                        <button
                          onClick={() => setShowEditModal(true)}
                          className="px-4 py-2 border border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          EDIT PROFILE
                        </button>
                        <button
                          onClick={() => router.push('/catalogs')}
                          className="px-4 py-2 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-xs tracking-[0.4em] font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          EDIT CATALOGS
                        </button>
                      </>
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

                {/* Bio */}
                {profile.bio && (
                  <div className="max-w-2xl">
                    <p className="text-sm leading-relaxed opacity-80">
                      {linkifyBio(profile.bio)}
                    </p>
                  </div>
                )}

                {/* Stats - Reordered to prioritize followers/following */}
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
                    {catalogs.length} PUBLIC CATALOGS
                  </span>
                  <span className="opacity-60 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {catalogs.reduce((total, catalog) => total + catalog.item_count, 0)} TOTAL ITEMS
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
            {/* Public Catalogs Tab */}
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
                        className="group cursor-pointer border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200"
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
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bookmarked Catalogs Tab */}
            {activeTab === 'bookmarks' && (
              <div className="space-y-6">
                {bookmarkedCatalogs.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NO BOOKMARKS YET
                    </p>
                    <p className="text-sm tracking-wide opacity-30 mt-2">
                      {isOwner ? "You haven't bookmarked any catalogs yet" : "This user hasn't bookmarked any public catalogs"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bookmarkedCatalogs.map((catalog) => (
                      <div
                        key={catalog.id}
                        className="group border border-black/20 hover:border-black transition-all"
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => router.push(`/${catalog.username}/${catalog.slug}`)}
                        >
                          <div className="aspect-square bg-white overflow-hidden">
                            {catalog.image_url ? (
                              <img
                                src={catalog.image_url}
                                alt={catalog.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
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
                            <p className="text-xs tracking-wider opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              BY @{catalog.username}
                            </p>
                            <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                              <span>🔖 {catalog.bookmark_count} bookmarks</span>
                              <span>{catalog.item_count} items</span>
                            </div>
                          </div>
                        </div>

                        {currentUserId && (
                          <div className="p-3 border-t border-black/10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(catalog.id);
                              }}
                              className="w-full py-2 border border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              🔖 UNBOOKMARK
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Liked Items Tab */}
            {activeTab === 'liked' && (
              <div className="space-y-6">
                {likedItems.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      NO LIKED ITEMS YET
                    </p>
                    <p className="text-sm tracking-wide opacity-30 mt-2">
                      {isOwner ? "You haven't liked any items yet" : "This user hasn't liked any public items"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {likedItems.map((item) => (
                      <div
                        key={item.id}
                        className="group border border-black/20 hover:border-black transition-all"
                      >
                        <div
                          className="relative aspect-square bg-white overflow-hidden cursor-pointer hidden md:block"
                          onClick={() => setExpandedItem(item)}
                        >
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover transition-all duration-500"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />

                          {item.like_count > 0 && (
                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
                              ♥ {item.like_count}
                            </div>
                          )}
                        </div>

                        <div className="relative aspect-square bg-white overflow-hidden md:hidden">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />

                          {item.like_count > 0 && (
                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
                              ♥ {item.like_count}
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-white border-t border-black/20">
                          <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {item.title}
                          </h3>

                          <p className="text-[9px] tracking-wider opacity-40 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            FROM @{item.catalog_owner} / {item.catalog_name}
                          </p>

                          <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-2">
                            {item.seller && <span className="truncate">{item.seller}</span>}
                            {item.price && <span className="ml-auto">${item.price}</span>}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setExpandedItem(item)}
                              className="flex-1 py-1.5 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-xs font-black"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              ⊕ VIEW
                            </button>
                            {currentUserId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(item.id);
                                }}
                                className="px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-all text-xs font-black"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                              >
                                ♥
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md md:max-w-2xl relative max-h-[85vh] md:max-h-[80vh]">
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute -top-10 md:-top-16 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="border-2 border-white p-6 md:p-12 bg-black relative text-white overflow-y-auto max-h-[85vh] md:max-h-[80vh]">
                <div className="space-y-6 md:space-y-8">
                  <div className="space-y-2">
                    <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      EDIT PROFILE
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      UPDATE
                    </h2>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-4 md:space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        FULL NAME (OPTIONAL)
                      </label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full px-0 py-2 md:py-3 bg-transparent border-b-2 border-white focus:outline-none transition-all text-white placeholder-white/40"
                        style={{ fontSize: '16px' }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        BIO (OPTIONAL)
                      </label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        rows={4}
                        maxLength={300}
                        className="w-full px-0 py-2 md:py-3 bg-transparent border-b-2 border-white focus:outline-none transition-all text-white placeholder-white/40 resize-none"
                        placeholder="Tell us about yourself..."
                        style={{ fontSize: '16px' }}
                      />
                      <p className="text-[9px] tracking-wider opacity-40">
                        {editBio.length}/300 characters
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        AVATAR (OPTIONAL)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setUploadMethod('file')}
                          className={`px-3 md:px-4 py-1.5 md:py-2 text-xs tracking-wider font-black transition-all ${
                            uploadMethod === 'file'
                              ? 'bg-white text-black'
                              : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          UPLOAD FILE
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMethod('url')}
                          className={`px-3 md:px-4 py-1.5 md:py-2 text-xs tracking-wider font-black transition-all ${
                            uploadMethod === 'url'
                              ? 'bg-white text-black'
                              : 'border border-white text-white hover:bg-white/10'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          IMAGE URL
                        </button>
                      </div>
                    </div>

                    {uploadMethod === 'file' && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="w-full px-0 py-2 md:py-3 bg-transparent border-b-2 border-white focus:outline-none text-white file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:tracking-wider file:font-black"
                          style={{ fontSize: '16px' }}
                        />
                        <p className="text-[9px] tracking-wider opacity-40">
                          JPG, PNG, or GIF. Max size 5MB.
                        </p>
                      </div>
                    )}

                    {uploadMethod === 'url' && (
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={editAvatarUrl}
                          onChange={(e) => setEditAvatarUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-0 py-2 md:py-3 bg-transparent border-b-2 border-white focus:outline-none transition-all text-white placeholder-white/40"
                          style={{ fontSize: '16px' }}
                        />
                        <p className="text-[9px] tracking-wider opacity-40">
                          Paste a link to your avatar image
                        </p>
                      </div>
                    )}

                    {((uploadMethod === 'url' && editAvatarUrl) || (uploadMethod === 'file' && previewUrl)) && (
                      <div className="space-y-3">
                        <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          PREVIEW
                        </label>
                        <div className="flex items-center gap-4 p-3 md:p-4 border border-white/20">
                          <img
                            src={uploadMethod === 'url' ? editAvatarUrl : previewUrl!}
                            alt="Preview"
                            className="w-12 h-12 md:w-16 md:h-16 border-2 border-white object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="text-xs opacity-60">
                            Avatar preview
                          </div>
                        </div>
                      </div>
                    )}

                    {imageError && (
                      <div className="p-3 border border-red-400 text-red-400 text-xs tracking-wide">
                        {imageError}
                      </div>
                    )}

                    <div className="flex gap-3 md:gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        className="flex-1 py-3 md:py-4 border-2 border-white text-white hover:bg-white hover:text-black transition-all text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CANCEL
                      </button>

                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-3 md:py-4 bg-white text-black hover:bg-black hover:text-white hover:border-white border-2 border-white transition-all text-xs tracking-[0.4em] font-black disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {saving ? 'SAVING...' : 'SAVE'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Followers/Following Modal */}
        {showFollowersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-2xl relative">
              <button
                onClick={() => setShowFollowersModal(false)}
                className="absolute -top-16 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="border-2 border-white p-6 bg-black relative text-white max-h-[80vh] overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      {followersModalType === 'followers' ? 'FOLLOWERS' : 'FOLLOWING'}
                    </h2>
                    <p className="text-sm opacity-60">
                      {followersModalType === 'followers' ? followers.length : following.length} total
                    </p>
                  </div>

                  <input
                    type="text"
                    value={followersSearchQuery}
                    onChange={(e) => setFollowersSearchQuery(e.target.value)}
                    placeholder="SEARCH USERNAMES..."
                    className="w-full px-4 py-3 bg-white text-black placeholder-black/50 focus:outline-none border-2 border-white tracking-wider"
                    style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px' }}
                  />

                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border border-white/20 hover:border-white/40 transition-all">
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => {
                            router.push(`/${user.username}`);
                            setShowFollowersModal(false);
                          }}
                        >
                          <div className="w-12 h-12 border border-white overflow-hidden flex-shrink-0">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                <span className="text-sm opacity-20">👤</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              @{user.username}
                            </h3>
                            {user.full_name && (
                              <p className="text-xs opacity-60">{user.full_name}</p>
                            )}
                            <p className="text-[10px] opacity-40 mt-1">
                              {user.followers_count} followers • {user.following_count} following
                            </p>
                          </div>
                        </div>

                        {isOwner && (
                          <button
                            onClick={() => {
                              if (followersModalType === 'followers') {
                                removeFollower(user.id);
                              } else {
                                unfollow(user.id);
                              }
                            }}
                            className="px-3 py-1 border border-red-400 text-red-400 hover:bg-red-400 hover:text-black transition-all text-xs tracking-wider"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                          >
                            {followersModalType === 'followers' ? 'REMOVE' : 'UNFOLLOW'}
                          </button>
                        )}
                      </div>
                    ))}

                    {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-sm opacity-40">
                          {followersSearchQuery ? 'No users found matching your search' :
                           followersModalType === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Item Modal */}
        {expandedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setExpandedItem(null)}
          >
            <div className="relative max-w-lg md:max-w-4xl max-h-[85vh] md:max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setExpandedItem(null)}
                className="absolute -top-10 md:-top-12 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="bg-white border-2 border-white overflow-hidden max-h-[85vh] md:max-h-[90vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  <div
                    className="aspect-square bg-black/5 overflow-hidden cursor-pointer"
                    onClick={() => {
                      if (expandedItem.product_url) {
                        window.open(expandedItem.product_url, '_blank');
                      }
                    }}
                  >
                    <img
                      src={expandedItem.image_url}
                      alt={expandedItem.title}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="p-6 md:p-8 space-y-4 md:space-y-6">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      {expandedItem.title}
                    </h2>

                    <p className="text-xs md:text-sm tracking-wider opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      FROM @{expandedItem.catalog_owner} / {expandedItem.catalog_name}
                    </p>

                    {expandedItem.seller && (
                      <p className="text-xs md:text-sm tracking-wider opacity-60">
                        SELLER: {expandedItem.seller}
                      </p>
                    )}

                    {expandedItem.price && (
                      <p className="text-xl md:text-2xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        ${expandedItem.price}
                      </p>
                    )}

                    <div className="space-y-3">
                      <p className="text-xs opacity-60">
                        ♥ {expandedItem.like_count} {expandedItem.like_count === 1 ? 'LIKE' : 'LIKES'}
                      </p>

                      {expandedItem.product_url && (
                        <button
                          onClick={() => window.open(expandedItem.product_url!, '_blank')}
                          className="w-full py-2.5 md:py-3 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-xs tracking-[0.4em] font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          VIEW PRODUCT ↗
                        </button>
                      )}

                      <button
                        onClick={() => router.push(`/${expandedItem.catalog_owner}/${expandedItem.catalog_slug}`)}
                        className="w-full py-2.5 md:py-3 border-2 border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        VIEW CATALOG
                      </button>
                    </div>
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