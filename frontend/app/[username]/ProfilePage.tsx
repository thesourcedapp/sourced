"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Cropper from 'react-easy-crop';

type Point = { x: number; y: number };
type Area = { x: number; y: number; width: number; height: number };

type ThemeKey = 'opium' | 'bone' | 'slate' | 'blush' | 'void' | 'chrome' | 'forest';
type Theme = { name: string; bg: string; surface: string; border: string; text: string; muted: string; accent: string; accentText: string; cardBg: string; };

const THEMES: Record<ThemeKey, Theme> = {
  opium:  { name:'OPIUM',  bg:'#0a0a0a', surface:'#111',    border:'#222',    text:'#fff',   muted:'#555',   accent:'#fff',    accentText:'#000', cardBg:'#151515' },
  bone:   { name:'BONE',   bg:'#f5f0e8', surface:'#ede8de', border:'#d4cfc4', text:'#1a1714',muted:'#8a8278',accent:'#1a1714', accentText:'#f5f0e8', cardBg:'#ede8de' },
  slate:  { name:'SLATE',  bg:'#0f1117', surface:'#161a24', border:'#252d3d', text:'#e8eaf2',muted:'#4a5268',accent:'#4f6ef7', accentText:'#fff', cardBg:'#1c2030' },
  blush:  { name:'BLUSH',  bg:'#fdf6f0', surface:'#f9ede4', border:'#e8d5c8', text:'#2a1a14',muted:'#9a7a6e',accent:'#c4614a', accentText:'#fff', cardBg:'#f4e4da' },
  void:   { name:'VOID',   bg:'#000',    surface:'#0a0a0a', border:'#1a1a1a', text:'#fff',   muted:'#333',   accent:'#ff3366', accentText:'#fff', cardBg:'#0d0d0d' },
  chrome: { name:'CHROME', bg:'#f0f0f0', surface:'#e8e8e8', border:'#c8c8c8', text:'#111',   muted:'#777',   accent:'#111',    accentText:'#f0f0f0', cardBg:'#e4e4e4' },
  forest: { name:'FOREST', bg:'#0d1a0f', surface:'#111f13', border:'#1a2e1c', text:'#e8f0e8',muted:'#3d5c40',accent:'#4caf66', accentText:'#000', cardBg:'#152117' },
};

type ProfileData = {
  id: string; username: string; full_name: string | null; avatar_url: string | null;
  bio: string | null; banner_url: string | null; theme: ThemeKey | null;
  social_instagram: string | null; social_tiktok: string | null; social_url: string | null;
  followers_count: number; following_count: number; is_following?: boolean;
};
type UserCatalog = { id: string; name: string; description: string | null; image_url: string | null; created_at: string; item_count: number; bookmark_count: number; slug: string; owner_username: string; is_pinned?: boolean; };
type CatalogItem = { id: string; title: string; image_url: string; product_url: string | null; price: string | null; seller: string | null; catalog_id: string; catalog_name: string; catalog_slug: string; like_count: number; is_monetized: boolean; };
type BookmarkedCatalog = { id: string; name: string; description: string | null; image_url: string | null; bookmark_count: number; username: string; full_name: string | null; item_count: number; created_at: string; slug: string; };
type LikedItem = { id: string; title: string; image_url: string; product_url: string | null; price: string | null; seller: string | null; catalog_id: string; catalog_name: string; catalog_owner: string; catalog_slug: string; like_count: number; created_at: string; is_monetized: boolean; };
type FeedPost = { id: string; image_url: string; caption: string | null; like_count: number; comment_count: number; created_at: string; is_pinned?: boolean; };
type SavedPost = { id: string; image_url: string; caption: string | null; like_count: number; comment_count: number; created_at: string; saved_at: string; };
type FollowUser = { id: string; username: string; full_name: string | null; avatar_url: string | null; followers_count: number; following_count: number; created_at: string; };

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
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No 2d context')); return; }
      canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Canvas empty')); }, 'image/jpeg', 0.95);
    };
    image.onerror = reject;
  });
}

