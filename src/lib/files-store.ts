// In-memory DMS store for the Files module.
// Seeded from projectDocuments + extra unattached workspace files.
// Persisted to localStorage so uploads/edits survive a refresh.
import { useSyncExternalStore } from "react";
import { mockProjects, projectDocuments, type ProjectDocument } from "@/lib/mock-data";

export type FileCategory = ProjectDocument["category"]; // Contract | Blueprint | Permit | Photos | Other
export const FILE_CATEGORIES: FileCategory[] = ["Contract", "Blueprint", "Permit", "Photos", "Other"];

export type FileVersion = {
  id: string;
  version: number;
  uploaded: string; // ISO
  uploadedBy: string;
  size: string;
  note?: string;
};

export type ShareLink = {
  id: string;
  createdAt: string; // ISO
  createdBy: string;
  recipient?: string; // email or name
  expiresAt?: string; // ISO
  permission: "view" | "comment" | "edit";
  url: string;
  revoked?: boolean;
};

export type FileActivity = {
  id: string;
  at: string; // ISO
  who: string;
  action:
    | "uploaded"
    | "renamed"
    | "moved"
    | "tagged"
    | "shared"
    | "share-revoked"
    | "version-added"
    | "downloaded"
    | "deleted"
    | "starred"
    | "unstarred";
  detail?: string;
};

export type FileRecord = {
  id: string;
  name: string;
  category: FileCategory;
  projectId?: string;
  projectName?: string;
  size: string;
  uploadedAt: string; // ISO
  uploadedBy: string;
  tags: string[];
  starred: boolean;
  shared: boolean;
  versions: FileVersion[]; // descending version
  shareLinks: ShareLink[];
  activity: FileActivity[]; // descending time
  url?: string; // object URL when uploaded in-session
  ext: string;
};

const OWNERS = ["Alex Romero", "Priya Shah", "Jamal Burke", "Mei Lin", "Sara Holt"];

function inferExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "file";
}

function isoDaysAgo(d: number): string {
  const ms = Date.UTC(2026, 3, 18) - d * 86_400_000;
  return new Date(ms).toISOString();
}

function shortSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ---- Seed ----
function buildSeed(): FileRecord[] {
  const records: FileRecord[] = [];
  let ix = 0;
  for (const project of mockProjects) {
    const docs = projectDocuments[project.id] ?? [];
    for (const d of docs) {
      ix += 1;
      const owner = OWNERS[ix % OWNERS.length];
      const uploadedAt = isoDaysAgo((ix * 3) % 60);
      records.push({
        id: d.id,
        name: d.name,
        category: d.category,
        projectId: project.id,
        projectName: project.name,
        size: d.size,
        uploadedAt,
        uploadedBy: owner,
        tags: tagsFor(d.category, project.type),
        starred: ix % 11 === 0,
        shared: d.shared,
        ext: inferExt(d.name),
        versions: [
          {
            id: `${d.id}_v1`,
            version: 1,
            uploaded: uploadedAt,
            uploadedBy: owner,
            size: d.size,
            note: "Initial upload",
          },
        ],
        shareLinks: d.shared
          ? [
              {
                id: `${d.id}_sl1`,
                createdAt: uploadedAt,
                createdBy: owner,
                permission: "view",
                url: `https://share.renometa.app/${d.id}`,
                recipient: `${project.client.split(" ")[0].toLowerCase()}@example.com`,
              },
            ]
          : [],
        activity: [
          { id: `${d.id}_a1`, at: uploadedAt, who: owner, action: "uploaded", detail: d.name },
          ...(d.shared
            ? [{ id: `${d.id}_a2`, at: uploadedAt, who: owner, action: "shared" as const, detail: "View link created" }]
            : []),
        ],
      });
    }
  }
  // A few unattached workspace files
  const extras: Array<{ name: string; category: FileCategory; tag: string }> = [
    { name: "Standard Subcontractor Agreement.pdf", category: "Contract", tag: "Template" },
    { name: "Brand Guidelines 2026.pdf", category: "Other", tag: "Brand" },
    { name: "OSHA Safety Checklist.pdf", category: "Other", tag: "Compliance" },
    { name: "Workshop Floor Plan.dwg", category: "Blueprint", tag: "Reference" },
  ];
  extras.forEach((e, i) => {
    const id = `wf_${i + 1}`;
    const uploadedAt = isoDaysAgo(20 + i * 8);
    const owner = OWNERS[i % OWNERS.length];
    records.push({
      id,
      name: e.name,
      category: e.category,
      size: shortSize(120_000 + i * 480_000),
      uploadedAt,
      uploadedBy: owner,
      tags: [e.tag, "Workspace"],
      starred: i === 0,
      shared: false,
      ext: inferExt(e.name),
      versions: [
        { id: `${id}_v1`, version: 1, uploaded: uploadedAt, uploadedBy: owner, size: shortSize(120_000 + i * 480_000), note: "Initial upload" },
      ],
      shareLinks: [],
      activity: [{ id: `${id}_a1`, at: uploadedAt, who: owner, action: "uploaded", detail: e.name }],
    });
  });
  return records;
}

function tagsFor(category: FileCategory, projectType: string): string[] {
  const base: Record<FileCategory, string[]> = {
    Contract: ["Signed", "Client"],
    Blueprint: ["CAD"],
    Permit: ["City"],
    Photos: ["Site"],
    Other: [],
  };
  return [...base[category], projectType];
}

// ---- Storage ----
const KEY = "renometa.files.v1";

function load(): FileRecord[] {
  if (typeof window === "undefined") return buildSeed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return buildSeed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return buildSeed();
    return parsed as FileRecord[];
  } catch {
    return buildSeed();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    // Don't persist URL-of-blob (object URLs aren't valid across reloads)
    const safe = files.map((f) => ({ ...f, url: undefined }));
    window.localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    /* ignore */
  }
}

