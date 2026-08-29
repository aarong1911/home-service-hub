# Environment Variable Audit — RenoMeta Connect

Branch: `chore/environment-variable-audit`
Repo: `github.com/aarong1911/home-service-hub`
Date: 2026-08-29

---

## 1. Executive summary

Netlify deploys fail because the **combined Function-scoped environment variable
set exceeds AWS Lambda's 4 KB limit**:

```
Failed to create function: Your environment variables exceed the 4KB limit imposed by AWS Lambda.
```

The repository's `netlify/functions/*` are **classic (Lambda-compatible v1)
functions** (`export const handler: Handler`). Netlify injects the **entire
site environment** into **every** such function's Lambda configuration, and AWS
caps that configuration blob at 4 KB (sum of all `KEY=value` pairs).

The environment has accumulated **~70 variables** across Supabase, AI, Vapi,
Twilio, SMTP, Stripe, Meta, Make, and a large block of **OAuth credentials +
scope strings for integrations that do not yet exist on `main`** (Google
Gmail/Calendar/Drive/GMB/Ads/Contacts, Microsoft, Slack, DocuSign, Trigger.dev,
AWS/SES). The scope strings alone (`GOOGLE_*_SCOPES`, `META_OAUTH_SCOPES`,
`MS_OAUTH_SCOPES`) are ~1.5 KB of the blob and are **never read by code**.

**The code actually references 31 distinct names**, of which:

- **13 are required-and-active** server variables,
- **8 are optional** server variables (feature degrades gracefully if unset),
- **5 are `VITE_*` build-time** variables that should **not** be Function-scoped,
- **1** (`URL`) is **auto-supplied by Netlify**,
- **2** (`__B64`, `__KEY`) are **internal, runtime-injected** onto a child
  process and are **not configuration**,
- **2** (`SMTP_PASS`, server fallback to `VITE_SUPABASE_URL`) are **duplicates**
  addressed by code changes in this branch.

Reducing the **Functions** scope to the ~21 names the functions truly need
brings the blob to an estimated **~1.6–2.1 KB — comfortably under 4 KB** —
without touching a single live credential value and without a runtime migration.

### Code changes made in this branch (all low-risk)

| File | Change | Why safe |
|---|---|---|
| `netlify/functions/send-email.ts` | `pass: process.env.SMTP_PASS` → `process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS` | Every other SMTP consumer already uses `SMTP_PASSWORD`; fallback keeps old behavior if only `SMTP_PASS` is set. |
| `netlify/functions/lib/seed-ai-center.ts` | `process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!` → `process.env.SUPABASE_URL!` | Removes a server-side fallback to a **frontend-only** var. Both callers (`seed-definitions`, `run-agent`) always run with `SUPABASE_URL` in Functions scope. |
| `src/lib/seed-ai-center.ts` | same as above | Same module, duplicated in the tree; only imported by `netlify/functions/seed-definitions.ts` (never by browser code). |
| `.env.example` | **created** (did not exist) — sanitized, grouped, scope-annotated | Reference only, placeholder values. |
| `docs/environment-variable-audit.md` | this document | — |

No variable was renamed or deleted. No Netlify dashboard change was made.

---

## 2. Current failure and root cause

| Layer | Fact |
|---|---|
| Function type | `netlify/functions/*.ts` use `@netlify/functions` `Handler` → **AWS Lambda-compatible (v1)**. Only `ai-tool-run.mjs` and `run-tool.mjs` use the v2 `export default async (req)` signature. |
| `netlify.toml` | Declares `[functions] directory = "netlify/functions"` and **nothing else** — no per-function env scoping, no `included_files`, no runtime override. |
| Injection model | Netlify writes the **whole site env** (all scopes that include "Functions") into each Lambda's `Environment.Variables`. AWS limits that map to **4 KB total**. |
| Trigger | The env set grew past 4 KB as OAuth credentials + long scope strings for **unbuilt** integrations were added. |
| Fix class | **Scope reduction** (remove Function scope from unused / build-only vars) — no code/runtime change required to unblock deploys. |

---

## 3. Complete variable inventory

### 3.1 Referenced by code — ACTIVE server (keep Functions scope)