function EmptyState({ text, theme }: { text: string; theme: Theme }) {
  return (
    <div className="text-center py-24">
      <p className="text-2xl font-black tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif', color: theme.muted, opacity: 0.4 }}>{text}</p>
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
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'catalogs'|'items'|'posts'|'bookmarks'|'liked'|'saved'>('catalogs');
  const [expandedItem, setExpandedItem] = useState<CatalogItem | LikedItem | null>(null);

  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState(false);
  const [customizeTab, setCustomizeTab] = useState<'theme'|'banner'|'social'|'profile'>('theme');

  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editSocialUrl, setEditSocialUrl] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('opium');
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
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
  useEffect(() => { if (profileId) { loadUserCatalogs(); loadAllItems(); loadBookmarkedCatalogs(); loadLikedItems(); loadFeedPosts(); if (isOwner) loadSavedPosts(); loadFollowers(); loadFollowing(); } }, [profileId, isOwner]);
  useEffect(() => { if (currentUserId && username) loadProfile(); }, [currentUserId, username]);

  async function loadCurrentUser() { const { data: { user } } = await supabase.auth.getUser(); setCurrentUserId(user?.id || null); }

  async function loadProfile() {
    if (!username) return;
    try {
      const { data, error } = await supabase.from('profiles').select('id,username,full_name,avatar_url,bio,banner_url,theme,social_instagram,social_tiktok,social_url,followers_count,following_count').eq('username', username).single();
      if (!error && data) {
        setProfileId(data.id);
        let p = { ...data, is_following: false };
        if (currentUserId && currentUserId !== data.id) { const { data: fd } = await supabase.from('followers').select('id').eq('follower_id', currentUserId).eq('following_id', data.id).single(); p.is_following = !!fd; }
        setProfile(p); setEditFullName(data.full_name||''); setEditBio(data.bio||''); setEditAvatarUrl(data.avatar_url||''); setEditInstagram(data.social_instagram||''); setEditTiktok(data.social_tiktok||''); setEditSocialUrl(data.social_url||''); setSelectedTheme((data.theme as ThemeKey)||'opium');
      }
    } catch(e){console.error(e);} finally{setLoading(false);}
  }

  async function loadUserCatalogs() {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.from('catalogs').select('id,name,description,image_url,created_at,bookmark_count,slug,owner_id,is_pinned,profiles!catalogs_owner_id_fkey(username),catalog_items(count)').eq('owner_id', profileId).eq('visibility','public').order('is_pinned',{ascending:false}).order('created_at',{ascending:false});
      if (!error && data) setCatalogs(data.map(c => { const owner = Array.isArray(c.profiles)?c.profiles[0]:c.profiles; return {...c, item_count:c.catalog_items?.[0]?.count||0, bookmark_count:c.bookmark_count||0, owner_username:owner?.username||'unknown', is_pinned:c.is_pinned||false}; }));
    } catch(e){console.error(e);}
  }

  async function loadAllItems() {
    if (!profileId) return;
    try {
      const { data: catalogData } = await supabase.from('catalogs').select('id,name,slug').eq('owner_id',profileId).eq('visibility','public');
      if (!catalogData||catalogData.length===0){setAllItems([]);return;}
      const catalogMap = new Map(catalogData.map(c=>[c.id,c]));
      const { data: items, error } = await supabase.from('catalog_items').select('id,title,image_url,product_url,price,seller,catalog_id,like_count,is_monetized').in('catalog_id',catalogData.map(c=>c.id)).order('created_at',{ascending:false});
      if (!error && items) setAllItems(items.map(item => { const cat=catalogMap.get(item.catalog_id); return {...item, catalog_name:cat?.name||'Unknown', catalog_slug:cat?.slug||'', like_count:item.like_count||0, is_monetized:item.is_monetized||false}; }));
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

  async function handleBannerUpload(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];if(!file||!currentUserId)return;setBannerUploading(true);
    try { const result=await uploadToStorage(file,'banners',currentUserId,'banner');if(result.url){await supabase.from('profiles').update({banner_url:result.url}).eq('id',currentUserId);await loadProfile();} } finally{setBannerUploading(false);}
  }

  async function applyTheme(t:ThemeKey) { setSelectedTheme(t);if(currentUserId){await supabase.from('profiles').update({theme:t}).eq('id',currentUserId);await loadProfile();} }

  async function saveCustomizeProfile(e:React.FormEvent) {
    e.preventDefault();if(!currentUserId)return;setSaving(true);setImageError('');
    try {
      let finalAvatarUrl=editAvatarUrl;
      if(selectedFile&&previewUrl&&croppedAreaPixels){
        const blob=await getCroppedImg(previewUrl,croppedAreaPixels);const croppedFile=new File([blob],selectedFile.name,{type:'image/jpeg'});
        const res=await uploadToStorage(croppedFile,'avatars',currentUserId,'avatar');if(!res.url){setImageError(res.error||'Upload failed');setSaving(false);return;}finalAvatarUrl=res.url;
        try{const ctrl=new AbortController();const tid=setTimeout(()=>ctrl.abort(),10000);const mod=await fetch('/api/check-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_url:finalAvatarUrl}),signal:ctrl.signal});clearTimeout(tid);if(mod.ok){const d=await mod.json();if(d.safe===false){setImageError('Inappropriate content');setSaving(false);return;}}}catch{}
      }
      await supabase.from('profiles').update({full_name:editFullName.trim()||null,bio:editBio.trim()||null,avatar_url:finalAvatarUrl.trim()||null,social_instagram:editInstagram.trim()||null,social_tiktok:editTiktok.trim()||null,social_url:editSocialUrl.trim()||null}).eq('id',currentUserId);
      await loadProfile();setShowCustomizeDrawer(false);setShowCropper(false);
    } catch(e){console.error(e);alert('Failed to save');} finally{setSaving(false);}
  }

  async function handleAvatarFileSelect(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){setImageError('Please select an image file');return;}
    setSelectedFile(file);setImageError('');const reader=new FileReader();reader.onload=ev=>{setPreviewUrl(ev.target?.result as string);setShowCropper(true);};reader.readAsDataURL(file);
  }

  const onCropComplete=(_:Area,cap:Area)=>{setCroppedAreaPixels(cap);};

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
        .catalog-card{transition:transform 0.2s ease;}
        .catalog-card:hover{transform:translateY(-4px);}
        .item-img{transition:transform 0.3s ease;}
        .item-card:hover .item-img{transform:scale(1.05);}
        .reveal-overlay{opacity:0;transition:opacity 0.2s ease;}
        .overlay-fade:hover .reveal-overlay{opacity:1;}
        .drawer-slide{transform:translateX(100%);transition:transform 0.3s ease;}
        .drawer-slide.open{transform:translateX(0);}
        .tab-ul::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--ta);transform:scaleX(0);transition:transform 0.2s ease;}
        .tab-ul.tab-active::after{transform:scaleX(1);}
      `}</style>
      <style>{`:root{--ta:${T.accent};}`}</style>

      <div style={{backgroundColor:T.bg,color:T.text,minHeight:'100vh'}}>

        {/* BACK */}
        <div className="px-6 md:px-10 pt-5">
          <button onClick={()=>router.back()} className="text-[10px] tracking-[0.35em] font-black opacity-30 hover:opacity-100 transition-opacity" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>← BACK</button>
        </div>

        {/* BANNER */}
        <div className="relative w-full" style={{height:'220px',overflow:'hidden'}}>
          {profile.banner_url
            ? <img src={profile.banner_url} alt="banner" className="w-full h-full object-cover"/>
            : <div className="w-full h-full flex items-center justify-center" style={{backgroundColor:T.surface}}>
                <svg width="100%" height="100%" style={{position:'absolute',inset:0,opacity:0.07}}><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke={T.text} strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
                {isOwner&&<button onClick={()=>{setShowCustomizeDrawer(true);setCustomizeTab('banner');}} className="relative z-10 px-5 py-2.5 text-[10px] tracking-[0.4em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,backgroundColor:'transparent'}}>+ ADD BANNER</button>}
              </div>
          }
          <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{background:`linear-gradient(to bottom, transparent, ${T.bg})`}}/>
          {isOwner&&profile.banner_url&&<button onClick={()=>{setShowCustomizeDrawer(true);setCustomizeTab('banner');}} className="absolute top-3 right-3 px-3 py-1.5 text-[9px] tracking-[0.3em] font-black border backdrop-blur-sm opacity-70 hover:opacity-100 transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:'rgba(255,255,255,0.3)',color:'#fff',backgroundColor:'rgba(0,0,0,0.4)'}}>CHANGE BANNER</button>}
        </div>

        {/* HERO */}
        <div className="px-6 md:px-10 pb-10" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start -mt-12 md:-mt-16">

              {/* Avatar */}
              <div className="flex-shrink-0 z-10">
                <div className="w-28 h-28 md:w-36 md:h-36 overflow-hidden border-4" style={{borderColor:T.bg,backgroundColor:T.surface}}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center" style={{backgroundColor:T.surface}}><span className="text-5xl opacity-20" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{profile.username[0].toUpperCase()}</span></div>
                  }
                </div>
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0 pt-2 space-y-4">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                  <div>
                    {profile.full_name&&<p className="text-[10px] tracking-[0.45em] mb-1.5 font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{profile.full_name}</p>}
                    <h1 className="text-5xl md:text-[72px] font-black tracking-tighter leading-none" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>@{profile.username}</h1>
                  </div>
                  <div className="flex gap-2 mt-1 md:mt-4 flex-wrap">
                    <button onClick={handleShareProfile} className="px-4 py-2 text-[10px] tracking-[0.35em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,backgroundColor:'transparent'}}>{showShareCopied?'COPIED!':'SHARE'}</button>
                    {isOwner
                      ? <button onClick={()=>setShowCustomizeDrawer(true)} className="px-4 py-2 text-[10px] tracking-[0.35em] font-black border-2 transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,color:T.accent,backgroundColor:'transparent'}}>CUSTOMIZE</button>
                      : currentUserId
                        ? <button onClick={toggleFollow} className="px-5 py-2 text-[10px] tracking-[0.35em] font-black border-2 transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:profile.is_following?'transparent':T.accent,color:profile.is_following?T.accent:T.accentText}}>{profile.is_following?'FOLLOWING':'FOLLOW'}</button>
                        : null
                    }
                  </div>
                </div>

                {profile.bio&&<p className="text-sm leading-relaxed max-w-xl" style={{color:T.muted}}>{linkifyBio(profile.bio)}</p>}

                {/* Social links */}
                {(profile.social_instagram||profile.social_tiktok||profile.social_url)&&(
                  <div className="flex flex-wrap gap-2">
                    {profile.social_instagram&&(
                      <a href={`https://instagram.com/${profile.social_instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.25em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,textDecoration:'none'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.text;(e.currentTarget as HTMLAnchorElement).style.color=T.text;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.border;(e.currentTarget as HTMLAnchorElement).style.color=T.muted;}}>
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        @{profile.social_instagram.replace('@','')}
                      </a>
                    )}
                    {profile.social_tiktok&&(
                      <a href={`https://tiktok.com/@${profile.social_tiktok.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.25em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,textDecoration:'none'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.text;(e.currentTarget as HTMLAnchorElement).style.color=T.text;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.border;(e.currentTarget as HTMLAnchorElement).style.color=T.muted;}}>
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                        @{profile.social_tiktok.replace('@','')}
                      </a>
                    )}
                    {profile.social_url&&(
                      <a href={profile.social_url.startsWith('http')?profile.social_url:`https://${profile.social_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.25em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,textDecoration:'none'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.text;(e.currentTarget as HTMLAnchorElement).style.color=T.text;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.borderColor=T.border;(e.currentTarget as HTMLAnchorElement).style.color=T.muted;}}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        {profile.social_url.replace(/^https?:\/\//,'').split('/')[0]}
                      </a>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-0 pt-1 flex-wrap">
                  {[
                    {label:'FOLLOWERS',value:profile.followers_count,onClick:()=>{setFollowersModalType('followers');setFollowersSearchQuery('');setShowFollowersModal(true);}},
                    {label:'FOLLOWING',value:profile.following_count,onClick:()=>{setFollowersModalType('following');setFollowersSearchQuery('');setShowFollowersModal(true);}},
                    {label:'CATALOGS',value:catalogs.length,onClick:undefined},
                    {label:'ITEMS',value:allItems.length,onClick:undefined},
                  ].map((stat,i)=>(
                    <div key={i} className="flex items-center">
                      {i>0&&<div className="w-px h-7 mx-6" style={{backgroundColor:T.border}}/>}
                      <button onClick={stat.onClick||undefined} className="text-left group" style={{cursor:stat.onClick?'pointer':'default',background:'none',border:'none'}}>
                        <span className="block text-2xl md:text-3xl font-black tracking-tighter leading-none" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>{stat.value}</span>
                        <span className="block text-[9px] tracking-[0.35em] mt-1 opacity-40 group-hover:opacity-80 transition-opacity" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{stat.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURED */}
        {hasPinned&&(
          <div className="px-6 md:px-10 py-10" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
            <div className="max-w-7xl mx-auto">
              <div className="flex items-baseline gap-4 mb-7">
                <h2 className="text-xs tracking-[0.5em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>FEATURED</h2>
                <div className="flex-1 h-px" style={{backgroundColor:T.border}}/>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {pinnedCatalogs.map(catalog=>(
                  <div key={catalog.id} className="overlay-fade cursor-pointer relative group" onClick={()=>router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                    <div className="relative overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface,border:`1px solid ${T.border}`}}>
                      {catalog.image_url?<img src={catalog.image_url} alt={catalog.name} className="item-img w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-10" style={{color:T.text}}>✦</span></div>}
                      <div className="reveal-overlay absolute inset-0 flex flex-col justify-end p-4" style={{background:'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)'}}><p className="text-white text-[10px] tracking-[0.3em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>SHOP CATALOG →</p></div>
                    </div>
                    <div className="pt-3"><p className="text-sm font-black tracking-wide uppercase truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{catalog.name}</p><p className="text-[10px] tracking-wider mt-0.5" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{catalog.item_count} ITEMS</p></div>
                    {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinCatalog(catalog.id);}} className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black tracking-wider border transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:'rgba(0,0,0,0.7)',borderColor:'rgba(255,255,255,0.3)',color:'#fff'}}>UNPIN</button>}
                  </div>
                ))}
                {pinnedPosts.map(post=>(
                  <div key={post.id} className="overlay-fade cursor-pointer relative group" onClick={()=>router.push(`/post/${post.id}`)}>
                    <div className="relative overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface,border:`1px solid ${T.border}`}}>
                      <img src={post.image_url} alt="" className="item-img w-full h-full object-cover"/>
                      <div className="reveal-overlay absolute inset-0 flex flex-col justify-end p-4" style={{background:'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)'}}><p className="text-white text-[10px] tracking-[0.3em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>VIEW POST →</p></div>
                    </div>
                    <div className="pt-3">{post.caption?<p className="text-sm font-black tracking-wide uppercase truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{post.caption}</p>:<p className="text-sm font-black tracking-wide uppercase opacity-30" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>POST</p>}<p className="text-[10px] tracking-wider mt-0.5" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>♥ {post.like_count}</p></div>
                    {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinPost(post.id);}} className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black tracking-wider border transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:'rgba(0,0,0,0.7)',borderColor:'rgba(255,255,255,0.3)',color:'#fff'}}>UNPIN</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="sticky top-0 z-20" style={{backgroundColor:T.bg,borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              {tabs.map(tab=>(
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                  className={`tab-ul relative py-4 px-5 md:px-6 text-[11px] tracking-[0.3em] font-black whitespace-nowrap transition-all${activeTab===tab.id?' tab-active':''}`}
                  style={{fontFamily:'Bebas Neue, sans-serif',color:activeTab===tab.id?T.text:T.muted,backgroundColor:'transparent',border:'none'}}>
                  {tab.label}<span className="ml-2 opacity-40">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* TAB CONTENT */}
        <div className="px-6 md:px-10 py-10">
          <div className="max-w-7xl mx-auto">

            {/* CATALOGS */}
            {activeTab==='catalogs'&&(catalogs.length===0?<EmptyState text="NO CATALOGS YET" theme={T}/>:
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {catalogs.map((catalog,i)=>(
                  <div key={catalog.id} className="catalog-card group relative cursor-pointer" style={{border:`1px solid ${T.border}`,backgroundColor:T.cardBg}} onClick={()=>router.push(`/${catalog.owner_username}/${catalog.slug}`)}>
                    {catalog.is_pinned&&<div className="absolute top-0 left-0 z-10 px-3 py-1 text-[9px] tracking-[0.3em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:T.accent,color:T.accentText}}>FEATURED</div>}
                    {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinCatalog(catalog.id);}} className="absolute top-2 right-2 z-10 px-2 py-0.5 text-[9px] font-black tracking-wider border transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue, sans-serif',backgroundColor:T.surface,borderColor:T.border,color:T.muted}}>{catalog.is_pinned?'UNPIN':'PIN'}</button>}
                    {/* Fixed image with 4:3 ratio */}
                    <div className="relative overflow-hidden" style={{width:'100%',paddingBottom:'75%',backgroundColor:T.surface}}>
                      <div className="absolute inset-0">
                        {catalog.image_url?<img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"/>:<div className="w-full h-full flex items-center justify-center"><span className="text-6xl opacity-10" style={{color:T.text}}>✦</span></div>}
                      </div>
                    </div>
                    <div className="p-5" style={{borderTopColor:T.border,borderTopWidth:1,borderTopStyle:'solid'}}>
                      <p className="text-[9px] tracking-[0.4em] mb-2 font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{String(i+1).padStart(2,'0')} / CATALOG</p>
                      <h3 className="text-xl font-black tracking-tight uppercase leading-tight mb-2" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>{catalog.name}</h3>
                      {catalog.description&&<p className="text-xs leading-relaxed line-clamp-2 mb-4" style={{color:T.muted}}>{catalog.description}</p>}
                      <div className="flex items-center justify-between text-[10px] tracking-[0.3em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}><span>{catalog.item_count} ITEMS</span><span>🔖 {catalog.bookmark_count}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SHOP - all items */}
            {activeTab==='items'&&(allItems.length===0?<EmptyState text="NO ITEMS YET" theme={T}/>:
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {allItems.map(item=>(
                  <div key={item.id} className="item-card group cursor-pointer" style={{border:`1px solid ${T.border}`,backgroundColor:T.cardBg}} onClick={()=>setExpandedItem(item)}>
                    <div className="relative overflow-hidden" style={{paddingBottom:'100%',backgroundColor:T.surface}}>
                      <div className="absolute inset-0">
                        <img src={item.image_url} alt={item.title} className="item-img w-full h-full object-cover" loading="lazy"/>
                        {item.is_monetized&&<div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.4)'}}><span className="text-[9px] font-black text-white" style={{fontFamily:'Bebas Neue, sans-serif'}}>$</span></div>}
                      </div>
                    </div>
                    <div className="p-3" style={{borderTopColor:T.border,borderTopWidth:1,borderTopStyle:'solid'}}>
                      <p className="text-[11px] font-black tracking-wide uppercase leading-tight truncate mb-1" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{item.title}</p>
                      <div className="flex items-center justify-between text-[9px] tracking-wider mb-1.5" style={{color:T.muted}}>{item.seller&&<span className="truncate mr-2">{item.seller}</span>}{item.price&&<span className="flex-shrink-0 font-black">${item.price}</span>}</div>
                      <p className="text-[9px] tracking-wider truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>↳ {item.catalog_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* POSTS */}
            {activeTab==='posts'&&(feedPosts.length===0?<EmptyState text="NO POSTS YET" theme={T}/>:
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {feedPosts.map(post=>(
                  <div key={post.id} className="overlay-fade relative group cursor-pointer overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface}} onClick={()=>router.push(`/post/${post.id}`)}>
                    {post.is_pinned&&<div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[8px] tracking-widest font-black" style={{fontFamily:'Bebas Neue',backgroundColor:T.accent,color:T.accentText}}>FEATURED</div>}
                    {isOwner&&<button onClick={e=>{e.stopPropagation();togglePinPost(post.id);}} className="absolute top-2 right-2 z-10 px-2 py-0.5 text-[8px] font-black tracking-wider transition-all opacity-0 group-hover:opacity-100" style={{fontFamily:'Bebas Neue',backgroundColor:'rgba(0,0,0,0.7)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)'}}>{post.is_pinned?'UNPIN':'PIN'}</button>}
                    <img src={post.image_url} alt="" className="item-img w-full h-full object-cover"/>
                    <div className="reveal-overlay absolute inset-0 flex items-center justify-center gap-5" style={{backgroundColor:'rgba(0,0,0,0.55)'}}>
                      <span className="text-white text-sm font-black" style={{fontFamily:'Bebas Neue'}}>♥ {post.like_count}</span>
                      <span className="text-white text-sm font-black" style={{fontFamily:'Bebas Neue'}}>💬 {post.comment_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ARCHIVE */}
            {activeTab==='saved'&&isOwner&&(savedPosts.length===0?<EmptyState text="NOTHING ARCHIVED" theme={T}/>:
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {savedPosts.map(post=>(
                  <div key={post.id} className="overlay-fade relative group cursor-pointer overflow-hidden" style={{aspectRatio:'3/4',backgroundColor:T.surface}} onClick={()=>router.push(`/post/${post.id}`)}>
                    <img src={post.image_url} alt="" className="item-img w-full h-full object-cover"/>
                    <div className="reveal-overlay absolute inset-0 flex items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.55)'}}><span className="text-white text-sm font-black" style={{fontFamily:'Bebas Neue'}}>♥ {post.like_count}</span></div>
                  </div>
                ))}
              </div>
            )}

            {/* SAVED (bookmarks) */}
            {activeTab==='bookmarks'&&(bookmarkedCatalogs.length===0?<EmptyState text="NO SAVED CATALOGS" theme={T}/>:
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {bookmarkedCatalogs.map(catalog=>(
                  <div key={catalog.id} className="group cursor-pointer" onClick={()=>router.push(`/${catalog.username}/${catalog.slug}`)}>
                    <div className="relative overflow-hidden" style={{paddingBottom:'100%',backgroundColor:T.surface,border:`1px solid ${T.border}`}}>
                      <div className="absolute inset-0">{catalog.image_url?<img src={catalog.image_url} alt={catalog.name} className="item-img w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-10" style={{color:T.text}}>✦</span></div>}</div>
                    </div>
                    <div className="pt-3"><p className="text-sm font-black tracking-wide uppercase truncate" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{catalog.name}</p><p className="text-[10px] tracking-wider mt-0.5" style={{color:T.muted}}>@{catalog.username} · {catalog.item_count} items</p></div>
                  </div>
                ))}
              </div>
            )}

            {/* LIKED */}
            {activeTab==='liked'&&(likedItems.length===0?<EmptyState text="NO LIKED ITEMS" theme={T}/>:
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {likedItems.map(item=>(
                  <div key={item.id} className="item-card group cursor-pointer" style={{border:`1px solid ${T.border}`,backgroundColor:T.cardBg}} onClick={()=>setExpandedItem(item)}>
                    <div className="relative overflow-hidden" style={{paddingBottom:'100%',backgroundColor:T.surface}}>
                      <div className="absolute inset-0">
                        <img src={item.image_url} alt={item.title} className="item-img w-full h-full object-cover" loading="lazy"/>
                        {item.is_monetized&&<div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.4)'}}><span className="text-[9px] font-black text-white" style={{fontFamily:'Bebas Neue, sans-serif'}}>$</span></div>}
                      </div>
                    </div>
                    <div className="p-3" style={{borderTopColor:T.border,borderTopWidth:1,borderTopStyle:'solid'}}>
                      <p className="text-[11px] font-black tracking-wide uppercase leading-tight truncate mb-1" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>{item.title}</p>
                      <div className="flex items-center justify-between text-[9px] tracking-wider" style={{color:T.muted}}>{item.seller&&<span className="truncate mr-2">{item.seller}</span>}{item.price&&<span className="flex-shrink-0 font-black">${item.price}</span>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
        {/* CUSTOMIZE DRAWER */}
        <div className="fixed inset-0 z-50 pointer-events-none" style={{visibility:showCustomizeDrawer?'visible':'hidden'}}>
          <div className="absolute inset-0 transition-opacity duration-300" style={{backgroundColor:'rgba(0,0,0,0.6)',opacity:showCustomizeDrawer?1:0,pointerEvents:showCustomizeDrawer?'auto':'none'}} onClick={()=>setShowCustomizeDrawer(false)}/>
          <div className={`drawer-slide${showCustomizeDrawer?' open':''} absolute right-0 top-0 bottom-0 w-full max-w-sm overflow-y-auto`} style={{backgroundColor:T.bg,borderLeft:`1px solid ${T.border}`,pointerEvents:'auto'}}>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tighter" style={{fontFamily:'Archivo Black, sans-serif',color:T.text}}>CUSTOMIZE</h2>
                <button onClick={()=>setShowCustomizeDrawer(false)} className="text-[10px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted,backgroundColor:'transparent',border:'none'}}>[ESC]</button>
              </div>
              <div className="flex gap-0 border-b" style={{borderColor:T.border}}>
                {(['theme','banner','social','profile'] as const).map(t=>(
                  <button key={t} onClick={()=>setCustomizeTab(t)} className="py-2.5 px-4 text-[10px] tracking-[0.3em] font-black transition-all" style={{fontFamily:'Bebas Neue, sans-serif',color:customizeTab===t?T.text:T.muted,borderBottom:customizeTab===t?`2px solid ${T.accent}`:'2px solid transparent',backgroundColor:'transparent',border:customizeTab===t?undefined:'none',borderBottomWidth:'2px',borderBottomStyle:'solid',borderBottomColor:customizeTab===t?T.accent:'transparent'}}>{t.toUpperCase()}</button>
                ))}
              </div>

              {/* Theme picker */}
              {customizeTab==='theme'&&(
                <div className="space-y-4">
                  <p className="text-[10px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>CHOOSE YOUR AESTHETIC</p>
                  <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(THEMES) as ThemeKey[]).map(key=>{
                      const th=THEMES[key];
                      return(
                        <button key={key} onClick={()=>applyTheme(key)} className="flex items-center gap-4 p-4 border-2 transition-all text-left" style={{backgroundColor:th.bg,borderColor:selectedTheme===key?th.accent:th.border}}>
                          <div className="flex gap-1.5">
                            <div className="w-4 h-4" style={{backgroundColor:th.bg,border:`1px solid ${th.border}`}}/>
                            <div className="w-4 h-4" style={{backgroundColor:th.surface}}/>
                            <div className="w-4 h-4" style={{backgroundColor:th.accent}}/>
                          </div>
                          <div>
                            <p className="text-xs font-black tracking-wider" style={{fontFamily:'Bebas Neue, sans-serif',color:th.text}}>{th.name}</p>
                            <p className="text-[9px] tracking-wider" style={{color:th.muted}}>{key==='opium'?'Dark, editorial, minimal':key==='bone'?'Warm off-white, refined':key==='slate'?'Blue-dark, modern':key==='blush'?'Warm terracotta, organic':key==='void'?'Pitch black, red accent':key==='chrome'?'Clean silver, industrial':'Deep green, natural'}</p>
                          </div>
                          {selectedTheme===key&&<div className="ml-auto w-5 h-5 flex items-center justify-center" style={{backgroundColor:th.accent}}><svg width="10" height="10" fill="none" stroke={th.accentText} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Banner */}
              {customizeTab==='banner'&&(
                <div className="space-y-5">
                  <p className="text-[10px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>PROFILE BANNER</p>
                  {profile.banner_url&&<div className="w-full overflow-hidden" style={{aspectRatio:'3/1',border:`1px solid ${T.border}`}}><img src={profile.banner_url} alt="banner" className="w-full h-full object-cover"/></div>}
                  <input type="file" id="banner-upload" accept="image/*" className="hidden" ref={bannerInputRef} onChange={handleBannerUpload}/>
                  <button onClick={()=>bannerInputRef.current?.click()} disabled={bannerUploading} className="w-full py-4 text-[10px] tracking-[0.4em] font-black border-2 transition-all disabled:opacity-40" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,color:T.accent,backgroundColor:'transparent'}}>{bannerUploading?'UPLOADING...':profile.banner_url?'REPLACE BANNER':'UPLOAD BANNER'}</button>
                  <p className="text-[9px] tracking-wider" style={{color:T.muted}}>Recommended: 1500×500px. JPG or PNG.</p>
                  {profile.banner_url&&<button onClick={async()=>{await supabase.from('profiles').update({banner_url:null}).eq('id',currentUserId!);await loadProfile();}} className="w-full py-3 text-[10px] tracking-[0.35em] font-black border transition-all" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.border,color:T.muted,backgroundColor:'transparent'}}>REMOVE BANNER</button>}
                </div>
              )}

              {/* Social */}
              {customizeTab==='social'&&(
                <div className="space-y-5">
                  <p className="text-[10px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>SOCIAL LINKS</p>
                  {[{label:'INSTAGRAM',value:editInstagram,setter:setEditInstagram,ph:'@username'},{label:'TIKTOK',value:editTiktok,setter:setEditTiktok,ph:'@username'},{label:'WEBSITE / LINK',value:editSocialUrl,setter:setEditSocialUrl,ph:'yoursite.com'}].map(field=>(
                    <div key={field.label} className="space-y-2">
                      <label className="block text-[10px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{field.label}</label>
                      <input type="text" value={field.value} onChange={e=>field.setter(e.target.value)} placeholder={field.ph} className="w-full bg-transparent py-2.5 border-b focus:outline-none transition-all" style={{borderColor:T.border,color:T.text,fontSize:'16px'}}/>
                    </div>
                  ))}
                  <button onClick={async()=>{if(!currentUserId)return;setSaving(true);await supabase.from('profiles').update({social_instagram:editInstagram.trim()||null,social_tiktok:editTiktok.trim()||null,social_url:editSocialUrl.trim()||null}).eq('id',currentUserId);await loadProfile();setSaving(false);}} disabled={saving} className="w-full py-4 text-[10px] tracking-[0.4em] font-black border-2 transition-all disabled:opacity-40" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:T.accent,color:T.accentText}}>{saving?'SAVING...':'SAVE LINKS'}</button>
                </div>
              )}

              {/* Profile info */}
              {customizeTab==='profile'&&(
                <form onSubmit={saveCustomizeProfile} className="space-y-5">
                  <p className="text-[10px] tracking-[0.35em]" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>PROFILE INFO</p>
                  <div className="space-y-2">
                    <label className="block text-[10px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>DISPLAY NAME</label>
                    <input type="text" value={editFullName} onChange={e=>setEditFullName(e.target.value)} className="w-full bg-transparent py-2.5 border-b focus:outline-none" style={{borderColor:T.border,color:T.text,fontSize:'16px'}}/>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>BIO</label>
                    <textarea value={editBio} onChange={e=>setEditBio(e.target.value)} rows={4} maxLength={300} className="w-full bg-transparent py-2.5 border-b focus:outline-none resize-none" style={{borderColor:T.border,color:T.text,fontSize:'16px'}} placeholder="Tell your story..."/>
                    <p className="text-[9px] tracking-wider" style={{color:T.muted}}>{editBio.length}/300</p>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>AVATAR</label>
                    {profile.avatar_url&&!showCropper&&<div className="w-20 h-20 overflow-hidden border" style={{borderColor:T.border}}><img src={profile.avatar_url} alt="Current" className="w-full h-full object-cover"/></div>}
                    <input type="file" accept="image/*" onChange={handleAvatarFileSelect} className="w-full text-xs" style={{color:T.muted,fontSize:'16px'}}/>
                    {showCropper&&previewUrl&&(
                      <div className="space-y-3">
                        <div className="relative w-full h-48 overflow-hidden" style={{backgroundColor:'#111'}}><Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}/></div>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="w-full"/>
                      </div>
                    )}
                  </div>
                  {imageError&&<p className="text-xs" style={{color:'#ff4444'}}>{imageError}</p>}
                  <button type="submit" disabled={saving} className="w-full py-4 text-[10px] tracking-[0.4em] font-black border-2 transition-all disabled:opacity-40" style={{fontFamily:'Bebas Neue, sans-serif',borderColor:T.accent,backgroundColor:T.accent,color:T.accentText}}>{saving?'SAVING...':'SAVE PROFILE'}</button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ITEM MODAL */}
        {expandedItem&&(
          <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.75)'}} onClick={()=>setExpandedItem(null)}>
            <div className="relative w-full md:w-auto md:min-w-[400px] md:max-w-lg bg-white shadow-2xl" style={{maxHeight:'65vh',borderRadius:'14px 14px 0 0'}} onClick={e=>e.stopPropagation()}>
              <div className="flex justify-center items-center pt-2.5 pb-2 md:hidden cursor-pointer" onClick={()=>setExpandedItem(null)}
                onTouchStart={e=>{const startY=e.touches[0].clientY;const onMove=(ev:TouchEvent)=>{if(ev.touches[0].clientY-startY>40){setExpandedItem(null);cleanup();}};const cleanup=()=>{window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',cleanup);};window.addEventListener('touchmove',onMove);window.addEventListener('touchend',cleanup);}}>
                <div className="w-10 h-1.5 bg-black/20 rounded-full"/>
              </div>
              <button onClick={()=>setExpandedItem(null)} className="absolute top-2.5 right-3 z-10 w-7 h-7 flex items-center justify-center bg-black/8 hover:bg-black/15 transition-colors text-xs font-black rounded-full" style={{fontFamily:'Bebas Neue, sans-serif'}}>✕</button>
              <div className="flex gap-0 overflow-hidden" style={{maxHeight:'calc(65vh - 28px)'}}>
                <div className="w-24 h-24 md:w-40 md:h-40 flex-shrink-0 bg-black/5 self-start m-3 mr-0"><img src={expandedItem.image_url} alt={expandedItem.title} className="w-full h-full object-cover"/></div>
                <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2">
                  <div>
                    <h2 className="text-sm md:text-lg font-black tracking-tighter leading-tight pr-6" style={{fontFamily:'Archivo Black, sans-serif'}}>{expandedItem.title}</h2>
                    {expandedItem.is_monetized&&<p className="text-[9px] tracking-[0.2em] font-black mt-1" style={{fontFamily:'Bebas Neue, sans-serif'}}>$ CREATOR EARNS COMMISSION</p>}
                  </div>
                  {'seller' in expandedItem&&expandedItem.seller&&<p className="text-[9px] tracking-wider opacity-40 uppercase">Seller: {expandedItem.seller}</p>}
                  {expandedItem.price&&<p className="text-base font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>${expandedItem.price}</p>}
                  <div className="flex flex-col gap-1.5 pt-1 pb-2">
                    {expandedItem.product_url&&<button onClick={()=>window.open(expandedItem.product_url!,'_blank')} className="w-full py-2 bg-black text-white hover:bg-white hover:text-black border border-black transition-all text-[9px] tracking-[0.25em] font-black" style={{fontFamily:'Bebas Neue, sans-serif'}}>VIEW PRODUCT ↗</button>}
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
              <div className="p-6 flex items-center justify-between" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
                <div className="flex gap-6">
                  {(['followers','following'] as const).map(type=>(
                    <button key={type} onClick={()=>setFollowersModalType(type)} className="text-sm font-black tracking-wider transition-all" style={{fontFamily:'Bebas Neue, sans-serif',color:followersModalType===type?T.text:T.muted,backgroundColor:'transparent',border:'none'}}>{type==='followers'?`${profile.followers_count} FOLLOWERS`:`${profile.following_count} FOLLOWING`}</button>
                  ))}
                </div>
                <button onClick={()=>setShowFollowersModal(false)} className="text-[10px] tracking-[0.35em] font-black" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted,backgroundColor:'transparent',border:'none'}}>[ESC]</button>
              </div>
              <div className="p-4" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}>
                <input type="text" value={followersSearchQuery} onChange={e=>setFollowersSearchQuery(e.target.value)} placeholder="SEARCH..." className="w-full bg-transparent text-xs tracking-wider focus:outline-none" style={{color:T.text,fontSize:'16px'}}/>
              </div>
              <div className="overflow-y-auto flex-1">
                {(followersModalType==='followers'?filteredFollowers:filteredFollowing).map(user=>(
                  <div key={user.id} className="flex items-center gap-3 p-4 cursor-pointer transition-all" style={{borderBottomColor:T.border,borderBottomWidth:1,borderBottomStyle:'solid'}}
                    onClick={()=>{setShowFollowersModal(false);router.push(`/@${user.username}`);}}>
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{backgroundColor:T.surface}}>
                      {user.avatar_url?<img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-sm font-black" style={{color:T.muted}}>{user.username[0].toUpperCase()}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black tracking-wide" style={{fontFamily:'Bebas Neue, sans-serif',color:T.text}}>@{user.username}</p>
                      {user.full_name&&<p className="text-xs truncate" style={{color:T.muted}}>{user.full_name}</p>}
                    </div>
                    <span className="text-[9px] tracking-wider" style={{fontFamily:'Bebas Neue, sans-serif',color:T.muted}}>{user.followers_count} followers</span>
                  </div>
                ))}
                {(followersModalType==='followers'?filteredFollowers:filteredFollowing).length===0&&(
                  <div className="p-8 text-center"><p className="text-xs tracking-wider" style={{color:T.muted}}>NO {followersModalType.toUpperCase()} FOUND</p></div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}