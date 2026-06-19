---
name: meta-integrations
description: >
  Meta (Facebook/Instagram/WhatsApp) OAuth and Graph API integration for
  Settings → Integrations. Covers Facebook Login for Business popup flow,
  meta_connections table, token encryption, Business Asset User Profile
  Access, WhatsApp Cloud API send/receive, and Meta App Review screen-recording
  requirements. Use whenever working on: settings.integrations.tsx for any
  Meta product (WhatsApp Business, Facebook Messenger, Instagram Direct, Meta
  Lead Ads), meta-oauth-start.ts, meta-oauth-callback.ts, meta-webhook.ts,
  meta-send-whatsapp.ts, meta_connections table, or Meta App Review /
  Business Verification submissions.
---

# Meta Integrations Skill

## Why this exists

RenoMeta Connect has 4 Meta-product integration cards in Settings →
Integrations (`whatsapp`, `fb-messenger`, `instagram-direct`, `meta-lead-ads`
in `src/lib/integrations-data.ts`). Before this skill, "Connect" just flipped
a local boolean — no real OAuth existed. This skill defines the real flow.

**Current scope:** WhatsApp Cloud API is fully wired (OAuth + webhook receive
+ send). The other 3 products get the same OAuth popup and profile capture,
but message sync is "coming soon" until built out per-product.

## Meta App Review context

Meta's review form for **Business Asset User Profile Access** asks for (1) a
written justification and (2) a screen recording. The justification should
state plainly: after a business connects their Meta account, RenoMeta reads
`id`/`name`/`picture` to show *which* Facebook identity and business is
connected in Settings → Integrations, so the contractor can verify the
correct account before relying on it for WhatsApp/Messenger/Instagram/Lead Ads
features. No marketing or ad-targeting use of this specific data.

The required screen recording must show, in order:
1. Log into RenoMeta Connect (connect.renometa.com)
2. Navigate to Settings → Integrations
3. Click "Connect" on a Meta product card → Facebook Login for Business opens
   in a **popup window** (not full-page redirect — Meta reviewers expect to
   see the popup pattern for web apps)
4. Authorize Business Asset access in that popup
5. Popup closes itself; user lands back on Integrations with no manual refresh
6. The card now shows "Connected" plus the connected Facebook user's name and
   profile picture, and the linked Business/Page/WABA name

Record this against a **fully working** flow, not a mock — Meta reviewers
test the actual app and will reject if behavior doesn't match the video.

## Architecture

### Database: `meta_connections`

**This table already existed before this skill was written** — it was built
for Meta Ads with this real, verified shape (confirmed via
`information_schema.columns`, not assumed):

```
id, org_id, user_id, meta_user_id, meta_user_name, access_token (text),
token_type, expires_at, granted_scopes (text[]), ad_account_id,
ad_account_name, page_id, page_name, ig_actor_id, is_active, connected_at,
updated_at
```

Two important real-world deviations from a "clean" design:
- **`access_token` is `text`, not `bytea`.** It was historically written as
  **plaintext**. New code writes an encrypted value into this same column as
  a string prefixed `"enc:"` followed by base64(iv\|\|authTag\|\|ciphertext).
  Any pre-existing row from before this scheme shipped may still hold a bare
  plaintext token with no prefix — reader code must check for the `enc:`
  prefix and fall back to treating the value as plaintext if absent. See
  `decryptOrPlaintext()` in `meta-send-whatsapp.ts`.
- **Field names use `meta_user_*` and `ad_account_*`**, not `fb_user_*` or
  `business_*` for the ad account. Don't rename existing columns — extend
  instead. `ad_account_id`/`ad_account_name` stay reserved for Meta Ads /
  Lead Ads; don't repurpose them for WhatsApp/Messenger/Instagram assets.

Extended (via `supabase/migrations/002_meta_connections_extend.sql`) with:

```sql
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS waba_id              text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS waba_phone_number_id text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS waba_display_phone   text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS ig_username          text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS meta_user_picture_url text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS business_id          text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS business_name        text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS connected_products   text[] NOT NULL DEFAULT '{}';
```

`connected_products` (e.g. `['whatsapp','messenger']`) is the only way to
tell which messaging products a row's token covers — `is_active` is a
single boolean for the whole row, not per-product, and predates this
feature. Treat `is_active` as "row not soft-deleted," not as a per-product
status.

**Before writing any code against this table in a future session: re-run**
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'meta_connections' ORDER BY ordinal_position;
```
**and confirm against this list rather than trusting this doc blindly** —
this exact mismatch (assumed schema vs. real schema) is what caused a
production SQL error (`column "waba_id" does not exist`) the first time
this feature was built, before the real columns were discovered.

### Token storage — `text` column with an `enc:` prefix, not `bytea`

Unlike GCal/Gmail (which use a `bytea` column), `meta_connections.access_token`
is `text` and pre-dates this feature with plaintext values in it. New code:

```typescript
// Encrypt (meta-oauth-callback.ts)
function encryptToken(plaintext: string): string {
  const key = crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY!).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc:" + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

