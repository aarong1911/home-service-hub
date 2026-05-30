# RenoMeta Connect — Claude Code Context

> CRM + project management SaaS for home improvement contractors.
> Read this file before making any changes.

## Quick Start

```bash
pnpm dev          # Vite on :5173
netlify dev       # Functions + Vite on :9999 (requires Node 20, NOT Node 24)
pnpm build        # Production build
pnpm tsc          # Type check
```

## Project Identifiers

| Key | Value |
|---|---|
| Supabase project | `tbtonsdemrcqtfhoocop` |
| Supabase URL | `https://tbtonsdemrcqtfhoocop.supabase.co` |
| Org ID (current) | `d7963ad6-4bfe-4cc2-b9c2-949a02a3fa72` |
| Owner user ID | `f4ec461f-9df6-4a2f-b2e1-1b421df475c1` |
| Connect app | `https://connect.renometa.com` |
| Portal | `https://portal.renometa.com` |
| Field app | `https://field.renometa.com` |
| Marketing site | `https://renometa.com` |
| Repo | `github.com/aarong1911/home-service-hub` |
| Local path | `C:\Users\info\OneDrive\Desktop\RenoMeta Apps\home-service-hub` |
| GCP project (Calendar) | `549459729443` |
| Vapi phone number ID | `9a024622-c69e-4035-93fa-ffb6b8a3ca00` |

## Stack

- **React 18** + **TypeScript** + **Vite 7**
- **TanStack Router** (file-based, `src/routes/`)
- **TanStack Query** for server state
- **Supabase** — auth, DB, storage, realtime
- **Netlify** — hosting + serverless functions (`netlify/functions/`)
- **shadcn/ui** + **Tailwind CSS** + **Lucide** icons
- **Sonner** toasts, **pnpm** (always pnpm, never npm/yarn)

## Project Structure

```
home-service-hub/
├── CLAUDE.md
├── skills/
│   ├── renometa-stack.skill
│   ├── netlify-supabase-functions.skill
│   └── tanstack-router-guards.skill
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # Auth guard + RoleGuard + AppShell
│   │   ├── index.tsx               # Dashboard /
│   │   ├── contacts.index.tsx      # /contacts
│   │   ├── leads.index.tsx         # /leads
│   │   ├── projects.index.tsx      # /projects (board, sheet, photos, invoices)
│   │   ├── portal.tsx              # /portal (no AppShell — client-facing)
│   │   ├── settings.tsx            # /settings layout
│   │   ├── settings.team.tsx       # /settings/team
│   │   ├── settings.permissions.tsx # /settings/permissions (role override matrix)
│   │   ├── settings.branding.tsx
│   │   ├── settings.integrations.tsx
│   │   ├── settings.billing.tsx    # owner only
│   │   ├── financials.estimates.tsx
│   │   ├── financials.invoices.tsx
│   │   ├── financials.payments.tsx
│   │   ├── inbox.index.tsx
│   │   ├── inbox.templates.tsx
│   │   ├── inbox.broadcasts.tsx
│   │   ├── calendar.index.tsx
│   │   ├── tasks.index.tsx
│   │   └── sales.pipeline.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx       # AppShell + PageHeader
│   │   │   ├── sidebar.tsx         # Role-filtered nav
│   │   │   └── topbar.tsx
│   │   ├── ui/                     # shadcn/ui + address-autocomplete.tsx
│   │   ├── organization/
│   │   │   ├── organization-settings.tsx
│   │   │   └── team-members-manager.tsx
│   │   ├── projects/
│   │   │   ├── InvoiceModal.tsx
│   │   │   └── InvoiceDetailModal.tsx
│   │   ├── portal/
│   │   │   └── InviteToPortalModal.tsx
│   │   └── voice/
│   │       ├── VoiceSettings.tsx   # Working hours, lead qualification
│   │       ├── AgentBuilder.tsx    # 4-tab agent creation
│   │       ├── TestAgentModal.tsx  # Browser test call
│   │       └── CallLogs.tsx
│   └── lib/
│       ├── supabase.ts
│       ├── organization.ts         # Org + team store (useSyncExternalStore)
│       ├── permissions.ts          # Role access control + useCurrentUserRole
│       ├── projects-store.ts
│       ├── contacts-store.ts
│       ├── leads-store.ts
│       └── tasks-store.ts
├── netlify/functions/
│   ├── invite-member.ts            # Team invite (NOT portal — no project_id)
│   ├── accept-invite.ts            # Accept team invitation
│   ├── update-user-by-id.ts        # Update auth user metadata
│   ├── portal-invite.ts            # Client portal invite → slug URL
│   ├── portal-action.ts            # Portal: message, approve, pay (Stripe)
│   ├── portal-data.ts              # Portal token → project data
│   ├── send-email.ts               # Generic email send
│   ├── vapi-webhook.ts             # Vapi Voice AI webhook (main)
│   ├── vapi-proxy.ts               # Vapi API proxy + Supabase sync
│   ├── assign-voice-number.ts      # Patch Vapi phone to serverUrl mode
│   ├── gcal-sync.ts                # Google Calendar sync
│   ├── gmail-sync.ts               # Gmail sync
│   ├── ai-tool-run.mjs             # AI Tools runner (Claude API)
│   ├── meta-oauth-start.ts         # Meta Ads OAuth
│   ├── meta-oauth-callback.ts
│   ├── generate-ad-variations.ts   # AI ad generation
│   ├── trigger-create-draft.ts     # Make.com trigger
│   └── trigger-publish-ad.ts
└── public/
```

