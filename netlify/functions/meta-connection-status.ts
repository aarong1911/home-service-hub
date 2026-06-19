// netlify/functions/meta-connection-status.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// meta-connection-status.ts
//
// Returns the org's meta_connections row MINUS the encrypted access_token,
// for display in Settings → Integrations (connected user name/picture,
// business name, which products are linked). Auth required — caller must
// be a logged-in org member.
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

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") {
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

  const { data: conn, error } = await supabaseAdmin
    .from("meta_connections")
    .select(
      "meta_user_id, meta_user_name, meta_user_picture_url, business_id, business_name, " +
      "page_id, page_name, ig_actor_id, ig_username, waba_id, waba_phone_number_id, " +
      "waba_display_phone, ad_account_id, ad_account_name, connected_products, " +
      "is_active, expires_at, updated_at",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[meta-connection-status] query error:", error.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Lookup failed" }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ connection: conn ?? null }) };
};