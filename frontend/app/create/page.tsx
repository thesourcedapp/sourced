"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Head from "next/head";

export default function CreateHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [username, setUsername] = useState<string>('');

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setIsAuthenticated(true);

    // Fetch profile — username + tutorial flag
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_seen_create_tutorial, username')
      .eq('id', user.id)
      .single();

    if (profile?.username) setUsername(profile.username);

    if (!profile?.has_seen_create_tutorial) {
      setShowTutorial(true);
      // Mark as seen immediately so it only fires once
      await supabase
        .from('profiles')
        .update({ has_seen_create_tutorial: true })
        .eq('id', user.id);
    }

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
            <div className="w-3 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');`}</style>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 pb-32">
          <p className="text-[10px] tracking-[0.4em] font-black mb-4 text-black/30" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            SOURCED
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-center mb-4 leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            YOU MUST BE LOGGED IN TO USE THIS FEATURE
          </h1>
          <p className="text-sm font-black tracking-wider text-black/40 text-center mb-8" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            SIGN IN TO CREATE CATALOGS AND FEED POSTS
          </p>
          <button
            onClick={() => router.push('/signin')}
            className="px-10 py-3.5 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all text-xs tracking-[0.2em] font-black"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            SIGN IN →
          </button>
        </div>
      </>
    );
  }


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

        /* Credit card chip shimmer */
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .chip-shine {
          background: linear-gradient(105deg, #c8a84b 0%, #f5e07c 40%, #c8a84b 55%, #a67c2e 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .chip-shine-white {
          background: linear-gradient(105deg, #ccc 0%, #fff 40%, #ccc 55%, #999 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }

        @keyframes tutSlide {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tut-in { animation: tutSlide 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="min-h-screen bg-white pb-32">
        <div className="max-w-lg mx-auto px-5 pt-12 md:pt-20">

          {/* ── Header ── */}
          <div className="mb-10 anim-1">
            <h1
              className="text-7xl md:text-9xl font-black tracking-tighter leading-none mb-3"
              style={{ fontFamily: 'Archivo Black, sans-serif', color: '#000' }}
            >
              CREATE
            </h1>
            <p
              className="text-base font-black tracking-[0.2em]"
              style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#000' }}
            >
              WHAT ARE YOU MAKING TODAY?
            </p>
          </div>

          {/* ── Credit Card Cards ── */}
          <div className="space-y-5 anim-2">

            {/* ── CATALOG CARD ── */}
            <div className="group">
              {/* Card face */}
              <button
                onClick={() => router.push('/catalogs')}
                className="w-full text-left block relative overflow-hidden transition-transform duration-200 hover:-translate-y-1 active:translate-y-0"
                style={{
                  background: '#000',
                  borderRadius: '16px',
                  aspectRatio: '1.586 / 1',
                  padding: '28px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                {/* Background texture lines */}
                <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '16px' }}>
                  <div style={{
                    position: 'absolute', top: '-40%', right: '-20%',
                    width: '70%', height: '200%',
                    background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.04) 50%, transparent 55%)',
                    transform: 'rotate(-15deg)',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '-10%', left: '-10%',
                    width: '60%', height: '60%',
                    background: 'radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, transparent 70%)',
                  }} />
                </div>

                {/* Top row: chip + network mark */}
                <div className="relative flex items-start justify-between mb-auto">
                  {/* EMV Chip */}
                  <div
                    className="chip-shine"
                    style={{
                      width: '42px', height: '32px', borderRadius: '5px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <div style={{
                      width: '26px', height: '20px', border: '1px solid rgba(0,0,0,0.3)',
                      borderRadius: '3px', display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: '2px', padding: '3px',
                    }}>
                      {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '1px' }} />
                      ))}
                    </div>
                  </div>

                  {/* Card type label */}
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>
                      SOURCED
                    </p>
                    <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.7)' }}>
                      CATALOG
                    </p>
                  </div>
                </div>



                {/* Bottom row: name + arrow */}
                <div style={{ position: 'absolute', bottom: '28px', left: '28px', right: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    {username && (
                      <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>
                        @{username}
                      </p>
                    )}
                    <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '22px', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
                      CATALOGS
                    </h2>
                    <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '9px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.45)', marginTop: '3px' }}>
                      CURATE · EARN · DISCOVER
                    </p>
                  </div>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)', fontSize: '16px',
                  }}
                    className="group-hover:border-white group-hover:text-white transition-all duration-200"
                  >
                    →
                  </div>
                </div>
              </button>

            </div>

            {/* ── FEED POST CARD ── */}
            <div className="group mt-2">
              <button
                onClick={() => router.push('/create/post')}
                className="w-full text-left block relative overflow-hidden transition-transform duration-200 hover:-translate-y-1 active:translate-y-0"
                style={{
                  background: '#fff',
                  border: '2px solid #000',
                  borderRadius: '16px',
                  aspectRatio: '1.586 / 1',
                  padding: '28px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {/* Background texture */}
                <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '14px' }}>
                  <div style={{
                    position: 'absolute', top: '-40%', right: '-20%',
                    width: '70%', height: '200%',
                    background: 'linear-gradient(135deg, transparent 45%, rgba(0,0,0,0.02) 50%, transparent 55%)',
                    transform: 'rotate(-15deg)',
                  }} />
                </div>

                {/* Chip */}
                <div className="relative flex items-start justify-between">
                  <div
                    className="chip-shine-white"
                    style={{
                      width: '42px', height: '32px', borderRadius: '5px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <div style={{
                      width: '26px', height: '20px', border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: '3px', display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: '2px', padding: '3px',
                    }}>
                      {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.12)', borderRadius: '1px' }} />
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(0,0,0,0.3)', marginBottom: '2px' }}>
                      SOURCED
                    </p>
                    <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.6)' }}>
                      POST
                    </p>
                  </div>
                </div>



                {/* Bottom */}
                <div style={{ position: 'absolute', bottom: '28px', left: '28px', right: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    {username && (
                      <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.35)', marginBottom: '4px' }}>
                        @{username}
                      </p>
                    )}
                    <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '22px', color: '#000', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
                      FEED POST
                    </h2>
                    <p style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '9px', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.35)', marginTop: '3px' }}>
                      FITS · DROPS · MOMENTS
                    </p>
                  </div>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    border: '1.5px solid rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(0,0,0,0.5)', fontSize: '16px',
                  }}
                    className="group-hover:border-black group-hover:text-black transition-all duration-200"
                  >
                    →
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Bottom note */}
          <p
            className="text-[10px] font-black tracking-[0.2em] text-center mt-10 anim-4"
            style={{ fontFamily: 'Bebas Neue, sans-serif', color: 'rgba(0,0,0,0.25)' }}
          >
            EDIT YOUR WORK FROM YOUR PROFILE OR EACH ITEM'S PAGE
          </p>

        </div>
      </div>

      {/* ── FIRST-TIME TUTORIAL ───────────────────────────────────────────────── */}
      {showTutorial && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="tut-in w-full md:max-w-sm bg-white" style={{ borderRadius: '16px 16px 0 0' }}>

            <div className="p-6 md:p-8">
              <p className="text-xs tracking-[0.3em] font-black mb-5" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#000000' }}>
                QUICK RUNDOWN
              </p>

              <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-5 leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif', color: '#000000', WebkitTextFillColor: '#000000' }}>
                Two ways to create on Sourced.
              </h2>

              {/* Catalog */}
              <div className="flex gap-4 mb-5">
                <div className="w-10 h-10 bg-black flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black tracking-[0.1em] mb-1" style={{ fontFamily: 'Archivo Black, sans-serif', color: '#000000' }}>CATALOG</p>
                  <p className="text-sm leading-snug" style={{ color: '#000000', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 400 }}>
                    A themed collection of pieces you curate over time. Add items with product links, earn commissions when people shop through it.
                  </p>
                </div>
              </div>

              {/* Feed Post */}
              <div className="flex gap-4 mb-6">
                <div className="w-10 h-10 border-2 border-black flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black tracking-[0.1em] mb-1" style={{ fontFamily: 'Archivo Black, sans-serif', color: '#000000' }}>FEED POST</p>
                  <p className="text-sm leading-snug" style={{ color: '#000000', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 400 }}>
                    A single moment — a fit, a haul, a pickup. Goes into the community feed. Tag items people can shop directly from the post.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowTutorial(false)}
                className="w-full py-3.5 bg-black text-white font-black tracking-[0.2em] text-xs hover:bg-white hover:text-black border-2 border-black transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                GOT IT →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}