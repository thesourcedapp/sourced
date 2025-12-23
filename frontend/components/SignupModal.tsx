"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupModal({ close }: { close: () => void }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTOS, setAcceptedTOS] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    if (!acceptedTOS) {
      setError("You must agree to the Terms of Service to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, is_onboarded")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.is_onboarded) {
          setError("Account already exists. Please log in instead.");
          setLoading(false);
          return;
        } else {
          setMessage(
            "An account with this email exists but isn't verified yet. Check your email to finish signing up."
          );

          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/onboarding/profile`,
            },
          });

          setLoading(false);
          return;
        }
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding/profile`,
        },
      });

      if (signupError) {
        setError(signupError.message);
        setLoading(false);
        return;
      }

      if (data?.session) {
        close();
        router.push("/onboarding/profile");
        return;
      }

      setMessage("Account created! Please check your email to verify.");
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
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
                  NEW USER
                </div>
                <h2
                  className="text-5xl md:text-6xl font-black tracking-tighter"
                  style={{ fontFamily: "Archivo Black, sans-serif" }}
                >
                  JOIN
                </h2>
              </div>

              {!message ? (
                <form onSubmit={handleSignUp} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] tracking-[0.4em] opacity-50">
                      EMAIL
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-0 py-4 bg-transparent border-b-2 border-white focus:outline-none focus:border-b-4 transition-all text-base tracking-wider text-white"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] tracking-[0.4em] opacity-50">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-0 py-4 bg-transparent border-b-2 border-white focus:outline-none focus:border-b-4 transition-all text-base tracking-wider text-white"
                    />
                  </div>

                  {/* TERMS CHECKBOX */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptedTOS}
                      onChange={(e) => setAcceptedTOS(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-white"
                      required
                    />
                    <p className="text-[10px] tracking-wider opacity-70 leading-relaxed">
                      I agree to the{" "}
                      <a
                        href="/legal/terms"
                        target="_blank"
                        className="underline"
                      >
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a
                        href="/legal/privacy"
                        target="_blank"
                        className="underline"
                      >
                        Privacy Policy
                      </a>
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-white text-black border-2 border-white">
                      <p className="text-xs tracking-wider font-bold">
                        {error}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !acceptedTOS}
                    className="w-full py-5 bg-white text-black hover:bg-black hover:text-white border-2 border-white transition-all text-xs tracking-[0.4em] font-black disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: "Bebas Neue, sans-serif" }}
                  >
                    {loading ? "LOADING..." : "CREATE"}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 border-2 border-white">
                    <p className="text-sm tracking-wider">{message}</p>
                  </div>
                </div>
              )}

              <div className="text-[9px] tracking-[0.5em] opacity-30 text-center pt-4">
                → TERMS APPLY
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
