// Cross-route in-memory draft invoices store.
// Used to ship draft invoices created from accepted estimates over to /financials/invoices.
import { useSyncExternalStore } from "react";
import type { Invoice } from "@/lib/mock-data";

const listeners = new Set<() => void>();
let drafts: Invoice[] = [];

function emit() {
  for (const l of listeners) l();
}

export function addDraftInvoice(invoice: Invoice) {
  drafts = [invoice, ...drafts];
  emit();
}

export function getDraftInvoices(): Invoice[] {
  return drafts;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: Invoice[] = [];

export function useDraftInvoices(): Invoice[] {
  // Use a stable empty array on the server snapshot to satisfy SSR + avoid loops.
  return useSyncExternalStore(
    subscribe,
    () => drafts,
    () => EMPTY,
  );
}

export function nextDraftInvoiceNumber(existingCount: number): string {
  return `INV-${String(8000 + existingCount + drafts.length + 1).padStart(4, "0")}`;
}
