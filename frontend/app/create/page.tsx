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

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/signin'); return; }
    setIsAuthenticated(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-black text-3xl font-black tracking-widest animate-pulse" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
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

  const HOW_IT_WORKS = [
    { n: '01', title: 'NAME YOUR CATALOG', body: 'Give it a theme — "Rick Season", "Quiet Luxury Summer", "Off-White Archive". Name it like it means something.' },
    { n: '02', title: 'ADD A COVER IMAGE', body: 'Upload from your camera roll or paste a link. Use images you own or have rights to — your own fits, product shots, mood imagery. No brand editorial or copyrighted photography.' },
    { n: '03', title: 'ADD ITEMS', body: 'Open your catalog and start building. Paste a product link and image, set a title and price. Every item can link out to where people can buy it.' },
    { n: '04', title: 'GO PUBLIC & EARN', body: 'Set it public so the community discovers it. Link to affiliate partner brands and earn a commission every time someone clicks through and buys.' },
  ];

  return (
    <>
      <Head><title>Create | Sourced</title></Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        body { background: #fff; color: #000; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-1 { animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .anim-2 { animation: slideUp 0.5s 0.07s cubic-bezier(0.16,1,0.3,1) both; }
        .anim-3 { animation: slideUp 0.5s 0.14s cubic-bezier(0.16,1,0.3,1) both; }
        .anim-4 { animation: slideUp 0.5s 0.21s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="min-h-screen bg-white pb-32">
        <div className="max-w-2xl mx-auto px-5 pt-12 md:pt-20">

          {/* ── Header ── */}
          <div className="mb-10 anim-1">
            <h1
              className="text-7xl md:text-9xl font-black tracking-tighter leading-none mb-3"
              style={{ fontFamily: 'Archivo Black, sans-serif' }}
            >
              CREATE
            </h1>
            <p
              className="text-base font-black tracking-[0.2em] text-black"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              WHAT ARE YOU MAKING TODAY?
            </p>
          </div>

          {/* ── Cards ── */}
          <div className="space-y-0 anim-2">

            {/* CATALOGS */}
            <div className="border-2 border-black group">
              <button
                onClick={() => router.push('/catalogs')}
                className="w-full text-left p-6 md:p-8 block hover:bg-black hover:text-white transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p
                      className="text-[10px] tracking-[0.35em] font-black mb-2 opacity-50 group-hover:opacity-70"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      GRAILS · FITS · SEASON EDITS · BRAND ARCHIVES
                    </p>
                    <h2
                      className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-3"
                      style={{ fontFamily: 'Archivo Black, sans-serif' }}
                    >
                      CATALOGS
                    </h2>
                    <p
                      className="text-sm font-black tracking-wide leading-snug"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      CURATE A THEMED COLLECTION OF FASHION PIECES. ADD ITEMS, LINK TO PRODUCTS, AND EARN COMMISSIONS WHEN PEOPLE SHOP THROUGH YOUR CATALOG.
                    </p>
                  </div>
                  <span className="text-4xl font-black group-hover:translate-x-2 transition-transform duration-200 flex-shrink-0">→</span>
                </div>
              </button>

              {/* Expandable how it works */}
              <div className="border-t-2 border-black">
                <button
                  onClick={() => setShowCatalogGuide(v => !v)}
                  className="w-full px-6 md:px-8 py-3 flex items-center justify-between hover:bg-black/4 transition-colors"
                >
                  <span
                    className="text-xs font-black tracking-[0.3em]"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {showCatalogGuide ? '▼' : '▶'} HOW IT WORKS
                  </span>
                </button>

                {showCatalogGuide && (
                  <div className="px-6 md:px-8 pb-6 space-y-5 border-t border-black/10">
                    <div className="pt-4 space-y-5">
                      {HOW_IT_WORKS.map((step) => (
                        <div key={step.n} className="flex gap-5">
                          <span
                            className="text-2xl font-black text-black/20 flex-shrink-0 w-8 leading-tight"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                          >
                            {step.n}
                          </span>
                          <div>
                            <p
                              className="text-sm font-black tracking-[0.15em] mb-1"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              {step.title}
                            </p>
                            <p className="text-sm leading-relaxed text-black/70">
                              {step.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-2 border-black/15 p-4">
                      <p
                        className="text-xs font-black tracking-wider leading-relaxed text-black/60"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                      >
                        ⚖ CONTENT POLICY — ONLY UPLOAD IMAGES YOU OWN OR HAVE RIGHTS TO USE. DO NOT UPLOAD COPYRIGHTED EDITORIAL IMAGES, BRAND CAMPAIGN PHOTOGRAPHY, OR ARTWORK WITHOUT PERMISSION. YOU ARE RESPONSIBLE FOR CONTENT YOU POST. SOURCED COMPLIES WITH DMCA AND WILL REMOVE INFRINGING CONTENT ON REQUEST.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FEED POST */}
            <button
              onClick={() => router.push('/create/post')}
              className="w-full text-left border-2 border-black border-t-0 p-6 md:p-8 block hover:bg-black hover:text-white transition-all duration-200 group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p
                    className="text-[10px] tracking-[0.35em] font-black mb-2 opacity-50 group-hover:opacity-70"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    FITS · HAULS · MOOD BOARDS · PICKUPS
                  </p>
                  <h2
                    className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-3"
                    style={{ fontFamily: 'Archivo Black, sans-serif' }}
                  >
                    FEED POST
                  </h2>
                  <p
                    className="text-sm font-black tracking-wide leading-snug"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    DROP A FIT, A FIND, OR A MOOD. POSTS GO INTO THE COMMUNITY FEED AND CAN INCLUDE TAGGED ITEMS PEOPLE CAN SHOP.
                  </p>
                </div>
                <span className="text-4xl font-black group-hover:translate-x-2 transition-transform duration-200 flex-shrink-0">→</span>
              </div>
            </button>

          </div>

          {/* Bottom note */}
          <p
            className="text-xs font-black tracking-[0.2em] text-black/30 text-center mt-10 anim-4"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            EDIT YOUR WORK FROM YOUR PROFILE OR EACH ITEM'S PAGE
          </p>

        </div>
      </div>
    </>
  );
}