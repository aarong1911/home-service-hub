// netlify/functions/meta-send-whatsapp.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────
// meta-send-whatsapp.ts
//
// POST { contactId?: string, toPhone?: string, body: string }
// Sends a WhatsApp text message via the org's connected WABA phone number,
// then logs it to inbox_messages as an outbound row (mirrors meta-webhook.ts
// inbound handling so both directions show up in the Inbox thread).
// ─────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Matches the encrypt half in meta-oauth-callback.ts: AES-256-GCM, value
// stored as "enc:" + base64(iv(12) || authTag(16) || ciphertext) in the
// `access_token` text column. Any row written before this scheme shipped
// (e.g. a pre-existing Meta Ads connection) may still hold a bare plaintext
// token with no "enc:" prefix — return it unchanged in that case rather
// than attempting to decrypt it.
function decryptOrPlaintext(stored: string): string {
  if (!stored.startsWith("enc:")) {
    return stored; // legacy plaintext token
  }
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

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const authToken = event.headers.authorization?.slice(7);
  if (!authToken) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  const { data: { user } } = await supabaseAdmin.auth.getUser(authToken);
  if (!user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid token" }) };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No organization" }) };
  }

  let reqBody: { contactId?: string; toPhone?: string; body?: string };
  try {
    reqBody = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const msgText = (reqBody.body ?? "").trim();
  if (!msgText) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Message body is required" }) };
  }

  let toPhone = reqBody.toPhone;
  let contactId = reqBody.contactId ?? null;

  if (!toPhone && contactId) {
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("phone")
      .eq("id", contactId)
      .eq("org_id", orgId)
      .maybeSingle();
    toPhone = contact?.phone;
  }
  if (!toPhone) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "toPhone or a valid contactId is required" }) };
  }

  const { data: conn, error: connErr } = await supabaseAdmin
    .from("meta_connections")
    .select("waba_phone_number_id, access_token, connected_products")
    .eq("org_id", orgId)
    .maybeSingle();

  if (connErr || !conn || !conn.waba_phone_number_id || !conn.access_token) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "WhatsApp is not connected for this organization" }) };
  }
  if (!(conn.connected_products ?? []).includes("whatsapp")) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "WhatsApp is not an active product on this connection" }) };
  }

  let accessToken: string;
  try {
    accessToken = decryptOrPlaintext(conn.access_token as string);
  } catch (e: any) {
    console.error("[meta-send-whatsapp] token decrypt failed:", e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not read stored WhatsApp credentials — try reconnecting" }) };
  }

  const toDigits = toPhone.replace(/[^\d]/g, "");

  try {
    const sendRes = await fetch(
      `https://graph.facebook.com/v21.0/${conn.waba_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toDigits,
          type: "text",
          text: { body: msgText },
        }),
      },
    );
    const sendJson = await sendRes.json();

    if (!sendRes.ok) {
      console.error("[meta-send-whatsapp] Graph API send failed:", sendJson);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: sendJson?.error?.message ?? "WhatsApp send failed" }) };
    }

    const waMessageId = sendJson?.messages?.[0]?.id ?? null;

    await supabaseAdmin.from("inbox_messages").insert({
      org_id: orgId,
      contact_id: contactId,
      channel: "whatsapp",
      direction: "out",
      body: msgText,
      from_address: `+${toDigits}`,
      meta: { msg_id: waMessageId },
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, messageId: waMessageId }) };
  } catch (err: any) {
    console.error("[meta-send-whatsapp] unhandled error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Unexpected error sending WhatsApp message" }) };
  }
};