## Environment Variables

```bash
# Supabase (server + client)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

# Email
SMTP_USER=support@renometa.com
SMTP_PASSWORD               # Gmail app password — NOT SMTP_PASS

# Payments
STRIPE_SECRET_KEY

# SMS
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
NOTIFY_PHONE_NUMBER         # Owner's number for portal message alerts

# Voice AI (Vapi)
VAPI_API_KEY                # Server-side
VITE_VAPI_PUBLIC_KEY        # Client-side for browser test calls

# Integrations
VITE_GOOGLE_PLACES_API_KEY
ENCRYPTION_KEY              # AES-256-GCM key for OAuth token decryption
```

## Database — Key Tables

```
profiles              — auth user profiles, organization_id FK
organizations         — company accounts (voice_settings JSONB for Voice AI)
org_memberships       — member_id + org_id + role
invitations           — team + portal invites
  project_id NULL     = team invite
  project_id SET      = portal invite (filter with .is("project_id", null) for team list)
projects              — jobs with status, budget, completion %
project_notes         — communications (is_client_message + client_email for portal msgs)
project_files         — attachments (images go to project-photos bucket)
contacts              — unique constraint on (org_id, phone)
leads                 — sales pipeline
invoices + invoice_items
estimates
appointments          — gcal_event_id set after Google Calendar sync
tasks
voice_agents          — Vapi assistants (tenant_id = org_id)
voice_calls           — call records (cost_usd raw, $0.35/min ceiling for display)
voice_call_tools      — tool call records per call
meta_connections      — Meta Ads OAuth tokens
ad_drafts             — Ad campaign drafts
member_permissions    — per-member action-level overrides (owner only)
```

## Storage Buckets

| Bucket | Access | Use |
|---|---|---|
| `project-photos` | **Public** | Site photos from project drawer |
| `project-files` | Auth | Documents, non-image files |
| `org-assets` | Public | Org logos |
| `proposal-pdfs` | Auth | Generated PDFs |
| `logos` | Public | Legacy logo bucket |

## Role System

9 roles: `owner` `admin` `office_manager` `estimator` `sales`
`project_manager` `field_worker` `accountant` `viewer`

- `owner` — all pages + **settings** (exclusively owner)
- `field_worker` → redirect to `https://field.renometa.com`
- `viewer` → redirect to `https://portal.renometa.com`
- See `src/lib/permissions.ts` for full route access map per role
- `member_permissions` table for per-member action-level overrides

## Portal Architecture

- Pretty URLs: `portal.renometa.com/p/{slug}` (e.g. `michael-chen-a1b2`)
- Token URLs: `portal.renometa.com/portal?token={uuid}` (legacy)
- Invite: `invitations` table with `role:"viewer"` + `project_id` + `portal_slug`
- Data: Supabase RPC `get_portal_data(p_token?, p_slug?)`
- Actions: `portal-action.ts` — send_message (→ project_notes + Twilio SMS), approve_estimate, create_payment (Stripe)
- Photos: `project-photos` bucket public URL
- Lovable portal app: `portalreno.netlify.app` / `portal.renometa.com`

## Voice AI (Vapi) — Critical Patterns

