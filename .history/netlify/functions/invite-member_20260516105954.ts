
// netlify/functions/invite-member.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Verify caller is authenticated
  const authHeader = event.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
  }

  // Get caller's org
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.organization_id;
  if (!orgId) {
    return { statusCode: 400, body: JSON.stringify({ error: "No organization found" }) };
  }

  // Parse body
  let body: { email: string; role: string; name?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, role, name } = body;
  if (!email || !role) {
    return { statusCode: 400, body: JSON.stringify({ error: "email and role are required" }) };
  }

  // Get org name for the email
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  const orgName = org?.name || "your team";

  // Save invitation record
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from("invitations")
    .insert({
      organization_id: orgId,
      email,
      role,
      status: "pending",
      invited_by: user.id,
      token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (invErr) {
    console.error("[invite-member] DB insert failed:", invErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to create invitation" }) };
  }

  // Send invitation email via Supabase Auth
  // This sends a magic link that creates/signs in the user
  const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.URL ?? "https://connect.renometa.com"}/settings/team?invited=true`,
    data: {
      invitation_id: invitation.id,
      org_id: orgId,
      org_name: orgName,
      role,
      invited_name: name || "",
    },
  });

  if (inviteErr) {
    console.error("[invite-member] auth invite failed:", inviteErr);
    // Don't fail — invitation record is created, email just didn't send
    return {
      statusCode: 207,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        invitationId: invitation.id,
        error: `Invitation saved but email failed: ${inviteErr.message}`,
      }),
    };
  }

  console.log(`[invite-member] invited ${email} to org ${orgId} as ${role}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, invitationId: invitation.id }),
  };
};