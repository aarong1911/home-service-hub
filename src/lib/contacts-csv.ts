import type { Contact } from "@/lib/mock-data";

const CSV_HEADERS = [
  "name", "email", "phone", "company", "tags", "owner",
] as const;

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function contactsToCSV(contacts: Contact[]): string {
  const header = CSV_HEADERS.join(",");
  const rows = contacts.map((c) =>
    CSV_HEADERS.map((h) => {
      const val = h === "tags" ? c.tags.join("; ") : (c[h as keyof Contact] as string) ?? "";
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

export const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "tags", label: "Tags" },
  { key: "owner", label: "Owner" },
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];
export type ContactColumnMapping = Record<ContactFieldKey, number>;

export type ContactTemplateType = "contact" | "customer" | "vendor";

const TEMPLATE_ALIASES: Record<ContactTemplateType, Record<ContactFieldKey, string[]>> = {
  contact: {
    name: ["name", "full name", "contact name", "client"],
    email: ["email", "e-mail", "email address"],
    phone: ["phone", "telephone", "phone number", "tel", "mobile"],
    company: ["company", "organization", "org", "business", "firm"],
    tags: ["tags", "tag", "labels", "categories", "type"],
    owner: ["owner", "assigned to", "assignee", "rep"],
  },
  customer: {
    name: ["name", "full name", "customer name", "client name"],
    email: ["email", "e-mail", "email address"],
    phone: ["phone", "telephone", "phone number", "tel", "mobile"],
    company: ["company", "account", "organization", "business"],
    tags: ["tags", "tier", "segment", "type", "labels"],
    owner: ["owner", "account manager", "rep", "assigned to"],
  },
  vendor: {
    name: ["name", "vendor name", "supplier", "contact name"],
    email: ["email", "e-mail", "email address"],
    phone: ["phone", "telephone", "phone number", "tel", "mobile"],
    company: ["company", "vendor", "supplier", "business", "firm"],
    tags: ["tags", "trade", "specialty", "category", "type"],
    owner: ["owner", "managed by", "rep", "assigned to"],
  },
};

export function parseCSVPreview(csv: string): { headers: string[]; preview: string[][]; totalRows: number } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], preview: [], totalRows: 0 };
  const headers = parseCSVLine(lines[0]);
  const dataLines = lines.slice(1);
  const preview = dataLines.slice(0, 3).map(parseCSVLine);
  return { headers, preview, totalRows: dataLines.length };
}

export function autoMapHeaders(csvHeaders: string[], templateType: ContactTemplateType = "contact"): ContactColumnMapping {
  const mapping: ContactColumnMapping = {
    name: -1, email: -1, phone: -1, company: -1, tags: -1, owner: -1,
  };
  const aliases = TEMPLATE_ALIASES[templateType];
  const lower = csvHeaders.map((h) => h.toLowerCase().trim());
  for (const field of CONTACT_FIELDS) {
    const fieldAliases = aliases[field.key];
    const idx = lower.findIndex((h) => fieldAliases.includes(h));
    if (idx >= 0) mapping[field.key] = idx;
  }
  return mapping;
}

export type TagDelimiter = "auto" | "comma" | "semicolon" | "both";

/** Analyze tag column values and pick the best delimiter. */
export function detectTagDelimiter(values: string[]): Exclude<TagDelimiter, "auto"> {
  let commas = 0;
  let semicolons = 0;
  for (const v of values) {
    if (v.includes(",")) commas++;
    if (v.includes(";")) semicolons++;
  }
  if (commas > 0 && semicolons === 0) return "comma";
  if (semicolons > 0 && commas === 0) return "semicolon";
  if (semicolons > 0 && commas > 0) return "both";
  return "comma"; // default when no delimiters found
}

export function splitTags(raw: string, delimiter: TagDelimiter): string[] {
  if (!raw) return [];
  const effective = delimiter === "auto" ? "both" : delimiter;
  const pattern = effective === "comma" ? /,/ : effective === "semicolon" ? /;/ : /[;,]/;
  return raw.split(pattern).map((t) => t.trim()).filter(Boolean);
}

export function applyMappingToContacts(csv: string, mapping: ContactColumnMapping, tagDelimiter: TagDelimiter = "both"): { contacts: Omit<Contact, "id">[]; errors: string[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { contacts: [], errors: ["CSV must have a header row and at least one data row."] };
  if (mapping.name < 0) return { contacts: [], errors: ["You must map the Name field."] };

  const errors: string[] = [];
  const parsed: Omit<Contact, "id">[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const get = (key: ContactFieldKey) => {
      const idx = mapping[key];
      return idx >= 0 ? (cols[idx]?.trim() ?? "") : "";
    };

    const name = get("name");
    if (!name) { errors.push(`Row ${i + 1}: missing name, skipped.`); continue; }

    const rawTags = get("tags");
    const tags = splitTags(rawTags, tagDelimiter);
    const owner = get("owner") || "Unassigned";

    parsed.push({
      name,
      email: get("email"),
      phone: get("phone"),
      company: get("company"),
      tags,
      owner,
      createdAt: now,
      lastActivity: now,
    });
  }

  return { contacts: parsed, errors };
}