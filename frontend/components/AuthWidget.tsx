"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import LoginModal from "./LoginModal";
import SignupModal from "./SignupModal";

type AuthWidgetProps = {
  showUsername?: boolean;
};

export default function AuthWidget({ showUsername = false }: AuthWidgetProps) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Function to manually refresh profile
  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", session.user.id)
        .single();

      console.log("Manual profile refresh:", profileData);
      setProfile(profileData);
    }
  }

  // Load session and profile on mount
  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        // Fetch profile data
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", session.user.id)
          .single();

        console.log("Profile data loaded:", profileData);
        setProfile(profileData);
      }
    }

    loadSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);

      if (!session) {
        setProfile(null);
      } else {
        // Small delay to ensure profile is created/updated in DB
        setTimeout(async () => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", session.user.id)
            .single();

          console.log("Profile data refreshed:", profileData);
          setProfile(profileData);
        }, 500);
      }

      // Refresh the page content to reflect auth state
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Logout handler
  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setMenuOpen(false);
    router.push("/");
  }

  // Delete account handler
  async function handleDelete() {
    if (!session) return;
    const confirmed = confirm("Are you sure you want to delete your account? This cannot be undone.");
    if (!confirmed) return;

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        alert("Session expired. Please log in again.");
        return;
      }

      const response = await fetch("/api/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({ userId: session.user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(`Error: ${data.error || "Failed to delete account"}`);
        return;
      }

      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setMenuOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("An error occurred while deleting your account.");
    }
  }

  // View profile handler
  function handleViewProfile() {
    if (session?.user?.id) {
      setMenuOpen(false);
      router.push(`/profiles/${session.user.id}`);
    }
  }

  if (!session) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>

        <div className="flex gap-4">
          <button
            onClick={() => setShowLogin(true)}
            className="px-6 py-2 border border-black text-black hover:bg-black hover:text-white transition-all text-xs tracking-[0.4em]"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            LOGIN
          </button>
          <button
            onClick={() => setShowSignup(true)}
            className="px-6 py-2 bg-black text-white hover:bg-white hover:text-black hover:border-black border border-black transition-all text-xs tracking-[0.4em]"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            SIGN UP
          </button>

          {showLogin && <LoginModal close={() => setShowLogin(false)} />}
          {showSignup && <SignupModal close={() => setShowSignup(false)} />}
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      `}</style>

      <div className="relative flex items-center gap-3">
        {showUsername && profile?.username && (
          <span
            className="text-sm tracking-wide font-black text-black"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            @{profile.username}
          </span>
        )}

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-all flex items-center justify-center text-lg font-black overflow-hidden"
          title={profile?.username || "Account"}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username || "Avatar"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{profile?.username ? profile.username[0]?.toUpperCase() : "U"}</span>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-12 bg-black border-2 border-white p-4 w-48 z-50 shadow-lg">
            <div className="absolute -top-1 -right-1 w-full h-full border border-white opacity-30 pointer-events-none"></div>

            <div className="space-y-4 relative z-10">
              <div className="border-b border-white/20 pb-3">
                <div className="text-[9px] tracking-[0.4em] opacity-40 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  USER
                </div>
                <div className="text-sm font-black tracking-wide text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  @{profile?.username || "loading..."}
                </div>
                {profile?.full_name && (
                  <div className="text-[10px] opacity-60 mt-1">
                    {profile.full_name}
                  </div>
                )}

                {!profile?.username && (
                  <button
                    onClick={refreshProfile}
                    className="text-[8px] opacity-40 hover:opacity-100 mt-2"
                  >
                    [REFRESH]
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleViewProfile}
                  className="w-full py-2 border border-white text-white hover:bg-white hover:text-black transition-all text-[10px] tracking-[0.4em]"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  VIEW PROFILE
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full py-2 border border-white text-white hover:bg-white hover:text-black transition-all text-[10px] tracking-[0.4em]"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  LOG OUT
                </button>

                <button
                  onClick={handleDelete}
                  className="w-full py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-all text-[10px] tracking-[0.4em]"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  DELETE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}