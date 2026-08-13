import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";
import type { ProfileRow } from "@/types/database";

/**
 * 認可の階層 1〜2 段目(docs/02-architecture.md §4)。
 * ここでの判定は UX のためのものであり、最終的な境界は RLS(3段目)にある。
 */

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    anonymousId: row.anonymous_id,
    ageRange: row.age_range,
    interviewCompletedAt: row.interview_completed_at,
    notificationsEnabled: row.notifications_enabled,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/** 未ログイン → /login */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/** profile なし → /invite */
export async function requireProfile(): Promise<Profile> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (!data) {
    redirect("/invite");
  }

  return toProfile(data);
}

/** interview_completed_at が NULL → /interview */
export async function requireInterviewed(): Promise<Profile> {
  const profile = await requireProfile();

  if (!profile.interviewCompletedAt) {
    redirect("/interview");
  }

  return profile;
}
