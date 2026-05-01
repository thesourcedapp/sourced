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
  bio: string | null;
  banner_url: string | null;
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

// Individual product item from catalog_items table
type CatalogItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  brand: string | null;
  catalog_id: string;
  catalog_name: string;
  catalog_slug: string;
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

type FollowUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
};

async function uploadImageToStorage(file: File, userId: string, bucket = 'avatars'): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${bucket}-${userId}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (error) return { url: null, error: error.message };
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return { url: publicUrl };
  } catch (e: any) { return { url: null, error: e.message }; }
}

function linkifyBio(text: string) {
  const re = /(https?:\/\/[^\s]+)/g;
  return text.split(re).map((part, i) =>
    part.match(re)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', opacity: 0.5, textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>{part}</a>
      : part
  );
}

function getCroppedImg(src: string, crop: Area): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image(); img.src = src;
    img.onload = () => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      if (!ctx) { rej(new Error('no ctx')); return; }
      c.width = crop.width; c.height = crop.height;
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      c.toBlob(b => b ? res(b) : rej(new Error('empty')), 'image/jpeg', 0.95);
    };
    img.onerror = rej;
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [catalogs, setCatalogs] = useState<UserCatalog[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubscriber] = useState(false);

  const [activeTab, setActiveTab] = useState<'items' | 'catalogs' | 'posts'>('items');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Customize drawer
  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'banner' | 'links' | 'subscription'>('banner');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editSocialUrl, setEditSocialUrl] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);
  const [editSubPrice, setEditSubPrice] = useState('');
  const [editSubEnabled, setEditSubEnabled] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  // Share / followers modal
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  const [followersSearch, setFollowersSearch] = useState('');
  const [filteredFollowers, setFilteredFollowers] = useState<FollowUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowUser[]>([]);

  const isOwner = currentUserId === profileId;

  useEffect(() => { async function init() { await loadCurrentUser(); if (username) await loadProfile(); } init(); }, [username]);
  useEffect(() => { if (profileId) { loadUserCatalogs(); loadFeedPosts(); loadFollowers(); loadFollowing(); } }, [profileId, isOwner]);
  useEffect(() => { if (currentUserId && username) loadProfile(); }, [currentUserId, username]);
  useEffect(() => {
    const q = followersSearch.toLowerCase();
    setFilteredFollowers(q ? followers.filter(u => u.username.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)) : followers);
    setFilteredFollowing(q ? following.filter(u => u.username.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)) : following);
  }, [followers, following, followersSearch]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadProfile() {
    if (!username) return;
    try {
      const { data, error } = await supabase.from('profiles')
        .select('id,username,full_name,avatar_url,bio,banner_url,social_instagram,social_tiktok,social_url,subscription_price,subscription_enabled,followers_count,following_count')
        .eq('username', username).single();
      if (!error && data) {
        setProfileId(data.id);
        setBannerUrl(data.banner_url || null);
        setEditInstagram(data.social_instagram || '');
        setEditTiktok(data.social_tiktok || '');
        setEditSocialUrl(data.social_url || '');
        setEditSubPrice(data.subscription_price ? String(data.subscription_price) : '');
        setEditSubEnabled(data.subscription_enabled || false);
        let p = { ...data, is_following: false };
        if (currentUserId && currentUserId !== data.id) {
          const { data: fd } = await supabase.from('followers').select('id').eq('follower_id', currentUserId).eq('following_id', data.id).single();
          p.is_following = !!fd;
        }
        setProfile(p);
        setEditFullName(data.full_name || '');
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.avatar_url || '');
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function loadUserCatalogs() {
    if (!profileId) return;
    const { data, error } = await supabase.from('catalogs')
      .select('id,name,description,image_url,created_at,bookmark_count,slug,owner_id,is_pinned,profiles!catalogs_owner_id_fkey(username),catalog_items(count)')
      .eq('owner_id', profileId).eq('visibility', 'public')
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (!error && data) {
      const mapped = data.map(c => {
        const o = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return { ...c, item_count: c.catalog_items?.[0]?.count || 0, bookmark_count: c.bookmark_count || 0, owner_username: o?.username || 'unknown', is_pinned: c.is_pinned || false };
      });
      setCatalogs(mapped);
      // Now load actual items from all public catalogs
      if (mapped.length > 0) {
        loadCatalogItems(mapped.map(c => c.id), mapped);
      }
    }
  }

  async function loadCatalogItems(catalogIds: string[], catalogList: UserCatalog[]) {
    const { data, error } = await supabase.from('catalog_items')
      .select('id,title,image_url,product_url,price,seller,brand,catalog_id,is_monetized')
      .in('catalog_id', catalogIds)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const catalogMap = new Map(catalogList.map(c => [c.id, c]));
      setCatalogItems(data.map(item => {
        const cat = catalogMap.get(item.catalog_id);
        return {
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          product_url: item.product_url,
          price: item.price,
          seller: item.seller,
          brand: item.brand,
          catalog_id: item.catalog_id,
          catalog_name: cat?.name || '',
          catalog_slug: cat?.slug || '',
          is_monetized: item.is_monetized || false,
        };
      }));
    }
  }

  async function loadFeedPosts() {
    if (!profileId) return;
    const { data, error } = await supabase.from('feed_posts')
      .select('id,image_url,caption,like_count,comment_count,created_at,is_pinned')
      .eq('owner_id', profileId)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (!error && data) setFeedPosts(data.map(p => ({ ...p, is_pinned: p.is_pinned || false })));
  }

  async function loadFollowers() {
    if (!profileId) return;
    const { data } = await supabase.from('followers').select('follower_id,created_at').eq('following_id', profileId).order('created_at', { ascending: false });
    if (!data?.length) { setFollowers([]); return; }
    const { data: pd } = await supabase.from('profiles').select('id,username,full_name,avatar_url,followers_count,following_count').in('id', data.map(f => f.follower_id));
    const m = new Map(pd?.map(p => [p.id, p]) || []);
    setFollowers(data.map(f => { const p = m.get(f.follower_id); if (!p) return null; return { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, followers_count: p.followers_count || 0, following_count: p.following_count || 0, created_at: f.created_at }; }).filter((f): f is FollowUser => f !== null));
  }

  async function loadFollowing() {
    if (!profileId) return;
    const { data } = await supabase.from('followers').select('following_id,created_at').eq('follower_id', profileId).order('created_at', { ascending: false });
    if (!data?.length) { setFollowing([]); return; }
    const { data: pd } = await supabase.from('profiles').select('id,username,full_name,avatar_url,followers_count,following_count').in('id', data.map(f => f.following_id));
    const m = new Map(pd?.map(p => [p.id, p]) || []);
    setFollowing(data.map(f => { const p = m.get(f.following_id); if (!p) return null; return { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, followers_count: p.followers_count || 0, following_count: p.following_count || 0, created_at: f.created_at }; }).filter((f): f is FollowUser => f !== null));
  }

  async function toggleFollow() {
    if (!currentUserId || !profile) return;
    if (profile.is_following) await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', profileId);
    else await supabase.from('followers').insert({ follower_id: currentUserId, following_id: profileId });
    await new Promise(r => setTimeout(r, 200));
    await loadProfile(); await loadFollowers(); await loadFollowing();
  }

  async function togglePinCatalog(id: string) {
    if (!isOwner) return;
    const c = catalogs.find(x => x.id === id); if (!c) return;
    await supabase.from('catalogs').update({ is_pinned: !c.is_pinned }).eq('id', id);
    await loadUserCatalogs();
  }

  async function togglePinPost(id: string) {
    if (!isOwner) return;
    const p = feedPosts.find(x => x.id === id); if (!p) return;
    await supabase.from('feed_posts').update({ is_pinned: !p.is_pinned }).eq('id', id);
    await loadFeedPosts();
  }

  async function handleShareProfile() {
    try {
      if (navigator.share) await navigator.share({ url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setShowShareCopied(true); setTimeout(() => setShowShareCopied(false), 2000); }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(window.location.href); setShowShareCopied(true); setTimeout(() => setShowShareCopied(false), 2000); } catch {}
      }
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith('image/')) { setImageError('Please select an image file'); return; }
    setSelectedFile(f); setImageError('');
    const r = new FileReader();
    r.onload = e => { setPreviewUrl(e.target?.result as string); setShowCropper(true); };
    r.readAsDataURL(f);
  }

  const onCropComplete = (_: Area, cap: Area) => setCroppedAreaPixels(cap);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault(); if (!currentUserId) return;
    setSaving(true); setImageError('');
    try {
      let url = editAvatarUrl;
      if (uploadMethod === 'file' && selectedFile && previewUrl && croppedAreaPixels) {
        const blob = await getCroppedImg(previewUrl, croppedAreaPixels);
        const f = new File([blob], selectedFile.name, { type: 'image/jpeg' });
        const r = await uploadImageToStorage(f, currentUserId, 'avatars');
        if (!r.url) { setImageError(r.error || 'Upload failed'); setSaving(false); return; }
        url = r.url;
        try {
          const ctrl = new AbortController(); const tid = setTimeout(() => ctrl.abort(), 10000);
          const res = await fetch('/api/check-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: url }), signal: ctrl.signal });
          clearTimeout(tid);
          if (res.ok) { const d = await res.json(); if (d.safe === false) { setImageError('Inappropriate content detected'); setSaving(false); return; } }
        } catch {}
      }
      const { error } = await supabase.from('profiles').update({ full_name: editFullName.trim() || null, bio: editBio.trim() || null, avatar_url: url.trim() || null }).eq('id', currentUserId);
      if (error) throw error;
      await loadProfile(); setShowEditModal(false); setShowCropper(false);
    } catch (e) { console.error(e); alert('Failed to update profile'); } finally { setSaving(false); }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !currentUserId) return;
    setBannerUploading(true);
    const r = await uploadImageToStorage(f, currentUserId, 'banners');
    if (r.url) { await supabase.from('profiles').update({ banner_url: r.url }).eq('id', currentUserId); setBannerUrl(r.url); }
    setBannerUploading(false);
  }

  async function handleSaveLinks() {
    if (!currentUserId) return; setSavingLinks(true);
    await supabase.from('profiles').update({ social_instagram: editInstagram.trim() || null, social_tiktok: editTiktok.trim() || null, social_url: editSocialUrl.trim() || null }).eq('id', currentUserId);
    await loadProfile(); setSavingLinks(false);
  }

  async function handleSaveSubscription() {
    if (!currentUserId) return; setSavingSub(true);
    await supabase.from('profiles').update({ subscription_price: editSubPrice ? parseFloat(editSubPrice) : null, subscription_enabled: editSubEnabled }).eq('id', currentUserId);
    await loadProfile(); setSavingSub(false);
  }

  async function removeFollower(fId: string) {
    if (!currentUserId || !isOwner) return;
    await supabase.from('followers').delete().eq('follower_id', fId).eq('following_id', profileId);
    const f = followers.find(x => x.id === fId);
    if (f) await supabase.from('profiles').update({ following_count: Math.max(0, f.following_count - 1) }).eq('id', fId);
    if (profile) await supabase.from('profiles').update({ followers_count: Math.max(0, profile.followers_count - 1) }).eq('id', profileId);
    await loadProfile(); await loadFollowers();
  }

  async function unfollowUser(fId: string) {
    if (!currentUserId || !isOwner) return;
    await supabase.from('followers').delete().eq('follower_id', currentUserId).eq('following_id', fId);
    const f = following.find(x => x.id === fId);
    if (f) await supabase.from('profiles').update({ followers_count: Math.max(0, f.followers_count - 1) }).eq('id', fId);
    if (profile) await supabase.from('profiles').update({ following_count: Math.max(0, profile.following_count - 1) }).eq('id', currentUserId);
    await loadProfile(); await loadFollowing();
  }

  const pinnedCatalogs = catalogs.filter(c => c.is_pinned);
  const subEnabled = profile?.subscription_enabled;
  const subPrice = profile?.subscription_price;

  const BB = "'Bebas Neue', sans-serif";
  const AB = "'Archivo Black', sans-serif";
  const AR = "'Archivo', sans-serif";

  if (loading) return (
    <>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: BB, fontSize: 13, letterSpacing: '0.4em', color: '#333' }}>LOADING...</span>
      </div>
    </>
  );

  if (!profile) return (
    <>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: AB, fontSize: 40, color: '#fff', marginBottom: 16 }}>PROFILE NOT FOUND</h1>
          <button onClick={() => router.back()} style={{ fontFamily: BB, fontSize: 12, letterSpacing: '0.4em', padding: '10px 24px', border: '2px solid #fff', background: 'transparent', color: '#fff', cursor: 'pointer' }}>GO BACK</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Scoped styles — no html/body overrides so nav is unaffected */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Archivo:wght@400;500&display=swap');
        .profile-page { background: #0c0c0c; }
        input, textarea, select { font-size: 16px !important; }
        .cc:hover .pin-toggle { opacity: 1 !important; }
        .cc:hover .cat-img img { transform: scale(1.03); }
        .pc:hover img { transform: scale(1.04); }
        .pc:hover .post-overlay { opacity: 1 !important; }
        .pc:hover .post-pin-toggle { opacity: 1 !important; }
        .pcard:hover { border-color: #3a3a3a !important; transform: translateY(-3px); }
        .soc:hover { border-color: #555 !important; color: #ccc !important; }
        .mu:hover { background: #131313 !important; }
        .ic:hover .ii-img img { transform: scale(1.04); }
        .stat-pill:hover { background: #1a1a1a !important; }
      `}</style>

      <div className="profile-page" style={{ minHeight: '100vh', color: '#fff', fontFamily: AR }}>

        {/* ── BANNER ── */}
        <div style={{ position: 'relative', height: 200, background: '#0c0c0c', overflow: 'hidden' }}>
          {bannerUrl
            ? <img src={bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg,transparent,transparent 59px,#151515 59px,#151515 60px),repeating-linear-gradient(0deg,transparent,transparent 59px,#151515 59px,#151515 60px)' }} />
                <span style={{ position: 'absolute', top: 18, left: 20, fontFamily: BB, fontSize: 11, letterSpacing: '3px', color: '#222' }}>SOURCED / CREATOR</span>
                <span style={{ position: 'absolute', top: 18, right: 20, fontFamily: BB, fontSize: 11, letterSpacing: '3px', color: '#222' }}>EST. 2024</span>
              </>
          }
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top,#0c0c0c,transparent)' }} />
          {isOwner && (
            <>
              <button onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}
                style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.75)', border: '1px solid #2a2a2a', color: '#666', padding: '6px 14px', fontFamily: BB, fontSize: 10, letterSpacing: '2px', cursor: 'pointer', backdropFilter: 'blur(6px)' }}>
                {bannerUploading ? 'UPLOADING...' : '+ BANNER'}
              </button>
              <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
            </>
          )}
        </div>

        {/* ── IDENTITY ── */}
        <div style={{ padding: '0 20px', marginTop: -52, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#1a1a1a', border: '4px solid #0c0c0c', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: BB, fontSize: 36, color: '#fff', letterSpacing: 1 }}>{profile.username.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 200, paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a' }}>AFFILIATE CREATOR</span>
            </div>
            <h1 style={{ fontFamily: BB, fontSize: 42, color: '#fff', lineHeight: 1, letterSpacing: 1 }}>@{profile.username.toUpperCase()}</h1>
            {profile.full_name && <p style={{ fontFamily: AR, fontSize: 13, color: '#555', marginTop: 4 }}>{profile.full_name}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 10, flexWrap: 'wrap' }}>
            {isOwner
              ? <>
                  <button onClick={() => setShowEditModal(true)} style={{ padding: '10px 18px', background: 'transparent', color: '#888', border: '1px solid #2a2a2a', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer' }}>EDIT</button>
                  <button onClick={() => setShowCustomizeDrawer(true)} style={{ padding: '10px 18px', background: 'transparent', color: '#888', border: '1px solid #2a2a2a', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer' }}>CUSTOMIZE</button>
                </>
              : currentUserId
                ? <button onClick={toggleFollow} style={{ padding: '10px 28px', background: profile.is_following ? 'transparent' : '#fff', color: profile.is_following ? '#fff' : '#000', border: '1px solid #fff', fontFamily: BB, fontSize: 13, letterSpacing: '2px', cursor: 'pointer', transition: 'all .15s' }}>{profile.is_following ? 'UNFOLLOW' : 'FOLLOW'}</button>
                : null
            }
            <button onClick={handleShareProfile} style={{ padding: '10px 16px', background: 'transparent', color: '#555', border: '1px solid #2a2a2a', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer' }}>{showShareCopied ? 'COPIED!' : 'SHARE'}</button>
          </div>
        </div>

        {/* ── BIO ── */}
        <div style={{ padding: '18px 20px 0', maxWidth: 580 }}>
          {profile.bio && <p style={{ fontSize: 13, color: '#777', lineHeight: 1.65 }}>{linkifyBio(profile.bio)}</p>}
          {(profile.social_instagram || profile.social_tiktok || profile.social_url) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {profile.social_instagram && <a href={`https://instagram.com/${profile.social_instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="soc" style={{ padding: '5px 14px', border: '1px solid #222', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#555', textDecoration: 'none', transition: 'all .15s' }}>INSTAGRAM</a>}
              {profile.social_tiktok && <a href={`https://tiktok.com/@${profile.social_tiktok.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="soc" style={{ padding: '5px 14px', border: '1px solid #222', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#555', textDecoration: 'none', transition: 'all .15s' }}>TIKTOK</a>}
              {profile.social_url && <a href={profile.social_url.startsWith('http') ? profile.social_url : `https://${profile.social_url}`} target="_blank" rel="noopener noreferrer" className="soc" style={{ padding: '5px 14px', border: '1px solid #222', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#555', textDecoration: 'none', transition: 'all .15s' }}>↗ LINK</a>}
            </div>
          )}
        </div>

        {/* ── STATS — pill style, no borders between ── */}
        <div style={{ padding: '20px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { num: profile.followers_count.toLocaleString(), label: 'followers', click: () => { setFollowersModalType('followers'); setShowFollowersModal(true); } },
            { num: profile.following_count.toLocaleString(), label: 'following', click: () => { setFollowersModalType('following'); setShowFollowersModal(true); } },
            { num: String(catalogs.length), label: 'catalogs', click: undefined },
            { num: String(catalogItems.length), label: 'items', click: undefined },
          ].map(s => (
            <button key={s.label} className="stat-pill" onClick={s.click}
              style={{ display: 'flex', alignItems: 'baseline', gap: 5, padding: '7px 14px', background: '#131313', border: '1px solid #1e1e1e', cursor: s.click ? 'pointer' : 'default', transition: 'background .15s' }}>
              <span style={{ fontFamily: BB, fontSize: 20, color: '#fff', lineHeight: 1 }}>{s.num}</span>
              <span style={{ fontFamily: AR, fontSize: 11, color: '#555' }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── SUBSCRIPTION CTA ── */}
        {subEnabled && subPrice && !isOwner && (
          <div style={{ margin: '20px 20px 0', padding: '16px 20px', border: '1px solid #1e1e1e', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontFamily: BB, fontSize: 15, letterSpacing: '2px', color: '#fff' }}>UNLOCK FULL ACCESS</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Exclusive catalogs, styling guides &amp; drops</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <span style={{ fontFamily: BB, fontSize: 24, color: '#fff' }}>${subPrice}<span style={{ fontFamily: AR, fontSize: 11, color: '#555' }}>/mo</span></span>
              <button style={{ padding: '10px 22px', background: '#fff', color: '#000', border: 'none', fontFamily: BB, fontSize: 12, letterSpacing: '2px', cursor: 'pointer' }}>SUBSCRIBE</button>
            </div>
          </div>
        )}
        {subEnabled && subPrice && isOwner && (
          <div style={{ margin: '20px 20px 0', padding: '12px 20px', border: '1px dashed #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.5 }}>
            <span style={{ fontFamily: BB, fontSize: 11, letterSpacing: '2px', color: '#555' }}>SUBSCRIPTION ACTIVE — ${subPrice}/MO</span>
            <span style={{ fontFamily: BB, fontSize: 9, letterSpacing: '2px', color: '#333' }}>PREVIEW</span>
          </div>
        )}

        {/* ── PINNED CATALOGS — bigger cards ── */}
        {pinnedCatalogs.length > 0 && (
          <>
            <div style={{ padding: '28px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: BB, fontSize: 18, letterSpacing: '3px', color: '#fff' }}>PINNED CATALOGS</span>
              <span onClick={() => setActiveTab('catalogs')} style={{ fontFamily: BB, fontSize: 11, letterSpacing: '2px', color: '#444', cursor: 'pointer' }}>VIEW ALL →</span>
            </div>
            <div style={{ display: 'flex', gap: 14, padding: '0 20px 28px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {pinnedCatalogs.map((c, i) => (
                <div key={c.id} className="pcard" onClick={() => router.push(`/${c.owner_username}/${c.slug}`)}
                  style={{ flexShrink: 0, width: 200, border: '1px solid #1e1e1e', background: '#0f0f0f', overflow: 'hidden', cursor: 'pointer', transition: 'all .2s', position: 'relative' }}>
                  {/* Image — taller than before */}
                  <div style={{ height: 220, background: '#111', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {c.image_url
                      ? <img src={c.image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }} />
                      : <span style={{ fontSize: 48, opacity: 0.06, color: '#fff' }}>✦</span>
                    }
                    {/* Badge */}
                    {i === 0 && (
                      <span style={{ position: 'absolute', top: 10, left: 10, background: '#fff', color: '#000', fontFamily: BB, fontSize: 9, letterSpacing: '1.5px', padding: '3px 9px' }}>HOT</span>
                    )}
                    {i === pinnedCatalogs.length - 1 && pinnedCatalogs.length > 1 && (
                      <span style={{ position: 'absolute', top: 10, left: 10, background: '#fff', color: '#000', fontFamily: BB, fontSize: 9, letterSpacing: '1.5px', padding: '3px 9px' }}>NEW</span>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px', borderTop: '1px solid #1a1a1a' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{c.item_count} items</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TABS ── */}
        <div style={{ borderBottom: '1px solid #1a1a1a', display: 'flex', padding: '0 20px' }}>
          {[
            { id: 'items' as const, label: 'ITEMS', count: catalogItems.length },
            { id: 'catalogs' as const, label: 'CATALOGS', count: catalogs.length },
            { id: 'posts' as const, label: 'POSTS', count: feedPosts.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '13px 18px', fontFamily: BB, fontSize: 11, letterSpacing: '2px', color: activeTab === tab.id ? '#fff' : '#333', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'all .15s' }}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* ── ITEMS GRID — actual catalog_items ── */}
        {activeTab === 'items' && (
          catalogItems.length === 0
            ? <div style={{ padding: '80px 20px', textAlign: 'center' }}><span style={{ fontFamily: BB, fontSize: 16, letterSpacing: '3px', color: '#2a2a2a' }}>NO ITEMS YET</span></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, background: '#1a1a1a' }}>
                {catalogItems.map(item => (
                  <div key={item.id} className="ic" style={{ background: '#0c0c0c', cursor: 'pointer', position: 'relative' }}
                    onClick={() => item.product_url ? window.open(item.product_url, '_blank') : router.push(`/${profile.username}/${item.catalog_slug}`)}>
                    <div className="ii-img" style={{ aspectRatio: '1', background: '#111', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.image_url
                        ? <img src={item.image_url} alt={item.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }} />
                        : <span style={{ fontSize: 32, opacity: 0.06, color: '#fff' }}>✦</span>
                      }
                      {/* Monetized dot */}
                      {item.is_monetized && (
                        <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
                      )}
                    </div>
                    <div style={{ padding: '9px 12px', borderTop: '1px solid #1a1a1a' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{item.seller || item.brand || item.catalog_name}</span>
                        {item.price && <span style={{ fontFamily: BB, fontSize: 13, color: '#888', flexShrink: 0 }}>${item.price}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Locked shells for non-subscribers */}
                {subEnabled && !isSubscriber && !isOwner && [1, 2, 3].map(i => (
                  <div key={`locked-${i}`} style={{ background: '#0c0c0c', opacity: 0.4 }}>
                    <div style={{ aspectRatio: '1', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" stroke="#444" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      <span style={{ fontFamily: BB, fontSize: 9, letterSpacing: '2px', color: '#333' }}>SUBSCRIBERS ONLY</span>
                    </div>
                    <div style={{ padding: '9px 12px', borderTop: '1px solid #1a1a1a' }}><div style={{ fontSize: 12, color: '#2a2a2a' }}>Private item</div></div>
                  </div>
                ))}
              </div>
        )}

        {/* ── CATALOGS GRID ── */}
        {activeTab === 'catalogs' && (
          catalogs.length === 0
            ? <div style={{ padding: '80px 20px', textAlign: 'center' }}><span style={{ fontFamily: BB, fontSize: 16, letterSpacing: '3px', color: '#2a2a2a' }}>NO CATALOGS YET</span></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, background: '#1a1a1a' }}>
                {catalogs.map(c => (
                  <div key={c.id} className="cc" style={{ background: '#0c0c0c', position: 'relative', cursor: 'pointer' }}>
                    {c.is_pinned && <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, background: '#f59e0b', color: '#000', fontFamily: BB, fontSize: 9, letterSpacing: '1px', padding: '2px 6px' }}>PINNED</span>}
                    {isOwner && <button className="pin-toggle" onClick={e => { e.stopPropagation(); togglePinCatalog(c.id); }}
                      style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, background: 'rgba(0,0,0,0.9)', color: '#777', border: '1px solid #2a2a2a', fontFamily: BB, fontSize: 9, letterSpacing: '1px', padding: '3px 8px', cursor: 'pointer', opacity: 0, transition: 'opacity .15s' }}>
                      {c.is_pinned ? 'UNPIN' : 'PIN'}
                    </button>}
                    <div className="cat-img" style={{ aspectRatio: '1', background: '#111', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => router.push(`/${c.owner_username}/${c.slug}`)}>
                      {c.image_url
                        ? <img src={c.image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }} />
                        : <span style={{ fontSize: 36, opacity: 0.06, color: '#fff' }}>✦</span>
                      }
                    </div>
                    <div onClick={() => router.push(`/${c.owner_username}/${c.slug}`)} style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{c.item_count} items</div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* ── POSTS GRID ── */}
        {activeTab === 'posts' && (
          feedPosts.length === 0
            ? <div style={{ padding: '80px 20px', textAlign: 'center' }}><span style={{ fontFamily: BB, fontSize: 16, letterSpacing: '3px', color: '#2a2a2a' }}>NO POSTS YET</span></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, background: '#1a1a1a' }}>
                {feedPosts.map(p => (
                  <div key={p.id} className="pc" style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden', cursor: 'pointer', background: '#111' }} onClick={() => router.push(`/post/${p.id}`)}>
                    <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s', display: 'block' }} />
                    {p.is_pinned && <span style={{ position: 'absolute', top: 8, left: 8, background: '#f59e0b', color: '#000', fontFamily: BB, fontSize: 9, padding: '2px 6px' }}>PINNED</span>}
                    {isOwner && <button className="post-pin-toggle" onClick={e => { e.stopPropagation(); togglePinPost(p.id); }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.9)', color: '#777', border: 'none', fontFamily: BB, fontSize: 9, letterSpacing: '1px', padding: '3px 8px', cursor: 'pointer', opacity: 0, transition: 'opacity .15s' }}>
                      {p.is_pinned ? 'UNPIN' : 'PIN'}
                    </button>}
                    <div className="post-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', opacity: 0, transition: 'opacity .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontFamily: BB, fontSize: 15 }}>
                        <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        {p.like_count}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontFamily: BB, fontSize: 15 }}>
                        <svg width="14" height="14" fill="#fff" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        {p.comment_count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* ── CUSTOMIZE DRAWER ── */}
        {showCustomizeDrawer && (
          <>
            <div onClick={() => setShowCustomizeDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, maxWidth: '100vw', background: '#0e0e0e', borderLeft: '1px solid #1a1a1a', zIndex: 101, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: BB, fontSize: 16, letterSpacing: '3px', color: '#fff' }}>CUSTOMIZE PAGE</span>
                <button onClick={() => setShowCustomizeDrawer(false)} style={{ background: 'none', border: 'none', color: '#444', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
                {(['banner', 'links', 'subscription'] as const).map(t => (
                  <button key={t} onClick={() => setDrawerTab(t)}
                    style={{ flex: 1, padding: '11px 6px', fontFamily: BB, fontSize: 10, letterSpacing: '1.5px', color: drawerTab === t ? '#fff' : '#3a3a3a', background: 'none', border: 'none', borderBottom: `2px solid ${drawerTab === t ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'all .15s' }}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {drawerTab === 'banner' && (
                  <>
                    <div>
                      <div style={{ fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 8 }}>CURRENT BANNER</div>
                      <div style={{ width: '100%', height: 100, background: '#111', border: '1px solid #1a1a1a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                        {bannerUrl ? <img src={bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: BB, fontSize: 11, letterSpacing: 2, color: '#2a2a2a' }}>NO BANNER SET</span>}
                      </div>
                      <button onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}
                        style={{ width: '100%', padding: 12, background: '#fff', color: '#000', border: 'none', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer', opacity: bannerUploading ? 0.4 : 1 }}>
                        {bannerUploading ? 'UPLOADING...' : '+ UPLOAD BANNER'}
                      </button>
                    </div>
                    {bannerUrl && <button onClick={async () => { await supabase.from('profiles').update({ banner_url: null }).eq('id', currentUserId!); setBannerUrl(null); }}
                      style={{ padding: 10, background: 'transparent', border: '1px solid #1a1a1a', color: '#3a3a3a', fontFamily: BB, fontSize: 10, letterSpacing: '2px', cursor: 'pointer' }}>REMOVE BANNER</button>}
                    <p style={{ fontSize: 11, color: '#3a3a3a', lineHeight: 1.6 }}>Recommended 1500×500px. This is the first thing people see — make it yours.</p>
                  </>
                )}
                {drawerTab === 'links' && (
                  <>
                    {[['INSTAGRAM', editInstagram, setEditInstagram, '@yourhandle'], ['TIKTOK', editTiktok, setEditTiktok, '@yourhandle'], ['PERSONAL LINK', editSocialUrl, setEditSocialUrl, 'https://yoursite.com']].map(([label, val, setter, ph]) => (
                      <div key={label as string}>
                        <div style={{ fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 6 }}>{label as string}</div>
                        <input value={val as string} onChange={e => (setter as any)(e.target.value)} placeholder={ph as string}
                          style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #1a1a1a', color: '#fff', padding: '8px 0', fontSize: 13, outline: 'none' }} />
                      </div>
                    ))}
                    <button onClick={handleSaveLinks} disabled={savingLinks}
                      style={{ width: '100%', padding: 12, background: '#fff', color: '#000', border: 'none', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer', opacity: savingLinks ? 0.4 : 1 }}>
                      {savingLinks ? 'SAVING...' : 'SAVE LINKS'}
                    </button>
                  </>
                )}
                {drawerTab === 'subscription' && (
                  <>
                    <div style={{ fontSize: 11, color: '#444', background: '#111', border: '1px solid #1a1a1a', padding: 12, lineHeight: 1.6 }}>
                      ⚡ Payments coming soon. Set your price now — goes live once Stripe is connected.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1a1a1a' }}>
                      <span style={{ fontFamily: BB, fontSize: 13, letterSpacing: '1px', color: '#fff' }}>ENABLE SUBSCRIPTIONS</span>
                      <button onClick={() => setEditSubEnabled(!editSubEnabled)}
                        style={{ width: 42, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', background: editSubEnabled ? '#fff' : '#222', transition: 'background .2s' }}>
                        <div style={{ position: 'absolute', top: 3, left: editSubEnabled ? 23 : 3, width: 16, height: 16, borderRadius: '50%', background: editSubEnabled ? '#000' : '#666', transition: 'left .2s' }} />
                      </button>
                    </div>
                    <div>
                      <div style={{ fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 6 }}>MONTHLY PRICE (USD)</div>
                      <input type="number" value={editSubPrice} onChange={e => setEditSubPrice(e.target.value)} placeholder="9.99" min="1" max="99" step="0.01"
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #1a1a1a', color: '#fff', padding: '8px 0', fontSize: 13, outline: 'none' }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#3a3a3a', lineHeight: 1.6 }}>You keep 80% of all subscription revenue. Suggested: $5–$15/month.</p>
                    <button onClick={handleSaveSubscription} disabled={savingSub}
                      style={{ width: '100%', padding: 12, background: '#fff', color: '#000', border: 'none', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer', opacity: savingSub ? 0.4 : 1 }}>
                      {savingSub ? 'SAVING...' : 'SAVE'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── EDIT PROFILE MODAL ── */}
        {showEditModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(12px)' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
              <button onClick={() => { setShowEditModal(false); setShowCropper(false); }}
                style={{ position: 'absolute', top: -36, right: 0, background: 'none', border: 'none', color: '#333', fontFamily: BB, fontSize: 11, letterSpacing: '3px', cursor: 'pointer' }}>[ESC] CLOSE</button>
              <div style={{ background: '#000', border: '2px solid #fff', padding: 36, maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ fontFamily: BB, fontSize: 10, letterSpacing: '5px', color: '#222', marginBottom: 4 }}>SOURCED / PROFILE</div>
                <h2 style={{ fontFamily: AB, fontSize: 36, color: '#fff', lineHeight: 1, marginBottom: 28 }}>EDIT PROFILE</h2>
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 6 }}>FULL NAME</label>
                    <input type="text" value={editFullName} onChange={e => setEditFullName(e.target.value)} placeholder="Your display name"
                      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #222', color: '#fff', padding: '8px 0', fontSize: 14, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 6 }}>BIO</label>
                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4} maxLength={300} placeholder="Tell us about your style..."
                      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #222', color: '#fff', padding: '8px 0', fontSize: 14, outline: 'none', resize: 'none' }} />
                    <div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>{editBio.length}/300</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 8 }}>AVATAR</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {(['file', 'url'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setUploadMethod(m)}
                          style={{ padding: '5px 14px', fontFamily: BB, fontSize: 10, letterSpacing: '1.5px', cursor: 'pointer', border: '1px solid', borderColor: uploadMethod === m ? '#fff' : '#2a2a2a', background: uploadMethod === m ? '#fff' : 'transparent', color: uploadMethod === m ? '#000' : '#444', transition: 'all .15s' }}>
                          {m === 'file' ? 'UPLOAD FILE' : 'IMAGE URL'}
                        </button>
                      ))}
                    </div>
                    {uploadMethod === 'file'
                      ? <input type="file" accept="image/*" onChange={handleFileSelect} style={{ width: '100%', borderBottom: '1px solid #1a1a1a', color: '#fff', padding: '8px 0', fontSize: 13 }} />
                      : <input type="url" value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg"
                          style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #222', color: '#fff', padding: '8px 0', fontSize: 14, outline: 'none' }} />
                    }
                  </div>
                  {showCropper && previewUrl && (
                    <div>
                      <label style={{ display: 'block', fontFamily: BB, fontSize: 10, letterSpacing: '2px', color: '#3a3a3a', marginBottom: 8 }}>CROP AVATAR</label>
                      <div style={{ position: 'relative', width: '100%', height: 220, background: '#111', overflow: 'hidden' }}>
                        <Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                      </div>
                      <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%', marginTop: 10 }} />
                    </div>
                  )}
                  {imageError && <div style={{ padding: 10, border: '1px solid #ef4444', color: '#ef4444', fontSize: 12 }}>{imageError}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => { setShowEditModal(false); setShowCropper(false); }}
                      style={{ flex: 1, padding: 14, background: 'transparent', color: '#fff', border: '2px solid #222', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer' }}>CANCEL</button>
                    <button type="submit" disabled={saving}
                      style={{ flex: 1, padding: 14, background: '#fff', color: '#000', border: '2px solid #fff', fontFamily: BB, fontSize: 11, letterSpacing: '2px', cursor: 'pointer', opacity: saving ? 0.4 : 1 }}>
                      {saving ? 'SAVING...' : 'SAVE'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── FOLLOWERS MODAL ── */}
        {showFollowersModal && (
          <div onClick={() => setShowFollowersModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#0e0e0e', border: '1px solid #1a1a1a', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 20 }}>
                  {(['followers', 'following'] as const).map(t => (
                    <button key={t} onClick={() => setFollowersModalType(t)}
                      style={{ fontFamily: BB, fontSize: 14, letterSpacing: '1px', color: followersModalType === t ? '#fff' : '#3a3a3a', background: 'none', border: 'none', borderBottom: `2px solid ${followersModalType === t ? '#fff' : 'transparent'}`, padding: '0 0 4px', cursor: 'pointer' }}>
                      {t === 'followers' ? `FOLLOWERS (${followers.length})` : `FOLLOWING (${following.length})`}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowFollowersModal(false)} style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <input placeholder="SEARCH..." value={followersSearch} onChange={e => setFollowersSearch(e.target.value)}
                style={{ margin: '10px 20px', padding: '8px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #1a1a1a', color: '#fff', fontSize: 13, outline: 'none', width: 'calc(100% - 40px)' }} />
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).map(user => (
                  <div key={user.id} className="mu" onClick={() => { setShowFollowersModal(false); router.push(`/@${user.username}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #111', cursor: 'pointer', transition: 'background .1s' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a1a', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BB, color: '#3a3a3a', fontSize: 14 }}>
                      {user.avatar_url ? <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: BB, fontSize: 14, letterSpacing: 1, color: '#fff' }}>@{user.username}</div>
                      {user.full_name && <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 1 }}>{user.full_name}</div>}
                    </div>
                    {isOwner && (
                      <button onClick={e => { e.stopPropagation(); followersModalType === 'followers' ? removeFollower(user.id) : unfollowUser(user.id); }}
                        style={{ marginLeft: 'auto', padding: '4px 10px', border: '1px solid #1a1a1a', background: 'transparent', color: '#3a3a3a', fontFamily: BB, fontSize: 9, letterSpacing: '1px', cursor: 'pointer' }}>
                        {followersModalType === 'followers' ? 'REMOVE' : 'UNFOLLOW'}
                      </button>
                    )}
                  </div>
                ))}
                {(followersModalType === 'followers' ? filteredFollowers : filteredFollowing).length === 0 && (
                  <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: BB, fontSize: 14, letterSpacing: 2, color: '#2a2a2a' }}>
                    {followersSearch ? 'NO RESULTS' : followersModalType === 'followers' ? 'NO FOLLOWERS YET' : 'NOT FOLLOWING ANYONE'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}