let files: FileRecord[] = load();
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

// ---- Public API ----
export function getFiles(): FileRecord[] {
  return files;
}

export function useFiles(): FileRecord[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => files,
    () => files,
  );
}

export function getFile(id: string): FileRecord | undefined {
  return files.find((f) => f.id === id);
}

export type UploadInput = {
  name: string;
  size: number;
  category?: FileCategory;
  projectId?: string;
  url?: string;
  uploadedBy?: string;
};

function projectName(projectId?: string): string | undefined {
  if (!projectId) return undefined;
  return mockProjects.find((p) => p.id === projectId)?.name;
}

export function addFile(input: UploadInput): FileRecord {
  const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const owner = input.uploadedBy ?? "Alex Romero";
  const now = new Date().toISOString();
  const record: FileRecord = {
    id,
    name: input.name,
    category: input.category ?? "Other",
    projectId: input.projectId,
    projectName: projectName(input.projectId),
    size: shortSize(input.size),
    uploadedAt: now,
    uploadedBy: owner,
    tags: [],
    starred: false,
    shared: false,
    ext: inferExt(input.name),
    versions: [
      { id: `${id}_v1`, version: 1, uploaded: now, uploadedBy: owner, size: shortSize(input.size), note: "Initial upload" },
    ],
    shareLinks: [],
    activity: [{ id: `${id}_a1`, at: now, who: owner, action: "uploaded", detail: input.name }],
    url: input.url,
  };
  files = [record, ...files];
  persist();
  emit();
  return record;
}

function update(id: string, patch: (f: FileRecord) => FileRecord) {
  files = files.map((f) => (f.id === id ? patch(f) : f));
  persist();
  emit();
}

function logActivity(f: FileRecord, action: FileActivity["action"], detail?: string): FileRecord {
  return {
    ...f,
    activity: [
      { id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), who: "Alex Romero", action, detail },
      ...f.activity,
    ],
  };
}

export function renameFile(id: string, newName: string) {
  update(id, (f) => logActivity({ ...f, name: newName, ext: inferExt(newName) }, "renamed", newName));
}

export function moveFile(id: string, projectId?: string) {
  update(id, (f) =>
    logActivity({ ...f, projectId, projectName: projectName(projectId) }, "moved", projectName(projectId) ?? "Workspace"),
  );
}

export function setCategory(id: string, category: FileCategory) {
  update(id, (f) => logActivity({ ...f, category }, "moved", category));
}

export function toggleStar(id: string) {
  update(id, (f) => logActivity({ ...f, starred: !f.starred }, f.starred ? "unstarred" : "starred"));
}

export function setTags(id: string, tags: string[]) {
  update(id, (f) => logActivity({ ...f, tags }, "tagged", tags.join(", ")));
}

export function addVersion(id: string, input: { size: number; note?: string }) {
  update(id, (f) => {
    const next = (f.versions[0]?.version ?? 0) + 1;
    const v: FileVersion = {
      id: `${id}_v${next}`,
      version: next,
      uploaded: new Date().toISOString(),
      uploadedBy: "Alex Romero",
      size: shortSize(input.size),
      note: input.note,
    };
    return logActivity(
      { ...f, versions: [v, ...f.versions], size: v.size },
      "version-added",
      `v${next}${input.note ? ` — ${input.note}` : ""}`,
    );
  });
}

export function createShareLink(id: string, opts: { recipient?: string; permission: ShareLink["permission"]; expiresAt?: string }) {
  update(id, (f) => {
    const link: ShareLink = {
      id: `${id}_sl_${Date.now()}`,
      createdAt: new Date().toISOString(),
      createdBy: "Alex Romero",
      recipient: opts.recipient,
      permission: opts.permission,
      expiresAt: opts.expiresAt,
      url: `https://share.renometa.app/${id}/${Math.random().toString(36).slice(2, 8)}`,
    };
    return logActivity(
      { ...f, shared: true, shareLinks: [link, ...f.shareLinks] },
      "shared",
      opts.recipient ? `with ${opts.recipient}` : opts.permission,
    );
  });
}

export function revokeShareLink(id: string, linkId: string) {
  update(id, (f) => {
    const links = f.shareLinks.map((l) => (l.id === linkId ? { ...l, revoked: true } : l));
    const stillShared = links.some((l) => !l.revoked);
    return logActivity({ ...f, shareLinks: links, shared: stillShared }, "share-revoked");
  });
}

export function deleteFile(id: string) {
  files = files.filter((f) => f.id !== id);
  persist();
  emit();
}

export function fileIcon(ext: string): "image" | "pdf" | "cad" | "doc" | "sheet" | "slides" | "video" | "archive" | "file" {
  const e = ext.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(e)) return "image";
  if (e === "pdf") return "pdf";
  if (["dwg", "dxf", "rvt", "skp"].includes(e)) return "cad";
  if (["doc", "docx", "rtf", "txt", "md"].includes(e)) return "doc";
  if (["xls", "xlsx", "csv"].includes(e)) return "sheet";
  if (["ppt", "pptx", "key"].includes(e)) return "slides";
  if (["mp4", "mov", "webm"].includes(e)) return "video";
  if (["zip", "rar", "7z", "tar", "gz"].includes(e)) return "archive";
  return "file";
}

// Total bytes-equivalent helper for storage stats (rough — parses our shortSize strings)
export function approxBytes(size: string): number {
  const m = /^([\d.]+)\s*(B|KB|MB|GB)$/i.exec(size);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  return unit === "GB" ? n * 1_073_741_824 : unit === "MB" ? n * 1_048_576 : unit === "KB" ? n * 1024 : n;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
