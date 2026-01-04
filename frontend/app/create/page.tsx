"use client";

import { useRouter } from "next/navigation";
import Head from "next/head";

export default function CreateHub() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Create | Sourced</title>
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        body {
          font-family: 'Bebas Neue', sans-serif;
          background: #FFFFFF;
          color: #000000;
        }
      `}</style>

      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-black text-black mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              CREATE
            </h1>
            <p className="text-black/60 text-lg" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Curate your style or share your look
            </p>
          </div>

          {/* Two Option Cards */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* Catalogs Option */}
            <button
              onClick={() => router.push('/catalogs')}
              className="group relative bg-neutral-100 rounded-3xl p-8 border-2 border-black/10 hover:border-black transition-all duration-300 text-left"
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-black/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-all">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-3xl font-black text-black mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  CATALOGS
                </h2>
                <p className="text-black/60 text-base" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  Create and manage your fashion catalogs
                </p>
              </div>

              <div className="flex items-center gap-2 text-black/40 group-hover:text-black transition-colors">
                <span className="text-sm font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  Get Started
                </span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/0 to-black/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </button>

            {/* Feed Posts Option */}
            <button
              onClick={() => router.push('/create/post')}
              className="group relative bg-neutral-100 rounded-3xl p-8 border-2 border-black/10 hover:border-black transition-all duration-300 text-left"
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-black/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-all">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-black text-black mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  FEED POSTS
                </h2>
                <p className="text-black/60 text-base" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  Share your style with the community
                </p>
              </div>

              <div className="flex items-center gap-2 text-black/40 group-hover:text-black transition-colors">
                <span className="text-sm font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  Get Started
                </span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/0 to-black/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </button>

          </div>

          {/* Bottom Info */}
          <div className="mt-12 text-center">
            <p className="text-black/40 text-sm" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              You can edit your existing catalogs and posts from their respective pages
            </p>
          </div>

        </div>
      </div>
    </>
  );
}