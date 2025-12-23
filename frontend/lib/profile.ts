import { supabase } from "./supabase/client";

export async function getProfileOrRedirect() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name")
    .eq("id", user.id)
    .single();

  return { user, profile };
}