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
