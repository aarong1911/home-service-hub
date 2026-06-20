// netlify/functions/send-inbox-message.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "node:crypto";

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

// Matches the encrypt half in meta-oauth-callback.ts — "enc:" + base64(iv||tag||ciphertext).
// Legacy rows from before this scheme shipped may be bare plaintext with no prefix.
function decryptOrPlaintext(stored: string): string {
  if (!stored.startsWith("enc:")) return stored;
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey) throw new Error("ENCRYPTION_KEY env var is not set — cannot decrypt Meta token");
  const raw = Buffer.from(stored.slice(4), "base64");
  const key = crypto.createHash("sha256").update(encKey).digest();
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

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
  let reqBody: { channel: string; to: string; body: string; subject?: string; from_name?: string; contact_id?: string };
  try {
    reqBody = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { channel, to, body, subject, from_name, contact_id } = reqBody;
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
    } else if (channel === "whatsapp" || channel === "messenger" || channel === "instagram") {
      const { data: conn, error: connErr } = await supabaseAdmin
        .from("meta_connections")
        .select("waba_phone_number_id, page_id, access_token, connected_products")
        .eq("org_id", orgId)
        .maybeSingle();

      const connectedProducts: string[] = conn?.connected_products ?? [];
      const productKey = channel === "whatsapp" ? "whatsapp" : channel === "messenger" ? "messenger" : "instagram";

      if (connErr || !conn || !conn.access_token || !connectedProducts.includes(productKey)) {
        return {
          statusCode: 422,
          headers: CORS,
          body: JSON.stringify({ error: `${channel === "whatsapp" ? "WhatsApp" : channel === "messenger" ? "Messenger" : "Instagram"} is not connected — go to Settings → Integrations to connect it` }),
        };
      }

      let accessToken: string;
      try {
        accessToken = decryptOrPlaintext(conn.access_token as string);
      } catch (e: any) {
        console.error("[send-inbox-message] token decrypt failed:", e.message);
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not read stored credentials — try reconnecting in Settings" }) };
      }

      if (channel === "whatsapp") {
        if (!conn.waba_phone_number_id) {
          return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: "No WhatsApp phone number on this connection — try reconnecting" }) };
        }
        // Meta's recipient allow-list (Development-mode WhatsApp numbers)
        // does an EXACT match against the full international format — a
        // 10-digit US number with no country code (e.g. "9548718466", as
        // many contacts are stored) is rejected with "(#131030) Recipient
        // phone number not in allowed list" even after that same number was
        // added/verified through Meta's console, since the console
        // stores/compares the full E.164 form. Reuse the same toE164()
        // normalizer SMS/Twilio already uses below, just without the "+"
        // since the Graph API's `to` field wants bare digits.
        const toDigits = toE164(to).replace("+", "");
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${conn.waba_phone_number_id}/messages`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: toDigits,
              type: "text",
              text: { body },
            }),
          },
        );
        if (!res.ok) {
          const err: any = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? `WhatsApp send failed (${res.status})`);
        }
      } else {
        // Messenger and Instagram both send through the same Page-scoped
        // /me/messages endpoint — `to` here is the contact's PSID (Messenger)
        // or IGSID (Instagram), resolved by the caller from
        // contacts.messenger_psid / contacts.instagram_igsid, NOT a phone
        // number or username.
        const res = await fetch(
          `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: to },
              message: { text: body },
            }),
          },
        );
        if (!res.ok) {
          const err: any = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? `${channel} send failed (${res.status})`);
        }
      }
    }
    // "note" channel: server-side no-op

    // Persist the outbound message for the 4 channels that have a real
    // table for it (see supabase/migrations/005_sms_meta_messages.sql).
    // Email is NOT included here — it has its own dedicated tables
    // (inbox_emails / emails / gmail_messages) with a richer schema
    // (gmail_message_id, body_html, thread linkage) that almost certainly
    // already has its own sync/send logic elsewhere; duplicating that here
    // without seeing it risks creating a second, conflicting source of
    // truth for email history. "note" is a client-side-only concept with
    // no external send and no persistence table.
    if (channel === "sms" || channel === "whatsapp" || channel === "messenger" || channel === "instagram") {
      const { error: insertErr } = await supabaseAdmin.from("sms_meta_messages").insert({
        org_id: orgId,
        contact_id: contact_id ?? null,
        channel,
        direction: "out",
        body,
        from_address: to,
        meta: null,
      });
      if (insertErr) {
        // Don't fail the request over this — the external send already
        // succeeded, losing the local history row is a lesser problem than
        // reporting a false failure to the user.
        console.error("[send-inbox-message] sms_meta_messages insert failed:", insertErr.message);
      }
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    console.error("[send-inbox-message]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};