// netlify/functions/meta-disconnect.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// meta-disconnect.ts
//
// POST { product?: "whatsapp" | "messenger" | "instagram" | "lead_ads" }
// If `product` is given, removes just that product from connected_products
// (leaving the token/profile in place if other products still use it).
// If omitted, deletes the whole meta_connections row for the org.
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

  let reqBody: { product?: string } = {};
  try { reqBody = JSON.parse(event.body ?? "{}"); } catch { /* default {} */ }

  if (!reqBody.product) {
    // Full disconnect with no product specified — still avoid nuking an
    // unrelated pre-existing Ads connection. Just clear connected_products
    // and the messaging-product fields rather than deleting the row if an
    // ad_account_id is present.
    const { data: existing } = await supabaseAdmin
      .from("meta_connections")
      .select("ad_account_id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (existing?.ad_account_id) {
      const { error } = await supabaseAdmin
        .from("meta_connections")
        .update({ connected_products: [], updated_at: new Date().toISOString() })
        .eq("org_id", orgId);
      if (error) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    const { error } = await supabaseAdmin.from("meta_connections").delete().eq("org_id", orgId);
    if (error) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
  }

  const { data: existing } = await supabaseAdmin
    .from("meta_connections")
    .select("connected_products, ad_account_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!existing) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
  }

  const remaining = (existing.connected_products ?? []).filter((p: string) => p !== reqBody.product);

  // Only fully delete the row if nothing else is using it — that includes
  // an Ads connection (ad_account_id) that may predate connected_products
  // and isn't tracked in that array at all. Otherwise just shrink the array.
  if (remaining.length === 0 && !existing.ad_account_id) {
    const { error } = await supabaseAdmin.from("meta_connections").delete().eq("org_id", orgId);
    if (error) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    }
  } else {
    const { error } = await supabaseAdmin
      .from("meta_connections")
      .update({ connected_products: remaining, updated_at: new Date().toISOString() })
      .eq("org_id", orgId);
    if (error) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
};