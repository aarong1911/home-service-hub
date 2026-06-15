/// <reference types="node" />
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Normalize any phone format to E.164 (+1XXXXXXXXXX) for Twilio
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };

  // Validate auth token
  const authToken = event.headers.authorization?.slice(7);
  if (!authToken) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  const { data: { user } } = await supabaseAdmin.auth.getUser(authToken);
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid token" }) };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  let orgId: string | null = profile?.organization_id ?? null;
  if (!orgId) {
    const { data: membership } = await supabaseAdmin
      .from("org_memberships")
      .select("org_id")
      .eq("member_id", user.id)
      .maybeSingle();
    orgId = membership?.org_id ?? null;
  }
  if (!orgId) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "No organization found" }) };

  // Parse request body
  let reqBody: { channel: string; to: string; body: string; subject?: string; from_name?: string };
  try {
    reqBody = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { channel, to, body, subject, from_name } = reqBody;
  if (!channel || !to || !body) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "channel, to, body are required" }) };
  }

  try {
    if (channel === "sms") {
      // Fetch org's Twilio credentials from integration_settings
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("integration_settings")
        .eq("id", orgId)
        .maybeSingle();

      const twilio = org?.integration_settings?.twilio;
      if (!twilio?.accountSid || !twilio?.authToken || !twilio?.phoneNumber) {
        return {
          statusCode: 422,
          headers: CORS,
          body: JSON.stringify({ error: "Twilio not configured — go to Settings → Integrations → Twilio to add your credentials" }),
        };
      }

      const { accountSid, authToken, phoneNumber } = twilio;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: toE164(phoneNumber),
            To:   toE164(to),
            Body: body,
          }).toString(),
        },
      );

      if (!res.ok) {
        const err: any = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Twilio error ${res.status}: ${err.code ?? ""}`);
      }
    } else if (channel === "email") {
      // Fetch org's Gmail credentials from integration_settings
      const { data: orgForEmail } = await supabaseAdmin
        .from("organizations")
        .select("integration_settings")
        .eq("id", orgId)
        .maybeSingle();

      const gmail = orgForEmail?.integration_settings?.gmail;
      if (!gmail?.email || !gmail?.appPassword) {
        return {
          statusCode: 422,
          headers: CORS,
          body: JSON.stringify({ error: "Gmail not configured — go to Settings → Integrations → Gmail to add your credentials" }),
        };
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmail.email, pass: gmail.appPassword },
      });
      await transporter.sendMail({
        from: `${from_name ?? "RenoMeta Connect"} <${gmail.email}>`,
        to,
        subject: subject || "(no subject)",
        text: body,
      });
    }
    // "note" channel: server-side no-op

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    console.error("[send-inbox-message]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
