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

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = () => setMenuOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

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
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="w-10 h-10 rounded-full border-2 border-black bg-white hover:border-4 transition-all flex items-center justify-center text-lg font-black overflow-hidden relative group"
          title={profile?.username || "Account"}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username || "Avatar"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-black group-hover:scale-110 transition-transform">
              {profile?.username ? profile.username[0]?.toUpperCase() : "U"}
            </span>
          )}
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-14 bg-black border border-white/20 w-64 z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent line */}
            <div className="h-[2px] bg-white"></div>

            <div className="p-6 space-y-6">
              {/* User info */}
              <div className="space-y-2">
                <div
                  className="text-[9px] tracking-[0.5em] text-white/40"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  LOGGED IN AS
                </div>
                <div
                  className="text-2xl font-black tracking-tight text-white"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  @{profile?.username || "loading..."}
                </div>
                {profile?.full_name && (
                  <div className="text-xs text-white/60 tracking-wide">
                    {profile.full_name}
                  </div>
                )}

                {!profile?.username && (
                  <button
                    onClick={refreshProfile}
                    className="text-[9px] text-white/40 hover:text-white transition-colors tracking-wider mt-2"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    [REFRESH]
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-white/10"></div>

              {/* Menu actions */}
              <div className="space-y-2">
                <button
                  onClick={handleViewProfile}
                  className="w-full group relative overflow-hidden"
                >
                  <div className="py-3 px-4 border border-white/30 hover:border-white transition-all text-left">
                    <span
                      className="text-[11px] tracking-[0.3em] text-white"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      VIEW PROFILE
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full group relative overflow-hidden"
                >
                  <div className="py-3 px-4 border border-white/30 hover:border-white transition-all text-left">
                    <span
                      className="text-[11px] tracking-[0.3em] text-white"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      LOG OUT
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </button>

                <button
                  onClick={handleDelete}
                  className="w-full group relative overflow-hidden"
                >
                  <div className="py-3 px-4 border border-red-500/50 hover:border-red-500 transition-all text-left">
                    <span
                      className="text-[11px] tracking-[0.3em] text-red-400"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      DELETE ACCOUNT
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}