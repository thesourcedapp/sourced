"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Cropper from 'react-easy-crop';

type Point = { x: number; y: number };
type Area = { x: number; y: number; width: number; height: number };

type ThemeKey = 'opium' | 'bone' | 'slate' | 'blush' | 'void' | 'chrome' | 'forest';
type Theme = { name: string; bg: string; surface: string; border: string; text: string; muted: string; accent: string; accentText: string; cardBg: string; desc: string; };

const THEMES: Record<ThemeKey, Theme> = {
  opium:  { name:'OPIUM',  desc:'Dark editorial',      bg:'#0a0a0a', surface:'#111',    border:'#222',    text:'#fff',   muted:'#666',   accent:'#fff',    accentText:'#000', cardBg:'#141414' },
  bone:   { name:'BONE',   desc:'Warm off-white',      bg:'#f5f0e8', surface:'#ede8de', border:'#d4cfc4', text:'#1a1714',muted:'#8a8278',accent:'#1a1714', accentText:'#f5f0e8', cardBg:'#ede8de' },
  slate:  { name:'SLATE',  desc:'Blue-dark modern',    bg:'#0f1117', surface:'#161a24', border:'#252d3d', text:'#e8eaf2',muted:'#4a5268',accent:'#4f6ef7', accentText:'#fff', cardBg:'#1c2030' },
  blush:  { name:'BLUSH',  desc:'Warm terracotta',     bg:'#fdf6f0', surface:'#f9ede4', border:'#e8d5c8', text:'#2a1a14',muted:'#9a7a6e',accent:'#c4614a', accentText:'#fff', cardBg:'#f4e4da' },
  void:   { name:'VOID',   desc:'Pitch black + red',   bg:'#000',    surface:'#0a0a0a', border:'#1a1a1a', text:'#fff',   muted:'#333',   accent:'#ff3366', accentText:'#fff', cardBg:'#0d0d0d' },
  chrome: { name:'CHROME', desc:'Clean industrial',    bg:'#f0f0f0', surface:'#e8e8e8', border:'#c8c8c8', text:'#111',   muted:'#777',   accent:'#111',    accentText:'#f0f0f0', cardBg:'#e4e4e4' },
  forest: { name:'FOREST', desc:'Deep green natural',  bg:'#0d1a0f', surface:'#111f13', border:'#1a2e1c', text:'#e8f0e8',muted:'#3d5c40',accent:'#4caf66', accentText:'#000', cardBg:'#152117' },
};

type CollabStatus = 'open' | 'selective' | 'closed';

type ProfileData = {
  id: string; username: string; full_name: string | null; avatar_url: string | null;
  bio: string | null; theme: ThemeKey | null;
  social_instagram: string | null; social_tiktok: string | null; social_url: string | null;
  collab_status: CollabStatus | null; collab_types: string | null;
  followers_count: number; following_count: number; is_following?: boolean;
};
type UserCatalog = { id: string; name: string; description: string | null; image_url: string | null; created_at: string; item_count: number; bookmark_count: number; slug: string; owner_username: string; is_pinned?: boolean; };
type CatalogItem = { id: string; title: string; image_url: string; product_url: string | null; price: string | null; seller: string | null; catalog_id: string; catalog_name: string; catalog_slug: string; like_count: number; is_monetized: boolean; };
type BookmarkedCatalog = { id: string; name: string; description: string | null; image_url: string | null; bookmark_count: number; username: string; full_name: string | null; item_count: number; created_at: string; slug: string; };
type LikedItem = { id: string; title: string; image_url: string; product_url: string | null; price: string | null; seller: string | null; catalog_id: string; catalog_name: string; catalog_owner: string; catalog_slug: string; like_count: number; created_at: string; is_monetized: boolean; };
type FeedPost = { id: string; image_url: string; caption: string | null; like_count: number; comment_count: number; created_at: string; is_pinned?: boolean; };
type SavedPost = { id: string; image_url: string; caption: string | null; like_count: number; comment_count: number; created_at: string; saved_at: string; };
type FollowUser = { id: string; username: string; full_name: string | null; avatar_url: string | null; followers_count: number; following_count: number; created_at: string; };
type ClickAnalytics = { total_clicks: number; unique_clicks: number; total_earnings: number; top_item_title: string | null; top_item_clicks: number; };

async function uploadToStorage(file: File, bucket: string, userId: string, prefix: string): Promise<{ url: string | null; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${prefix}-${userId}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (error) return { url: null, error: error.message };
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return { url: publicUrl };
  } catch (e: any) { return { url: null, error: e.message }; }
}

function linkifyBio(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    part.match(urlRegex)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70 transition-opacity" onClick={e => e.stopPropagation()}>{part}</a>
      : part
  );
}

function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No 2d context')); return; }
      canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Canvas empty')); }, 'image/jpeg', 0.95);
    };
    image.onerror = reject;
  });
}

