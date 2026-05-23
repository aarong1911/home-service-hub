/// <reference types="node" />
// netlify/functions/accept-invite.ts
// Validates invitation token, creates auth user, adds to org, returns session
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  let body: { token: string; password: string; firstName: string; lastName: string; phone?: string };
  try { body = JSON.parse(event.body ?? "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { token, password, firstName, lastName, phone } = body;
  if (!token || !password) return { statusCode: 400, body: JSON.stringify({ error: "token and password required" }) };

  // Validate invitation token
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (invErr || !invitation) {
    return { statusCode: 404, body: JSON.stringify({ error: "Invalid or expired invitation" }) };
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    return { statusCode: 410, body: JSON.stringify({ error: "Invitation has expired" }) };
  }

  const { email, organization_id: orgId, role } = invitation;

  // Create auth user
  const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // Add metadata separately after user is created
  if (!createErr && newUser?.user) {
    await supabaseAdmin.auth.admin.updateUserById(newUser.user.id, {
      user_metadata: {
        first_name:    firstName,
        last_name:     lastName,
        full_name:     `${firstName} ${lastName}`.trim(),
        phone:         phone || null,
        org_id:        orgId,
        role,
        invitation_id: invitation.id,
      },
    });
  }

  if (createErr) {
    // If user already exists, update their password instead
    if (createErr.message?.includes("already been registered") || createErr.code === "email_exists") {
      const { data: rows } = await supabaseAdmin.rpc("get_user_id_by_email", { user_email: email });
      const existingId = rows?.[0]?.id;
      if (existingId) {
        await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password,
          user_metadata: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim(), phone: phone || null },
        });
      }
    } else {
      console.error("[accept-invite] createUser failed:", createErr);
      return { statusCode: 500, body: JSON.stringify({ error: createErr.message }) };
    }
  }

  const userId = newUser?.user?.id ?? (await supabaseAdmin.rpc("get_user_id_by_email", { user_email: email })).data?.[0]?.id;

  if (!userId) {
    return { statusCode: 500, body: JSON.stringify({ error: "Could not resolve user ID" }) };
  }

  // Upsert profile
  await supabaseAdmin.from("profiles").upsert({
    id:              userId,
    email,
    first_name:      firstName,
    last_name:       lastName,
    phone:           phone || null,
    organization_id: orgId,
  }, { onConflict: "id" });

  // Add to org_memberships
  await supabaseAdmin.from("org_memberships").upsert({
    member_id: userId,
    org_id:    orgId,
    role,
  }, { onConflict: "member_id,org_id" });

  // Mark invitation accepted
  await supabaseAdmin.from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  // Set phone on auth row
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
    if (e164) await supabaseAdmin.auth.admin.updateUserById(userId, { phone: e164 });
  }

  console.log(`[accept-invite] user ${email} joined org ${orgId} as ${role}`);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, email }),
  };
};