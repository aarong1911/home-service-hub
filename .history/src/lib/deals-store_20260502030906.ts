// src/lib/deals-store.ts
// Supabase-backed deals store — maintains the same hook interface.
// Also exports pipeline stages fetched from Supabase.

import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import type { Deal, LostReason } from "@/lib/mock-data";

// ── Org helper ──
async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
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

// ── Pipeline stages ──
// Exported for the pipeline page to use as column headers.
type PipelineStage = { id: string; name: string; supabaseId: string };

// Fallback stages in case Supabase hasn't loaded yet
const FALLBACK_STAGES: PipelineStage[] = [
  { id: "new", name: "New", supabaseId: "" },
  { id: "qualified", name: "Qualified", supabaseId: "" },
  { id: "site-visit", name: "Site Visit", supabaseId: "" },
  { id: "proposal", name: "Proposal", supabaseId: "" },
  { id: "negotiation", name: "Negotiation", supabaseId: "" },
  { id: "won", name: "Won", supabaseId: "" },
  { id: "lost", name: "Lost", supabaseId: "" },
];

let pipelineStagesData: PipelineStage[] = [...FALLBACK_STAGES];

// Map from Supabase UUID → slug (e.g. "site-visit") and vice versa
let stageUuidToSlug: Record<string, string> = {};
let stageSlugToUuid: Record<string, string> = {};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function fetchPipelineStages(): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) return;

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();

  if (!pipeline) return;

  const { data: stages, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, position, probability")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  if (error || !stages?.length) return;

  pipelineStagesData = stages.map((s: any) => ({
    id: slugify(s.name),
    name: s.name,
    supabaseId: s.id,
  }));

  stageUuidToSlug = {};
  stageSlugToUuid = {};
  for (const s of pipelineStagesData) {
    stageUuidToSlug[s.supabaseId] = s.id;
    stageSlugToUuid[s.id] = s.supabaseId;
  }
}

export { pipelineStagesData as pipelineStages };

export function usePipelineStages(): PipelineStage[] {
  useEffect(() => { fetchPipelineStages(); }, []);
  return pipelineStagesData;
}

// ── Map Supabase row → Deal type ──
function mapRow(row: any, contactMap: Record<string, any>): Deal {
  const contact = row.contact_id ? contactMap[row.contact_id] : null;
  const stageSlug = stageUuidToSlug[row.stage_id] ?? "new";
  const cf = row.custom_fields ?? {};

  const createdAt = new Date(row.created_at ?? Date.now());
  const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);

  return {
    id: row.id,
    name: row.title ?? "Untitled Deal",
    contactId: row.contact_id ?? "",
    contactName: contact?.full_name ?? "—",
    value: parseFloat(String(row.value ?? 0)),
    stage: row.status === "lost" ? "lost" : stageSlug,
    expectedClose: row.expected_close_date ?? "",
    owner: "—",
    ownerInitials: "—",
    ageDays,
    lostReason: cf.lost_reason as LostReason | undefined,
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    address: contact?.address ?? "",
  };
}

// ── Reactive store ──
let deals: Deal[] = [];
let loaded = false;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

async function fetchDeals(): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) return;

  // Ensure stages are loaded first
  if (!Object.keys(stageUuidToSlug).length) {
    await fetchPipelineStages();
  }

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[deals-store] fetch failed:", error);
    return;
  }

  // Batch-fetch contacts
  const contactIds = (data ?? [])
    .map((r: any) => r.contact_id)
    .filter(Boolean) as string[];

  let contactMap: Record<string, any> = {};
  if (contactIds.length > 0) {
    const unique = [...new Set(contactIds)];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone, address")
      .in("id", unique);

    if (contacts) {
      contactMap = Object.fromEntries(contacts.map((c: any) => [c.id, c]));
    }
  }

  deals = (data ?? []).map((r: any) => mapRow(r, contactMap));
  loaded = true;
  emit();
}

// Initial fetch
fetchDeals();

// ── Public API ──

export function getDeals(): Deal[] {
  return deals;
}

export function useDeals(): Deal[] {
  useEffect(() => { if (!loaded) fetchDeals(); }, []);

  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => deals,
    () => [],
  );
}

export async function addDeal(deal: Omit<Deal, "id">): Promise<Deal> {
  const orgId = await getOrgId();
  const tempId = `deal-${Date.now()}`;

  if (orgId) {
    const stageUuid = stageSlugToUuid[deal.stage] ?? Object.values(stageSlugToUuid)[0];

    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (pipeline) {
      const { data, error } = await supabase
        .from("deals")
        .insert({
          org_id: orgId,
          pipeline_id: pipeline.id,
          stage_id: stageUuid,
          title: deal.name,
          contact_id: deal.contactId || null,
          value: deal.value || 0,
          status: "open",
          expected_close_date: deal.expectedClose || null,
          stage_order: 0,
        })
        .select()
        .single();

      if (!error && data) {
        const mapped: Deal = { ...deal, id: data.id };
        deals = [mapped, ...deals];
        emit();
        return mapped;
      }
    }
  }

  const next: Deal = { ...deal, id: tempId };
  deals = [next, ...deals];
  emit();
  return next;
}

export async function updateDeal(id: string, patch: Partial<Deal>): Promise<void> {
  const update: Record<string, any> = { updated_at: new Date().toISOString() };

  if (patch.stage !== undefined) {
    if (patch.stage === "lost") {
      update.status = "lost";
    } else if (patch.stage === "won") {
      update.status = "won";
    } else {
      update.status = "open";
      const uuid = stageSlugToUuid[patch.stage];
      if (uuid) update.stage_id = uuid;
    }
  }
  if (patch.name !== undefined) update.title = patch.name;
  if (patch.value !== undefined) update.value = patch.value;
  if (patch.expectedClose !== undefined) update.expected_close_date = patch.expectedClose;
  if (patch.lostReason !== undefined) {
    update.custom_fields = { lost_reason: patch.lostReason };
  }

  const { error } = await supabase
    .from("deals")
    .update(update)
    .eq("id", id);

  if (error) console.error("[deals-store] update failed:", error);

  deals = deals.map((d) => (d.id === id ? { ...d, ...patch } : d));
  emit();
}

export function setDealsState(next: Deal[]): void {
  deals = next;
  emit();
}

export async function refreshDeals(): Promise<void> {
  await fetchDeals();
}