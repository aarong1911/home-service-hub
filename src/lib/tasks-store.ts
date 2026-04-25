import { useSyncExternalStore } from "react";
import { mockTasks, type Task } from "@/lib/mock-data";

const STORAGE_KEY = "renometa.tasks.v1";

function load(): Task[] {
  if (typeof window === "undefined") return [...mockTasks];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...mockTasks];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as Task[]) : [...mockTasks];
  } catch {
    return [...mockTasks];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { /* ignore */ }
}

let tasks: Task[] = load();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function useTasks(): Task[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => tasks,
    () => mockTasks,
  );
}

export function addTask(task: Omit<Task, "id">): Task {
  const next: Task = { ...task, id: `t_${Date.now()}` };
  tasks = [next, ...tasks];
  persist();
  emit();
  return next;
}

export function updateTask(id: string, patch: Partial<Task>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  persist();
  emit();
}

export function deleteTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  persist();
  emit();
}

function addRecurrence(iso: string, recurrence: NonNullable<Task["recurrence"]>): string {
  const d = new Date(iso);
  switch (recurrence) {
    case "daily": d.setUTCDate(d.getUTCDate() + 1); break;
    case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
    case "biweekly": d.setUTCDate(d.getUTCDate() + 14); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
    default: return iso;
  }
  return d.toISOString();
}

/**
 * Mark a task done. If it has a recurrence, also create the next instance
 * (todo) with the due date advanced by the recurrence interval.
 * Returns the newly created next-instance task, if any.
 */
export function completeTask(id: string): Task | null {
  const current = tasks.find((t) => t.id === id);
  if (!current) return null;
  const recurrence = current.recurrence;
  tasks = tasks.map((t) => (t.id === id ? { ...t, status: "done" as const } : t));
  if (!recurrence || recurrence === "none") {
    persist();
    emit();
    return null;
  }
  const next: Task = {
    ...current,
    id: `t_${Date.now()}`,
    status: "todo",
    due: addRecurrence(current.due, recurrence),
  };
  tasks = [next, ...tasks];
  persist();
  emit();
  return next;
}
