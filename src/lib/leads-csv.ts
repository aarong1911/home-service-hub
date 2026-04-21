import type { Lead, LeadSource, LeadStatus, LeadScore } from "@/lib/mock-data";

const CSV_HEADERS = [
  "name", "email", "phone", "address", "source", "status", "score",
  "projectType", "estimatedBudget", "notes", "owner",
] as const;

const VALID_SOURCES: LeadSource[] = ["Website", "Referral", "Angi", "Thumbtack", "Google Ads", "Walk-in", "Social Media"];
const VALID_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];
const VALID_SCORES: LeadScore[] = ["hot", "warm", "cold"];

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function leadsToCSV(leads: Lead[]): string {
  const header = CSV_HEADERS.join(",");
  const rows = leads.map((l) =>
    CSV_HEADERS.map((h) => {
      const val = h === "estimatedBudget" ? String(l[h]) : (l[h as keyof Lead] as string) ?? "";
      return escapeCSV(val);
    }).join(","),
  );
  return [header, ...rows].join("\n");
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSVToLeads(csv: string): { leads: Omit<Lead, "id">[]; errors: string[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { leads: [], errors: ["CSV must have a header row and at least one data row."] };

  const headerLine = parseCSVLine(lines[0]);
  const headerMap = new Map(headerLine.map((h, i) => [h.toLowerCase().trim(), i]));

  const getIdx = (key: string) => headerMap.get(key) ?? -1;
  const nameIdx = getIdx("name");
  if (nameIdx === -1) return { leads: [], errors: ["CSV must have a 'name' column."] };

  const errors: string[] = [];
  const parsed: Omit<Lead, "id">[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    if (!name) { errors.push(`Row ${i + 1}: missing name, skipped.`); continue; }

    const get = (key: string) => {
      const idx = getIdx(key);
      return idx >= 0 ? (cols[idx]?.trim() ?? "") : "";
    };

    const rawSource = get("source");
    const source = (VALID_SOURCES.includes(rawSource as LeadSource) ? rawSource : "Website") as LeadSource;
    const rawStatus = get("status");
    const status = (VALID_STATUSES.includes(rawStatus as LeadStatus) ? rawStatus : "new") as LeadStatus;
    const rawScore = get("score");
    const score = (VALID_SCORES.includes(rawScore as LeadScore) ? rawScore : "warm") as LeadScore;
    const owner = get("owner") || "Unassigned";

    parsed.push({
      name,
      email: get("email"),
      phone: get("phone"),
      address: get("address"),
      source,
      status,
      score,
      projectType: get("projecttype") || get("project type") || get("projectType") || "Kitchen Remodel",
      estimatedBudget: Number(get("estimatedbudget") || get("estimated budget") || get("estimatedBudget") || get("budget")) || 0,
      notes: get("notes"),
      owner,
      ownerInitials: owner.split(" ").map((p) => p[0]).join(""),
      createdAt: now,
      lastActivity: now,
    });
  }

  return { leads: parsed, errors };
}