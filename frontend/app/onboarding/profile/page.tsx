"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Username validation function
function validateUsername(username: string): { valid: boolean; error?: string } {
  const normalized = username.toLowerCase().trim();

  // Check length
  if (normalized.length < 6) {
    return { valid: false, error: "Username must be at least 6 characters" };
  }

  // Check format (alphanumeric + underscore only)
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return { valid: false, error: "Only letters, numbers, and underscores allowed" };
  }

  // Check for repeated characters (e.g., "aaaaaa")
  if (/(.)\1{5,}/.test(normalized)) {
    return { valid: false, error: "Too many repeated characters" };
  }

  // Check for sequential numbers (e.g., "123456")
  if (/012345|123456|234567|345678|456789/.test(normalized)) {
    return { valid: false, error: "Sequential patterns not allowed" };
  }

  return { valid: true };
}

// Function to check username against banned words via API
async function checkUsernameSafety(username: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const response = await fetch('https://sourced-5ovn.onrender.com/api/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      console.error('Username check failed:', response.status);
      // Fail open - allow username if check fails
      return { safe: true };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking username safety:', error);
    // Fail open - allow username if check fails
    return { safe: true };
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Username availability checking
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameValidation, setUsernameValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Not logged in, redirect to home
        window.location.href = "https://www.thesourcedapp.com";
        return;
      }

      // Check if user is already onboarded
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_onboarded")
        .eq("id", session.user.id)
        .single();

      if (profile?.is_onboarded) {
        // Already onboarded, redirect to featured
        window.location.href = "https://www.thesourcedapp.com";
        return;
      }

      setSession(session);
      setLoading(false);
    }

    load();
  }, [router]);

  // Check username availability and safety as user types
  useEffect(() => {
    if (!username) {
      setUsernameAvailable(null);
      setUsernameValidation({ valid: true });
      return;
    }

    // First do basic validation
    const validation = validateUsername(username);
    setUsernameValidation(validation);

    if (!validation.valid || username.length < 6) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);

      // Check safety first
      const safetyCheck = await checkUsernameSafety(username);
      if (!safetyCheck.safe) {
        setUsernameValidation({ valid: false, error: safetyCheck.error || "Username not allowed" });
        setUsernameAvailable(null); // Set to null instead of false
        setCheckingUsername(false);
        return;
      }

      // Then check availability
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.trim().toLowerCase())
        .maybeSingle();

      setCheckingUsername(false);

      if (error) {
        console.error("Error checking username:", error);
        return;
      }

      setUsernameAvailable(data === null); // Available if no user found
    };

    // Debounce the check
    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  async function handleFinishOnboarding() {
    if (!session) return;

    setSaving(true);
    setError(null);

    // Final safety check before submission
    const safetyCheck = await checkUsernameSafety(username);
    if (!safetyCheck.safe) {
      setError(safetyCheck.error || "Username not allowed");
      setSaving(false);
      return;
    }

    try {
      // Update the profile with username, full_name, and mark as onboarded
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: username.trim().toLowerCase(),
          full_name: fullName.trim(),
          is_onboarded: true, // Set to true immediately - no email verification
        })
        .eq("id", session.user.id);

      if (updateError) {
        if (updateError.message.includes("duplicate key") ||
            updateError.message.includes("unique constraint") ||
            updateError.code === "23505") {
          setError("Username already taken. Please choose another one.");
        } else {
          setError(updateError.message);
        }
        setSaving(false);
        return;
      }

      // Success! Redirect to featured page
      await supabase.auth.refreshSession();
      window.location.href = "https://www.thesourcedapp.com";
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  if (loading) {
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

  // Check if email is verified (only applies if email confirmation is enabled in Supabase)
  if (!session?.user?.email_confirmed_at) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-lg text-center space-y-8">
            <div className="space-y-4">
              <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                VERIFICATION REQUIRED
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                CHECK
                <br />
                EMAIL
              </h1>
            </div>
            <p className="text-sm tracking-wider opacity-60">
              Click the verification link sent to your email to continue.
            </p>
            <button
              onClick={() => window.location.href = "https://www.thesourcedapp.com"}
              className="px-8 py-3 border-2 border-white hover:bg-white hover:text-black transition-all text-xs tracking-[0.4em]"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              BACK HOME
            </button>
          </div>
        </div>
      </>
    );
  }

  const isUsernameValid = usernameValidation.valid && username.length >= 6;
  const canSubmit = isUsernameValid && usernameAvailable === true && !saving;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">

          {/* Header */}
          <div className="mb-12 space-y-4">
            <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              STEP 1 / 1
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-none" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              CREATE
              <br />
              PROFILE
            </h1>
            <p className="text-sm tracking-wider opacity-60">
              Choose your identity
            </p>
          </div>

          {/* Form */}
          <div className="space-y-10">

            {/* Username Field */}
            <div className="space-y-4">
              <label className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                USERNAME
              </label>
              <input
                type="text"
                placeholder="choose wisely"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full px-0 py-4 bg-transparent border-b-2 focus:outline-none focus:border-b-4 transition-all text-xl tracking-wider text-white placeholder-white/30 ${
                  username.length > 0 && !usernameValidation.valid
                    ? 'border-red-400'
                    : usernameAvailable === true
                    ? 'border-green-400'
                    : 'border-white'
                }`}
              />

              {/* Username validation feedback - always visible when typing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] tracking-wider opacity-40">
                    6+ characters • letters, numbers, underscores
                  </p>
                  {checkingUsername && (
                    <span className="text-xs tracking-wider opacity-40">checking...</span>
                  )}
                </div>

                {/* Show validation errors dynamically */}
                {username.length > 0 && !usernameValidation.valid && (
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xs">✗</span>
                    <p className="text-red-400 text-xs tracking-wide">
                      {usernameValidation.error}
                    </p>
                  </div>
                )}

                {/* Show availability status */}
                {!checkingUsername && usernameValidation.valid && username.length >= 6 && usernameAvailable === true && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs">✓</span>
                    <p className="text-green-400 text-xs tracking-wide">
                      Username available
                    </p>
                  </div>
                )}

                {!checkingUsername && usernameValidation.valid && username.length >= 6 && usernameAvailable === false && (
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xs">✗</span>
                    <p className="text-red-400 text-xs tracking-wide">
                      Username already taken
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Full Name Field */}
            <div className="space-y-4">
              <label className="text-[10px] tracking-[0.4em] opacity-50" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                FULL NAME
              </label>
              <input
                type="text"
                placeholder="your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                minLength={1}
                className="w-full px-0 py-4 bg-transparent border-b-2 border-white focus:outline-none focus:border-b-4 transition-all text-xl tracking-wider text-white placeholder-white/30"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-white text-black border-2 border-white">
                <p className="text-xs tracking-wider font-bold">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleFinishOnboarding}
              disabled={!canSubmit || !fullName.trim()}
              className="w-full py-5 bg-white text-black hover:bg-black hover:text-white hover:border-white border-2 border-white transition-all text-sm tracking-[0.4em] font-black disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {saving ? "CREATING..." : "CONTINUE"}
            </button>

            {/* Footer note */}
            <div className="text-center pt-6">
              <p className="text-[9px] tracking-[0.5em] opacity-30" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                → USERNAME CANNOT BE CHANGED
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}