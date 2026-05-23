// src/lib/organization.ts
// Organization + team domain.
// Loads from Supabase on init, falls back to defaults if not yet onboarded.
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type Role =
  | "viewer"
  | "field_worker"
  | "estimator"
  | "sales"
  | "accountant"
  | "project_manager"
  | "admin"
  | "owner";

export const ALL_ROLES: Role[] = [
  "viewer",
  "field_worker",
  "estimator",
  "sales",
  "accountant",
  "project_manager",
  "admin",
  "owner",
];

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  field_worker: "Field Worker",
  estimator: "Estimator",
  sales: "Sales",
  accountant: "Accountant",
  project_manager: "Project Manager",
  admin: "Admin",
  owner: "Owner",
};

export const INDUSTRIES = [
  "General Contractor / Remodeler",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "Painting",
  "Landscaping",
  "Flooring",
  "Windows & Doors",
  "Handyman",
] as const;

export const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
] as const;

/** Best-effort timezone from a US state abbreviation in the address. */
const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Boise",
  IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/Detroit", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York",
  NM: "America/Denver", NY: "America/New_York", NC: "America/New_York",
  ND: "America/Chicago", OH: "America/New_York", OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago",
  TX: "America/Chicago", UT: "America/Denver", VT: "America/New_York",
  VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago", WY: "America/Denver", DC: "America/New_York",
};

export function guessTimezoneFromAddress(address: string): string | null {
  const m = address.match(/\b([A-Z]{2})\s*\d{0,5}\s*$/);
  if (m) return STATE_TZ[m[1]] ?? null;
  const m2 = address.match(/,\s*([A-Z]{2})\b/);
  if (m2) return STATE_TZ[m2[1]] ?? null;
  return null;
}

export const CRM_GOALS = [
  "Manage Leads",
  "Track Sales",
  "Schedule Jobs",
  "Invoice Customers",
  "Automations",
  "Email/SMS Marketing",
  "Reporting",
] as const;

export type WorkerType = "employee" | "subcontractor";

export type Organization = {
  companyName: string;
  primaryPhone: string;
  website: string;
  industry?: string;
  address: string;
  logoUrl: string | null;
  crmGoals: string[];
  timezone: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  workerType: WorkerType;
  status: "active" | "invited";
  invitedAt?: string;
};

// ── Logo cache ────────────────────────────────────────────────────────────────
// Persists the logo URL in localStorage so it shows instantly on every refresh,
// before Supabase auth even resolves. Cleared on sign-out.

const LOGO_CACHE_KEY = "rm_org_logo";
const COMPANY_CACHE_KEY = "rm_org_name";

function readLogoCache(): string | null {
  try {
    const v = localStorage.getItem(LOGO_CACHE_KEY);
    // Discard stale blob: URLs from previous sessions
    return v && !v.startsWith("blob:") ? v : null;
  } catch {
    return null;
  }
}

function writeLogoCache(url: string | null) {
  try {
    if (url && !url.startsWith("blob:")) localStorage.setItem(LOGO_CACHE_KEY, url);
    else localStorage.removeItem(LOGO_CACHE_KEY);
  } catch {}
}

function readCompanyCache(): string {
  try { return localStorage.getItem(COMPANY_CACHE_KEY) ?? ""; } catch { return ""; }
}

function writeCompanyCache(name: string) {
  try {
    if (name) localStorage.setItem(COMPANY_CACHE_KEY, name);
    else localStorage.removeItem(COMPANY_CACHE_KEY);
  } catch {}
}

// ── Default (shown before Supabase loads) ─────────────────────────────────────

const DEFAULT_ORG: Organization = {
  companyName: "",
  primaryPhone: "",
  website: "",
  industry: undefined,
  address: "",
  logoUrl: null,
  crmGoals: [],
  timezone: "America/Los_Angeles",
};

const DEFAULT_TEAM: TeamMember[] = [];

// ── In-memory store ───────────────────────────────────────────────────────────
// Pre-seed from localStorage so logo + company name appear immediately.

let org: Organization = {
  ...DEFAULT_ORG,
  logoUrl: readLogoCache(),
  companyName: readCompanyCache(),
};
let team: TeamMember[] = [...DEFAULT_TEAM];
let orgLoaded = false;

const orgListeners = new Set<() => void>();
const teamListeners = new Set<() => void>();

function emitOrg() { for (const l of orgListeners) l(); }
function emitTeam() { for (const l of teamListeners) l(); }

// ── Load from Supabase ────────────────────────────────────────────────────────

