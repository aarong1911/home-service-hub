// src/lib/organization.ts
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type Role =
  | "viewer" | "field_worker" | "estimator" | "sales"
  | "accountant" | "project_manager" | "admin" | "owner";

export const ALL_ROLES: Role[] = [
  "viewer","field_worker","estimator","sales",
  "accountant","project_manager","admin","owner",
];

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer", field_worker: "Field Worker", estimator: "Estimator",
  sales: "Sales", accountant: "Accountant", project_manager: "Project Manager",
  admin: "Admin", owner: "Owner",
};

export const INDUSTRIES = [
  "General Contractor / Remodeler","HVAC","Plumbing","Electrical","Roofing",
  "Painting","Landscaping","Flooring","Windows & Doors","Handyman",
] as const;

export const TIMEZONE_OPTIONS = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Anchorage","Pacific/Honolulu","America/Phoenix","America/Toronto",
  "America/Vancouver","Europe/London","Europe/Paris","Europe/Berlin",
  "Asia/Tokyo","Asia/Shanghai","Australia/Sydney",
] as const;

const STATE_TZ: Record<string, string> = {
  AL:"America/Chicago",AK:"America/Anchorage",AZ:"America/Phoenix",
  AR:"America/Chicago",CA:"America/Los_Angeles",CO:"America/Denver",
  CT:"America/New_York",DE:"America/New_York",FL:"America/New_York",
  GA:"America/New_York",HI:"Pacific/Honolulu",ID:"America/Boise",
  IL:"America/Chicago",IN:"America/Indiana/Indianapolis",IA:"America/Chicago",
  KS:"America/Chicago",KY:"America/New_York",LA:"America/Chicago",
  ME:"America/New_York",MD:"America/New_York",MA:"America/New_York",
  MI:"America/Detroit",MN:"America/Chicago",MS:"America/Chicago",
  MO:"America/Chicago",MT:"America/Denver",NE:"America/Chicago",
  NV:"America/Los_Angeles",NH:"America/New_York",NJ:"America/New_York",
  NM:"America/Denver",NY:"America/New_York",NC:"America/New_York",
  ND:"America/Chicago",OH:"America/New_York",OK:"America/Chicago",
  OR:"America/Los_Angeles",PA:"America/New_York",RI:"America/New_York",
  SC:"America/New_York",SD:"America/Chicago",TN:"America/Chicago",
  TX:"America/Chicago",UT:"America/Denver",VT:"America/New_York",
  VA:"America/New_York",WA:"America/Los_Angeles",WV:"America/New_York",
  WI:"America/Chicago",WY:"America/Denver",DC:"America/New_York",
};

export function guessTimezoneFromAddress(address: string): string | null {
  const m = address.match(/\b([A-Z]{2})\s*\d{0,5}\s*$/);
  if (m) return STATE_TZ[m[1]] ?? null;
  const m2 = address.match(/,\s*([A-Z]{2})\b/);
  if (m2) return STATE_TZ[m2[1]] ?? null;
  return null;
}

export const CRM_GOALS = [
  "Manage Leads","Track Sales","Schedule Jobs","Invoice Customers",
  "Automations","Email/SMS Marketing","Reporting",
] as const;

export type WorkerType = "employee" | "subcontractor";

export type Organization = {
  companyName: string; primaryPhone: string; website: string;
  industry?: string; address: string; logoUrl: string | null;
  crmGoals: string[]; timezone: string;
};

export type TeamMember = {
  id: string; name: string; email: string; phone?: string;
  role: Role; workerType: WorkerType;
  status: "active" | "invited"; invitedAt?: string;
};

// ── Logo / company cache ──────────────────────────────────────────────────────

const LOGO_KEY    = "rm_org_logo";
const COMPANY_KEY = "rm_org_name";

