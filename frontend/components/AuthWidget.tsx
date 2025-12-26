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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);

      if (!session) {
        setProfile(null);
      } else {
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

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setMenuOpen(false);
    router.push("/");
  }

  async function handleDeleteConfirm() {
    if (!session || !deleteConfirmed) return;

    setDeleting(true);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        alert("Session expired. Please log in again.");
        setDeleting(false);
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
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setShowDeleteModal(false);
      setMenuOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("An error occurred while deleting your account.");
      setDeleting(false);
    }
  }

  function handleViewProfile() {
    if (profile?.username) {
      setMenuOpen(false);
      router.push(`/${profile.username}`);
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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&Inter:wght@500;600&display=swap');
      `}</style>

      <div className="relative flex items-center gap-3">
        {showUsername && profile?.username && (
          <span
            className="text-sm tracking-wide font-black text-black hidden md:block"
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
            className="absolute right-0 top-14 bg-white/90 backdrop-blur-xl border border-black/10 rounded-2xl w-56 md:w-64 z-50 overflow-hidden shadow-lg"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div className="p-3 space-y-1">
              <button
                onClick={handleViewProfile}
                className="w-full py-3 px-4 rounded-xl hover:bg-black/5 transition-all text-left flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-semibold text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                  View Profile
                </span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 rounded-xl hover:bg-black/5 transition-all text-left flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm font-semibold text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Log Out
                </span>
              </button>

              <div className="border-t border-black/10 my-1"></div>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowDeleteModal(true);
                }}
                className="w-full py-3 px-4 rounded-xl hover:bg-red-500/10 transition-all text-left flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm font-semibold text-red-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Delete Account
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setShowDeleteModal(false);
            setDeleteConfirmed(false);
          }}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 space-y-6">
              {/* Warning Icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Delete Account?
                </h3>
                <p className="text-sm text-black/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                  This action cannot be undone. All your data will be permanently deleted.
                </p>
              </div>

              {/* Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-black/5 rounded-xl">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded accent-red-500"
                  id="delete-confirm"
                />
                <label
                  htmlFor="delete-confirm"
                  className="text-sm text-black/80 cursor-pointer select-none"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  I understand that this action is permanent and all my data will be lost.
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmed(false);
                  }}
                  className="flex-1 py-3 px-6 rounded-xl border border-black/20 hover:bg-black/5 transition-all text-sm font-semibold"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={!deleteConfirmed || deleting}
                  className="flex-1 py-3 px-6 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {deleting ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}