| Variable | Referenced in | Runtime consumer | Scope | Status | Risk if removed/changed |
|---|---|---|---|---|---|
| `SUPABASE_URL` | ~20 functions + `netlify/lib/run-agent.ts`, `netlify/functions/lib/*` | Supabase JS client (service role) | Functions (+ Prod + Previews) | **Required, active** | **High** — every function 500s |
| `SUPABASE_SERVICE_ROLE_KEY` | same as above | Supabase admin client | Functions only — **server secret** | **Required, active** | **High** — all privileged DB/auth ops fail |
| `ANTHROPIC_API_KEY` | `run-agent.ts`, `netlify/lib/run-agent.ts`, `run-tool.mjs`, `ai-tool-run.mjs`, `ai-draft-reply.ts`, `execute-workflow.ts`, `lib/post-call-automation.ts` | Claude Messages API | Functions | **Required, active** | High — AI Center, workflow AI steps, draft-reply, post-call summary fail |
| `ENCRYPTION_KEY` | `vapi-webhook.ts` (GCal token), `meta-oauth-callback.ts`, `meta-create-ad-campaign.ts`, `send-inbox-message.ts`; fallback in `meta-oauth-start.ts` | AES-256-GCM decrypt | Functions | **Required, active** | High — Meta token decrypt + GCal sync throw |
| `VAPI_API_KEY` | `assign-voice-number.ts`, `vapi-proxy.ts` | Vapi REST API | Functions | **Required, active** | High — voice number provisioning + agent CRUD proxy fail |
| `TWILIO_ACCOUNT_SID` | `portal-action.ts`, `execute-workflow.ts`, `run-agent.ts`, `netlify/lib/run-agent.ts`, `run-tool.mjs` | Twilio Messages API | Functions | **Required, active** | High — **missed-call text-back** + portal SMS + agent SMS silently skip |
| `TWILIO_AUTH_TOKEN` | same as `TWILIO_ACCOUNT_SID` | Twilio auth | Functions — **secret** | **Required, active** | High — same |
| `TWILIO_PHONE_NUMBER` | `portal-action.ts`, `execute-workflow.ts`, `run-agent.ts`, `netlify/lib/run-agent.ts` | Twilio "From" | Functions | **Required, active** | High — SMS send skipped. **Not present in local `.env`** (see §8). |
| `SMTP_USER` | `invite-member.ts`, `portal-invite.ts`, `send-email.ts`, `execute-workflow.ts` | nodemailer (smtp.gmail.com:587) | Functions | **Required, active** | High — team invites, portal invites, workflow email fail |
| `SMTP_PASSWORD` | `invite-member.ts`, `portal-invite.ts`, `execute-workflow.ts`, `send-email.ts` (after this branch's fix) | nodemailer auth | Functions — **secret** | **Required, active** | High — same |
| `META_APP_ID` | `meta-oauth-start.ts`, `meta-oauth-callback.ts` | Meta OAuth dialog + token exchange | Functions | **Required, active** (Meta) | Med — Meta connect flow breaks |
| `META_APP_SECRET` | `meta-oauth-callback.ts` | Meta token exchange | Functions — **secret** | **Required, active** (Meta) | Med — Meta connect flow breaks |
| `META_VERIFY_TOKEN` | `meta-webhook.ts` | Webhook GET handshake | Functions | **Required, active** (Meta) | Med — Meta can't (re)verify webhook subscription |

### 3.2 Referenced by code — OPTIONAL server (keep Functions scope; safe if unset)

| Variable | Referenced in | Behavior if unset | Status |
|---|---|---|---|
| `VAPI_WEBHOOK_SECRET` | `vapi-webhook.ts` `verifySignature()` | **Signature check skipped** (warns, returns `true`) | Optional — **set in production** for webhook authenticity |
| `STRIPE_SECRET_KEY` | `portal-action.ts` `create_payment` | Portal writes a "please follow up" note instead of Stripe Checkout | Optional-degrading — required for real portal payments |
| `NOTIFY_PHONE_NUMBER` | `portal-action.ts` (send_message) | Owner SMS alert on new portal message is skipped | Optional |
| `META_OAUTH_STATE_SECRET` | `meta-oauth-start.ts`, `meta-oauth-callback.ts` | Falls back to `ENCRYPTION_KEY` for HMAC of `state` | Optional |
| `WHATSAPP_TEMPLATE_NAME` | `send-inbox-message.ts` | Defaults to `renometa_appointment_confirmed_` | Optional |
| `WHATSAPP_TEMPLATE_LANG` | `send-inbox-message.ts` | Defaults to `en_US` | Optional |
| `MAKE_CALL_ENDED_WEBHOOK` | `vapi-webhook.ts` `handleEndOfCallReport()` | `fireMakeWebhook()` no-ops | Optional |
| `MAKE_TOOL_CALL_WEBHOOK` | `vapi-webhook.ts` (tool-call path) | `fireMakeWebhook()` no-ops | Optional |

### 3.3 Referenced by code — FRONTEND / build-time (`VITE_*`) — **Builds scope only**

| Variable | Referenced in | Consumer | Correct scope | Notes |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts`, `src/routes/projects.index.tsx` | browser Supabase client | **Builds** | Public by design (anon). Also read as a server fallback in `seed-ai-center` **until this branch removes it**. |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | browser Supabase client | **Builds** | Public anon JWT (~200 chars — meaningful chunk of the Lambda blob if Function-scoped). |
| `VITE_VAPI_PUBLIC_KEY` | `src/components/automation/voice-agent-tab.tsx` | Vapi Web SDK (browser test call) | **Builds** | Public key. |
| `VITE_VAPI_SERVER_URL` | `src/components/automation/voice-agent-tab.tsx` | shows webhook URL / tunnel override | **Builds** (or local-only) | Dev convenience (ngrok). |
| `VITE_GOOGLE_PLACES_API_KEY` | `src/components/ui/address-autocomplete.tsx` | Google Places Autocomplete | **Builds** | Optional feature. |

`import.meta.env.DEV` (`src/router.tsx`) is a Vite built-in — not configured.

### 3.4 Referenced by code — auto / internal (never set in dashboard)

| Variable | Referenced in | Nature |
|---|---|---|
| `URL` | `meta-oauth-start.ts`, `meta-oauth-callback.ts` (build `redirect_uri`), `vapi-webhook.ts` (call `execute-workflow`) | **Auto-supplied by Netlify** per deploy. Setting it manually breaks deploy previews. Has hard-coded fallbacks (`https://connect.renometa.com`, `http://localhost:8888`). |
| `__B64`, `__KEY` | `run-agent.ts`, `run-tool.mjs` `callClaude*ChildProcess()` | Set by the function onto a **spawned child `node` process** to work around lambda-local intercepting `fetch` on Node 24 + Windows. **Not** site configuration. |

### 3.5 In `.env` (local) but **NOT referenced anywhere** in the repo on `main`

> None of the following appears in `process.env.*`, `process.env["..."]`,
> `import.meta.env.*`, `netlify.toml`, package scripts, or any function/lib.
> There are **no** `gcal-sync`, `gmail-sync`, `google-ads-*`, `slack-*`,
> `ms-*`, `docusign-*`, or `trigger-*` functions in `netlify/functions/`.

| Group | Variables | Classification |
|---|---|---|
| URL / base-url dupes | `APP_BASE_URL`, `APP_LOCAL_URL` | **Legacy / delete candidate** — no consumer; URL derivation uses Netlify `URL` + hard-coded fallback. |
| Email dupes / unused | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (host/port hard-coded in code), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM`, `GMAIL_SMTP_HOST`, `GMAIL_SMTP_PORT`, `GMAIL_SMTP_SECURE`, `EMAIL_SENDER_API_KEY`, `EMAIL_SENDER_USER`, `RESEND_API_KEY` | **Legacy / delete candidate** — SMTP path is nodemailer→Gmail with literal host/port; Resend/Gmail-native never wired. |
| Orphan secrets | `JWT_SECRET`, `BRIDGE_SHARED_SECRET`, `REG_SECRET` | **Unknown / investigate** — no consumer here. `BRIDGE_SHARED_SECRET` likely belongs to `renometa-connect-sync` (out of scope). Do **not** delete the value blindly; just drop Functions scope. |
| Twilio extras | `TWILIO_MESSAGING_SERVICE_SID`, `CALLER_ID`, `TWILIO_WHATSAPP_ENABLED`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_SMS_ENABLED`, `TWILIO_SMS_NUMBER`, `MISSED_CALL_ENABLED`, `MISSED_CALL_MESSAGE` | **Legacy / delete candidate** — code uses only `TWILIO_PHONE_NUMBER`; missed-call gating is Vapi `endedReason` + `workflows` rows, not `MISSED_CALL_*`. |
| Meta extras | `META_OAUTH_SCOPES` (scopes hard-coded per product in `meta-oauth-start.ts`), `VITE_META_REDIRECT_URI` (redirect derived from `URL`; also listed twice in `.env`) | **Legacy / duplicate** — remove Functions scope. |
| Google OAuth + scopes | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_REDIRECT_BASE_URL`, `GOOGLE_GMAIL_SCOPES`, `GOOGLE_CAL_SCOPES`, `GOOGLE_DRIVE_SCOPES`, `GOOGLE_GMB_SCOPES`, `GOOGLE_ADS_SCOPES`, `GOOGLE_CONTACTS_SCOPES` | **Reserved for unfinished integration** — no Google sync/OAuth function on `main`. Remove Functions scope; **keep values** for planned work. |
| Google Ads | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_OAUTH_STATE_SECRET`, `GOOGLE_ADS_API_VERSION`, `GOOGLE_ADS_REDIRECT_URI`, `GOOGLE_ADS_POST_CONNECT_URL` (any that exist in the dashboard) | **Reserved for unfinished integration** — **do not delete.** Remove Functions scope until a `google-ads-*` function ships. Callback + post-connect URLs should later be **derived** from `URL` + a path, not stored. |
| Microsoft | `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET`, `MS_OAUTH_TENANT_ID`, `MS_OAUTH_SCOPES` | **Reserved / unused** — remove Functions scope. |
| Slack | `SLACK_OAUTH_CLIENT_ID`, `SLACK_OAUTH_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_OAUTH_SCOPES`, `SLACK_REDIRECT_URI` | **Reserved / unused** — remove Functions scope. `SLACK_REDIRECT_URI` should later be derived from `URL`. |
| Dashboard-only groups named in the task (not in local `.env`, not in code) | `DOCUSIGN_*`, `MAILTRAP_*`, `NETLIFY_EMAILS_*`, `RENOMETA_AWS_*` (AWS/SES/S3), `TRIGGER_*` | **Reserved / legacy** — **no reference anywhere in the repo.** Remove Functions scope now. Delete entirely only after Aaron confirms no external system depends on them. |

---

## 4. Variables referenced in code but missing from `.env` / `.env.example`

`.env.example` **did not exist** before this branch (`.gitignore` already
whitelists it: `!.env.example`). It is created here. Relative to the local
`.env` that was used as the reference, these code-referenced names have **no
entry** and must be confirmed present in the Netlify **Functions** scope:

| Missing name | Needed by | Impact today |
|---|---|---|
| `TWILIO_PHONE_NUMBER` | missed-call SMS, portal SMS, agent SMS | If only `CALLER_ID` / `TWILIO_SMS_NUMBER` are set, **all Twilio sends are skipped** (`if (!sid || !auth || !from) return`). Must exist in Functions scope. |
| `STRIPE_SECRET_KEY` | portal `create_payment` | Portal payments fall back to a note. |
| `NOTIFY_PHONE_NUMBER` | portal message alert | Owner alert skipped. |
| `VAPI_WEBHOOK_SECRET` | Vapi webhook auth | Signature verification disabled. |
| `META_OAUTH_STATE_SECRET` | Meta OAuth `state` HMAC | Falls back to `ENCRYPTION_KEY` (works, but shared-secret reuse). |
| `MAKE_CALL_ENDED_WEBHOOK`, `MAKE_TOOL_CALL_WEBHOOK` | Make.com forwarding | Forwarding disabled. |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | WhatsApp template send | Code defaults used. |

> These may already be set directly in the Netlify dashboard — this audit cannot
> read the dashboard. Verify against the dashboard before removing anything.

---

## 5. Variables in `.env` but unused (see §3.5 for the full list)

Everything in §3.5. Highest-value removals for the 4 KB blob (largest
`KEY=value` footprint, zero code references):

1. `GOOGLE_GMAIL_SCOPES`, `GOOGLE_CAL_SCOPES`, `GOOGLE_DRIVE_SCOPES`,
   `GOOGLE_GMB_SCOPES`, `GOOGLE_ADS_SCOPES`, `GOOGLE_CONTACTS_SCOPES`
   — six long URL-list strings, ~700–900 bytes combined.
2. `META_OAUTH_SCOPES` — ~230 bytes.
3. `MS_OAUTH_SCOPES` — ~180 bytes.
4. `MISSED_CALL_MESSAGE` — ~110 bytes.
5. `GOOGLE_OAUTH_CLIENT_SECRET`, `MS_OAUTH_CLIENT_SECRET`,
   `SLACK_OAUTH_CLIENT_SECRET`, `JWT_SECRET`, `BRIDGE_SHARED_SECRET`,
   `REG_SECRET`, `RESEND_API_KEY`, `EMAIL_SENDER_API_KEY` — ~60–90 bytes each.
6. `GMAIL_*` (6), `SMTP_HOST/PORT/FROM`, `TWILIO_*` extras (6), `APP_BASE_URL`,
   `APP_LOCAL_URL`, `VITE_META_REDIRECT_URI` — small individually, ~30 total keys.

---

## 6. Duplicate / consolidation candidates

| Concept | Names seen | Verdict | Plan |
|---|---|---|---|
| SMTP password | `SMTP_PASSWORD` (invite-member, portal-invite, execute-workflow), `SMTP_PASS` (send-email only) | **Consolidate → `SMTP_PASSWORD`** | **Done in this branch:** `send-email.ts` now reads `SMTP_PASSWORD ?? SMTP_PASS`. Removal sequence: (a) merge this branch, (b) confirm `SMTP_PASSWORD` set in Netlify, (c) delete `SMTP_PASS` from dashboard, (d) later PR: drop the `?? SMTP_PASS` fallback. |
| Supabase URL, server vs client | `SUPABASE_URL` (server), `VITE_SUPABASE_URL` (client) | **Keep both — intentional.** Server must not depend on a `VITE_` var. | **Done in this branch:** removed the `?? process.env.VITE_SUPABASE_URL` fallback from both `seed-ai-center.ts` copies. `VITE_SUPABASE_URL` → Builds scope only. |
| App base URL | `APP_BASE_URL`, `APP_LOCAL_URL`, Netlify `URL` | **Consolidate → `URL`** (already the only one code reads) | Remove `APP_BASE_URL` / `APP_LOCAL_URL` from Functions scope. No code change needed — nothing references them. |
| Gmail vs SMTP creds | `GMAIL_APP_PASSWORD` / `GMAIL_USER` vs `SMTP_PASSWORD` / `SMTP_USER` | **Consolidate → `SMTP_*`** (the only pair code reads) | Remove all `GMAIL_*` from Functions scope. Values are (per `.env`) the same Gmail app password; keeping one pair removes 6 keys. |
| Meta redirect | `VITE_META_REDIRECT_URI` (x2 in `.env`) vs derived `${URL}/.netlify/functions/meta-oauth-callback` | **Derived wins** — no stored URL needed | Remove `VITE_META_REDIRECT_URI` entirely. |
| Anthropic key header | one name `ANTHROPIC_API_KEY` everywhere | No dup | — |

### URL configuration (Task 3) — verified

- `meta-oauth-start.ts:52-53` and `meta-oauth-callback.ts:114-115`:
  `const siteUrl = process.env.URL || "https://connect.renometa.com";`
  then `redirectUri = \`${siteUrl}/.netlify/functions/meta-oauth-callback\``.
  **Full callback URLs are already derived**, not stored. `VITE_META_REDIRECT_URI`
  is dead.
- `vapi-webhook.ts:2127`: `fetch(\`${process.env.URL ?? 'http://localhost:8888'}/.netlify/functions/execute-workflow\`)` — derived.
- Meta OAuth **scopes** are hard-coded (`PRODUCT_SCOPES` map in
  `meta-oauth-start.ts:16`); `META_OAUTH_SCOPES` is dead.
- Google Ads / Slack redirect + post-connect URLs (when those functions are
  built) should follow the same `${URL}` + path pattern rather than being
  stored as standalone variables.

---

## 7. Legacy / delete candidates

**Safe to remove from Functions scope now (no code reference, no runtime need):**
`APP_BASE_URL`, `APP_LOCAL_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`,
`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM`, `GMAIL_SMTP_HOST`,
`GMAIL_SMTP_PORT`, `GMAIL_SMTP_SECURE`, `EMAIL_SENDER_API_KEY`,
`EMAIL_SENDER_USER`, `RESEND_API_KEY`, `TWILIO_MESSAGING_SERVICE_SID`,
`CALLER_ID`, `TWILIO_WHATSAPP_ENABLED`, `TWILIO_WHATSAPP_NUMBER`,
`TWILIO_SMS_ENABLED`, `TWILIO_SMS_NUMBER`, `MISSED_CALL_ENABLED`,
`MISSED_CALL_MESSAGE`, `META_OAUTH_SCOPES`, `VITE_META_REDIRECT_URI`,
`MS_OAUTH_*`, `SLACK_*`, `DOCUSIGN_*`, `MAILTRAP_*`, `NETLIFY_EMAILS_*`,
`RENOMETA_AWS_*`, `TRIGGER_*`.

**Investigate before deleting the value entirely:** `JWT_SECRET`,
`BRIDGE_SHARED_SECRET` (likely `renometa-connect-sync`), `REG_SECRET`. Drop
Functions scope now; keep the value until Aaron confirms no external consumer.

**Do NOT delete (planned work):** all `GOOGLE_OAUTH_*`, `GOOGLE_*_SCOPES`,
`GOOGLE_ADS_*`. Remove Functions scope only.

---

## 8. Local-only candidates

| Variable | Why local-only |
|---|---|
| `VITE_VAPI_SERVER_URL` | ngrok tunnel to reach `vapi-webhook` from Vapi during local dev. Prod uses the deployed URL. |
| `APP_LOCAL_URL` | `http://localhost:9999` — never used by code; a dev note at best. |
| `GOOGLE_REDIRECT_BASE_URL` (`http://localhost:9999` in `.env`) | Only meaningful for a local OAuth loop that doesn't exist yet. |
| `SMTP_*` / `TWILIO_*` / provider secrets | Needed locally **only** when exercising that function via `netlify dev`; otherwise local dev runs the Vite client against prod Supabase. |

---

## 9. Production-only candidates

| Variable | Why prod-only |
|---|---|
| `VAPI_WEBHOOK_SECRET` | Only meaningful when a real Vapi tenant signs webhooks. |
| `STRIPE_SECRET_KEY` (live) | Real portal payments. |
| `NOTIFY_PHONE_NUMBER` | Real owner alerting. |
| `MAKE_CALL_ENDED_WEBHOOK`, `MAKE_TOOL_CALL_WEBHOOK` | Point at live Make.com scenarios. |
| `URL` | Auto-set by Netlify per deploy (prod + previews). |

---

## 10. URL configuration analysis

See §6 "URL configuration (Task 3) — verified". **Conclusion:** the codebase
already derives every callback/base URL it needs from Netlify's `URL` plus a
literal path, with a hard-coded `https://connect.renometa.com` fallback. The
stored URL variables (`APP_BASE_URL`, `APP_LOCAL_URL`, `VITE_META_REDIRECT_URI`,
`GOOGLE_REDIRECT_BASE_URL`, `SLACK_REDIRECT_URI`) are **redundant** for current
code. When Google Ads / Slack functions are built, they should reuse the
`${URL}` + path pattern rather than introduce new stored-URL variables.

---

## 11. Meta analysis

| Purpose | Variable | Referenced in | Verdict |
|---|---|---|---|
| App identity | `META_APP_ID` | `meta-oauth-start.ts`, `meta-oauth-callback.ts` | **Keep — Functions** |
| Token exchange | `META_APP_SECRET` | `meta-oauth-callback.ts` | **Keep — Functions, secret** |
| Webhook verify (Messenger / IG / WhatsApp / Lead Ads all share one webhook) | `META_VERIFY_TOKEN` | `meta-webhook.ts:31` | **Keep — Functions** |
| OAuth `state` HMAC | `META_OAUTH_STATE_SECRET` | `meta-oauth-start.ts:42`, `meta-oauth-callback.ts:101` (`|| ENCRYPTION_KEY`) | **Keep — Functions, optional** |
| Token decrypt for outbound WhatsApp / campaigns | `ENCRYPTION_KEY` | `meta-oauth-callback.ts`, `meta-create-ad-campaign.ts`, `send-inbox-message.ts` | **Keep — Functions** (shared with Vapi/GCal) |
| WhatsApp template | `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | `send-inbox-message.ts:285-286` | **Keep — Functions, optional** (code defaults) |
| Scopes | `META_OAUTH_SCOPES` | **nowhere** — hard-coded `PRODUCT_SCOPES` in `meta-oauth-start.ts:16` | **Delete / remove Functions scope** |
| Redirect URI | `VITE_META_REDIRECT_URI` | **nowhere** — derived from `URL` | **Delete** |
| Deauth callback | `meta-deauthorize.js` | reads **no** env (stub) | n/a |

**No redundant duplicates like `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` /
`META_GRAPH_API_VERSION` / `META_WEBHOOK_URL` / `WHATSAPP_TOKEN` exist in the
code.** The Graph API version is hard-coded in the Meta functions. The single
`meta-webhook` endpoint serves Messenger, Instagram DM, WhatsApp, and Lead Ads.
The **exact names the code expects**: `META_APP_ID`, `META_APP_SECRET`,
`META_VERIFY_TOKEN`, `META_OAUTH_STATE_SECRET` (optional), `ENCRYPTION_KEY`,
`WHATSAPP_TEMPLATE_NAME` (optional), `WHATSAPP_TEMPLATE_LANG` (optional).

---

## 12. Google Ads analysis

**No Google Ads code exists on `main`.** There is no `google-ads-*` function,
no `process.env.GOOGLE_ADS_*` reference anywhere. `GOOGLE_ADS_SCOPES` is present
in local `.env` but unused. Any of `GOOGLE_ADS_CLIENT_ID`,
`GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`,
`GOOGLE_ADS_OAUTH_STATE_SECRET`, `GOOGLE_ADS_API_VERSION`,
`GOOGLE_ADS_REDIRECT_URI`, `GOOGLE_ADS_POST_CONNECT_URL` that exist in the
dashboard are **reserved for in-development work**.

**Action:** remove **Functions** scope from all `GOOGLE_ADS_*`; **do not delete
the values**. When the integration ships, derive `GOOGLE_ADS_REDIRECT_URI` and
`GOOGLE_ADS_POST_CONNECT_URL` from `URL` + a path instead of storing them.

> Note: RenoMeta's current Meta ad-campaign demo (`meta-create-ad-campaign.ts`,
> AI Center → AI Tools → "Create Ad Campaign") is **Meta** Marketing API, not
> Google Ads, and needs only `SUPABASE_*` + `ENCRYPTION_KEY`.

---

## 13. Supabase analysis

| Variable | Where | Correct? |
|---|---|---|
| `SUPABASE_URL` | every function + `netlify/lib/run-agent.ts` + `netlify/functions/lib/*` | ✅ server-only name |
| `SUPABASE_SERVICE_ROLE_KEY` | same | ✅ server-only, **must stay out of Builds/Runtime scope** — it must never reach the client bundle |
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts`, `src/routes/projects.index.tsx` | ✅ client name; **Builds scope only** |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | ✅ client name; Builds scope only; anon key is safe to ship to browser |
| ~~`VITE_SUPABASE_URL` as server fallback~~ | ~~`seed-ai-center.ts` (both copies)~~ | ❌ **fixed in this branch** — server no longer falls back to a `VITE_` var |

`src/lib/seed-ai-center.ts` lives under `src/` but is imported **only** by
`netlify/functions/seed-definitions.ts` (never by a route/component), so its
`process.env.SUPABASE_SERVICE_ROLE_KEY` is not bundled for the browser
(confirmed: `pnpm build` succeeds and produces no `SERVICE_ROLE` reference).
Recommend moving it to `netlify/functions/lib/` in a future cleanup to remove
the ambiguity, but that is not required to fix the deploy.

**No duplicated frontend/server naming is unintentional.** The `VITE_` /
non-`VITE_` split is correct and should be preserved.

---

## 14. AWS / SES analysis

**Nothing in the repo references AWS/SES/S3.** No `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_*`, or `S3_*` in
`process.env`. Supabase Storage (not S3) backs file uploads; nodemailer→Gmail
SMTP (not SES) sends mail. If `RENOMETA_AWS_*` / `SES_*` / `S3_*` exist in the
Netlify dashboard they are **left over from earlier experiments / proof-of-
activity functions** that are no longer in the codebase.

**Action:** remove **Functions** scope from all AWS/SES/S3 variables now.
Delete entirely once Aaron confirms no external (non-repo) job uses those keys.

---

## 15. Make.com analysis

| Variable | Used by | Scenario | Necessary? |
|---|---|---|---|
| `MAKE_CALL_ENDED_WEBHOOK` | `vapi-webhook.ts` `handleEndOfCallReport()` | "call ended" → Make scenario (post-call routing / CRM) | Optional — keep Functions scope if the scenario is live |
| `MAKE_TOOL_CALL_WEBHOOK` | `vapi-webhook.ts` tool-call path | "tool called during call" → Make scenario | Optional — keep Functions scope if live |

Two **distinct** webhook URLs for two **distinct** events — both legitimate,
neither legacy. `fireMakeWebhook(url)` is a no-op when the URL is unset, so an
empty value is safe. The Make **daily-social-media** and **contact-form**
scenarios described in `CLAUDE.md` run entirely inside Make.com and need **no**
env var in this repo.

---

## 16. Netlify Lambda 4 KB analysis

### Is Netlify injecting the whole env into every function?

**Yes.** With classic `netlify/functions` + no scoping in `netlify.toml`, every
variable whose scope includes "Functions" is written into **each** Lambda's
`Environment.Variables`. AWS sums all `KEY=value` bytes and rejects > 4 KB.
`netlify.toml` here does nothing to limit that.

### Which functions actually need large credential sets?

| Function | Real needs |
|---|---|
| `vapi-webhook.ts` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `VAPI_WEBHOOK_SECRET?`, `MAKE_*?`, `URL` (auto) |
| `execute-workflow.ts` | `SUPABASE_*`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`, `SMTP_USER/PASSWORD`, `ANTHROPIC_API_KEY` |
| `assign-voice-number.ts` | `SUPABASE_*`, `VAPI_API_KEY` |
| `vapi-proxy.ts` | `SUPABASE_*`, `VAPI_API_KEY` |
| `portal-action.ts` | `SUPABASE_*`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`, `NOTIFY_PHONE_NUMBER?`, `STRIPE_SECRET_KEY?` |
| `run-agent.ts` / `run-tool.mjs` | `SUPABASE_*`, `ANTHROPIC_API_KEY`, `TWILIO_*` |
| `meta-*` | `SUPABASE_*`, `META_APP_ID/SECRET`, `META_VERIFY_TOKEN`, `META_OAUTH_STATE_SECRET?`, `ENCRYPTION_KEY`, `URL` (auto) |
| `invite-member.ts` / `portal-invite.ts` / `send-email.ts` | `SUPABASE_*`, `SMTP_USER/PASSWORD` |

No function needs `GOOGLE_*`, `MS_*`, `SLACK_*`, `DOCUSIGN_*`, `TRIGGER_*`,
`RENOMETA_AWS_*`, `GMAIL_*`, `EMAIL_SENDER_*`, `RESEND_API_KEY`, `JWT_SECRET`,
`BRIDGE_SHARED_SECRET`, `REG_SECRET`, `APP_*`, the `MISSED_CALL_*` / extra
`TWILIO_*` values, or any `VITE_*` var.

### Can variables be build-time only?

Yes — **all 5 `VITE_*` variables** are consumed only by `vite build`. Scope them
to **Builds** and remove Functions. (Netlify UI: uncheck "Functions" for each.)

### Is "Lambda compatibility mode" contributing?

Yes. The classic v1 `Handler` functions carry the AWS 4 KB env cap. Netlify's
newer function runtime (v2, `export default async (req) => Response`, already
used by `ai-tool-run.mjs` / `run-tool.mjs`) is **not** subject to that specific
AWS-config limit. Migrating every function would remove the ceiling — **but that
is explicitly out of scope for this task** (see §18 recommendation).

### Would scope reduction alone fix the deploy?

**Almost certainly yes.** Estimated Functions blob after the §17 cleanup:

| Bucket | Approx bytes |
|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ~290 |
| `ANTHROPIC_API_KEY` | ~115 |
| `ENCRYPTION_KEY` | ~55 |
| `VAPI_API_KEY` + `VAPI_WEBHOOK_SECRET` | ~90 |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_NUMBER` | ~110 |
| `NOTIFY_PHONE_NUMBER` | ~35 |
| `SMTP_USER` + `SMTP_PASSWORD` (+ `SMTP_PASS` during cutover) | ~90 |
| `STRIPE_SECRET_KEY` | ~120 |
| `META_APP_ID` + `META_APP_SECRET` + `META_VERIFY_TOKEN` + `META_OAUTH_STATE_SECRET` | ~150 |
| `WHATSAPP_TEMPLATE_NAME` + `WHATSAPP_TEMPLATE_LANG` | ~60 |
| `MAKE_CALL_ENDED_WEBHOOK` + `MAKE_TOOL_CALL_WEBHOOK` | ~120 |
| Netlify auto (`URL`, `SITE_NAME`, `DEPLOY_*`, …) | ~400–700 |
| **Total** | **~1.7–2.4 KB** |

That leaves comfortable headroom under 4 KB even with Netlify's own auto
variables included.

---

## 17. Recommended LOW-RISK cleanup order

Do these **in order**; stop and redeploy after step 3 to confirm the fix.

1. **Scope all `VITE_*` to Builds only** (uncheck Functions):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPI_PUBLIC_KEY`,
   `VITE_VAPI_SERVER_URL`, `VITE_GOOGLE_PLACES_API_KEY`.

2. **Remove Functions scope from the "no reference anywhere" set** (§7 "safe
   now" list) — Google OAuth/scopes, Google Ads, Microsoft, Slack, DocuSign,
   Trigger, AWS/SES/S3, GMAIL_*, EMAIL_SENDER_*, RESEND_API_KEY, APP_BASE_URL,
   APP_LOCAL_URL, SMTP_HOST/PORT/FROM, TWILIO extras, MISSED_CALL_*,
   META_OAUTH_SCOPES, VITE_META_REDIRECT_URI. Keep values (Builds scope or a
   secure note); do not delete yet.

3. **Remove Functions scope from orphan secrets** `JWT_SECRET`,
   `BRIDGE_SHARED_SECRET`, `REG_SECRET` (keep values).

4. **Redeploy.** Confirm the 4 KB error is gone and functions boot.

5. **Merge this branch**, confirm `SMTP_PASSWORD` is set in Functions scope,
   then **delete `SMTP_PASS`** from the dashboard.

6. **Follow-up PR:** drop the `?? process.env.SMTP_PASS` fallback in
   `send-email.ts`; move `src/lib/seed-ai-center.ts` → `netlify/functions/lib/`.

7. **Later, when Aaron confirms:** delete (not just unscope) the AWS/SES,
   DocuSign, Trigger, Mailtrap, Netlify-Emails, GMAIL_*, EMAIL_SENDER_*,
   RESEND_API_KEY, APP_* variables.

### Exact Netlify dashboard instructions

Site → **Project configuration → Environment variables**. For each variable:
**Options → Edit → "Scopes"** and set as below (Netlify scopes: *Builds*,
*Functions*, *Runtime*, *Post processing*; plus *Deploy contexts*).

**Set scope = Functions only (also Production + Deploy Previews contexts):**

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
ENCRYPTION_KEY
VAPI_API_KEY
VAPI_WEBHOOK_SECRET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
NOTIFY_PHONE_NUMBER
SMTP_USER
SMTP_PASSWORD
SMTP_PASS            (temporary — delete after cutover, step 5)
STRIPE_SECRET_KEY
META_APP_ID
META_APP_SECRET
META_VERIFY_TOKEN
META_OAUTH_STATE_SECRET
WHATSAPP_TEMPLATE_NAME
WHATSAPP_TEMPLATE_LANG
MAKE_CALL_ENDED_WEBHOOK
MAKE_TOOL_CALL_WEBHOOK
```

**Set scope = Builds only (uncheck Functions):**

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_VAPI_PUBLIC_KEY
VITE_VAPI_SERVER_URL
VITE_GOOGLE_PLACES_API_KEY
```

**Remove Functions scope (keep the value; Builds scope or leave unscoped):**

```
APP_BASE_URL  APP_LOCAL_URL
SMTP_HOST  SMTP_PORT  SMTP_FROM
GMAIL_USER  GMAIL_APP_PASSWORD  GMAIL_FROM  GMAIL_SMTP_HOST  GMAIL_SMTP_PORT  GMAIL_SMTP_SECURE
EMAIL_SENDER_API_KEY  EMAIL_SENDER_USER  RESEND_API_KEY
JWT_SECRET  BRIDGE_SHARED_SECRET  REG_SECRET
TWILIO_MESSAGING_SERVICE_SID  CALLER_ID
TWILIO_WHATSAPP_ENABLED  TWILIO_WHATSAPP_NUMBER  TWILIO_SMS_ENABLED  TWILIO_SMS_NUMBER
MISSED_CALL_ENABLED  MISSED_CALL_MESSAGE
META_OAUTH_SCOPES  VITE_META_REDIRECT_URI
GOOGLE_OAUTH_CLIENT_ID  GOOGLE_OAUTH_CLIENT_SECRET  GOOGLE_REDIRECT_BASE_URL
GOOGLE_GMAIL_SCOPES  GOOGLE_CAL_SCOPES  GOOGLE_DRIVE_SCOPES  GOOGLE_GMB_SCOPES
GOOGLE_ADS_SCOPES  GOOGLE_CONTACTS_SCOPES
GOOGLE_ADS_CLIENT_ID  GOOGLE_ADS_CLIENT_SECRET  GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_OAUTH_STATE_SECRET  GOOGLE_ADS_API_VERSION
GOOGLE_ADS_REDIRECT_URI  GOOGLE_ADS_POST_CONNECT_URL
MS_OAUTH_CLIENT_ID  MS_OAUTH_CLIENT_SECRET  MS_OAUTH_TENANT_ID  MS_OAUTH_SCOPES
SLACK_OAUTH_CLIENT_ID  SLACK_OAUTH_CLIENT_SECRET  SLACK_SIGNING_SECRET
SLACK_OAUTH_SCOPES  SLACK_REDIRECT_URI
DOCUSIGN_*  MAILTRAP_*  NETLIFY_EMAILS_*  RENOMETA_AWS_*  TRIGGER_*
```

**Never set manually:** `URL` (and other `DEPLOY_*` / `SITE_*`) — Netlify
supplies these.

### Validation & rollback

- **Validate:** after step 3, trigger a deploy. Check the build log for the
  4 KB error (gone) and hit: a Vapi test call → confirm `voice_calls` row +
  missed-call SMS on no-answer; a portal message → owner SMS; a team invite
  email; Meta webhook GET verify (`hub.mode=subscribe`). 
- **Rollback:** scope changes are per-variable and instantly reversible in the
  dashboard — re-check "Functions" on any variable and redeploy. The code
  changes in this branch are backwards-compatible (fallbacks retained), so
  reverting the branch is not required if a scope change misfires.

---

## 18. Variables that MUST NOT be touched yet

| Variable | Reason |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Every function depends on them. Service-role key must remain **Functions-only** (never Builds/Runtime). |
| `ANTHROPIC_API_KEY` | AI Center, workflow AI, draft-reply, post-call summary. |
| `ENCRYPTION_KEY` | Meta + GCal token decryption; also the `META_OAUTH_STATE_SECRET` fallback. |
| `VAPI_API_KEY` | Voice number provisioning + agent proxy. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | **Missed-call text-back.** Verify `TWILIO_PHONE_NUMBER` specifically exists in Functions scope (code does not read `CALLER_ID` / `TWILIO_SMS_NUMBER`). |
| `SMTP_USER`, `SMTP_PASSWORD` | Team + portal invite email, workflow email. Keep `SMTP_PASS` until the post-merge cutover (step 5). |
| `STRIPE_SECRET_KEY` | Portal payments. |
| `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` | Meta OAuth + webhook for WhatsApp / Messenger / Instagram / Lead Ads. |
| `VAPI_WEBHOOK_SECRET`, `META_OAUTH_STATE_SECRET`, `NOTIFY_PHONE_NUMBER`, `MAKE_*`, `WHATSAPP_TEMPLATE_*` | Optional but active — leave in Functions scope. |
| `URL` | Auto-managed by Netlify; do not create/override. |
| All `GOOGLE_OAUTH_*`, `GOOGLE_*_SCOPES`, `GOOGLE_ADS_*` **values** | Reserved for in-development integrations — remove Functions scope, **do not delete**. |

---

## 19. Future recommendation — modern Netlify Functions runtime (do NOT do now)

The classic v1 `Handler` functions are what impose the AWS 4 KB env ceiling.
Migrating `netlify/functions/*.ts` to the **v2 signature**
(`export default async (req: Request): Promise<Response>`, with
`export const config = { path: "..." }` where a custom route is needed) moves
them onto Netlify's newer runtime, which is **not** subject to that specific
AWS Lambda environment-configuration limit. `ai-tool-run.mjs` and `run-tool.mjs`
already use this style, so the pattern is established in-repo.

This is a **separate, larger change** (per-function signature rewrite, response
object changes, re-testing every endpoint, the Node 24 + lambda-local
`fetch`-intercept workaround in `run-agent`/`run-tool` should be re-evaluated
since v2 runs on a different local host) and is explicitly **out of scope**
here. Track it as its own ticket once the scope-reduction fix has unblocked
deploys.

---

## 20. Validation results (this branch)

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc -p tsconfig.json --noEmit` | ✅ **pass** (exit 0), identical before/after changes |
| Production build | `pnpm build` | ✅ **pass** (exit 0). Client bundle hash unchanged (`assets/index-CSFAL-la.js`) — the code changes touch server-only paths only. No `SERVICE_ROLE` string in `dist/`. |
| Lint | `pnpm lint` (`eslint .`) | ⚠️ **pre-existing failures, not caused by this branch.** `eslint .` reports 1000+ `prettier/prettier` errors across the repo (CRLF line endings + unformatted arrays), and also lints 165 stale `.history/**` snapshots (the `.history/` dir is git-ignored but not in `eslint.config.js` `ignores`). The three files edited here have **fewer** lint errors after the change than their `main` versions. Recommend a separate `prettier --write` + `.history` ignore PR. |
| Env re-scan | grep for `process.env.*` / `import.meta.env.*` post-change | ✅ No `process.env.VITE_*` remains in `src/` or `netlify/`. Server no longer reads any `VITE_` name. |
| Secret scan | `git diff --cached` | ✅ No credential values in the diff. `.env` not touched, not staged, git-ignored. `.env.example` contains only placeholders. |
| Missed-call path | manual read of `vapi-webhook.ts`, `execute-workflow.ts`, `assign-voice-number.ts`, `vapi-proxy.ts` | ✅ All variables required for webhook auth (`VAPI_WEBHOOK_SECRET`), call persistence (`SUPABASE_*`), workflow trigger (`URL` → `execute-workflow`), Twilio SMS (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`), and optional Make webhooks (`MAKE_*`) are on the "keep Functions scope" list. |
| Supabase server-only | grep | ✅ `SUPABASE_SERVICE_ROLE_KEY` appears only in `netlify/**` and `src/lib/seed-ai-center.ts` (server module, not imported by any route/component; absent from `dist/`). |

### Pre-existing issues found (report only — not addressed here)

1. `pnpm lint` is effectively broken on `main` (mass `prettier/prettier` errors + lints `.history/`). Separate PR: run `pnpm format`, add `.history` / `netlify` globs to `eslint.config.js` `ignores`.
2. `tsconfig.json` `include` lists `netlify/lib/run-tool.ts` and `netlify/lib/run-agent.ts`; only `netlify/lib/run-agent.ts` exists (the tool runner is `netlify/functions/run-tool.mjs`). Harmless (tsc still exits 0) but stale.
3. `CLAUDE.md` references `gcal-sync.ts` / `gmail-sync.ts` functions that are **not** in `netlify/functions/` on this branch — the Google OAuth env vars they would need are currently orphaned.
4. `.env` (local) had no `.env.example` counterpart and contained `VITE_META_REDIRECT_URI` defined twice.

---

## Appendix A — how the inventory was gathered

```
grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]*"            src netlify test-claude.mjs
grep -rhoE "process\.env\[[\"'][A-Za-z_][A-Za-z0-9_]*[\"']\]"  src netlify
grep -rhoE "import\.meta\.env\.[A-Z_][A-Z0-9_]*"       src netlify
```

Plus manual review of: `netlify.toml`, `vite.config.ts`, `package.json`
scripts, `eslint.config.js`, `tsconfig.json`, every file in
`netlify/functions/` and `netlify/functions/lib/` and `netlify/lib/`,
`src/lib/`, and the `.gitignore` whitelist (`!.env.example`). There is no
`.github/` directory (no CI workflows). `supabase/` contains only SQL
migrations (no Edge Functions, no `Deno.env`).

## Appendix B — full list of code-referenced names (31)

Server (`process.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`, `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
`NOTIFY_PHONE_NUMBER`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PASS`,
`STRIPE_SECRET_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`,
`META_OAUTH_STATE_SECRET`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`,
`MAKE_CALL_ENDED_WEBHOOK`, `MAKE_TOOL_CALL_WEBHOOK`, `URL` (auto),
`VITE_SUPABASE_URL` (server fallback — removed in this branch), `__B64`
(internal), `__KEY` (internal).

Client (`import.meta.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_VAPI_PUBLIC_KEY`, `VITE_VAPI_SERVER_URL`, `VITE_GOOGLE_PLACES_API_KEY`
(+ `DEV`, a Vite built-in).