function readLogoCache(): string | null {
  try { const v = localStorage.getItem(LOGO_KEY); return v && !v.startsWith("blob:") ? v : null; }
  catch { return null; }
}
function writeLogoCache(url: string | null) {
  try { url && !url.startsWith("blob:") ? localStorage.setItem(LOGO_KEY, url) : localStorage.removeItem(LOGO_KEY); }
  catch {}
}
function readCompanyCache(): string {
  try { return localStorage.getItem(COMPANY_KEY) ?? ""; } catch { return ""; }
}
function writeCompanyCache(name: string) {
  try { name ? localStorage.setItem(COMPANY_KEY, name) : localStorage.removeItem(COMPANY_KEY); } catch {}
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_ORG: Organization = {
  companyName: "", primaryPhone: "", website: "", industry: undefined,
  address: "", logoUrl: null, crmGoals: [], timezone: "America/Los_Angeles",
};

// ── In-memory store ───────────────────────────────────────────────────────────

let org: Organization = { ...DEFAULT_ORG, logoUrl: readLogoCache(), companyName: readCompanyCache() };
let team: TeamMember[] = [];
let orgLoaded      = false;
let orgSubscribed  = false;
let currentOrgId: string | null = null;
let isUpdating     = false; // blocks realtime reloads during manual updates

const orgListeners  = new Set<() => void>();
const teamListeners = new Set<() => void>();
function emitOrg()  { for (const l of orgListeners)  l(); }
function emitTeam() { for (const l of teamListeners) l(); }

// ── Team reload ───────────────────────────────────────────────────────────────

export async function reloadTeam(orgId: string) {
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("org_memberships").select(`
      member_id, role,
      profiles!org_memberships_member_id_fkey(id, first_name, last_name, email, phone)
    `).eq("org_id", orgId),
    supabase.from("invitations").select("*")
      .eq("organization_id", orgId).eq("status", "pending"),
  ]);

  const activeMembers: TeamMember[] = (members ?? []).map((m: any) => ({
    id:         m.member_id,
    name:       `${m.profiles?.first_name || ""} ${m.profiles?.last_name || ""}`.trim() || m.profiles?.email || "",
    email:      m.profiles?.email  || "",
    phone:      m.profiles?.phone  || undefined,
    role:       m.role || "viewer",
    workerType: "employee" as WorkerType,
    status:     "active" as const,
  }));

  const invitedMembers: TeamMember[] = (invites ?? []).map((inv: any) => ({
    id:        `inv-${inv.id}`,
    name:      `${inv.first_name || ""} ${inv.last_name || ""}`.trim() || inv.email || "",
    email:     inv.email || "",
    role:      inv.role || "viewer",
    workerType: inv.worker_type || "employee",
    status:    "invited" as const,
    invitedAt: inv.created_at,
  }));

  const existingIds = new Set(activeMembers.map(m => m.id));
  team = [...activeMembers, ...invitedMembers.filter(m => !existingIds.has(m.id))];
  emitTeam();
}

// ── Full load ─────────────────────────────────────────────────────────────────

