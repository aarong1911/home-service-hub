/// <reference types="node" />
// netlify/functions/invite-member.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FIELD_APP_URL  = "https://field.renometa.com";
const PORTAL_APP_URL = "https://portal.renometa.com";

function getInviteUrl(role: string, isOffline: boolean, token: string, baseUrl: string): string {
  if (role === "field_worker" && isOffline) return `${FIELD_APP_URL}/welcome?token=${token}`;
  if (role === "viewer")                    return `${PORTAL_APP_URL}/portal?token=${token}`;
  return `${baseUrl}/auth/callback?token=${token}`;
}

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

  let body: {
    email: string; role: string; name?: string; phone?: string;
    workerType?: string; isOffline?: boolean; rosterOnly?: boolean;
  };
  try { body = JSON.parse(event.body ?? "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { email, role, name, phone, workerType, isOffline = false, rosterOnly = false } = body;
  if (!email || !role) return { statusCode: 400, body: JSON.stringify({ error: "email and role required" }) };

  const { data: org } = await supabaseAdmin
    .from("organizations").select("name, phone").eq("id", orgId).maybeSingle();
  const orgName  = org?.name  || "your team";
  const orgPhone = org?.phone || "";

  const nameParts = (name ?? "").trim().split(" ");
  const firstName = nameParts[0] || null;
  const lastName  = nameParts.slice(1).join(" ") || null;
  const invToken  = crypto.randomUUID();

  // Save invitation
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from("invitations")
    .insert({
      organization_id: orgId,
      email,
      role,
      status:        rosterOnly ? "roster_only" : "pending",
      invited_by:    user.id,
      token:         invToken,
      expires_at:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      first_name:    firstName,
      last_name:     lastName,
      primary_phone: phone || null,
      worker_type:   workerType || "employee",
    })
    .select("id")
    .single();

  if (invErr) {
    console.error("[invite-member] DB insert failed:", invErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to create invitation" }) };
  }

  // Roster-only — save to local team list, no email sent
  if (rosterOnly) {
    console.log(`[invite-member] roster-only: ${email} added to org ${orgId}`);
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, invitationId: invitation.id, rosterOnly: true }) };
  }

  const baseUrl    = process.env.URL ?? "http://localhost:9999";
  const inviteUrl  = getInviteUrl(role, isOffline, invToken, baseUrl);
  const isExternal = role === "field_worker" && isOffline || role === "viewer";

  // Build email content based on destination
  let emailHtml: string;
  if (role === "field_worker" && isOffline) {
    emailHtml = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">You've been added to the ${orgName} team!</h2>
        <p>Hi${name ? ` ${name}` : ""},</p>
        <p>You have been added to the <strong>${orgName}</strong> roster as <strong>Field Crew / Technician</strong>.</p>
        <p style="margin:28px 0">
          <a href="${inviteUrl}" style="background:#F59E0B;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">
            View Your Team Profile
          </a>
        </p>
        ${orgPhone ? `<p><a href="tel:${orgPhone}" style="color:#3b82f6">📞 Call the office: ${orgPhone}</a></p>` : ""}
        <p style="color:#6b7280;font-size:13px;">No account or password needed.</p>
      </div>`;
  } else if (role === "viewer") {
    emailHtml = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">Your project portal is ready</h2>
        <p>Hi${name ? ` ${name}` : ""},</p>
        <p><strong>${orgName}</strong> has set up a project portal for you to track progress, milestones, and site photos.</p>
        <p style="margin:28px 0">
          <a href="${inviteUrl}" style="background:#3b82f6;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">
            View Your Project Portal
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">No account or password needed. This link is private — just for you.</p>
      </div>`;
  } else {
    emailHtml = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">You've been invited!</h2>
        <p>Hi${name ? ` ${name}` : ""},</p>
        <p>You've been invited to join <strong>${orgName}</strong> as <strong>${role.replace(/_/g, " ")}</strong> on RenoMeta Connect.</p>
        <p style="margin:28px 0">
          <a href="${inviteUrl}" style="background:#3b82f6;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">
            Accept Invitation &amp; Set Password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">This link expires in 7 days.</p>
      </div>`;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"RenoMeta Connect" <${process.env.SMTP_USER}>`,
      to: email,
      subject: isExternal
        ? role === "viewer" ? `Your project portal from ${orgName}` : `You've been added to the ${orgName} team`
        : `You've been invited to join ${orgName} on RenoMeta Connect`,
      html: emailHtml,
    });
    console.log(`[invite-member] sent to ${email} (${role}, offline=${isOffline})`);
  } catch (mailErr) {
    console.error("[invite-member] email failed:", mailErr);
    return { statusCode: 207, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, invitationId: invitation.id,
        error: `Invitation saved but email failed: ${(mailErr as Error).message}` }) };
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, invitationId: invitation.id }) };
};