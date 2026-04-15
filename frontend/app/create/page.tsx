"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Head from "next/head";

export default function CreateHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCatalogGuide, setShowCatalogGuide] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/signin');
      return;
    }
    setIsAuthenticated(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-black text-3xl font-black tracking-widest animate-pulse" style={{ fontFamily: 'Bebas Neue' }}>
            SOURCED
          </div>
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2.5 h-2.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2.5 h-2.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <Head>
        <title>Create | Sourced</title>
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        body { background: #fff; color: #000; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fadeUp 0.45s ease both; }
        .fade-up-2 { animation: fadeUp 0.45s 0.08s ease both; }
        .fade-up-3 { animation: fadeUp 0.45s 0.16s ease both; }
        .fade-up-4 { animation: fadeUp 0.45s 0.24s ease both; }
      `}</style>

      <div className="min-h-screen bg-white pb-24 md:pb-12">
        <div className="max-w-2xl mx-auto px-5 pt-10 md:pt-16">

          {/* Header */}
          <div className="mb-10 fade-up-1">
            <p className="text-[10px] tracking-[0.4em] opacity-30 mb-2 font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              SOURCED
            </p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              CREATE
            </h1>
            <p className="text-sm opacity-40 mt-3 tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              WHAT ARE YOU MAKING TODAY?
            </p>
          </div>

          {/* Option Cards */}
          <div className="space-y-4 fade-up-2">

            {/* ── CATALOGS ── */}
            <div className="border-2 border-black/10 hover:border-black transition-all duration-200 group">
              <button
                onClick={() => router.push('/catalogs')}
                className="w-full text-left p-6 md:p-8 block"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 bg-black flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                        CATALOGS
                      </h2>
                    </div>
                    <p className="text-sm opacity-50 leading-relaxed mb-1">
                      Curate a themed collection of fashion pieces. Add items, link to products, and earn commissions when people shop through your catalog.
                    </p>
                    <p className="text-[10px] tracking-wider opacity-30 font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      GRAILS · FITS · SEASON EDITS · BRAND ARCHIVES
                    </p>
                  </div>
                  <span className="text-2xl opacity-20 group-hover:opacity-60 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1">→</span>
                </div>
              </button>

              {/* What is a catalog — expandable */}
              <div className="border-t border-black/8 px-6 md:px-8 py-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCatalogGuide(v => !v); }}
                  className="text-[10px] tracking-[0.3em] opacity-40 hover:opacity-80 transition-opacity font-black flex items-center gap-2"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  {showCatalogGuide ? '▼' : '▶'} HOW IT WORKS
                </button>

                {showCatalogGuide && (
                  <div className="mt-4 mb-2 space-y-4">
                    {[
                      {
                        n: '01',
                        title: 'NAME YOUR CATALOG',
                        body: 'Give it a theme — "Quiet Luxury Summer", "Rick Season", "Off-White Archive". Name it like it means something.'
                      },
                      {
                        n: '02',
                        title: 'ADD A COVER',
                        body: 'Upload a photo from your camera roll or paste an image link. Use images you own or have permission to use — your own fits, product shots, mood imagery. Avoid brand logos or editorial photography you don\'t own.'
                      },
                      {
                        n: '03',
                        title: 'ADD ITEMS',
                        body: 'Once created, open your catalog and start adding items. Paste a product link and an image, give it a title and price. Every item can link out to where people can buy it.'
                      },
                      {
                        n: '04',
                        title: 'GO PUBLIC & EARN',
                        body: 'Set it public so the community can discover it. When you link to affiliate partner brands, you earn a commission every time someone clicks through and buys.'
                      },
                    ].map((step) => (
                      <div key={step.n} className="flex gap-4">
                        <span className="text-xs font-black opacity-20 flex-shrink-0 w-5 pt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{step.n}</span>
                        <div>
                          <p className="text-[10px] tracking-[0.2em] font-black mb-1 opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{step.title}</p>
                          <p className="text-xs opacity-50 leading-relaxed">{step.body}</p>
                        </div>
                      </div>
                    ))}

                    <div className="border border-black/8 p-3 mt-2">
                      <p className="text-[9px] tracking-wider opacity-40 leading-relaxed" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        ⚖ CONTENT POLICY — Only upload images you own or have rights to use. Do not upload copyrighted editorial images, brand campaign photography, or artwork without permission. You are responsible for the content you post. Sourced complies with DMCA and will remove infringing content on request.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── FEED POSTS ── */}
            <div className="border-2 border-black/10 hover:border-black transition-all duration-200 group">
              <button
                onClick={() => router.push('/create/post')}
                className="w-full text-left p-6 md:p-8 block"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 border-2 border-black flex items-center justify-center flex-shrink-0 group-hover:bg-black transition-colors duration-200">
                        <svg className="w-5 h-5 group-hover:text-white transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                        FEED POST
                      </h2>
                    </div>
                    <p className="text-sm opacity-50 leading-relaxed mb-1">
                      Drop a fit, a find, or a mood. Posts go into the community feed and can include tagged items people can shop.
                    </p>
                    <p className="text-[10px] tracking-wider opacity-30 font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      FITS · HAULS · MOOD BOARDS · PICKUPS
                    </p>
                  </div>
                  <span className="text-2xl opacity-20 group-hover:opacity-60 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1">→</span>
                </div>
              </button>
            </div>

          </div>

          {/* Bottom note */}
          <p className="text-[9px] tracking-wider opacity-20 text-center mt-10 fade-up-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            EDIT YOUR WORK FROM YOUR PROFILE OR EACH ITEM'S PAGE
          </p>

        </div>
      </div>
    </>
  );
}