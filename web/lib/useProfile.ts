"use client";

import { useEffect, useState } from "react";
import { PROFILE_CHANGE_EVENT, loadProfile, type UserProfile } from "@/lib/profile";

/** The saved profile, kept current when it is edited or switched on/off elsewhere on the page. */
export function useProfile(): UserProfile | null {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const refresh = () => setProfile(loadProfile());
    refresh();
    window.addEventListener(PROFILE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_CHANGE_EVENT, refresh);
  }, []);

  return profile;
}
