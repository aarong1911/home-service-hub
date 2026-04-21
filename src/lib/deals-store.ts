import { useSyncExternalStore } from "react";
import { mockDeals, type Deal } from "@/lib/mock-data";

const STORAGE_KEY = "renometa.deals.v1";

function loadDeals(): Deal[] {
  if (typeof window === "undefined") return [...mockDeals];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...mockDeals];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as Deal[]) : [...mockDeals];
  } catch {
    return [...mockDeals];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deals)); } catch { /* ignore */ }
}

let deals: Deal[] = loadDeals();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function getDeals(): Deal[] {
  return deals;
}

export function useDeals(): Deal[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => deals,
    () => mockDeals,
  );
}

export function addDeal(deal: Omit<Deal, "id">): Deal {
  const next: Deal = { ...deal, id: `deal-${Date.now()}` };
  deals = [next, ...deals];
  persist();
  emit();
  return next;
}

export function updateDeal(id: string, patch: Partial<Deal>) {
  deals = deals.map((d) => (d.id === id ? { ...d, ...patch } : d));
  persist();
  emit();
}

export function setDealsState(next: Deal[]) {
  deals = next;
  persist();
  emit();
}