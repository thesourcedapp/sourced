"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginModal({ close }: { close: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Close modal and stay on current page
    close();
    // Don't redirect - let middleware handle routing if needed
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <div className="w-full max-w-lg relative">
          <button
            onClick={close}
            className="absolute -top-16 right-0 text-[10px] tracking-[0.4em] text-white hover:opacity-50 transition-opacity"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            [ESC]
          </button>

          <div className="border-2 border-white p-8 md:p-12 bg-black relative text-white">
            <div className="absolute -top-1 -left-1 w-full h-full border border-white opacity-50 pointer-events-none"></div>

            <div className="space-y-10">
              <div className="space-y-2">
                <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  RETURNING
                </div>
                <h2 className="text-5xl md:text-6xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  ENTER
                </h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    EMAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-0 py-4 bg-transparent border-b-2 border-white focus:outline-none focus:border-b-4 transition-all text-base tracking-wider text-white placeholder-white/40"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-0 py-4 bg-transparent border-b-2 border-white focus:outline-none focus:border-b-4 transition-all text-base tracking-wider text-white placeholder-white/40"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-white text-black border-2 border-white">
                    <p className="text-xs tracking-wider font-bold">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-white text-black hover:bg-black hover:text-white hover:border-white border-2 border-white transition-all text-xs tracking-[0.4em] font-black disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  {loading ? "LOADING..." : "ENTER"}
                </button>
              </form>

              <div className="text-center pt-4">
                <button className="text-[9px] tracking-[0.4em] opacity-30 hover:opacity-100 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  FORGOT?
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}