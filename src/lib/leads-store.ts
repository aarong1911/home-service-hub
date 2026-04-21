import { useSyncExternalStore } from "react";
import { mockLeads, type Lead, type LeadStatus, type LeadScore } from "@/lib/mock-data";

const STORAGE_KEY = "renometa.leads.v1";

function loadLeads(): Lead[] {
  if (typeof window === "undefined") return [...mockLeads];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...mockLeads];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as Lead[]) : [...mockLeads];
  } catch {
    return [...mockLeads];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch { /* ignore */ }
}

let leads: Lead[] = loadLeads();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function getLeads(): Lead[] {
  return leads;
}

export function useLeads(): Lead[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => leads,
    () => mockLeads,
  );
}

export function addLead(lead: Omit<Lead, "id">): Lead {
  const next: Lead = { ...lead, id: `lead-${Date.now()}` };
  leads = [next, ...leads];
  persist();
  emit();
  return next;
}

export function updateLead(id: string, patch: Partial<Lead>) {
  leads = leads.map((l) => (l.id === id ? { ...l, ...patch } : l));
  persist();
  emit();
}

export function updateLeadStatus(id: string, status: LeadStatus) {
  updateLead(id, { status, lastActivity: new Date().toISOString() });
}

export function updateLeadScore(id: string, score: LeadScore) {
  updateLead(id, { score });
}

export function convertLead(id: string): string {
  const dealId = `d_converted_${id}`;
  updateLead(id, {
    status: "converted",
    convertedDealId: dealId,
    lastActivity: new Date().toISOString(),
  });
  return dealId;
}