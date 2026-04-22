import { useSyncExternalStore } from "react";
import { mockContacts, type Contact } from "@/lib/mock-data";

const STORAGE_KEY = "renometa.contacts.v1";

function loadContacts(): Contact[] {
  if (typeof window === "undefined") return [...mockContacts];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...mockContacts];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as Contact[]) : [...mockContacts];
  } catch {
    return [...mockContacts];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts)); } catch { /* ignore */ }
}

let contacts: Contact[] = loadContacts();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function getContacts(): Contact[] {
  return contacts;
}

export function useContacts(): Contact[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => contacts,
    () => mockContacts,
  );
}

export function updateContact(id: string, patch: Partial<Contact>): void {
  const prev = contacts;
  contacts = contacts.map((c) => (c.id === id ? { ...c, ...patch } : c));
  try {
    persist();
  } catch (e) {
    contacts = prev;
    throw e;
  }
  emit();
}