"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";

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
};

type BookmarkedCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  username: string;
  full_name: string | null;
  item_count: number;
  bookmark_count: number;
  created_at: string;
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

// Function to check image safety via API
async function checkImageSafety(imageUrl: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const response = await fetch('/api/check-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking image safety:', error);
    return { safe: false, error: "Failed to verify image safety" };
  }
}

// Function to check username/text safety via API
async function checkTextSafety(text: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const response = await fetch('/api/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: text }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking text safety:', error);
    return { safe: false, error: "Failed to verify text safety" };
  }
}

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
  const profileId = params.id as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [catalogs, setCatalogs] = useState<UserCatalog[]>([]);
  const [bookmarkedCatalogs, setBookmarkedCatalogs] = useState<BookmarkedCatalog[]>([]);
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalogs' | 'bookmarks' | 'liked' | 'followers' | 'following'>('catalogs');

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [bioError, setBioError] = useState('');
  const [checkingImage, setCheckingImage] = useState(false);
  const [imageValid, setImageValid] = useState<boolean | null>(null);
  const [imageError, setImageError] = useState('');

  // Followers/Following Modal
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowUser[]>([]);

  const isOwner = currentUserId === profileId;

  useEffect(() => {
    async function initProfile() {
      await loadCurrentUser();
      if (profileId) {
        await loadProfile();
        await loadUserCatalogs();
        await loadBookmarkedCatalogs();
        await loadLikedItems();
        await loadFollowers();
        await loadFollowing();
      }
    }
    initProfile();
  }, [profileId]);

  // Reload profile when currentUserId changes
  useEffect(() => {
    if (currentUserId && profileId) {
      loadProfile();
    }
  }, [currentUserId]);

  useEffect(() => {
    // Filter followers based on search
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
    // Filter following based on search
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
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, followers_count, following_count')
        .eq('id', profileId)
        .single();

      if (!error && data) {
        let profileWithFollowing = { ...data, is_following: false };

        // Check if current user is following this profile
        if (currentUserId && currentUserId !== profileId) {
          const { data: followData } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', currentUserId)
            .eq('following_id', profileId)
            .single();

          profileWithFollowing.is_following = !!followData;
        }

        setProfile(profileWithFollowing);

        // Pre-fill edit form if this is the owner
        setEditFullName(data.full_name || '');
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.avatar_url || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  async function loadUserCatalogs() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('catalogs')
        .select(`
          id, name, description, image_url, created_at, bookmark_count,
          catalog_items(count)
        `)
        .eq('owner_id', profileId)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const catalogsWithCount = data.map(catalog => ({
          ...catalog,
          item_count: catalog.catalog_items?.[0]?.count || 0,
          bookmark_count: catalog.bookmark_count || 0
        }));
        setCatalogs(catalogsWithCount);
      }
    } catch (error) {
      console.error('Error loading catalogs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBookmarkedCatalogs() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('bookmarked_catalogs')
        .select(`
          catalogs!inner(
            id, name, description, image_url, bookmark_count,
            profiles!inner(username, full_name),
            catalog_items(count)
          ),
          created_at
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const transformedCatalogs: BookmarkedCatalog[] = data.map(bookmark => ({
          id: bookmark.catalogs.id,
          name: bookmark.catalogs.name,
          description: bookmark.catalogs.description,
          image_url: bookmark.catalogs.image_url,
          username: bookmark.catalogs.profiles.username,
          full_name: bookmark.catalogs.profiles.full_name,
          item_count: bookmark.catalogs.catalog_items?.[0]?.count || 0,
          bookmark_count: bookmark.catalogs.bookmark_count || 0,
          created_at: bookmark.created_at
        }));
        setBookmarkedCatalogs(transformedCatalogs);
      }
    } catch (error) {
      console.error('Error loading bookmarked catalogs:', error);
    }
  }

  async function loadLikedItems() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('liked_items')
        .select(`
          catalog_items!inner(
            id, title, image_url, product_url, price, seller, catalog_id, like_count,
            catalogs!inner(name, profiles!inner(username))
          ),
          created_at
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const transformedItems: LikedItem[] = data.map(like => ({
          id: like.catalog_items.id,
          title: like.catalog_items.title,
          image_url: like.catalog_items.image_url,
          product_url: like.catalog_items.product_url,
          price: like.catalog_items.price,
          seller: like.catalog_items.seller,
          catalog_id: like.catalog_items.catalog_id,
          catalog_name: like.catalog_items.catalogs.name,
          catalog_owner: like.catalog_items.catalogs.profiles.username,
          like_count: like.catalog_items.like_count || 0,
          created_at: like.created_at
        }));
        setLikedItems(transformedItems);
      }
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
          created_at,
          profiles!followers_follower_id_fkey(id, username, full_name, avatar_url, followers_count, following_count)
        `)
        .eq('following_id', profileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const transformedFollowers: FollowUser[] = data.map(follow => ({
          id: follow.profiles.id,
          username: follow.profiles.username,
          full_name: follow.profiles.full_name,
          avatar_url: follow.profiles.avatar_url,
          followers_count: follow.profiles.followers_count || 0,
          following_count: follow.profiles.following_count || 0,
          created_at: follow.created_at
        }));
        setFollowers(transformedFollowers);
      }
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
          created_at,
          profiles!followers_following_id_fkey(id, username, full_name, avatar_url, followers_count, following_count)
        `)
        .eq('follower_id', profileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const transformedFollowing: FollowUser[] = data.map(follow => ({
          id: follow.profiles.id,
          username: follow.profiles.username,
          full_name: follow.profiles.full_name,
          avatar_url: follow.profiles.avatar_url,
          followers_count: follow.profiles.followers_count || 0,
          following_count: follow.profiles.following_count || 0,
          created_at: follow.created_at
        }));
        setFollowing(transformedFollowing);
      }
    } catch (error) {
      console.error('Error loading following:', error);
    }
  }

  async function toggleFollow() {
    if (!currentUserId || !profile) return;

    try {
      if (profile.is_following) {
        // Unfollow
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId);
      } else {
        // Follow
        await supabase
          .from('followers')
          .insert({
            follower_id: currentUserId,
            following_id: profileId
          });
      }

      // Reload profile data to get accurate counts from database
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

      // Reload data to get accurate counts from database
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

      // Reload data to get accurate counts from database
      await loadProfile();
      await loadFollowing();
    } catch (error) {
      console.error('Error unfollowing user:', error);
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
    setImageValid(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleImageUrlChange(url: string) {
    setEditAvatarUrl(url);
    setImageValid(null);
    setImageError('');
    setPreviewUrl(null);
    setSelectedFile(null);

    if (!url.trim()) return;

    try {
      new URL(url);
    } catch {
      setImageValid(false);
      setImageError("Invalid URL format");
      return;
    }

    setCheckingImage(true);

    setTimeout(async () => {
      const safetyCheck = await checkImageSafety(url);
      setCheckingImage(false);

      if (!safetyCheck.safe) {
        setImageValid(false);
        setImageError(safetyCheck.error || "Image contains inappropriate content");
      } else {
        setImageValid(true);
      }
    }, 500);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;

    setSaving(true);
    setNameError('');
    setBioError('');
    setImageError('');

    try {
      // Validate full name
      if (editFullName.trim()) {
        const nameCheck = await checkTextSafety(editFullName);
        if (!nameCheck.safe) {
          setNameError('Name contains inappropriate content');
          setSaving(false);
          return;
        }
      }

      // Validate bio
      if (editBio.trim()) {
        const bioCheck = await checkTextSafety(editBio);
        if (!bioCheck.safe) {
          setBioError('Bio contains inappropriate content');
          setSaving(false);
          return;
        }
      }

      let finalAvatarUrl = editAvatarUrl;

      // Handle file upload
      if (uploadMethod === 'file' && selectedFile) {
        const uploadResult = await uploadImageToStorage(selectedFile, currentUserId);

        if (!uploadResult.url) {
          setImageError(uploadResult.error || "Failed to upload image");
          setSaving(false);
          return;
        }

        finalAvatarUrl = uploadResult.url;

        // Check uploaded image safety
        const safetyCheck = await checkImageSafety(finalAvatarUrl);
        if (!safetyCheck.safe) {
          setImageError(safetyCheck.error || "Image contains inappropriate content");
          setSaving(false);
          return;
        }
      } else if (uploadMethod === 'url' && editAvatarUrl.trim()) {
        // Final safety check for URL method
        const safetyCheck = await checkImageSafety(editAvatarUrl);
        if (!safetyCheck.safe) {
          setImageError(safetyCheck.error || "Image contains inappropriate content");
          setSaving(false);
          return;
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName.trim() || null,
          bio: editBio.trim() || null,
          avatar_url: finalAvatarUrl.trim() || null
        })
        .eq('id', currentUserId);

      if (error) throw error;

      // Refresh profile data
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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
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
              <div className="w-32 h-32 border-2 border-black overflow-hidden flex-shrink-0">
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
                          onClick={() => router.push('/catalogs/your_catalogs')}
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

                <div className="flex items-center gap-6 text-sm tracking-wider opacity-60">
                  <span style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {catalogs.length} PUBLIC CATALOGS
                  </span>
                  <span style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {catalogs.reduce((total, catalog) => total + catalog.item_count, 0)} TOTAL ITEMS
                  </span>
                  <button
                    onClick={() => openFollowersModal('followers')}
                    className="hover:opacity-100 transition-opacity"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {profile.followers_count} FOLLOWERS
                  </button>
                  <button
                    onClick={() => openFollowersModal('following')}
                    className="hover:opacity-100 transition-opacity"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {profile.following_count} FOLLOWING
                  </button>
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
                        onClick={() => router.push(`/catalogs/${catalog.id}`)}
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
                        className="group cursor-pointer border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200"
                        onClick={() => router.push(`/catalogs/${catalog.id}`)}
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
                          <p className="text-xs tracking-wider opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            BY @{catalog.username}
                          </p>
                          <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                            <span>🔖 {catalog.bookmark_count} bookmarks</span>
                            <span>{catalog.item_count} items</span>
                          </div>
                        </div>
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
                        className="group cursor-pointer border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200"
                        onClick={() => router.push(`/catalogs/${item.catalog_id}`)}
                      >
                        <div className="relative aspect-square bg-white overflow-hidden">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover transition-all duration-500"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />

                          {/* Product link overlay */}
                          {item.product_url && (
                            <button
                              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white border border-black transition-all opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.product_url!, '_blank');
                              }}
                            >
                              <span className="text-black text-xs">↗</span>
                            </button>
                          )}

                          {/* Like count badge */}
                          {item.like_count > 0 && (
                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
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

                          <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60">
                            {item.seller && <span className="truncate">{item.seller}</span>}
                            {item.price && <span className="ml-auto">{item.price}</span>}
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
            <div className="w-full max-w-2xl relative">
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute -top-16 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="border-2 border-white p-8 md:p-12 bg-black relative text-white max-h-[80vh] overflow-y-auto">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      EDIT PROFILE
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      UPDATE
                    </h2>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {/* Full Name */}
                    <div className="space-y-2">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        FULL NAME (OPTIONAL)
                      </label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className={`w-full px-0 py-3 bg-transparent border-b-2 focus:outline-none transition-all text-white placeholder-white/40 ${
                          nameError ? 'border-red-400' : 'border-white focus:border-white'
                        }`}
                      />
                      {nameError && (
                        <p className="text-red-400 text-xs tracking-wide">{nameError}</p>
                      )}
                    </div>

                    {/* Bio */}
                    <div className="space-y-2">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        BIO (OPTIONAL)
                      </label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        rows={4}
                        maxLength={300}
                        className={`w-full px-0 py-3 bg-transparent border-b-2 focus:outline-none transition-all text-white placeholder-white/40 resize-none ${
                          bioError ? 'border-red-400' : 'border-white focus:border-white'
                        }`}
                        placeholder="Tell us about yourself... (Links will be automatically highlighted)"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] tracking-wider opacity-40">
                          {editBio.length}/300 characters
                        </p>
                      </div>
                      {bioError && (
                        <p className="text-red-400 text-xs tracking-wide">{bioError}</p>
                      )}
                    </div>

                    {/* Upload Method Selection */}
                    <div className="space-y-3">
                      <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        AVATAR (OPTIONAL)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setUploadMethod('file')}
                          className={`px-4 py-2 text-xs tracking-wider font-black transition-all ${
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
                          className={`px-4 py-2 text-xs tracking-wider font-black transition-all ${
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

                    {/* File Upload */}
                    {uploadMethod === 'file' && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="w-full px-0 py-3 bg-transparent border-b-2 border-white focus:outline-none text-white file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-white file:text-black file:text-xs file:tracking-wider file:font-black"
                        />
                        <p className="text-[9px] tracking-wider opacity-40">
                          JPG, PNG, or GIF. Max size 5MB.
                        </p>
                      </div>
                    )}

                    {/* URL Input */}
                    {uploadMethod === 'url' && (
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={editAvatarUrl}
                          onChange={(e) => handleImageUrlChange(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className={`w-full px-0 py-3 bg-transparent border-b-2 focus:outline-none transition-all text-white placeholder-white/40 ${
                            editAvatarUrl && imageValid === false
                              ? 'border-red-400'
                              : editAvatarUrl && imageValid === true
                              ? 'border-green-400'
                              : 'border-white focus:border-white'
                          }`}
                        />

                        <div className="flex items-center justify-between">
                          <p className="text-[9px] tracking-wider opacity-40">
                            Paste a link to your avatar image
                          </p>
                          {checkingImage && (
                            <span className="text-xs tracking-wider opacity-40">verifying...</span>
                          )}
                        </div>

                        {editAvatarUrl && !checkingImage && imageValid === false && (
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 text-xs">✗</span>
                            <p className="text-red-400 text-xs tracking-wide">{imageError}</p>
                          </div>
                        )}

                        {editAvatarUrl && !checkingImage && imageValid === true && (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 text-xs">✓</span>
                            <p className="text-green-400 text-xs tracking-wide">Image verified</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview */}
                    {((uploadMethod === 'url' && editAvatarUrl && imageValid === true) ||
                      (uploadMethod === 'file' && previewUrl)) && (
                      <div className="space-y-3">
                        <label className="block text-sm tracking-wider font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          PREVIEW
                        </label>
                        <div className="flex items-center gap-4 p-4 border border-white/20">
                          <img
                            src={uploadMethod === 'url' ? editAvatarUrl : previewUrl!}
                            alt="Preview"
                            className="w-16 h-16 border-2 border-white object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="text-xs opacity-60">
                            This is how your avatar will appear
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {imageError && (
                      <div className="p-3 border border-red-400 text-red-400 text-xs tracking-wide">
                        {imageError}
                      </div>
                    )}

                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        className="flex-1 py-4 border-2 border-white text-white hover:bg-white hover:text-black transition-all text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        CANCEL
                      </button>

                      <button
                        type="submit"
                        disabled={saving || !!nameError || !!bioError}
                        className="flex-1 py-4 bg-white text-black hover:bg-black hover:text-white hover:border-white border-2 border-white transition-all text-xs tracking-[0.4em] font-black disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        {saving ? 'SAVING...' : 'SAVE CHANGES'}
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

                  {/* Search Input */}
                  <input
                    type="text"
                    value={followersSearchQuery}
                    onChange={(e) => setFollowersSearchQuery(e.target.value)}
                    placeholder="SEARCH USERNAMES..."
                    className="w-full px-4 py-3 bg-white text-black placeholder-black/50 focus:outline-none border-2 border-white text-sm tracking-wider"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  />

                  {/* User List */}
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border border-white/20 hover:border-white/40 transition-all">
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => {
                            router.push(`/profiles/${user.id}`);
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

                        {/* Remove/Unfollow button for owner */}
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
      </div>
    </>
  );
}