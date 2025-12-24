"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginModal({ close }: { close: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://www.thesourcedapp.com/featured",
        },
      });

      if (signInError) {
        console.error("OAuth error:", signInError);
        setError(signInError.message);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error("Unexpected OAuth error:", err);
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm"
        onClick={close}
      >
        <div
          className="w-full max-w-md relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute -top-12 right-0 text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal content */}
          <div className="bg-black border border-white/20 relative overflow-hidden">
            {/* Accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white"></div>

            <div className="p-8 md:p-12 space-y-8">
              {/* Header */}
              <div className="space-y-2">
                <div
                  className="text-[9px] tracking-[0.5em] text-white/40"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  WELCOME BACK
                </div>
                <h2
                  className="text-5xl md:text-6xl font-black tracking-tighter text-white leading-none"
                  style={{ fontFamily: 'Archivo Black, sans-serif' }}
                >
                  LOG IN
                </h2>
              </div>

              {/* Google sign in */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full group relative overflow-hidden"
              >
                <div className="relative py-4 px-6 border border-white/30 hover:border-white transition-all duration-300 flex items-center justify-center gap-3">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span
                    className="text-xs tracking-[0.3em] text-white font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {loading ? "CONNECTING..." : "CONTINUE WITH GOOGLE"}
                  </span>
                </div>
                {/* Hover effect */}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </button>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30">
                  <p className="text-xs tracking-wide text-red-400">{error}</p>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 text-center">
                <p
                  className="text-[9px] tracking-[0.4em] text-white/30"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  SECURE AUTHENTICATION
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}