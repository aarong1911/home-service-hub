// netlify/functions/meta-create-ad-campaign.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────
// meta-create-ad-campaign.ts
//
// POST { name: string, dailyBudgetCents: number, objective: string }
// Creates a REAL campaign via the Meta Marketing API in the org's connected
// ad account (meta_connections.ad_account_id), always in PAUSED status with
// no ad sets/creative attached — so it costs nothing and spends nothing,
// while still being a genuine create call against the Marketing API. This
// exists specifically to demonstrate real Marketing API Access Tier usage
// for Meta App Review; see .claude/skills/meta-integrations/SKILL.md.
//
// Uses the same encrypted-or-legacy-plaintext token read as
// meta-send-whatsapp.ts (access_token column predates the "enc:" scheme).
// Note: meta-send-whatsapp.ts was deleted as redundant — its logic is
// now part of send-inbox-message.ts, which is the real call site.
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

const ALLOWED_OBJECTIVES = new Set([
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
]);

function decryptOrPlaintext(stored: string): string {
  if (!stored.startsWith("enc:")) return stored; // legacy plaintext token
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

  let reqBody: { name?: string; dailyBudgetCents?: number; objective?: string };
  try {
    reqBody = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const name = (reqBody.name ?? "").trim();
  const dailyBudgetCents = Number(reqBody.dailyBudgetCents);
  const objective = reqBody.objective ?? "OUTCOME_TRAFFIC";

  if (!name) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Campaign name is required" }) };
  }
  if (!Number.isFinite(dailyBudgetCents) || dailyBudgetCents < 100) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Daily budget must be at least $1.00 (100 cents)" }) };
  }
  if (!ALLOWED_OBJECTIVES.has(objective)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Objective must be one of: ${[...ALLOWED_OBJECTIVES].join(", ")}` }) };
  }

  const { data: conn, error: connErr } = await supabaseAdmin
    .from("meta_connections")
    .select("ad_account_id, ad_account_name, access_token")
    .eq("org_id", orgId)
    .maybeSingle();

  if (connErr || !conn || !conn.ad_account_id || !conn.access_token) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No connected Meta Ads account found — connect one in Settings → Integrations first" }) };
  }

  let accessToken: string;
  try {
    accessToken = decryptOrPlaintext(conn.access_token as string);
  } catch (e: any) {
    console.error("[meta-create-ad-campaign] token decrypt failed:", e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not read stored Meta Ads credentials — try reconnecting" }) };
  }

  // ad_account_id is stored without the "act_" prefix the Marketing API expects
  const actId = conn.ad_account_id.startsWith("act_") ? conn.ad_account_id : `act_${conn.ad_account_id}`;

  try {
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${actId}/campaigns`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          objective,
          // PAUSED is intentional and not a default to be changed casually —
          // this endpoint exists to demonstrate real Marketing API usage
          // without ever spending money. Do not change this to ACTIVE
          // without deliberately deciding the org wants live spend.
          status: "PAUSED",
          special_ad_categories: [],
          // Required when budget is set at the AD SET level (which this
          // flow does — see the ad set creation below) rather than at the
          // campaign level. false = no Advantage Campaign Budget sharing.
          // Without this, Meta rejects the request with error_subcode
          // 4834011: "Must specify True or False in is_adset_budget_sharing_enabled".
          is_adset_budget_sharing_enabled: false,
        }),
      },
    );
    const createJson = await createRes.json();

    if (!createRes.ok) {
      console.error("[meta-create-ad-campaign] Graph API create failed:", createJson);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: createJson?.error?.message ?? "Campaign creation failed" }) };
    }

    const campaignId = createJson.id;

    // Create a matching PAUSED ad set with the real daily budget, so the
    // demo shows more than a bare campaign shell — this is what actually
    // exercises budget-related Marketing API fields. Still PAUSED, still no
    // spend, since it has no creative/ads attached and isn't activated.
    let adSetId: string | null = null;
    try {
      const adSetRes = await fetch(
        `https://graph.facebook.com/v21.0/${actId}/adsets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `${name} — Ad Set`,
            campaign_id: campaignId,
            daily_budget: dailyBudgetCents,
            billing_event: "IMPRESSIONS",
            optimization_goal: objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "LINK_CLICKS",
            bid_strategy: "LOWEST_COST_WITHOUT_CAP",
            status: "PAUSED",
            targeting: { geo_locations: { countries: ["US"] } },
          }),
        },
      );
      const adSetJson = await adSetRes.json();
      if (adSetRes.ok) {
        adSetId = adSetJson.id;
      } else {
        console.warn("[meta-create-ad-campaign] ad set creation failed (campaign still created):", adSetJson);
      }
    } catch (e) {
      console.warn("[meta-create-ad-campaign] ad set creation error (campaign still created):", e);
    }

    // Create a matching ad_drafts row if that table already exists from the
    // earlier Make.com-era Ads work, so this shows up alongside any existing
    // drafts rather than only living on the Graph API side. Best-effort —
    // don't fail the whole request if this table doesn't have the columns
    // we expect.
    try {
      await supabaseAdmin.from("ad_drafts").insert({
        org_id: orgId,
        campaign_id: campaignId,
        ad_set_id: adSetId,
        name,
        objective,
        daily_budget_cents: dailyBudgetCents,
        status: "PAUSED",
        ad_account_id: conn.ad_account_id,
      });
    } catch (e) {
      console.warn("[meta-create-ad-campaign] ad_drafts insert skipped:", e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        campaignId,
        adSetId,
        adAccountName: conn.ad_account_name,
        status: "PAUSED",
      }),
    };
  } catch (err: any) {
    console.error("[meta-create-ad-campaign] unhandled error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Unexpected error creating campaign" }) };
  }
};