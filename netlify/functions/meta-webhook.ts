// netlify/functions/meta-webhook.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Required Supabase table (run once in the SQL editor):
//
// CREATE TABLE inbox_messages (
//   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
//   contact_id   uuid REFERENCES contacts(id) ON DELETE SET NULL,
//   channel      text NOT NULL,
//   direction    text NOT NULL CHECK (direction IN ('in', 'out')),
//   body         text NOT NULL DEFAULT '',
//   from_address text,
//   received_at  timestamptz NOT NULL DEFAULT now(),
//   meta         jsonb
// );
// CREATE INDEX ON inbox_messages (org_id, received_at DESC);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const handler: Handler = async (event) => {
  // ── GET — Meta webhook verification ────────────────────────────────────────
  if (event.httpMethod === "GET") {
    const p = event.queryStringParameters ?? {};
    const mode      = p["hub.mode"];
    const token     = p["hub.verify_token"];
    const challenge = p["hub.challenge"] ?? "";

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
      return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: challenge };
    }
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Forbidden" }) };
  }

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // ── POST — incoming WhatsApp message ───────────────────────────────────────
  // Meta requires a 200 response quickly or it will retry. Process inline —
  // Supabase ops are fast enough that we won't hit the 20-second timeout.
  try {
    await processPayload(event.body ?? "{}");
  } catch (err: any) {
    console.error("[meta-webhook] unhandled error:", err.message);
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};

async function processPayload(rawBody: string): Promise<void> {
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return;
  }

  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    const wabaId: string = entry.id; // WhatsApp Business Account ID

    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value ?? {};

      for (const msg of value.messages ?? []) {
        // Skip non-text for now (image, audio, etc.)
        if (msg.type !== "text") continue;

        const fromPhone: string  = msg.from;                  // digits only, no leading +
        const body: string       = msg.text?.body ?? "";
        const msgId: string      = msg.id;
        const receivedAt: string = new Date(parseInt(msg.timestamp, 10) * 1000).toISOString();
        const senderName: string = value.contacts?.[0]?.profile?.name ?? fromPhone;

        // Find the org whose WhatsApp connection matches this WABA ID.
        // Primary path: meta_connections (real OAuth flow, see
        // .claude/skills/meta-integrations/SKILL.md). Falls back to the
        // legacy organizations.integration_settings JSONB path so any
        // connections made before the meta_connections migration still
        // route correctly — remove the fallback once confirmed unused.
        let orgId: string | undefined;

        const { data: connRow, error: connErr } = await supabaseAdmin
          .from("meta_connections")
          .select("org_id")
          .eq("waba_id", wabaId)
          .maybeSingle();

        if (connErr) {
          console.error("[meta-webhook] meta_connections lookup error:", connErr.message);
        }
        orgId = connRow?.org_id;

        if (!orgId) {
          const { data: orgs, error: orgErr } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .filter("integration_settings->whatsapp->>waba_id", "eq", wabaId);

          if (orgErr) {
            console.error("[meta-webhook] legacy org lookup error:", orgErr.message);
          }
          orgId = orgs?.[0]?.id;
        }

        if (!orgId) {
          console.warn("[meta-webhook] no org found for waba_id:", wabaId);
          continue;
        }

        const e164 = `+${fromPhone}`;

        // Upsert contact by phone so they appear in the Inbox conversation list
        const { data: contactRow, error: contactErr } = await supabaseAdmin
          .from("contacts")
          .upsert(
            { org_id: orgId, phone: e164, full_name: senderName },
            { onConflict: "org_id,phone" },
          )
          .select("id")
          .maybeSingle();

        if (contactErr) {
          console.error("[meta-webhook] contact upsert error:", contactErr.message);
        }

        const contactId: string | null = contactRow?.id ?? null;

        // Persist the inbound message
        const { error: insertErr } = await supabaseAdmin
          .from("inbox_messages")
          .insert({
            org_id:       orgId,
            contact_id:   contactId,
            channel:      "whatsapp",
            direction:    "in",
            body,
            from_address: e164,
            received_at:  receivedAt,
            meta:         { waba_id: wabaId, msg_id: msgId },
          });

        if (insertErr) {
          console.error("[meta-webhook] message insert error:", insertErr.message);
        }
      }
    }
  }
}