async function loadOrgFromSupabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const user = session.user;

    // Resolve org ID
    const { data: profile } = await supabase.from("profiles")
      .select("organization_id").eq("id", user.id).maybeSingle();
    let orgId = profile?.organization_id;

    if (!orgId) {
      const { data: membership } = await supabase.from("org_memberships")
        .select("org_id").eq("member_id", user.id).maybeSingle();
      orgId = membership?.org_id;
    }
    if (!orgId) return;
    currentOrgId = orgId;

    // Fetch org row
    const { data: orgData } = await supabase.from("organizations")
      .select("*").eq("id", orgId).maybeSingle();

    if (orgData) {
      const rawLogo = orgData.logo_url || null;
      const logoUrl = rawLogo?.startsWith("blob:") ? null : rawLogo;
      org = {
        companyName:  orgData.name  || orgData.public_name || "",
        primaryPhone: orgData.phone || "",
        website:      orgData.website || "",
        industry:     orgData.industry || undefined,
        address:      orgData.address  || orgData.business_address || "",
        logoUrl:      logoUrl || readLogoCache(),
        crmGoals:     orgData.crm_goals || [],
        timezone:     orgData.timezone  || "America/Los_Angeles",
      };
      if (logoUrl) writeLogoCache(logoUrl);
      writeCompanyCache(org.companyName);
      orgLoaded = true;
      emitOrg();
    }

    // Realtime subscriptions — only once per session
    if (!orgSubscribed) {
      orgSubscribed = true;

      // Org row changes (logo, name, etc.)
      supabase.channel(`org_${orgId}`)
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "organizations", filter: `id=eq.${orgId}` },
          (payload) => {
            const d   = payload.new as any;
            const raw = d.logo_url || null;
            const rl  = raw?.startsWith("blob:") ? null : raw;
            org = { ...org,
              companyName:  d.name  || d.public_name || org.companyName,
              primaryPhone: d.phone || org.primaryPhone,
              website:      d.website || org.website,
              industry:     d.industry || org.industry,
              address:      d.address  || d.business_address || org.address,
              logoUrl:      rl ?? readLogoCache(),
              crmGoals:     d.crm_goals || org.crmGoals,
              timezone:     d.timezone  || org.timezone,
            };
            if (rl) writeLogoCache(rl);
            emitOrg();
          })
        .subscribe();

      // Membership changes → reload team (guarded during manual updates)
      supabase.channel(`members_${orgId}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "org_memberships", filter: `org_id=eq.${orgId}` },
          () => { if (!isUpdating) reloadTeam(orgId!); })
        .subscribe();

      // Invitation changes → reload team (guarded during manual updates)
      supabase.channel(`invitations_${orgId}`)
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "invitations", filter: `organization_id=eq.${orgId}` },
          () => { if (!isUpdating) reloadTeam(orgId!); })
        .subscribe();
    }

    await reloadTeam(orgId);

  } catch (err) {
    console.error("[org] loadOrgFromSupabase failed:", err);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

loadOrgFromSupabase();

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
    loadOrgFromSupabase();
  } else if (event === "SIGNED_OUT") {
    writeLogoCache(null);
    writeCompanyCache("");
    org           = { ...DEFAULT_ORG };
    team          = [];
    orgLoaded     = false;
    orgSubscribed = false;
    currentOrgId  = null;
    isUpdating    = false;
    emitOrg();
    emitTeam();
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

export function getOrganization(): Organization { return org; }

export function updateOrganization(patch: Partial<Organization>) {
  org = { ...org, ...patch };
  if (patch.logoUrl     !== undefined) writeLogoCache(patch.logoUrl);
  if (patch.companyName !== undefined) writeCompanyCache(patch.companyName);
  emitOrg();

  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: p } = await supabase.from("profiles")
        .select("organization_id").eq("id", session.user.id).maybeSingle();
      const orgId = p?.organization_id;
      if (!orgId) return;

      const u: Record<string, any> = {};
      if (patch.companyName  !== undefined) { u.name = patch.companyName; u.public_name = patch.companyName; }
      if (patch.primaryPhone !== undefined) u.phone     = patch.primaryPhone;
      if (patch.website      !== undefined) u.website   = patch.website;
      if (patch.industry     !== undefined) u.industry  = patch.industry;
      if (patch.address      !== undefined) u.address   = patch.address;
      if (patch.logoUrl      !== undefined) u.logo_url  = patch.logoUrl;
      if (patch.crmGoals     !== undefined) u.crm_goals = patch.crmGoals;
      if (patch.timezone     !== undefined) u.timezone  = patch.timezone;

      if (Object.keys(u).length > 0) {
        const { error } = await supabase.from("organizations").update(u).eq("id", orgId);
        if (error) console.error("[org] updateOrganization failed:", error);
      }
    } catch (err) {
      console.error("[org] updateOrganization sync failed:", err);
    }
  })();
}

export function useOrganization(): Organization {
  return useSyncExternalStore(
    cb => { orgListeners.add(cb); return () => orgListeners.delete(cb); },
    () => org,
    () => ({ ...DEFAULT_ORG, logoUrl: readLogoCache(), companyName: readCompanyCache() }),
  );
}

export function getTeam(): TeamMember[] { return team; }

export function useTeam(): TeamMember[] {
  return useSyncExternalStore(
    cb => { teamListeners.add(cb); return () => teamListeners.delete(cb); },
    () => team,
    () => [],
  );
}

export function addMember(member: Omit<TeamMember, "id">): TeamMember {
  const next: TeamMember = { ...member, id: `u${Date.now()}` };
  team = [...team, next];
  emitTeam();
  return next;
}

export function updateMember(id: string, patch: Partial<TeamMember>) {
  // Optimistic update shown immediately
  team = team.map(m => m.id === id ? { ...m, ...patch } : m);
  emitTeam();

  (async () => {
    try {
      isUpdating = true; // prevent realtime from overwriting during writes

      // 1. Update profiles (name + phone)
      if (patch.name !== undefined || patch.phone !== undefined) {
        const parts = (patch.name ?? "").trim().split(" ");
        const { error } = await supabase.from("profiles").update({
          ...(patch.name !== undefined ? {
            first_name: parts[0] ?? "",
            last_name:  parts.slice(1).join(" ") || null,
          } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
        }).eq("id", id);
        if (error) console.error("[org] profiles update failed:", error);
      }

      // 2. Update role in org_memberships
      if (patch.role !== undefined) {
        const { error } = await supabase.from("org_memberships")
          .update({ role: patch.role })
          .eq("member_id", id);
        if (error) console.error("[org] org_memberships update failed:", error);
      }

      // 3. Update auth.users via admin function (phone + name)
      if (patch.phone !== undefined || patch.name !== undefined) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const member = team.find(m => m.id === id);
          const parts  = (patch.name ?? member?.name ?? "").trim().split(" ");
          fetch("/.netlify/functions/update-user-by-id", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              targetUserId: id,
              phone:        patch.phone ?? member?.phone,
              firstName:    parts[0] ?? "",
              lastName:     parts.slice(1).join(" ") ?? "",
            }),
          }).catch(err => console.error("[org] update-user-by-id failed:", err));
        }
      }

      // 4. Re-fetch from DB — authoritative values after all writes complete
      if (currentOrgId) await reloadTeam(currentOrgId);

    } catch (err) {
      console.error("[org] updateMember failed:", err);
    } finally {
      isUpdating = false; // always release
    }
  })();
}

export function removeMember(id: string) {
  team = team.filter(m => m.id !== id);
  emitTeam();
}

export function memberInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}