// Decrypt with plaintext fallback (meta-send-whatsapp.ts)
function decryptOrPlaintext(stored: string): string {
  if (!stored.startsWith("enc:")) return stored; // legacy plaintext row
  const raw = Buffer.from(stored.slice(4), "base64");
  const key = crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY!).digest();
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
```

Don't try to retroactively encrypt old rows from SQL — there's no way to do
that safely without the plaintext value in hand. If an old Ads connection's
plaintext token needs encrypting, the cleanest path is to have the user
reconnect once, which overwrites it with an `enc:`-prefixed value.

### OAuth flow — popup, not full-page redirect

Full-page redirect would navigate the contractor's whole CRM tab to
Facebook and back, which is jarring and isn't what Meta reviewers expect to
see demoed for a web app. Use a popup:

```
Settings/Integrations card "Connect"
  → window.open(`/.netlify/functions/meta-oauth-start?orgId=...`, "meta-oauth", "width=600,height=700")
  → meta-oauth-start.ts redirects (302) to Facebook's OAuth dialog
  → user authorizes in the popup
  → Facebook redirects popup to meta-oauth-callback.ts
  → callback exchanges code, fetches profile + assets, encrypts + upserts meta_connections
  → callback responds with a tiny HTML page:
        <script>
          window.opener.postMessage({ source: "meta-oauth", success: true }, window.location.origin);
          window.close();
        </script>
  → parent window's `message` listener refreshes connection state, closes drawer, shows toast
```

Parent-side listener (in `settings.integrations.tsx` or the config drawer):

```typescript
useEffect(() => {
  function onMessage(e: MessageEvent) {
    if (e.origin !== window.location.origin) return;
    if (e.data?.source !== "meta-oauth") return;
    if (e.data.success) {
      toast.success("Meta account connected");
      reloadConnectionStatus();
    } else {
      toast.error(e.data.error ?? "Connection failed");
    }
  }
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}, []);
```

### `state` param — CSRF protection + org binding + user binding

`meta-oauth-start.ts` must sign `orgId`, `userId`, and a random nonce into
`state` (HMAC with `ENCRYPTION_KEY` or a dedicated secret) so
`meta-oauth-callback.ts` can verify the callback wasn't forged and knows
which org/user to attach the connection to (the callback has no other
session context — it's a top-level navigation inside a popup, not an
authenticated fetch from the app). `userId` is required, not optional —
`meta_connections.user_id` is `NOT NULL` in the real table.

### Calling the Graph API after token exchange

```typescript
// 1. Exchange code for short-lived token, then exchange for long-lived token
const tokenRes = await fetch(
  `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${REDIRECT_URI}&code=${code}`
);

// 2. Business Asset User Profile Access — id, name, picture
const meRes = await fetch(
  `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${accessToken}`
);

// 3. Discover WhatsApp Business Account + phone number (if whatsapp_business_management scope granted)
const wabaRes = await fetch(
  `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`
);
// then for each business: /v21.0/{business_id}/owned_whatsapp_business_accounts
// then for the WABA: /v21.0/{waba_id}/phone_numbers
```

Required scopes/products to request in the Meta App dashboard depending on
which integration card triggered the flow:
- WhatsApp: `whatsapp_business_management`, `whatsapp_business_messaging`
- Messenger: `pages_messaging`, `pages_show_list`
- Instagram Direct: `instagram_basic`, `instagram_manage_messages`
- Meta Lead Ads: `leads_retrieval`, `pages_show_list`
- All of the above also need `business_management` for asset access, plus
  Business Asset User Profile Access is requested implicitly via the Business
  Login config — it isn't a separate scope string.

### WhatsApp send (pairs with existing `meta-webhook.ts` receiver)

`meta-webhook.ts` already handles inbound messages and looks up the org via
`organizations.integration_settings->whatsapp->>waba_id` — **that lookup
path is now stale** once `meta_connections` exists; update it to query
`meta_connections` by `waba_id` instead (see migration note below).

```typescript
// meta-send-whatsapp.ts
await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: toPhoneE164.replace("+", ""),
    type: "text",
    text: { body: messageText },
  }),
});
```

### Migration note: `meta-webhook.ts`

The existing webhook queries `organizations.integration_settings`. Once
`meta_connections` ships, change the org lookup in `meta-webhook.ts` to:

```typescript
const { data: conn } = await supabaseAdmin
  .from("meta_connections")
  .select("org_id")
  .eq("waba_id", wabaId)
  .maybeSingle();
