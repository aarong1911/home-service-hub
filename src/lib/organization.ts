// Shared organization + team domain (used by onboarding and /settings).
// In-memory store (no backend) — mirrors the schema from the onboarding flow
// so the same forms can be reused in both places.
import { useSyncExternalStore } from "react";

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
  "Construction",
  "Remodeling",
  "Flooring",
  "Roofing",
  "Electrical",
  "Plumbing",
  "Windows & Doors",
] as const;

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

// ---- Default seed data ----
const DEFAULT_ORG: Organization = {
  companyName: "RenoMeta Builders",
  primaryPhone: "(415) 555-0142",
  website: "https://renometa.com",
  industry: "Remodeling",
  address: "1180 Folsom St, San Francisco, CA 94103",
  logoUrl: null,
  crmGoals: ["Manage Leads", "Track Sales", "Invoice Customers"],
};

const DEFAULT_TEAM: TeamMember[] = [
  { id: "u1", name: "Alex Romero", email: "alex@renometa.com", role: "owner", workerType: "employee", status: "active" },
  { id: "u2", name: "Priya Shah", email: "priya@renometa.com", role: "admin", workerType: "employee", status: "active" },
  { id: "u3", name: "Jamal Burke", email: "jamal@renometa.com", role: "project_manager", workerType: "employee", status: "active" },
  { id: "u4", name: "Mei Lin", email: "mei@renometa.com", role: "sales", workerType: "employee", status: "active" },
  { id: "u5", name: "Sara Holt", email: "sara@renometa.com", role: "accountant", workerType: "subcontractor", status: "active" },
];

// ---- Store ----
let org: Organization = { ...DEFAULT_ORG };
let team: TeamMember[] = [...DEFAULT_TEAM];

const orgListeners = new Set<() => void>();
const teamListeners = new Set<() => void>();

function emitOrg() {
  for (const l of orgListeners) l();
}
function emitTeam() {
  for (const l of teamListeners) l();
}

export function getOrganization(): Organization {
  return org;
}
export function updateOrganization(patch: Partial<Organization>) {
  org = { ...org, ...patch };
  emitOrg();
}
export function useOrganization(): Organization {
  return useSyncExternalStore(
    (cb) => {
      orgListeners.add(cb);
      return () => orgListeners.delete(cb);
    },
    () => org,
    () => DEFAULT_ORG,
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