async function loadOrgFromSupabase() {
  try {
    // getSession() reads from localStorage — no network call needed, works on refresh
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const user = session.user;

    // Get org id via profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    let orgId = profile?.organization_id;

    // Fallback: org_memberships
    if (!orgId) {
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("member_id", user.id)
        .maybeSingle();
      orgId = membership?.org_id;
    }

    if (!orgId) return;

    // Fetch organization row
    const { data: orgData } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    if (orgData) {
      const rawLogo = orgData.logo_url ?? null;
      // Discard stale blob: URLs saved by older code
      const logoUrl = rawLogo?.startsWith("blob:") ? null : rawLogo;

      org = {
        companyName: orgData.name || orgData.public_name || "",
        primaryPhone: orgData.phone || "",
        website: orgData.website || "",
        industry: orgData.industry || undefined,
        address: orgData.address || orgData.business_address || "",
        logoUrl: logoUrl ?? readLogoCache(),
        crmGoals: orgData.crm_goals || [],
        timezone: orgData.timezone || "America/Los_Angeles",
      };

      // Only update cache when DB has a real value — never clear it based on null from DB
      // (handles case where the Supabase update failed but storage upload succeeded)
      if (logoUrl) writeLogoCache(logoUrl);
      writeCompanyCache(org.companyName);

      orgLoaded = true;
      emitOrg();
    }

    // Fetch team members
    const { data: members } = await supabase
      .from("org_memberships")
      .select(`
        member_id,
        role,
        profiles!inner (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("organization_id", orgId);

    if (members && members.length > 0) {
      team = members.map((m: any) => ({
        id: m.member_id,
        name: `${m.profiles?.first_name || ""} ${m.profiles?.last_name || ""}`.trim() || m.profiles?.email || "",
        email: m.profiles?.email || "",
        role: m.role || "viewer",
        workerType: "employee" as WorkerType,
        status: "active" as const,
      }));
      emitTeam();
    }

    // Fetch pending invitations
    const { data: invites } = await supabase
      .from("invitations")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "pending");

    if (invites && invites.length > 0) {
      const invitedMembers: TeamMember[] = invites.map((inv: any) => ({
        id: `inv-${inv.id}`,
        name: inv.name || inv.email || "",
        email: inv.email || "",
        role: inv.role || "viewer",
        workerType: inv.worker_type || "employee",
        status: "invited" as const,
        invitedAt: inv.created_at,
      }));
      team = [...team, ...invitedMembers];
      emitTeam();
    }
  } catch (err) {
    console.error("Failed to load org from Supabase:", err);
  }
}

// Kick off loading when this module is first imported
loadOrgFromSupabase();

// Reload when auth state changes
supabase.auth.onAuthStateChange((event) => {
  if (
    event === "SIGNED_IN" ||
    event === "TOKEN_REFRESHED" ||
    event === "INITIAL_SESSION"
  ) {
    loadOrgFromSupabase();
  } else if (event === "SIGNED_OUT") {
    // Clear caches on sign-out
    writeLogoCache(null);
    writeCompanyCache("");
    org = { ...DEFAULT_ORG };
    team = [...DEFAULT_TEAM];
    orgLoaded = false;
    emitOrg();
    emitTeam();
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

export function getOrganization(): Organization {
  return org;
}

export function updateOrganization(patch: Partial<Organization>) {
  org = { ...org, ...patch };

  // Keep localStorage in sync immediately so refresh shows latest values
  if (patch.logoUrl !== undefined) writeLogoCache(patch.logoUrl);
  if (patch.companyName !== undefined) writeCompanyCache(patch.companyName);

  emitOrg();

  // Persist to Supabase in background
  (async () => {
    try {
      // Use getSession() — no network call, works reliably
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const user = session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      const orgId = profile?.organization_id;
      if (!orgId) return;

      const updates: Record<string, any> = {};
      if (patch.companyName !== undefined) { updates.name = patch.companyName; updates.public_name = patch.companyName; }
      if (patch.primaryPhone !== undefined) updates.phone = patch.primaryPhone;
      if (patch.website !== undefined) updates.website = patch.website;
      if (patch.industry !== undefined) updates.industry = patch.industry;
      if (patch.address !== undefined) updates.address = patch.address;
      if (patch.logoUrl !== undefined) updates.logo_url = patch.logoUrl;
      if (patch.crmGoals !== undefined) updates.crm_goals = patch.crmGoals;
      if (patch.timezone !== undefined) updates.timezone = patch.timezone;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("organizations")
          .update(updates)
          .eq("id", orgId);
        if (error) console.error("[org] Supabase update failed:", error);
      }
    } catch (err) {
      console.error("Failed to sync org update to Supabase:", err);
    }
  })();
}

export function useOrganization(): Organization {
  return useSyncExternalStore(
    (cb) => {
      orgListeners.add(cb);
      return () => orgListeners.delete(cb);
    },
    () => org,
    () => ({ ...DEFAULT_ORG, logoUrl: readLogoCache(), companyName: readCompanyCache() }),
  );
}

export function getTeam(): TeamMember[] {
  return team;
}

export function useTeam(): TeamMember[] {
  return useSyncExternalStore(
    (cb) => {
      teamListeners.add(cb);
      return () => teamListeners.delete(cb);
    },
    () => team,
    () => DEFAULT_TEAM,
  );
}

export function addMember(member: Omit<TeamMember, "id">): TeamMember {
  const next: TeamMember = { ...member, id: `u${Date.now()}` };
  team = [...team, next];
  emitTeam();
  return next;
}

export function updateMember(id: string, patch: Partial<TeamMember>) {
  team = team.map((m) => (m.id === id ? { ...m, ...patch } : m));
  emitTeam();
}

export function removeMember(id: string) {
  team = team.filter((m) => m.id !== id);
  emitTeam();
}

export function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}