// src/lib/projects-store.ts
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type Project = {
  id: string;
  name: string;
  clientId: string;
  status: string;
  address: string;
  budgetTotal: number;
  actualCost: number;
  completionPercentage: number;
  startDate: string | null;
  endDate: string | null;
  slug: string | null;
};

async function getOrgId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.organization_id) return profile.organization_id;

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("member_id", user.id)
    .maybeSingle();

  return membership?.org_id ?? null;
}

function mapProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    status: row.status,
    address: row.address ?? "",
    budgetTotal: Number(row.budget_total ?? 0),
    actualCost: Number(row.actual_cost ?? 0),
    completionPercentage: Number(row.completion_percentage ?? 0),
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    slug: row.slug ?? null,
  };
}

let projects: Project[] = [];
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function fetchProjects() {
  const orgId = await getOrgId();

  if (!orgId) {
    projects = [];
    loaded = true;
    emit();
    return;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[projects-store] fetch failed:", JSON.stringify(error, null, 2));
    loaded = true;
    emit();
    return;
  }

  projects = (data ?? []).map(mapProject);
  loaded = true;
  emit();
}

void fetchProjects();

export function useProjects(): Project[] {
  useEffect(() => {
    if (!loaded) void fetchProjects();
  }, []);

  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => projects,
    () => [],
  );
}

export function useProjectsLoading(): boolean {
  return !loaded;
}

export function getProjectName(projectId: string): string {
  return projects.find((project) => project.id === projectId)?.name ?? "Unassigned";
}

export async function refreshProjects() {
  await fetchProjects();
}