function EmptyState({ text, theme, cta, onCta }: { text: string; theme: Theme; cta?: string; onCta?: () => void }) {
  return (
    <div className="text-center py-20 flex flex-col items-center gap-4">
      <p className="text-2xl font-black tracking-wider opacity-20" style={{ fontFamily: 'Bebas Neue, sans-serif', color: theme.text }}>{text}</p>
      {cta && onCta && (
        <button onClick={onCta} className="px-6 py-3 text-[10px] tracking-[0.4em] font-black border-2 transition-all hover:opacity-80" style={{ fontFamily: 'Bebas Neue, sans-serif', borderColor: theme.accent, color: theme.accent, backgroundColor: 'transparent' }}>{cta}</button>
      )}
    </div>
  );
}
export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [catalogs, setCatalogs] = useState<UserCatalog[]>([]);
  const [allItems, setAllItems] = useState<CatalogItem[]>([]);
  const [bookmarkedCatalogs, setBookmarkedCatalogs] = useState<BookmarkedCatalog[]>([]);
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [analytics, setAnalytics] = useState<ClickAnalytics | null>(null);
  const [topBrands, setTopBrands] = useState<{ seller: string; count: number; pct: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'catalogs'|'items'|'posts'|'bookmarks'|'liked'|'saved'>('catalogs');
  const [expandedItem, setExpandedItem] = useState<CatalogItem | LikedItem | null>(null);

  // Edit drawer
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editTab, setEditTab] = useState<'profile'|'theme'|'social'|'collab'>('profile');

  // Edit fields
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editSocialUrl, setEditSocialUrl] = useState('');
  const [editCollabStatus, setEditCollabStatus] = useState<CollabStatus>('open');
  const [editCollabTypes, setEditCollabTypes] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('opium');
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');

  // Avatar crop
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // UI state
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers'|'following'>('followers');
  const [followersSearchQuery, setFollowersSearchQuery] = useState('');

  const isOwner = currentUserId === profileId;
  const T: Theme = THEMES[profile?.theme || 'opium'];

  const pinnedCatalogs = catalogs.filter(c => c.is_pinned);
  const pinnedPosts = feedPosts.filter(p => p.is_pinned);
  const hasPinned = pinnedCatalogs.length > 0 || pinnedPosts.length > 0;
  const filteredFollowers = followersSearchQuery.trim() ? followers.filter(u => u.username.toLowerCase().includes(followersSearchQuery.toLowerCase()) || (u.full_name||'').toLowerCase().includes(followersSearchQuery.toLowerCase())) : followers;
  const filteredFollowing = followersSearchQuery.trim() ? following.filter(u => u.username.toLowerCase().includes(followersSearchQuery.toLowerCase()) || (u.full_name||'').toLowerCase().includes(followersSearchQuery.toLowerCase())) : following;

  useEffect(() => { async function init() { await loadCurrentUser(); if (username) await loadProfile(); } init(); }, [username]);
  useEffect(() => { if (profileId) { loadUserCatalogs(); loadAllItems(); loadBookmarkedCatalogs(); loadLikedItems(); loadFeedPosts(); loadFollowers(); loadFollowing(); if (isOwner) { loadSavedPosts(); loadAnalytics(); } } }, [profileId, isOwner]);
  useEffect(() => { if (currentUserId && username) loadProfile(); }, [currentUserId, username]);

  async function loadCurrentUser() { const { data: { user } } = await supabase.auth.getUser(); setCurrentUserId(user?.id || null); }

  async function loadProfile() {
    if (!username) return;
    try {
      const { data, error } = await supabase.from('profiles').select('id,username,full_name,avatar_url,bio,theme,social_instagram,social_tiktok,social_url,collab_status,collab_types,followers_count,following_count').eq('username', username).single();
      if (!error && data) {
        setProfileId(data.id);
        let p = { ...data, is_following: false };
        if (currentUserId && currentUserId !== data.id) { const { data: fd } = await supabase.from('followers').select('id').eq('follower_id', currentUserId).eq('following_id', data.id).single(); p.is_following = !!fd; }
        setProfile(p); setEditFullName(data.full_name||''); setEditBio(data.bio||'');
        setEditInstagram(data.social_instagram||''); setEditTiktok(data.social_tiktok||''); setEditSocialUrl(data.social_url||'');
        setEditCollabStatus((data.collab_status as CollabStatus)||'open'); setEditCollabTypes(data.collab_types||'');
        setSelectedTheme((data.theme as ThemeKey)||'opium');
      }
    } catch(e){console.error(e);} finally{setLoading(false);}
  }

  async function loadUserCatalogs() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.from('catalogs').select('id,name,description,image_url,created_at,bookmark_count,slug,owner_id,is_pinned,profiles!catalogs_owner_id_fkey(username),catalog_items(count)').eq('owner_id',profileId).eq('visibility','public').order('is_pinned',{ascending:false}).order('created_at',{ascending:false});
      if (!error && data) setCatalogs(data.map(c => { const owner=Array.isArray(c.profiles)?c.profiles[0]:c.profiles; return {...c,item_count:c.catalog_items?.[0]?.count||0,bookmark_count:c.bookmark_count||0,owner_username:owner?.username||'unknown',is_pinned:c.is_pinned||false}; }));
    } catch(e){console.error(e);}
  }

  async function loadAllItems() {
    if (!profileId) return;
    try {
      const { data: catalogData } = await supabase.from('catalogs').select('id,name,slug').eq('owner_id',profileId).eq('visibility','public');
      if (!catalogData||catalogData.length===0){setAllItems([]);return;}
      const catalogMap = new Map(catalogData.map(c=>[c.id,c]));
      const { data: items, error } = await supabase.from('catalog_items').select('id,title,image_url,product_url,price,seller,catalog_id,like_count,is_monetized').in('catalog_id',catalogData.map(c=>c.id)).order('created_at',{ascending:false});
      if (!error && items) {
        const itemsMapped = items.map(item => { const cat=catalogMap.get(item.catalog_id); return {...item,catalog_name:cat?.name||'Unknown',catalog_slug:cat?.slug||'',like_count:item.like_count||0,is_monetized:item.is_monetized||false}; });
        setAllItems(itemsMapped);
        // Compute top brands
        const brandCounts: Record<string,number> = {};
        itemsMapped.forEach(item => { if(item.seller) brandCounts[item.seller]=(brandCounts[item.seller]||0)+1; });
        const total = Object.values(brandCounts).reduce((a,b)=>a+b,0);
        const sorted = Object.entries(brandCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([seller,count])=>({seller,count,pct:Math.round((count/total)*100)}));
        setTopBrands(sorted);
      }
    } catch(e){console.error(e);}
  }

  async function loadAnalytics() {
    if (!profileId) return;
    try {
      const { data: clicks } = await supabase.from('affiliate_clicks').select('item_id,is_unique,created_at').eq('creator_id',profileId);
      if (!clicks) return;
      const total = clicks.length;
      const unique = clicks.filter(c=>c.is_unique).length;
      // earnings from transactions
      const { data: earnings } = await supabase.from('earnings_transactions').select('amount').eq('creator_id',profileId);
      const totalEarnings = earnings?.reduce((a,b)=>a+(b.amount||0),0)||0;
      // top item
      const itemCounts: Record<string,number> = {};
      clicks.forEach(c=>{ if(c.item_id) itemCounts[c.item_id]=(itemCounts[c.item_id]||0)+1; });
      const topItemId = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1])[0];
      let topItemTitle: string|null = null; let topItemClicks = 0;
      if(topItemId) {
        const { data: itemData } = await supabase.from('catalog_items').select('title').eq('id',topItemId[0]).single();
        topItemTitle = itemData?.title||null; topItemClicks = topItemId[1];
      }
      setAnalytics({ total_clicks: total, unique_clicks: unique, total_earnings: totalEarnings, top_item_title: topItemTitle, top_item_clicks: topItemClicks });
    } catch(e){console.error(e);}
  }

  async function loadFeedPosts() {
    if (!profileId) return;
    try { const {data,error}=await supabase.from('feed_posts').select('id,image_url,caption,like_count,comment_count,created_at,is_pinned').eq('owner_id',profileId).order('is_pinned',{ascending:false}).order('created_at',{ascending:false}); if(!error&&data)setFeedPosts(data.map(p=>({...p,is_pinned:p.is_pinned||false}))); } catch(e){console.error(e);}
  }

  async function loadSavedPosts() {
    if (!profileId||!isOwner) return;
    try {
      const {data:savedData}=await supabase.from('saved_feed_posts').select('feed_post_id,created_at').eq('user_id',profileId);
      if (!savedData||savedData.length===0){setSavedPosts([]);return;}
      const {data:postsData}=await supabase.from('feed_posts').select('id,image_url,caption,like_count,comment_count,created_at').in('id',savedData.map(s=>s.feed_post_id));
      if(postsData)setSavedPosts(postsData.map(p=>({...p,saved_at:savedData.find(s=>s.feed_post_id===p.id)?.created_at||''})).sort((a,b)=>new Date(b.saved_at).getTime()-new Date(a.saved_at).getTime()));
    } catch(e){console.error(e);}
  }

  async function loadBookmarkedCatalogs() {
    if (!profileId) return;
    try {
      const {data}=await supabase.from('bookmarked_catalogs').select('catalog_id,created_at').eq('user_id',profileId);
      if(!data||data.length===0){setBookmarkedCatalogs([]);return;}
      const {data:catalogsData}=await supabase.from('catalogs').select('id,name,description,image_url,bookmark_count,owner_id,visibility,slug,catalog_items(count)').in('id',data.map(b=>b.catalog_id));
      if(!catalogsData)return;
      const {data:ownersData}=await supabase.from('profiles').select('id,username,full_name').in('id',[...new Set(catalogsData.map(c=>c.owner_id))]);
      const om=new Map(ownersData?.map(o=>[o.id,o])||[]);
      setBookmarkedCatalogs(catalogsData.filter(c=>c.visibility==='public').map(c=>{const owner=om.get(c.owner_id);const bm=data.find(b=>b.catalog_id===c.id);return{id:c.id,name:c.name,description:c.description,image_url:c.image_url,bookmark_count:c.bookmark_count||0,username:owner?.username||'unknown',full_name:owner?.full_name,item_count:c.catalog_items?.[0]?.count||0,created_at:bm?.created_at||'',slug:c.slug||''};}).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()));
    } catch(e){console.error(e);}
  }

  async function loadLikedItems() {
    if (!profileId) return;
    try {
      const {data:catalogLikes}=await supabase.from('liked_items').select('item_id,created_at').eq('user_id',profileId);
      const {data:feedPostLikes}=await supabase.from('liked_feed_post_items').select('item_id,created_at').eq('user_id',profileId);
      const items:LikedItem[]=[];
      if(catalogLikes&&catalogLikes.length>0){
        const {data:itemsData}=await supabase.from('catalog_items').select('id,title,image_url,product_url,price,seller,catalog_id,like_count,is_monetized').in('id',catalogLikes.map(l=>l.item_id));
        if(itemsData){
          const {data:catalogsData}=await supabase.from('catalogs').select('id,name,owner_id,visibility,slug').in('id',[...new Set(itemsData.map(i=>i.catalog_id))]);
          const {data:ownersData}=await supabase.from('profiles').select('id,username').in('id',[...new Set(catalogsData?.map(c=>c.owner_id)||[])]);
          const cm=new Map(catalogsData?.map(c=>[c.id,c])||[]);const om=new Map(ownersData?.map(o=>[o.id,o])||[]);
          itemsData.filter(item=>cm.get(item.catalog_id)?.visibility==='public').forEach(item=>{const cat=cm.get(item.catalog_id);const owner=cat?om.get(cat.owner_id):null;const like=catalogLikes.find(l=>l.item_id===item.id);items.push({id:item.id,title:item.title,image_url:item.image_url,product_url:item.product_url,price:item.price,seller:item.seller,catalog_id:item.catalog_id,catalog_name:cat?.name||'Unknown',catalog_owner:owner?.username||'unknown',catalog_slug:cat?.slug||'',like_count:item.like_count||0,created_at:like?.created_at||'',is_monetized:item.is_monetized||false});});
        }
      }
      if(feedPostLikes&&feedPostLikes.length>0){
        const {data:feedItemsData}=await supabase.from('feed_post_items').select('id,title,image_url,product_url,price,seller,feed_post_id,like_count').in('id',feedPostLikes.map(l=>l.item_id));
        feedItemsData?.forEach(item=>{const like=feedPostLikes.find(l=>l.item_id===item.id);items.push({id:item.id,title:item.title,image_url:item.image_url,product_url:item.product_url,price:item.price,seller:item.seller,catalog_id:item.feed_post_id,catalog_name:'Feed Post',catalog_owner:'feed',catalog_slug:item.feed_post_id,like_count:item.like_count||0,created_at:like?.created_at||'',is_monetized:false});});
      }
      items.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
      setLikedItems(items);
    } catch(e){console.error(e);}
  }

  async function loadFollowers() {
    if (!profileId) return;
    try {
      const {data}=await supabase.from('followers').select('follower_id,created_at').eq('following_id',profileId).order('created_at',{ascending:false});
      if(!data||data.length===0){setFollowers([]);return;}
      const {data:profilesData}=await supabase.from('profiles').select('id,username,full_name,avatar_url,followers_count,following_count').in('id',data.map(f=>f.follower_id));
      const pm=new Map(profilesData?.map(p=>[p.id,p])||[]);
      setFollowers(data.map(f=>{const p=pm.get(f.follower_id);if(!p)return null;return{...p,followers_count:p.followers_count||0,following_count:p.following_count||0,created_at:f.created_at};}).filter(Boolean) as FollowUser[]);
    } catch(e){console.error(e);}
  }

  async function loadFollowing() {
    if (!profileId) return;
    try {
      const {data}=await supabase.from('followers').select('following_id,created_at').eq('follower_id',profileId).order('created_at',{ascending:false});
      if(!data||data.length===0){setFollowing([]);return;}
      const {data:profilesData}=await supabase.from('profiles').select('id,username,full_name,avatar_url,followers_count,following_count').in('id',data.map(f=>f.following_id));
      const pm=new Map(profilesData?.map(p=>[p.id,p])||[]);
      setFollowing(data.map(f=>{const p=pm.get(f.following_id);if(!p)return null;return{...p,followers_count:p.followers_count||0,following_count:p.following_count||0,created_at:f.created_at};}).filter(Boolean) as FollowUser[]);
    } catch(e){console.error(e);}
  }

  async function handleShareProfile() {
    try { if(navigator.share){await navigator.share({url:window.location.href});}else{await navigator.clipboard.writeText(window.location.href);setShowShareCopied(true);setTimeout(()=>setShowShareCopied(false),2000);} } catch(err){if(err instanceof Error&&err.name!=='AbortError'){try{await navigator.clipboard.writeText(window.location.href);setShowShareCopied(true);setTimeout(()=>setShowShareCopied(false),2000);}catch{}}}
  }

  async function toggleFollow() {
    if(!currentUserId||!profile)return;
    try { if(profile.is_following)await supabase.from('followers').delete().eq('follower_id',currentUserId).eq('following_id',profileId); else await supabase.from('followers').insert({follower_id:currentUserId,following_id:profileId}); await new Promise(r=>setTimeout(r,200)); await loadProfile();await loadFollowers();await loadFollowing(); } catch(e){console.error(e);}
  }

  async function togglePinCatalog(catalogId:string) { if(!isOwner)return; const catalog=catalogs.find(c=>c.id===catalogId);if(!catalog)return; await supabase.from('catalogs').update({is_pinned:!catalog.is_pinned}).eq('id',catalogId); await loadUserCatalogs(); }
  async function togglePinPost(postId:string) { if(!isOwner)return; const post=feedPosts.find(p=>p.id===postId);if(!post)return; await supabase.from('feed_posts').update({is_pinned:!post.is_pinned}).eq('id',postId); await loadFeedPosts(); }

  async function applyTheme(t:ThemeKey) {
    setSelectedTheme(t);
    if(currentUserId){ await supabase.from('profiles').update({theme:t}).eq('id',currentUserId); await loadProfile(); }
  }

  async function saveProfile(e:React.FormEvent) {
    e.preventDefault(); if(!currentUserId)return; setSaving(true); setImageError('');
    try {
      let finalAvatarUrl = profile?.avatar_url||'';
      if(selectedFile&&previewUrl&&croppedAreaPixels){
        const blob=await getCroppedImg(previewUrl,croppedAreaPixels); const croppedFile=new File([blob],selectedFile.name,{type:'image/jpeg'});
        const res=await uploadToStorage(croppedFile,'avatars',currentUserId,'avatar'); if(!res.url){setImageError(res.error||'Upload failed');setSaving(false);return;} finalAvatarUrl=res.url;
        try{const ctrl=new AbortController();const tid=setTimeout(()=>ctrl.abort(),10000);const mod=await fetch('/api/check-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_url:finalAvatarUrl}),signal:ctrl.signal});clearTimeout(tid);if(mod.ok){const d=await mod.json();if(d.safe===false){setImageError('Inappropriate content');setSaving(false);return;}}}catch{}
      }
      await supabase.from('profiles').update({ full_name:editFullName.trim()||null, bio:editBio.trim()||null, avatar_url:finalAvatarUrl||null, social_instagram:editInstagram.trim()||null, social_tiktok:editTiktok.trim()||null, social_url:editSocialUrl.trim()||null, collab_status:editCollabStatus, collab_types:editCollabTypes.trim()||null }).eq('id',currentUserId);
      await loadProfile(); setShowEditDrawer(false); setShowCropper(false);
    } catch(e){console.error(e);alert('Failed to save');} finally{setSaving(false);}
  }

  async function handleAvatarFileSelect(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file)return; if(!file.type.startsWith('image/')){setImageError('Please select an image file');return;}
    setSelectedFile(file);setImageError(''); const reader=new FileReader(); reader.onload=ev=>{setPreviewUrl(ev.target?.result as string);setShowCropper(true);}; reader.readAsDataURL(file);
  }

  const onCropComplete=(_:Area,cap:Area)=>{setCroppedAreaPixels(cap);};

  const collabColors: Record<CollabStatus,string> = { open:'#22c55e', selective:'#eab308', closed:'#ef4444' };
  const collabLabels: Record<CollabStatus,string> = { open:'Open to collabs', selective:'Selective', closed:'Not available' };

  const tabs=[
    {id:'catalogs' as const,label:'CATALOGS',count:catalogs.length},
    {id:'items' as const,label:'SHOP',count:allItems.length},
    {id:'posts' as const,label:'POSTS',count:feedPosts.length},
    {id:'bookmarks' as const,label:'SAVED',count:bookmarkedCatalogs.length},
    {id:'liked' as const,label:'LIKED',count:likedItems.length},
    ...(isOwner?[{id:'saved' as const,label:'ARCHIVE',count:savedPosts.length}]:[])
  ];
  if(loading) return (<><style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style><div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-xs tracking-[0.4em]" style={{fontFamily:'Bebas Neue, sans-serif'}}>LOADING...</p></div></>);
  if(!profile) return (<><style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style><div className="min-h-screen bg-white text-black flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-black tracking-tighter mb-4" style={{fontFamily:'Archivo Black, sans-serif'}}>PROFILE NOT FOUND</h1><button onClick={()=>router.back()} className="px-6 py-2 border-2 border-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>GO BACK</button></div></div></>);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        input,textarea,select{font-size:16px!important;}
        .cat-img{transition:transform 0.4s ease;}
        .cat-card:hover .cat-img{transform:scale(1.04);}
        .item-img{transition:transform 0.3s ease;}
        .item-card:hover .item-img{transform:scale(1.05);}
        .reveal-overlay{opacity:0;transition:opacity 0.2s ease;}
        .reveal-wrap:hover .reveal-overlay{opacity:1;}
        .drawer-in{transform:translateX(100%);transition:transform 0.28s cubic-bezier(.4,0,.2,1);}
        .drawer-in.open{transform:translateX(0);}
        .tab-ul::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--ta);transform:scaleX(0);transition:transform 0.18s ease;}
        .tab-ul.tab-act::after{transform:scaleX(1);}
        .stat-hover:hover{opacity:0.7;}
      `}</style>
      <style>{`:root{--ta:${T.accent};}`}</style>

      <div style={{backgroundColor:T.bg,color:T.text,minHeight:'100vh'}}>

        {/* BACK */}
        <div className="px-5 md:px-10 pt-5">
          <button onClick={()=>router.back()} style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted,background:'none',border:'none'}} className="text-[10px] tracking-[0.35em] font-black opacity-50 hover:opacity-100 transition-opacity">← BACK</button>
        </div>

        {/* ═══════════════════════════════
            HERO — avatar left, identity right
            No banner — clean editorial
        ═══════════════════════════════ */}
        <div className="px-5 md:px-10 pt-6 pb-8" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">

              {/* Avatar */}
              <div className="flex-shrink-0 relative">
                <div className="w-32 h-32 md:w-44 md:h-44 overflow-hidden" style={{border:`2px solid ${T.border}`,backgroundColor:T.surface}}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center"><span className="font-black opacity-20" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text,fontSize:'4rem'}}>{profile.username[0].toUpperCase()}</span></div>
                  }
                </div>
                {/* Collab badge — bottom of avatar */}
                {profile.collab_status && (
                  <div className="absolute -bottom-3 left-0 right-0 flex justify-center">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[8px] tracking-[0.2em] font-black whitespace-nowrap" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:T.bg,border:`1px solid ${T.border}`,color:collabColors[profile.collab_status]}}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:collabColors[profile.collab_status]}}/>
                      {collabLabels[profile.collab_status].toUpperCase()}
                    </div>
                  </div>
                )}
              </div>

              {/* Identity block */}
              <div className="flex-1 min-w-0 space-y-3 md:space-y-4 pt-1">

                {/* Name + username + actions */}
                <div>
                  {profile.full_name&&<p className="text-[10px] tracking-[0.45em] mb-1 font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{profile.full_name}</p>}
                  <div className="flex flex-wrap items-center gap-4">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>@{profile.username}</h1>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={handleShareProfile} style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,backgroundColor:'transparent'}} className="px-3 py-1.5 text-[9px] tracking-[0.3em] font-black border transition-all hover:opacity-100 opacity-70">{showShareCopied?'COPIED!':'SHARE'}</button>
                      {isOwner
                        ? <button onClick={()=>{setShowEditDrawer(true);setEditTab('profile');}} style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,color:T.accent,backgroundColor:'transparent'}} className="px-3 py-1.5 text-[9px] tracking-[0.3em] font-black border-2 transition-all hover:opacity-80">EDIT PROFILE</button>
                        : currentUserId
                          ? <button onClick={toggleFollow} style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:profile.is_following?'transparent':T.accent,color:profile.is_following?T.accent:T.accentText}} className="px-4 py-1.5 text-[9px] tracking-[0.3em] font-black border-2 transition-all">{profile.is_following?'FOLLOWING':'FOLLOW'}</button>
                          : null
                      }
                    </div>
                  </div>
                </div>

                {profile.bio&&<p className="text-sm leading-relaxed max-w-lg" style={{color:T.muted}}>{linkifyBio(profile.bio)}</p>}

                {/* Social links */}
                {(profile.social_instagram||profile.social_tiktok||profile.social_url)&&(
                  <div className="flex flex-wrap gap-2">
                    {profile.social_instagram&&(
                      <a href={`https://instagram.com/${profile.social_instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,textDecoration:'none'}} className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] tracking-[0.2em] font-black border transition-all hover:opacity-100 opacity-70"
                        onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.text;(e.currentTarget as HTMLAnchorElement).style.color=T.text;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.border;(e.currentTarget as HTMLAnchorElement).style.color=T.muted;}}>
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        @{profile.social_instagram.replace('@','')}
                      </a>
                    )}
                    {profile.social_tiktok&&(
                      <a href={`https://tiktok.com/@${profile.social_tiktok.replace('@','')}`} target="_blank" rel="noopener noreferrer" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,textDecoration:'none'}} className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] tracking-[0.2em] font-black border transition-all hover:opacity-100 opacity-70"
                        onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.text;(e.currentTarget as HTMLAnchorElement).style.color=T.text;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.border;(e.currentTarget as HTMLAnchorElement).style.color=T.muted;}}>
                        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                        @{profile.social_tiktok.replace('@','')}
                      </a>
                    )}
                    {profile.social_url&&(
                      <a href={profile.social_url.startsWith('http')?profile.social_url:`https://${profile.social_url}`} target="_blank" rel="noopener noreferrer" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,textDecoration:'none'}} className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] tracking-[0.2em] font-black border transition-all hover:opacity-100 opacity-70"
                        onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.text;(e.currentTarget as HTMLAnchorElement).style.color=T.text;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.border;(e.currentTarget as HTMLAnchorElement).style.color=T.muted;}}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        {profile.social_url.replace(/^https?:\/\//,'').split('/')[0]}
                      </a>
                    )}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center flex-wrap gap-0 pt-1">
                  {[
                    {label:'FOLLOWERS',value:profile.followers_count,onClick:()=>{setFollowersModalType('followers');setFollowersSearchQuery('');setShowFollowersModal(true);}},
                    {label:'FOLLOWING',value:profile.following_count,onClick:()=>{setFollowersModalType('following');setFollowersSearchQuery('');setShowFollowersModal(true);}},
                    {label:'CATALOGS',value:catalogs.length,onClick:undefined},
                    {label:'ITEMS',value:allItems.length,onClick:undefined},
                  ].map((stat,i)=>(
                    <div key={i} className="flex items-center">
                      {i>0&&<div className="w-px h-6 mx-5" style={{backgroundColor:T.border}}/>}
                      <button onClick={stat.onClick||undefined} style={{cursor:stat.onClick?'pointer':'default',background:'none',border:'none'}} className="stat-hover text-left transition-opacity">
                        <span className="block text-xl md:text-2xl font-black tracking-tighter leading-none" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>{stat.value}</span>
                        <span className="block text-[8px] tracking-[0.3em] mt-0.5 opacity-40" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{stat.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── CREATOR VALUE SNAPSHOT (owner only, brand-pitch ready) ── */}
            {isOwner && analytics && (
              <div className="mt-8 p-5 border" style={{borderColor:T.border,backgroundColor:T.surface}}>
                <div className="flex items-baseline gap-3 mb-4">
                  <p className="text-[9px] tracking-[0.5em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>CREATOR SNAPSHOT</p>
                  <div className="flex-1 h-px" style={{backgroundColor:T.border}}/>
                  <p className="text-[8px] tracking-wider" style={{color:T.muted,fontFamily:'Bebas Neue, sans-serif'}}>VISIBLE TO YOU ONLY</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {[
                    {label:'TOTAL CLICKS',value:analytics.total_clicks.toLocaleString()},
                    {label:'UNIQUE CLICKS',value:analytics.unique_clicks.toLocaleString()},
                    {label:'EARNINGS',value:`$${analytics.total_earnings.toFixed(2)}`},
                    {label:'CATALOG ITEMS',value:allItems.length.toString()},
                  ].map((s,i)=>(
                    <div key={i} className="p-3 border" style={{borderColor:T.border,backgroundColor:T.cardBg}}>
                      <p className="text-xl md:text-2xl font-black tracking-tighter leading-none" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>{s.value}</p>
                      <p className="text-[8px] tracking-[0.3em] mt-1 opacity-50" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {analytics.top_item_title&&(
                  <p className="mt-3 text-[9px] tracking-wider" style={{color:T.muted}}>
                    TOP ITEM: <span style={{color:T.text}} className="font-black">{analytics.top_item_title}</span> — {analytics.top_item_clicks} clicks
                  </p>
                )}
              </div>
            )}

            {/* ── TOP BRANDS strip (public) ── */}
            {topBrands.length > 0 && (
              <div className="mt-6">
                <div className="flex items-baseline gap-3 mb-3">
                  <p className="text-[9px] tracking-[0.5em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>MOST FEATURED BRANDS</p>
                  <div className="flex-1 h-px" style={{backgroundColor:T.border}}/>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topBrands.map((b,i)=>(
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border" style={{borderColor:T.border,backgroundColor:T.cardBg}}>
                      <span className="text-[10px] font-black tracking-wider" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{b.seller}</span>
                      <span className="text-[8px] tracking-wider" style={{color:T.accent,fontFamily:'Bebas Neue, sans-serif'}}>{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* FEATURED */}
        {hasPinned&&(
          <div className="px-5 md:px-10 py-8" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
            <div className="max-w-6xl mx-auto">
              <div className="flex items-baseline gap-3 mb-6"><p className="text-[9px] tracking-[0.5em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>FEATURED</p><div className="flex-1 h-px" style={{backgroundColor:T.border}}/></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {pinnedCatalogs.map(catalog=>(
                  <div key={catalog.id} className="reveal-wrap cursor-pointer relative group" onClick={()=>router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                    <div className="relative overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface,border:`1px solid ${T.border}`}}>
                      {catalog.image_url?<img src={catalog.image_url} alt={catalog.name} className="cat-img w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-10" style={{color:T.text}}>✦</span></div>}
                      <div className="reveal-overlay absolute inset-0 flex flex-col justify-end p-3" style={{background:'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)'}}><p className="text-white text-[9px] tracking-[0.3em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>SHOP CATALOG →</p></div>
                    </div>
                    <div className="pt-2.5"><p className="text-sm font-black tracking-wide uppercase truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{catalog.name}</p><p className="text-[9px] mt-0.5" style={{color:T.muted}}>{catalog.item_count} items</p></div>
                    {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinCatalog(catalog.id);}} className="absolute top-2 right-2 px-2 py-0.5 text-[8px] font-black tracking-wider border transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:'rgba(0,0,0,0.7)',borderColor:'rgba(255,255,255,0.3)',color:'#fff'}}>UNPIN</button>}
                  </div>
                ))}
                {pinnedPosts.map(post=>(
                  <div key={post.id} className="reveal-wrap cursor-pointer relative group" onClick={()=>router.push(`/post/${post.id}`)}>
                    <div className="relative overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface,border:`1px solid ${T.border}`}}>
                      <img src={post.image_url} alt="" className="cat-img w-full h-full object-cover"/>
                      <div className="reveal-overlay absolute inset-0 flex flex-col justify-end p-3" style={{background:'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)'}}><p className="text-white text-[9px] tracking-[0.3em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>VIEW POST →</p></div>
                    </div>
                    <div className="pt-2.5">{post.caption?<p className="text-sm font-black tracking-wide uppercase truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{post.caption}</p>:<p className="text-sm font-black tracking-wide uppercase opacity-30" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>POST</p>}<p className="text-[9px] mt-0.5" style={{color:T.muted}}>♥ {post.like_count}</p></div>
                    {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinPost(post.id);}} className="absolute top-2 right-2 px-2 py-0.5 text-[8px] font-black tracking-wider border transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:'rgba(0,0,0,0.7)',borderColor:'rgba(255,255,255,0.3)',color:'#fff'}}>UNPIN</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="sticky top-0 z-20" style={{backgroundColor:T.bg,borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
          <div className="max-w-6xl mx-auto px-5 md:px-10">
            <div className="flex overflow-x-auto items-center">
              <div className="flex flex-1 overflow-x-auto">
                {tabs.map(tab=>(
                  <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`tab-ul relative py-4 px-4 md:px-5 text-[10px] tracking-[0.3em] font-black whitespace-nowrap transition-all${activeTab===tab.id?' tab-act':''}`} style={{fontFamily:'Bebas Neue, sans-serif',color:activeTab===tab.id?T.text:T.muted,backgroundColor:'transparent',border:'none'}}>
                    {tab.label}<span className="ml-1.5 opacity-40 text-[9px]">{tab.count}</span>
                  </button>
                ))}
              </div>
              {/* + CREATE buttons — owner only */}
              {isOwner&&(
                <div className="flex items-center gap-2 pl-3 flex-shrink-0" style={{borderLeftColor:T.border,borderLeftWidth:1,borderLeftStyle:'solid'}}>
                  <button onClick={()=>router.push('/catalogs/new')} className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] tracking-[0.2em] font-black border transition-all hover:opacity-80" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,color:T.accent,backgroundColor:'transparent'}}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                    CATALOG
                  </button>
                  <button onClick={()=>router.push('/posts/new')} className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] tracking-[0.2em] font-black border transition-all hover:opacity-80" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,backgroundColor:'transparent'}}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                    POST
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="px-5 md:px-10 py-8">
          <div className="max-w-6xl mx-auto">

            {/* CATALOGS */}
            {activeTab==='catalogs'&&(catalogs.length===0
              ? <EmptyState text="NO CATALOGS YET" theme={T} cta={isOwner?'+ CREATE CATALOG':undefined} onCta={isOwner?()=>router.push('/catalogs/new'):undefined}/>
              : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
                  {catalogs.map((catalog,i)=>(
                    <div key={catalog.id} className="cat-card group relative cursor-pointer" style={{border:`1px solid ${T.border}`,backgroundColor:T.cardBg}} onClick={()=>router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                      {catalog.is_pinned&&<div className="absolute top-0 left-0 z-10 px-3 py-1 text-[8px] tracking-[0.3em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:T.accent,color:T.accentText}}>FEATURED</div>}
                      {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinCatalog(catalog.id);}} className="absolute top-2 right-2 z-10 px-2 py-0.5 text-[8px] font-black tracking-wider border transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:T.surface,borderColor:T.border,color:T.muted}}>{catalog.is_pinned?'UNPIN':'PIN'}</button>}
                      {/* Taller image — 5:6 ratio */}
                      <div className="relative overflow-hidden" style={{width:'100%',paddingBottom:'83%',backgroundColor:T.surface}}>
                        <div className="absolute inset-0">
                          {catalog.image_url?<img src={catalog.image_url} alt={catalog.name} className="cat-img w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><span className="text-6xl opacity-10" style={{color:T.text}}>✦</span></div>}
                        </div>
                      </div>
                      <div className="p-4" style={{borderTopColor:T.border,borderTopWidth:1,borderTopStyle:'solid'}}>
                        <p className="text-[8px] tracking-[0.4em] mb-1.5 font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{String(i+1).padStart(2,'0')} / CATALOG</p>
                        <h3 className="text-lg font-black tracking-tight uppercase leading-tight mb-1.5" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>{catalog.name}</h3>
                        {catalog.description&&<p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{color:T.muted}}>{catalog.description}</p>}
                        <div className="flex items-center justify-between text-[9px] tracking-[0.3em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}><span>{catalog.item_count} ITEMS</span><span>🔖 {catalog.bookmark_count}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* SHOP */}
            {activeTab==='items'&&(allItems.length===0
              ? <EmptyState text="NO ITEMS YET" theme={T}/>
              : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {allItems.map(item=>(
                    <div key={item.id} className="item-card group cursor-pointer" style={{border:`1px solid ${T.border}`,backgroundColor:T.cardBg}} onClick={()=>setExpandedItem(item)}>
                      <div className="relative overflow-hidden" style={{paddingBottom:'100%',backgroundColor:T.surface}}>
                        <div className="absolute inset-0">
                          <img src={item.image_url} alt={item.title} className="item-img w-full h-full object-cover" loading="lazy"/>
                          {item.is_monetized&&<div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.4)'}}><span className="text-[8px] font-black text-white" style={{fontFamily:'Bebas Neue, sans-serif'}}>$</span></div>}
                        </div>
                      </div>
                      <div className="p-2.5" style={{borderTopColor:T.border,borderTopWidth:1,borderTopStyle:'solid'}}>
                        <p className="text-[10px] font-black tracking-wide uppercase leading-tight truncate mb-1" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{item.title}</p>
                        <div className="flex items-center justify-between text-[8px] tracking-wider mb-1" style={{color:T.muted}}>{item.seller&&<span className="truncate mr-1">{item.seller}</span>}{item.price&&<span className="flex-shrink-0 font-black">${item.price}</span>}</div>
                        <p className="text-[8px] tracking-wider truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>↳ {item.catalog_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* POSTS */}
            {activeTab==='posts'&&(feedPosts.length===0
              ? <EmptyState text="NO POSTS YET" theme={T} cta={isOwner?'+ CREATE POST':undefined} onCta={isOwner?()=>router.push('/posts/new'):undefined}/>
              : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {feedPosts.map(post=>(
                    <div key={post.id} className="reveal-wrap relative group cursor-pointer overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface}} onClick={()=>router.push(`/post/${post.id}`)}>
                      {post.is_pinned&&<div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[7px] tracking-widest font-black" style={{fontFamily:'Bebas Neue',backgroundColor:T.accent,color:T.accentText}}>FEATURED</div>}
                      {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinPost(post.id);}} className="absolute top-2 right-2 z-10 px-2 py-0.5 text-[7px] font-black tracking-wider transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue',backgroundColor:'rgba(0,0,0,0.7)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)'}}>{post.is_pinned?'UNPIN':'PIN'}</button>}
                      <img src={post.image_url} alt="" className="item-img w-full h-full object-cover"/>
                      <div className="reveal-overlay absolute inset-0 flex items-center justify-center gap-4" style={{backgroundColor:'rgba(0,0,0,0.55)'}}>
                        <span className="text-white text-sm font-black" style={{fontFamily:'Bebas Neue'}}>♥ {post.like_count}</span>
                        <span className="text-white text-sm font-black" style={{fontFamily:'Bebas Neue'}}>💬 {post.comment_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* ARCHIVE */}
            {activeTab==='saved'&&isOwner&&(savedPosts.length===0
              ? <EmptyState text="NOTHING ARCHIVED" theme={T}/>
              : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {savedPosts.map(post=>(
                    <div key={post.id} className="reveal-wrap relative group cursor-pointer overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface}} onClick={()=>router.push(`/post/${post.id}`)}>
                      <img src={post.image_url} alt="" className="item-img w-full h-full object-cover"/>
                      <div className="reveal-overlay absolute inset-0 flex items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.55)'}}><span className="text-white text-sm font-black" style={{fontFamily:'Bebas Neue'}}>♥ {post.like_count}</span></div>
                    </div>
                  ))}
                </div>
            )}

            {/* BOOKMARKS */}
            {activeTab==='bookmarks'&&(bookmarkedCatalogs.length===0
              ? <EmptyState text="NO SAVED CATALOGS" theme={T}/>
              : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                  {bookmarkedCatalogs.map(catalog=>(
                    <div key={catalog.id} className="group cursor-pointer" onClick={()=>router.push(`/${catalog.username}/${catalog.slug}`)}>
                      <div className="relative overflow-hidden" style={{paddingBottom:'100%',backgroundColor:T.surface,border:`1px solid ${T.border}`}}>
                        <div className="absolute inset-0">{catalog.image_url?<img src={catalog.image_url} alt={catalog.name} className="item-img w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-10" style={{color:T.text}}>✦</span></div>}</div>
                      </div>
                      <div className="pt-2.5"><p className="text-sm font-black tracking-wide uppercase truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{catalog.name}</p><p className="text-[9px] mt-0.5" style={{color:T.muted}}>@{catalog.username} · {catalog.item_count} items</p></div>
                    </div>
                  ))}
                </div>
            )}

            {/* LIKED */}
            {activeTab==='liked'&&(likedItems.length===0
              ? <EmptyState text="NO LIKED ITEMS" theme={T}/>
              : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {likedItems.map(item=>(
                    <div key={item.id} className="item-card group cursor-pointer" style={{border:`1px solid ${T.border}`,backgroundColor:T.cardBg}} onClick={()=>setExpandedItem(item)}>
                      <div className="relative overflow-hidden" style={{paddingBottom:'100%',backgroundColor:T.surface}}>
                        <div className="absolute inset-0">
                          <img src={item.image_url} alt={item.title} className="item-img w-full h-full object-cover" loading="lazy"/>
                          {item.is_monetized&&<div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.4)'}}><span className="text-[8px] font-black text-white" style={{fontFamily:'Bebas Neue, sans-serif'}}>$</span></div>}
                        </div>
                      </div>
                      <div className="p-2.5" style={{borderTopColor:T.border,borderTopWidth:1,borderTopStyle:'solid'}}>
                        <p className="text-[10px] font-black tracking-wide uppercase leading-tight truncate mb-1" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{item.title}</p>
                        <div className="flex items-center justify-between text-[8px] tracking-wider" style={{color:T.muted}}>{item.seller&&<span className="truncate mr-1">{item.seller}</span>}{item.price&&<span className="flex-shrink-0 font-black">${item.price}</span>}</div>
                      </div>
                    </div>
                  ))}
                </div>
            )}

          </div>
        </div>
        {/* ═══ EDIT DRAWER ═══ */}
        <div className="fixed inset-0 z-50 pointer-events-none" style={{visibility:showEditDrawer?'visible':'hidden'}}>
          <div className="absolute inset-0 transition-opacity duration-300" style={{backgroundColor:'rgba(0,0,0,0.65)',opacity:showEditDrawer?1:0,pointerEvents:showEditDrawer?'auto':'none'}} onClick={()=>setShowEditDrawer(false)}/>
          <div className={`drawer-in${showEditDrawer?' open':''} absolute right-0 top-0 bottom-0 w-full max-w-sm overflow-y-auto`} style={{backgroundColor:T.bg,borderLeft:`1px solid ${T.border}`,pointerEvents:'auto'}}>
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 pb-0" style={{backgroundColor:T.bg}}>
              <h2 className="text-xl font-black tracking-tighter" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>EDIT PROFILE</h2>
              <button onClick={()=>setShowEditDrawer(false)} style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted,background:'none',border:'none'}} className="text-[9px] tracking-[0.35em] font-black">[CLOSE]</button>
            </div>

            {/* Drawer tabs */}
            <div className="flex gap-0 mt-4 px-5 border-b" style={{borderColor:T.border}}>
              {([
                {id:'profile' as const,label:'PROFILE'},
                {id:'theme' as const,label:'THEME'},
                {id:'social' as const,label:'LINKS'},
                {id:'collab' as const,label:'COLLAB'},
              ]).map(t=>(
                <button key={t.id} onClick={()=>setEditTab(t.id)} className="py-2.5 px-3.5 text-[9px] tracking-[0.25em] font-black transition-all" style={{fontFamily:'Bebas Neue, sans-serif',color:editTab===t.id?T.text:T.muted,borderBottom:editTab===t.id?`2px solid ${T.accent}`:'2px solid transparent',backgroundColor:'transparent',border:'none',borderBottomWidth:'2px',borderBottomStyle:'solid',borderBottomColor:editTab===t.id?T.accent:'transparent'}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-5">

              {/* ── PROFILE TAB ── */}
              {editTab==='profile'&&(
                <form onSubmit={saveProfile} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-[9px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>DISPLAY NAME</label>
                    <input type="text" value={editFullName} onChange={e=>setEditFullName(e.target.value)} className="w-full bg-transparent py-2.5 border-b focus:outline-none" style={{borderColor:T.border,color:T.text,fontSize:'16px'}}/>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>BIO <span className="opacity-50">({editBio.length}/300)</span></label>
                    <textarea value={editBio} onChange={e=>setEditBio(e.target.value)} rows={4} maxLength={300} className="w-full bg-transparent py-2.5 border-b focus:outline-none resize-none" style={{borderColor:T.border,color:T.text,fontSize:'16px'}} placeholder="Tell your story..."/>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[9px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>AVATAR</label>
                    {profile.avatar_url&&!showCropper&&<div className="w-16 h-16 overflow-hidden border" style={{borderColor:T.border}}><img src={profile.avatar_url} alt="current" className="w-full h-full object-cover"/></div>}
                    <input type="file" accept="image/*" onChange={handleAvatarFileSelect} className="w-full text-xs" style={{color:T.muted,fontSize:'16px'}}/>
                    {showCropper&&previewUrl&&(
                      <div className="space-y-2">
                        <div className="relative w-full h-44 overflow-hidden" style={{backgroundColor:'#111'}}><Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}/></div>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="w-full"/>
                      </div>
                    )}
                  </div>
                  {imageError&&<p className="text-xs" style={{color:'#ff4444'}}>{imageError}</p>}
                  <button type="submit" disabled={saving} className="w-full py-3.5 text-[10px] tracking-[0.4em] font-black border-2 transition-all disabled:opacity-40" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:T.accent,color:T.accentText}}>{saving?'SAVING...':'SAVE PROFILE'}</button>
                </form>
              )}

              {/* ── THEME TAB ── */}
              {editTab==='theme'&&(
                <div className="space-y-3">
                  <p className="text-[9px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>CHOOSE YOUR AESTHETIC — applies instantly</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {(Object.keys(THEMES) as ThemeKey[]).map(key=>{
                      const th=THEMES[key];
                      return(
                        <button key={key} onClick={()=>applyTheme(key)} className="flex items-center gap-3 p-3.5 border-2 transition-all text-left" style={{backgroundColor:th.bg,borderColor:selectedTheme===key?th.accent:th.border}}>
                          <div className="flex gap-1">
                            <div className="w-5 h-5" style={{backgroundColor:th.bg,border:`1px solid ${th.border}`}}/>
                            <div className="w-5 h-5" style={{backgroundColor:th.surface}}/>
                            <div className="w-5 h-5" style={{backgroundColor:th.accent}}/>
                          </div>
                          <div className="flex-1">
                            <p className="text-[11px] font-black tracking-wider leading-none" style={{fontFamily:'Bebas Neue, sans-serif',color:th.text}}>{th.name}</p>
                            <p className="text-[9px] mt-0.5" style={{color:th.muted}}>{th.desc}</p>
                          </div>
                          {selectedTheme===key&&<div className="w-5 h-5 flex items-center justify-center flex-shrink-0" style={{backgroundColor:th.accent}}><svg width="9" height="9" fill="none" stroke={th.accentText} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── SOCIAL/LINKS TAB ── */}
              {editTab==='social'&&(
                <div className="space-y-4">
                  <p className="text-[9px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>SOCIAL LINKS</p>
                  {[{label:'INSTAGRAM',value:editInstagram,setter:setEditInstagram,ph:'@username'},{label:'TIKTOK',value:editTiktok,setter:setEditTiktok,ph:'@username'},{label:'WEBSITE',value:editSocialUrl,setter:setEditSocialUrl,ph:'yoursite.com'}].map(field=>(
                    <div key={field.label} className="space-y-1.5">
                      <label className="block text-[9px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{field.label}</label>
                      <input type="text" value={field.value} onChange={e=>field.setter(e.target.value)} placeholder={field.ph} className="w-full bg-transparent py-2.5 border-b focus:outline-none transition-all" style={{borderColor:T.border,color:T.text,fontSize:'16px'}}/>
                    </div>
                  ))}
                  <button onClick={async()=>{if(!currentUserId)return;setSaving(true);await supabase.from('profiles').update({social_instagram:editInstagram.trim()||null,social_tiktok:editTiktok.trim()||null,social_url:editSocialUrl.trim()||null}).eq('id',currentUserId);await loadProfile();setSaving(false);}} disabled={saving} className="w-full py-3.5 text-[10px] tracking-[0.4em] font-black border-2 transition-all disabled:opacity-40 mt-4" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:T.accent,color:T.accentText}}>{saving?'SAVING...':'SAVE LINKS'}</button>
                </div>
              )}

              {/* ── COLLAB TAB ── */}
              {editTab==='collab'&&(
                <div className="space-y-5">
                  <p className="text-[9px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>BRAND COLLABORATION STATUS</p>
                  <p className="text-xs leading-relaxed" style={{color:T.muted}}>This badge shows on your profile. Brands and visitors can see at a glance whether you're open to work.</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {([
                      {val:'open' as CollabStatus,label:'Open to collabs',sub:'Actively looking for brand deals',color:'#22c55e'},
                      {val:'selective' as CollabStatus,label:'Selective',sub:'Open to the right opportunities',color:'#eab308'},
                      {val:'closed' as CollabStatus,label:'Not available',sub:'Not taking brand deals right now',color:'#ef4444'},
                    ]).map(opt=>(
                      <button key={opt.val} onClick={()=>setEditCollabStatus(opt.val)} className="flex items-center gap-3 p-3.5 border-2 text-left transition-all" style={{backgroundColor:T.cardBg,borderColor:editCollabStatus===opt.val?opt.color:T.border}}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:opt.color}}/>
                        <div>
                          <p className="text-[11px] font-black tracking-wider" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{opt.label.toUpperCase()}</p>
                          <p className="text-[9px] mt-0.5" style={{color:T.muted}}>{opt.sub}</p>
                        </div>
                        {editCollabStatus===opt.val&&<div className="ml-auto w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0" style={{backgroundColor:opt.color}}><svg width="8" height="8" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[9px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>COLLAB TYPES (optional)</label>
                    <input type="text" value={editCollabTypes} onChange={e=>setEditCollabTypes(e.target.value)} placeholder="e.g. Paid, Gifted, Affiliate" className="w-full bg-transparent py-2.5 border-b focus:outline-none" style={{borderColor:T.border,color:T.text,fontSize:'16px'}}/>
                  </div>
                  <button onClick={async()=>{if(!currentUserId)return;setSaving(true);await supabase.from('profiles').update({collab_status:editCollabStatus,collab_types:editCollabTypes.trim()||null}).eq('id',currentUserId);await loadProfile();setSaving(false);}} disabled={saving} className="w-full py-3.5 text-[10px] tracking-[0.4em] font-black border-2 transition-all disabled:opacity-40" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:T.accent,color:T.accentText}}>{saving?'SAVING...':'SAVE STATUS'}</button>

                  {/* Media kit CTA */}
                  <div className="pt-4 border-t" style={{borderColor:T.border}}>
                    <p className="text-[9px] tracking-[0.35em] mb-3" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>MEDIA KIT</p>
                    <button onClick={()=>{navigator.clipboard.writeText(window.location.href);alert('Profile link copied! Share this URL as your media kit.');}} className="w-full py-3 text-[9px] tracking-[0.35em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,backgroundColor:'transparent'}}>
                      COPY PROFILE LINK ↗
                    </button>
                    <p className="text-[8px] mt-2 leading-relaxed" style={{color:T.muted}}>Share your profile URL directly with brands. Your stats, catalogs, and collab status are all visible.</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ITEM MODAL */}
        {expandedItem&&(
          <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.75)'}} onClick={()=>setExpandedItem(null)}>
            <div className="relative w-full md:w-auto md:min-w-[400px] md:max-w-lg bg-white shadow-2xl" style={{maxHeight:'65vh',borderRadius:'14px 14px 0 0'}} onClick={e=>e.stopPropagation()}>
              <div className="flex justify-center items-center pt-2.5 pb-2 md:hidden cursor-pointer" onClick={()=>setExpandedItem(null)} onTouchStart={e=>{const sy=e.touches[0].clientY;const om=(ev:TouchEvent)=>{if(ev.touches[0].clientY-sy>40){setExpandedItem(null);cl();}};const cl=()=>{window.removeEventListener('touchmove',om);window.removeEventListener('touchend',cl);};window.addEventListener('touchmove',om);window.addEventListener('touchend',cl);}}>
                <div className="w-10 h-1.5 bg-black/20 rounded-full"/>
              </div>
              <button onClick={()=>setExpandedItem(null)} className="absolute top-2.5 right-3 z-10 w-7 h-7 flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors text-xs font-black rounded-full" style={{fontFamily:'Bebas Neue, sans-serif'}}>✕</button>
              <div className="flex gap-0 overflow-hidden" style={{maxHeight:'calc(65vh - 28px)'}}>
                <div className="w-24 h-24 md:w-40 md:h-40 flex-shrink-0 bg-black/5 self-start m-3 mr-0"><img src={expandedItem.image_url} alt={expandedItem.title} className="w-full h-full object-cover"/></div>
                <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2">
                  <div>
                    <h2 className="text-sm md:text-base font-black tracking-tighter leading-tight pr-6" style={{fontFamily:'Archivo Black, sans-serif'}}>{expandedItem.title}</h2>
                    {expandedItem.is_monetized&&<p className="text-[8px] tracking-[0.2em] font-black mt-1" style={{fontFamily:'Bebas Neue, sans-serif'}}>$ CREATOR EARNS COMMISSION</p>}
                  </div>
                  {'seller' in expandedItem&&expandedItem.seller&&<p className="text-[8px] tracking-wider opacity-40 uppercase">Seller: {expandedItem.seller}</p>}
                  {expandedItem.price&&<p className="text-base font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>${expandedItem.price}</p>}
                  <div className="flex flex-col gap-1.5 pt-1 pb-2">
                    {expandedItem.product_url&&<button onClick={()=>window.open(expandedItem.product_url!,'_blank')} className="w-full py-2 bg-black text-white hover:bg-white hover:text-black border border-black transition-all text-[8px] tracking-[0.25em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>VIEW PRODUCT ↗</button>}
                    {'catalog_name' in expandedItem&&expandedItem.catalog_name!=='Feed Post'&&(
                      <button onClick={()=>{setExpandedItem(null);router.push(`/${'catalog_owner' in expandedItem?expandedItem.catalog_owner:profile.username}/${expandedItem.catalog_slug}`);}} className="w-full py-1.5 border border-black/15 hover:border-black/40 transition-all text-[8px] tracking-[0.2em] font-black opacity-60 hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif'}}>IN: {expandedItem.catalog_name} →</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOLLOWERS MODAL */}
        {showFollowersModal&&(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor:'rgba(0,0,0,0.8)'}} onClick={()=>setShowFollowersModal(false)}>
            <div className="w-full max-w-md max-h-[80vh] flex flex-col" style={{backgroundColor:T.bg,border:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
              <div className="p-5 flex items-center justify-between" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
                <div className="flex gap-5">
                  {(['followers','following'] as const).map(type=>(
                    <button key={type} onClick={()=>setFollowersModalType(type)} className="text-sm font-black tracking-wider transition-all" style={{fontFamily:'Bebas Neue, sans-serif',color:followersModalType===type?T.text:T.muted,background:'none',border:'none'}}>{type==='followers'?`${profile.followers_count} FOLLOWERS`:`${profile.following_count} FOLLOWING`}</button>
                  ))}
                </div>
                <button onClick={()=>setShowFollowersModal(false)} style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted,background:'none',border:'none'}} className="text-[9px] tracking-[0.35em] font-black">[ESC]</button>
              </div>
              <div className="p-4" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
                <input type="text" value={followersSearchQuery} onChange={e=>setFollowersSearchQuery(e.target.value)} placeholder="SEARCH..." className="w-full bg-transparent text-xs tracking-wider focus:outline-none" style={{color:T.text,fontSize:'16px'}}/>
              </div>
              <div className="overflow-y-auto flex-1">
                {(followersModalType==='followers'?filteredFollowers:filteredFollowing).map(user=>(
                  <div key={user.id} className="flex items-center gap-3 p-4 cursor-pointer transition-all hover:opacity-70" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}} onClick={()=>{setShowFollowersModal(false);router.push(`/@${user.username}`);}}>
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{backgroundColor:T.surface}}>
                      {user.avatar_url?<img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-sm font-black" style={{color:T.muted}}>{user.username[0].toUpperCase()}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black tracking-wide" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>@{user.username}</p>
                      {user.full_name&&<p className="text-xs truncate" style={{color:T.muted}}>{user.full_name}</p>}
                    </div>
                    <span className="text-[8px] tracking-wider flex-shrink-0" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{user.followers_count} followers</span>
                  </div>
                ))}
                {(followersModalType==='followers'?filteredFollowers:filteredFollowing).length===0&&<div className="p-8 text-center"><p className="text-xs tracking-wider" style={{color:T.muted}}>NO {followersModalType.toUpperCase()} FOUND</p></div>}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}