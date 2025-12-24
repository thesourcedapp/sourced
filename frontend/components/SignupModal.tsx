"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupModal({ close }: { close: () => void }) {
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
          redirectTo: "https://www.thesourcedapp.com/onboarding/profile",
        },
      });

      if (signInError) {
        console.error("OAuth error:", signInError);
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // OAuth will redirect automatically, so we don't need to do anything else
    } catch (err: any) {
      console.error("Unexpected OAuth error:", err);
      setError(err.message || "Something went wrong with sign-in.");
      setLoading(false);
    }
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
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            [ESC]
          </button>

          <div className="border-2 border-white p-8 md:p-12 bg-black relative text-white">
            <div className="absolute -top-1 -left-1 w-full h-full border border-white opacity-50 pointer-events-none"></div>

            <div className="space-y-10">
              <div className="space-y-2">
                <div
                  className="text-[10px] tracking-[0.5em] opacity-40"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  GET STARTED
                </div>
                <h2
                  className="text-5xl md:text-6xl font-black tracking-tighter"
                  style={{ fontFamily: "Archivo Black, sans-serif" }}
                >
                  JOIN
                  <br />
                  SOURCED
                </h2>
              </div>

              <div className="space-y-6">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-5 border-2 border-white hover:bg-white hover:text-black transition-all text-xs tracking-[0.3em] font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? "LOADING..." : "CONTINUE WITH GOOGLE"}
                </button>

                {error && (
                  <div className="p-4 bg-white text-black border-2 border-white">
                    <p className="text-xs tracking-wider font-bold">
                      {error}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-[10px] tracking-wider opacity-70 leading-relaxed text-center">
                  By continuing, you agree to our{" "}
                  <a
                    href="/legal/terms"
                    target="_blank"
                    className="underline hover:opacity-100"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    className="underline hover:opacity-100"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>

              <div className="text-[9px] tracking-[0.5em] opacity-30 text-center pt-4">
                → SECURE AUTHENTICATION
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}