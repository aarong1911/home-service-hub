// src/lib/team.ts
import { supabase } from "@/lib/supabase";

export type InviteResult =
  | { success: true; invitationId: string }
  | { success: false; error: string };

export type RemoveResult =
  | { success: true }
  | { success: false; error: string };

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function inviteMember(params: {
  email: string; role: string; name?: string; phone?: string; workerType?: string;
}): Promise<InviteResult> {
  const token = await getToken();
  if (!token) return { success: false, error: "Not authenticated" };

  const res = await fetch("/.netlify/functions/invite-member", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (res.status === 207) return { success: false, error: data.error };
  if (!res.ok)           return { success: false, error: data.error ?? "Invitation failed" };
  return { success: true, invitationId: data.invitationId };
}

export async function removeMemberFromOrg(params: {
  memberId?: string;      // for active members — their auth user ID
  invitationId?: string;  // for invited members — the inv-xxx id from the store
}): Promise<RemoveResult> {
  const token = await getToken();
  if (!token) return { success: false, error: "Not authenticated" };

  // Strip the "inv-" prefix to get the real invitation UUID
  const invitationId = params.invitationId?.startsWith("inv-")
    ? params.invitationId.slice(4)
    : params.invitationId;

  const res = await fetch("/.netlify/functions/remove-member", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ memberId: params.memberId, invitationId }),
  });

  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error ?? "Remove failed" };
  return { success: true };
}