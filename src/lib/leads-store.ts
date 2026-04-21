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

export function importLeads(newLeads: Omit<Lead, "id">[]): number {
  const added = newLeads.map((l, i) => ({ ...l, id: `lead-import-${Date.now()}-${i}` } as Lead));
  leads = [...added, ...leads];
  persist();
  emit();
  return added.length;
}

/* ---------- Internal Notes ---------- */

export type LeadNote = { id: string; text: string; createdAt: string };

const NOTES_KEY = "renometa.leadnotes.v1";

function loadNotes(): Record<string, LeadNote[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

let notesMap: Record<string, LeadNote[]> = loadNotes();
const noteListeners = new Set<() => void>();
function emitNotes() { for (const l of noteListeners) l(); }
function persistNotes() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(NOTES_KEY, JSON.stringify(notesMap)); } catch { /* */ }
}

export function useLeadNotes(leadId: string): LeadNote[] {
  const all = useSyncExternalStore(
    (cb) => { noteListeners.add(cb); return () => noteListeners.delete(cb); },
    () => notesMap,
    () => ({}),
  );
  return all[leadId] ?? [];
}

export function addLeadNote(leadId: string, text: string): LeadNote {
  const note: LeadNote = { id: `note-${Date.now()}`, text, createdAt: new Date().toISOString() };
  notesMap = { ...notesMap, [leadId]: [note, ...(notesMap[leadId] ?? [])] };
  persistNotes();
  emitNotes();
  return note;
}