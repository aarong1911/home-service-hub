/// <reference types="node" />
// netlify/functions/invite-member.ts
// Flow: save invitation → generate invite link (no Supabase email) → send via Gmail SMTP
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Verify caller
  const token = event.headers.authorization?.slice(7);
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };

  // Get caller's org
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return { statusCode: 400, body: JSON.stringify({ error: "No organization found" }) };

  // Parse body
  let body: { email: string; role: string; name?: string; phone?: string };
  try { body = JSON.parse(event.body ?? "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { email, role, name, phone } = body;
  if (!email || !role) return { statusCode: 400, body: JSON.stringify({ error: "email and role required" }) };

  // Get org name
  const { data: org } = await supabaseAdmin
    .from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = org?.name || "your team";

  // Parse name
  const nameParts = (name ?? "").trim().split(" ");
  const firstName = nameParts[0] || null;
  const lastName  = nameParts.slice(1).join(" ") || null;

  // Clean up any existing unconfirmed auth user (re-invite flow)
  try {
    const { data: rows } = await supabaseAdmin.rpc("get_user_id_by_email", { user_email: email });
    const existingId = rows?.[0]?.id;
    if (existingId) {
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(existingId);
      if (existing?.user && !existing.user.email_confirmed_at) {
        await supabaseAdmin.auth.admin.deleteUser(existingId);
        console.log(`[invite-member] cleaned up unconfirmed user for ${email}`);
      }
    }
  } catch (err) {
    console.warn("[invite-member] cleanup check failed (non-fatal):", err);
  }

  // Save invitation record
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from("invitations")
    .insert({
      organization_id: orgId,
      email,
      role,
      status:     "pending",
      invited_by: user.id,
      token:      crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      first_name: firstName,
      last_name:  lastName,
    })
    .select("id")
    .single();

  if (invErr) {
    console.error("[invite-member] DB insert failed:", invErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to create invitation" }) };
  }

  // Generate invite link without sending email (no Supabase rate limit)
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: "http://localhost:9999/auth/callback",
      data: {
        invitation_id: invitation.id,
        org_id:        orgId,
        org_name:      orgName,
        role,
        invited_name:  name || "",
        full_name:     name || email,
        first_name:    firstName,
        last_name:     lastName,
        phone:         phone || "",
      },
    },
  });

  if (linkErr) {
    console.error("[invite-member] generateLink failed:", linkErr);
    return {
      statusCode: 207,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, invitationId: invitation.id, error: linkErr.message }),
    };
  }

  const inviteUrl = linkData.properties?.action_link;

  // Send email via Gmail SMTP (no Supabase rate limit)
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"RenoMeta Connect" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `You've been invited to join ${orgName} on RenoMeta Connect`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#111">You've been invited!</h2>
          <p>Hi${name ? ` ${name}` : ""},</p>
          <p>You've been invited to join <strong>${orgName}</strong> as <strong>${role.replace("_", " ")}</strong> on RenoMeta Connect.</p>
          <p style="margin:28px 0">
            <a href="${inviteUrl}"
              style="background:#3b82f6;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">
              Accept Invitation &amp; Set Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px;">This link expires in 7 days. If you didn't expect this, you can ignore this email.</p>
        </div>
      `,
    });

    console.log(`[invite-member] email sent to ${email} for org ${orgId} as ${role}`);
  } catch (mailErr) {
    console.error("[invite-member] email send failed:", mailErr);
    return {
      statusCode: 207,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        invitationId: invitation.id,
        error: `Invitation saved but email failed: ${(mailErr as Error).message}`,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, invitationId: invitation.id }),
  };
};