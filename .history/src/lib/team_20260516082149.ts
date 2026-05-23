// src/lib/team.ts
import { supabase } from "@/lib/supabase";

export type InviteResult =
  | { success: true; invitationId: string }
  | { success: false; error: string };

export async function inviteMember(params: {
  email: string;
  role: string;
  name?: string;
}): Promise<InviteResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const res = await fetch("/.netlify/functions/invite-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (res.status === 207) {
    // Invitation saved but email failed
    return { success: false, error: data.error };
  }

  if (!res.ok) {
    return { success: false, error: data.error ?? "Invitation failed" };
  }

  return { success: true, invitationId: data.invitationId };
}