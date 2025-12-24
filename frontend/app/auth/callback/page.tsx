"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session, redirect to home
        window.location.href = "https://www.thesourcedapp.com";
        return;
      }

      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_onboarded, username")
        .eq("id", session.user.id)
        .single();

      if (profile?.is_onboarded && profile?.username) {
        // Returning user - go to home
        window.location.href = "https://www.thesourcedapp.com";
      } else {
        // New user - go to onboarding
        window.location.href = "https://www.thesourcedapp.com/onboarding/profile";
      }
    }

    handleCallback();
  }, [router]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      `}</style>
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          LOADING...
        </p>
      </div>
    </>
  );
}