"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  is_liked: boolean;
};

export default function LikedItemsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<LikedItem | null>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadLikedItems();
    }
  }, [currentUserId]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadLikedItems() {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('liked_items')
        .select(`
          catalog_items!inner(
            id,
            title,
            image_url,
            product_url,
            price,
            seller,
            catalog_id,
            like_count,
            catalogs!inner(
              name,
              profiles!inner(username)
            )
          ),
          created_at
        `)
        .eq('user_id', currentUserId)
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
          created_at: like.created_at,
          is_liked: true
        }));
        setLikedItems(transformedItems);
      }
    } catch (error) {
      console.error('Error loading liked items:', error);
    } finally {
      setLoading(false);
    }
  }

  async function unlikeItem(itemId: string) {
    if (!currentUserId) return;

    try {
      await supabase
        .from('liked_items')
        .delete()
        .eq('user_id', currentUserId)
        .eq('item_id', itemId);

      setLikedItems(prevItems =>
        prevItems.filter(item => item.id !== itemId)
      );

      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Error unliking item:', error);
    }
  }

  function handleImageClick(item: LikedItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (item.product_url) {
      window.open(item.product_url, '_blank');
    }
  }

  function handleCardClick(item: LikedItem) {
    setSelectedItem(item);
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
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              LIKED ITEMS
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => router.push('/catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                SEARCH CATALOGS
              </button>
              <button
                onClick={() => router.push('/catalogs/your_catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                YOUR CATALOGS
              </button>
              <button
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-black text-black"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                LIKED ITEMS
              </button>
              <button
                onClick={() => router.push('/catalogs/bookmarked_catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                BOOKMARKED
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <p className="text-sm tracking-wider opacity-60">
                Items you've liked from catalogs
              </p>

              {loading ? (
                <div className="text-center py-20">
                  <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    LOADING...
                  </p>
                </div>
              ) : likedItems.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    NO LIKED ITEMS YET
                  </p>
                  <p className="text-sm tracking-wide opacity-30 mt-2">
                    Like items from catalogs to save them here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {likedItems.map((item) => (
                    <div
                      key={item.id}
                      className="group border border-black/20 hover:border-black transition-all relative"
                    >
                      {/* Item Image - Clickable to product URL */}
                      <div
                        className="aspect-square bg-white overflow-hidden cursor-pointer relative"
                        onClick={(e) => handleImageClick(item, e)}
                      >
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />

                        {/* Like Count Badge */}
                        {item.like_count > 0 && (
                          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
                            ♥ {item.like_count}
                          </div>
                        )}
                      </div>

                      {/* Item Info - Desktop (clickable to expand) */}
                      <div
                        className="p-3 bg-white border-t border-black/20 cursor-pointer hover:bg-black/5 transition-all hidden md:block"
                        onClick={() => handleCardClick(item)}
                      >
                        <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          {item.title}
                        </h3>

                        {/* Catalog info */}
                        <p className="text-[9px] tracking-wider opacity-40 mb-2 truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          @{item.catalog_owner} / {item.catalog_name}
                        </p>

                        <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-3">
                          {item.seller && <span className="truncate">{item.seller}</span>}
                          {item.price && <span className="ml-auto">{item.price}</span>}
                        </div>

                        {/* Unlike button - Desktop */}
                        <button
                          className="w-full py-2 bg-red-500/10 hover:bg-red-500 border border-red-500 text-red-500 hover:text-white transition-all text-xs tracking-wider font-black"
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            unlikeItem(item.id);
                          }}
                        >
                          ♥ UNLIKE
                        </button>
                      </div>

                      {/* Item Info - Mobile */}
                      <div className="md:hidden bg-white border-t border-black/20">
                        <div className="p-3">
                          <h3 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {item.title}
                          </h3>

                          {/* Catalog info */}
                          <p className="text-[9px] tracking-wider opacity-40 mb-2 truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            @{item.catalog_owner} / {item.catalog_name}
                          </p>

                          <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60 mb-3">
                            {item.seller && <span className="truncate">{item.seller}</span>}
                            {item.price && <span className="ml-auto">{item.price}</span>}
                          </div>

                          {/* Action buttons - Mobile */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Unlike button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                unlikeItem(item.id);
                              }}
                              className="py-2 bg-red-500/10 hover:bg-red-500 border border-red-500 text-red-500 hover:text-white transition-all text-[10px] tracking-wider font-black"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              ♥ UNLIKE
                            </button>

                            {/* Expand Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                              }}
                              className="py-2 border border-black/20 hover:border-black hover:bg-black/10 transition-all text-[10px] tracking-wider font-black"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              ⊕ VIEW
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Item Detail Modal */}
        {selectedItem && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="bg-white border-2 border-black max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-8">
                {/* Left side - Image */}
                <div className="aspect-square border border-black bg-white flex items-center justify-center relative">
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.title}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => {
                      if (selectedItem.product_url) {
                        window.open(selectedItem.product_url, '_blank');
                      }
                    }}
                  />
                  {selectedItem.product_url && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 text-white text-[8px] tracking-wider font-black">
                      CLICK TO SHOP
                    </div>
                  )}
                </div>

                {/* Right side - Info */}
                <div className="space-y-6">
                  {/* Close button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="w-10 h-10 border border-black hover:bg-black hover:text-white transition-all flex items-center justify-center text-xl"
                    >
                      ×
                    </button>
                  </div>

                  {/* Item name */}
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-wide uppercase leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                      {selectedItem.title}
                    </h2>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm opacity-60">
                    {selectedItem.like_count > 0 && (
                      <span>♥ {selectedItem.like_count} likes</span>
                    )}
                    <span>FROM @{selectedItem.catalog_owner}</span>
                  </div>

                  {/* Seller */}
                  {selectedItem.seller && (
                    <div className="space-y-1">
                      <p className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        SELLER
                      </p>
                      <p className="text-lg tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {selectedItem.seller}
                      </p>
                    </div>
                  )}

                  {/* Price */}
                  {selectedItem.price && (
                    <div className="space-y-1">
                      <p className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        PRICE
                      </p>
                      <p className="text-2xl font-black tracking-wide">
                        {selectedItem.price}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-4">
                    {/* Product link button */}
                    {selectedItem.product_url && (
                      <button
                        onClick={() => window.open(selectedItem.product_url!, '_blank')}
                        className="block w-full py-4 bg-black text-white hover:bg-white hover:text-black hover:border-2 hover:border-black transition-all text-center text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        SHOP THIS ITEM
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {/* Unlike button */}
                      <button
                        className="py-4 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all text-center text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          unlikeItem(selectedItem.id);
                        }}
                      >
                        ♥ UNLIKE
                      </button>

                      {/* View catalog button */}
                      <button
                        className="py-4 border-2 border-black text-black hover:bg-black hover:text-white transition-all text-center text-xs tracking-[0.4em] font-black"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        onClick={() => {
                          router.push(`/catalogs/${selectedItem.catalog_id}`);
                        }}
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