```typescript
// Phone numbers MUST use serverUrl mode with assistantId: null explicitly
// (not just omitted — Vapi ignores missing field)
{ serverUrl: WEBHOOK_URL, assistantId: null }

// Vapi renamed events — need BOTH formats in switch
"call-started" / "assistant.started"   // kebab (old) + dot-notation (new)
"call-ended"   / "call.ended"

// fn.arguments is a plain OBJECT, not a JSON string
const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;

// Vapi Web SDK — use window singleton (static imports cause Krisp duplicate warning)
if (!window.__vapiInstance) {
  const { default: Vapi } = await import("@vapi-ai/web");
  window.__vapiInstance = new Vapi(process.env.VITE_VAPI_PUBLIC_KEY);
}

// Google Calendar ISO strings — must include explicit UTC offset
// Netlify runs in UTC; use getUTCFullYear/Month/Date, NOT local date methods
"2026-04-13T14:00:00-04:00"  // correct
"2026-04-13T14:00:00"        // WRONG — interpreted as UTC

// Billable cost shown to users: $0.35/min ceiling-rounded
// Raw Vapi cost stored in cost_usd column
```

## OAuth Token Decryption (gcal-sync, gmail-sync)

Supabase stores OAuth tokens as `\x{hex}` (bytea format). Decrypt like this:

```typescript
// ENCRYPTION_KEY env var, AES-256-GCM
function parseToken(raw: string): Buffer {
  if (raw.startsWith("\\x")) return Buffer.from(raw.slice(2), "hex");
  return Buffer.from(raw, "base64");
}
// Then: hex → UTF-8 → base64-decode → raw Buffer → AES-256-GCM decrypt
```

## TanStack Router — Key Rules

```typescript
// NEVER use "as any" on createFileRoute — breaks router generator
export const Route = createFileRoute("/settings/permissions")({ component: Page });

// Find bad casts (PowerShell):
Select-String -Path "src/routes/*.tsx" -Pattern "createFileRoute.*as any"

// After adding new route file, just run pnpm dev — routeTree.gen.ts auto-regenerates
```

## Common Gotchas (compiled from all sessions)

| Issue | Fix |
|---|---|
| Node 24 + netlify dev | Use Node 20 |
| `as any` on routes | Remove it, run pnpm dev |
| `SMTP_PASSWORD` vs `SMTP_PASS` | Always `SMTP_PASSWORD` |
| `message` variable name | Conflicts with DOM global — use `clientMessage` |
| `body` variable in functions | Conflicts with response field — use `reqBody` |
| Portal invites in team list | `.is("project_id", null)` on invitations query |
| Photo bucket | `project-photos` (NOT `project-files`) for images |
| Stripe API version | `"2026-04-22.dahlia"` |
| Vapi `assistantId` | Must send `null` explicitly, not just omit |
| Vapi `fn.arguments` | Plain object, NOT JSON string |
| Calendar ISO strings | Must include UTC offset, use `getUTC*` methods |
| OAuth token format | `\x{hex}` bytea — use `parseToken()` before decrypt |
| `ENCRYPTION_KEY` env var | Required for gcal-sync and gmail-sync |
| GCP Calendar API | Must be enabled in project `549459729443` |
| pnpm only | Never npm install or yarn add |

## Related Projects

| Project | Repo | Stack |
|---|---|---|
| Marketing site | `aarong1911/renometa-website-v5` | React/TS, Netlify |
| Lovable portal | `portalreno.netlify.app` | React, Supabase, react-router |
| Field app | `field.renometa.com` | Separate Netlify site |

## Make.com Automations

- **Daily social media**: Posts Mon-Fri across FB/LinkedIn/Instagram/X using Claude API
  - Weekday via `formatDate(now; "e")` → platform routing
  - Instagram: `gpt-image-1` → imgbb (base64 → hosted URL) → Instagram
  - X via Buffer (native Twitter module deprecated May 2025)
  - Claude API header: `x-api-key` (NOT `Authorization`)
  - Body type: Raw (NOT "Data structure")
- **Contact form → email**: renometa.com form → Resend email
- **Meta Ads**: Draft creation + publish via Make.com scenarios

## Stores Pattern (organization.ts)

All stores use `useSyncExternalStore`:

```typescript
let state = initialState;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function useX() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => initialState,
  );
}
```

Supabase realtime subscriptions call `reload()` on changes.
