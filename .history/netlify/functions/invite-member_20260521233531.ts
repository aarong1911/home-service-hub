// netlify/functions/invite-member.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const token = event.headers.authorization?.slice(7);
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return { statusCode: 400, body: JSON.stringify({ error: "No organization found" }) };

  let body: { email: string; role: string; name?: string; phone?: string };
  try { body = JSON.parse(event.body ?? "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { email, role, name, phone } = body;
  if (!email || !role) return { statusCode: 400, body: JSON.stringify({ error: "email and role required" }) };

  const { data: org } = await supabaseAdmin
    .from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = org?.name || "your team";

  const nameParts = (name ?? "").trim().split(" ");
  const firstName = nameParts[0] || null;
  const lastName  = nameParts.slice(1).join(" ") || null;

  // Generate a unique invitation token
  const invToken = crypto.randomUUID();

  // Save invitation record
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from("invitations")
    .insert({
      organization_id: orgId,
      email,
      role,
      status:     "pending",
      invited_by: user.id,
      token:      invToken,
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

  // Build invite URL using our own token — no Supabase auth URL, no hash tokens
  const baseUrl = process.env.URL ?? "http://localhost:9999";
  const inviteUrl = `${baseUrl}/auth/callback?token=${invToken}`;

  // Send email via Gmail SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"RenoMeta Connect" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `You've been invited to join ${orgName} on RenoMeta Connect`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#111">You've been invited!</h2>
          <p>Hi${name ? ` ${name}` : ""},</p>
          <p>You've been invited to join <strong>${orgName}</strong> as <strong>${role.replace(/_/g, " ")}</strong> on RenoMeta Connect.</p>
          <p style="margin:28px 0">
            <a href="${inviteUrl}"
              style="background:#3b82f6;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">
              Accept Invitation &amp; Set Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px;">This link expires in 7 days.</p>
        </div>
      `,
    });

    console.log(`[invite-member] invited ${email} to org ${orgId} as ${role}`);
  } catch (mailErr) {
    console.error("[invite-member] email failed:", mailErr);
    return {
      statusCode: 207,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false, invitationId: invitation.id,
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