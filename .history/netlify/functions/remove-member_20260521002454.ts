// netlify/functions/remove-member.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  const token = event.headers.authorization?.slice(7);
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  // Verify caller
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };

  // Caller must be admin/owner of the org
  const { data: callerProfile } = await admin
    .from("profiles").select("organization_id").eq("id", caller.id).maybeSingle();
  const orgId = callerProfile?.organization_id;
  if (!orgId) return { statusCode: 403, body: JSON.stringify({ error: "No org found" }) };

  const { memberId, invitationId } = JSON.parse(event.body ?? "{}");

  // ── Case 1: Remove a pending invitation ───────────────────────────────────
  if (invitationId) {
    // Get the invitation to find the user ID
    const { data: inv } = await admin
      .from("invitations").select("*").eq("id", invitationId).eq("organization_id", orgId).maybeSingle();

    if (!inv) return { statusCode: 404, body: JSON.stringify({ error: "Invitation not found" }) };

    // Delete invitation row
    await admin.from("invitations").delete().eq("id", invitationId);

    // Find and delete the auth user created for this invite (if they haven't accepted yet)
    if (inv.email) {
      const { data: { users } } = await admin.auth.admin.listUsers();
      const invitedUser = users.find(u => u.email === inv.email && !u.email_confirmed_at);
      if (invitedUser) {
        await admin.auth.admin.deleteUser(invitedUser.id);
        console.log(`[remove-member] deleted unconfirmed auth user ${invitedUser.id}`);
      }
    }

    console.log(`[remove-member] removed invitation ${invitationId}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  // ── Case 2: Remove an active member ──────────────────────────────────────
  if (memberId) {
    // Prevent removing the org owner
    const { data: membership } = await admin
      .from("org_memberships").select("role").eq("member_id", memberId).eq("org_id", orgId).maybeSingle();

    if (membership?.role === "owner") {
      return { statusCode: 403, body: JSON.stringify({ error: "Cannot remove the owner" }) };
    }

    // Remove from org_memberships
    await admin.from("org_memberships").delete().eq("member_id", memberId).eq("org_id", orgId);

    // Clear organization_id from profile (they keep their auth account)
    await admin.from("profiles").update({ organization_id: null }).eq("id", memberId);

    console.log(`[remove-member] removed member ${memberId} from org ${orgId}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "memberId or invitationId required" }) };
};