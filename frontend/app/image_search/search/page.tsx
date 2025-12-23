"use client";

import { useState } from "react";

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:5000/search", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Unknown server error");
      }

      const data: Product[] = await res.json();
      setProducts(data);
    } catch (err: any) {
      console.error("Error uploading file:", err);
      setError(err.message || "Something went wrong");
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
              IMAGE SEARCH
            </h1>
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
                  <label className="block cursor-pointer">
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
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
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
                  <div className="mt-8 text-center border border-black/20 p-6">
                    <p className="text-xs tracking-[0.4em] mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      SEARCHING...
                    </p>
                    <p className="text-[10px] tracking-wider opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      PLEASE WAIT, CAN TAKE UP TO 30 SECONDS
                    </p>
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
                      <a
                        key={idx}
                        href={product.item_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200"
                      >
                        {/* Product Image */}
                        <div className="relative aspect-square bg-white overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Product Info */}
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