const orgId = conn?.org_id;
```

Don't delete the old `integration_settings` path until this migration is
confirmed in production — keep both lookups temporarily and log which one
matched, then remove the old path once `meta_connections` is the only source.

## Environment variables (new)

```
META_APP_ID
META_APP_SECRET
META_VERIFY_TOKEN          # already exists, used by meta-webhook.ts GET verification
META_OAUTH_STATE_SECRET    # or reuse ENCRYPTION_KEY for HMAC signing of `state`
```

## Marketing API Access Tier — minimal real demo

Meta App Review requires actually demonstrating any requested permission's
usage, not just requesting it. `ads_management`/`ads_read` were already
"Ready for testing" from earlier work (a Make.com daily-social-posting
scenario — Facebook/LinkedIn/Instagram organic posts, Claude-generated
content/images), but that scenario never calls the Marketing API at all;
it's plain Graph API posting, not ad campaign management. **Marketing API
Access Tier specifically had no real usage anywhere** before this section
was added.

To make that submission honest, `meta-create-ad-campaign.ts` creates a real
**PAUSED** campaign + matching PAUSED ad set in the org's connected Meta Ads
account via the live Marketing API — no creative attached, so it never
spends money, but it's a genuine create call exercising real Marketing API
fields (objective, daily_budget, billing_event, optimization_goal,
targeting). Surfaced in AI Center → AI Tools as "Create Ad Campaign."

This tool intentionally bypasses `run-tool.mjs` (the generic Claude-prompt
pipeline every other AI Tool uses) — see `ai-tools-tab.tsx`
`ToolDrawerContent.handleRun`, which special-cases
`tool.name === "Create Ad Campaign"` to call `meta-create-ad-campaign.ts`
directly instead. The `tool_definitions` row for it has an empty
`system_prompt` and a placeholder `model` value ("n/a — calls the Meta
Marketing API directly, not Claude") since neither field is used.

**Seeding note:** `seed-ai-center.ts`'s `seedAiCenter()` only inserts
`TOOL_DEFINITIONS` when the table is completely empty — it will NOT pick up
this new row automatically in an existing deployment. Run
`supabase/migrations/003_seed_create_ad_campaign_tool.sql` once after
deploying, or this tool simply won't appear in AI Center despite being in
the code.

Uses `meta_connections.ad_account_id` (the pre-existing Ads column,
untouched by the WhatsApp-focused extension migration) and the same
`decryptOrPlaintext()` token-read pattern as `meta-send-whatsapp.ts`.

## Gotchas specific to Meta integrations

| Issue | Fix |
|---|---|
| Full-page OAuth redirect | Use popup + `postMessage`, not `window.location` |
| `state` param missing org binding | Sign orgId+nonce into `state`, verify in callback |
| Short-lived token only | Exchange for long-lived token (60 days) immediately after initial exchange |
| WABA discovery skipped | Must call `/me/businesses` → `/owned_whatsapp_business_accounts` → `/phone_numbers`, profile fetch alone doesn't return WABA |
| `meta-webhook.ts` org lookup | Migrate from `integration_settings` JSONB to `meta_connections.waba_id` |
| RLS on `meta_connections` | Must explicitly `ENABLE ROW LEVEL SECURITY` — writing policies isn't enough |
| **Assuming a clean schema** | `meta_connections` already existed from an earlier Meta Ads build with real columns `meta_user_id`/`ad_account_id`/plaintext `access_token` (text) — **always re-run the `information_schema.columns` query before writing migrations or code against this table**, don't trust this doc's column list without verifying |
| **`user_id` is `NOT NULL`** | The real table has a `user_id` column (the Supabase auth user who connected it, separate from `meta_user_id` which is the Facebook profile id) that is `NOT NULL` with no default. The OAuth callback has no Authorization header (it's a top-level browser redirect, not a fetch), so `userId` must be passed as a query param to `meta-oauth-start.ts` and signed into `state` alongside `orgId`, then read back out in `meta-oauth-callback.ts` and included in the upsert. Forgetting this causes the upsert to fail with a NOT NULL violation, surfaced to the user as a generic "Could not save the connection" toast. |
| Token storage | `text` column, `"enc:"`-prefixed base64 for new writes, legacy plaintext rows have no prefix — handle both on read |
| Deleting on disconnect | Never blind-delete the row on full disconnect — check `ad_account_id` first; an unrelated Ads connection can live on the same row |
| Popup blocked by browser | Must call `window.open` synchronously inside the click handler, not after an awaited fetch |
| Picture URL expiry | Facebook profile picture URLs can rotate; re-fetch `/me?fields=picture` periodically rather than caching forever, or store the redirect URL only short-term |