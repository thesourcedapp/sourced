"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type Product = {
  name: string;
  price: string;
  seller: string;
  image_url: string;
  item_url: string;
};

export default function SearchPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("SEARCHING...");
  const [totalSearches, setTotalSearches] = useState<number | null>(null);

  useEffect(() => {
    loadCurrentUser();
    loadSearchCount();
  }, []);

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
    } else {
      setCurrentUserId(null);
      setIsOnboarded(false);
    }
  }

  async function loadSearchCount() {
    const { count } = await supabase
      .from('searches')
      .select('*', { count: 'exact', head: true });

    setTotalSearches(count || 0);
  }

  async function recordSearch() {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('searches')
      .insert({ user_id: currentUserId });

    if (!error) {
      // Increment local count immediately for responsive UI
      setTotalSearches(prev => (prev !== null ? prev + 1 : 1));
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUserId || !isOnboarded) {
      setShowAuthPopup(true);
      e.target.value = '';
      return;
    }

    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);
    setLoadingMessage("SEARCHING...");

    // Record the search
    await recordSearch();

    const messages = [
      "SEARCHING...",
      "ANALYZING IMAGE...",
      "LOOKING FOR YOUR ITEM...",
      "FINDING MATCHES...",
      "ALMOST THERE..."
    ];
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingMessage(messages[messageIndex]);
    }, 3000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch("https://sourced-5ovn.onrender.com/search", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(messageInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Unknown server error");
      }

      const data: Product[] = await res.json();
      setProducts(data);
    } catch (err: any) {
      clearTimeout(timeoutId);
      clearInterval(messageInterval);
      console.error("Error uploading file:", err);

      if (err.name === 'AbortError') {
        setError("Search timed out. The server may be waking up from sleep. Please try again.");
      } else if (err.message.includes('Failed to fetch')) {
        setError("Unable to reach search server. It may be starting up (this can take 30-60s on first use). Please try again in a moment.");
      } else {
        setError(err.message || "Something went wrong");
      }
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setPreview(null);
    setProducts([]);
    setError(null);
  };

  const handleUploadClick = () => {
    if (!currentUserId || !isOnboarded) {
      setShowAuthPopup(true);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Auth Required Popup */}
        {showAuthPopup && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowAuthPopup(false)}
          >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <div
              className="relative w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowAuthPopup(false)}
                className="absolute -top-12 right-0 text-white text-xs tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                [ESC]
              </button>

              <div className="border-2 border-white p-8 md:p-10 bg-black text-white">
                <div className="text-center space-y-6">
                  <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    ACCESS DENIED
                  </div>

                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-none" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                    LOGIN
                    <br />
                    REQUIRED
                  </h2>

                  <div className="pt-4 pb-2">
                    <div className="w-16 h-px bg-white/20 mx-auto" />
                  </div>

                  <p className="text-xs tracking-wide opacity-60 leading-relaxed">
                    You must be authenticated to use image search
                  </p>

                  <button
                    onClick={() => setShowAuthPopup(false)}
                    className="w-full py-3 bg-white text-black hover:bg-black hover:text-white hover:border-2 hover:border-white transition-all text-xs tracking-[0.4em] font-black mt-6"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                IMAGE SEARCH
              </h1>
              {totalSearches !== null && (
                <div className="text-right">
                  <div className="text-[10px] tracking-[0.5em] opacity-40 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    TOTAL SEARCHES
                  </div>
                  <div className="text-2xl md:text-3xl font-black tracking-wider" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                    {totalSearches.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <p className="text-sm tracking-wider opacity-60">
                Upload a photo to find similar items
              </p>

              {/* Upload Section */}
              <div className="max-w-2xl">
                {!preview ? (
                  <label className="block cursor-pointer" onClick={handleUploadClick}>
                    <div className="border-2 border-dashed border-black/20 hover:border-black transition-all p-16 md:p-20">
                      <div className="text-center space-y-6">
                        <div className="text-8xl opacity-20">⊕</div>
                        <div>
                          <p className="text-2xl font-black tracking-wide mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            DROP IMAGE HERE
                          </p>
                          <p className="text-xs tracking-[0.3em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            OR CLICK TO BROWSE
                          </p>
                        </div>
                      </div>
                    </div>
                    {currentUserId && isOnboarded && (
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    )}
                  </label>
                ) : (
                  <div className="relative">
                    <div className="relative border-2 border-black overflow-hidden bg-white">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full max-h-96 object-contain"
                      />
                      <button
                        onClick={clearImage}
                        className="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-black hover:bg-black hover:text-white transition-all flex items-center justify-center text-2xl"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div className="mt-8 text-center border border-black/20 p-8">
                    <div className="space-y-4">
                      <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {loadingMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="mt-8 border-2 border-red-500 p-6 text-center bg-red-50">
                    <p className="text-xs tracking-wider text-red-500 font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {error}
                    </p>
                  </div>
                )}
              </div>

              {/* Results Section */}
              {products.length > 0 && (
                <div className="mt-12">
                  <div className="border-b border-black/20 pb-4 mb-8">
                    <h3 className="text-3xl font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {products.length} RESULTS
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {products.map((product, idx) => (

                        key={idx}
                        href={product.item_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200"
                      >
                        <div className="relative aspect-square bg-white overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="p-3 bg-white border-t border-black/20">
                          <h4 className="text-xs font-black tracking-wide uppercase leading-tight truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {product.name}
                          </h4>
                          <div className="flex items-center justify-between text-[10px] tracking-wider opacity-60">
                            {product.seller && (
                              <p className="truncate">{product.seller}</p>
                            )}
                            {product.price && (
                              <p className="ml-auto">{product.price}</p>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && products.length === 0 && preview && !error && (
                <div className="text-center py-20 border border-black/20 mt-8">
                  <div className="text-6xl opacity-10 mb-4">✦</div>
                  <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    NO RESULTS FOUND
                  </p>
                  <p className="text-sm tracking-wide opacity-30 mt-2">
                    Try a different image
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}