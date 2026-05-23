// src/routes/contacts.tsx

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, SlidersHorizontal, Mail, Phone, MoreHorizontal, Download, Upload,
  Users, UserPlus, Star, Activity,
} from "lucide-react";
import { mockDeals, mockProjects, pipelineStages, type Contact, type Deal, type Project } from  "@/lib/mock-data";
import { useContacts } from "@/lib/contacts-store";
import { formatDistanceToNow } from "date-fns";
import { Mail as MailIcon, Phone as PhoneIcon, MessageSquare, FileText, CheckCircle2, StickyNote, ArrowRight, AlertTriangle } from "lucide-react";
import { formatMoney, formatDateShort } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  contactsToCSV, downloadCSV, parseCSVPreview, autoMapHeaders, applyMappingToContacts,
  CONTACT_FIELDS, splitTags, detectTagDelimiter, detectTagDelimiterWithConfidence, type ContactColumnMapping, type ContactFieldKey, type ContactTemplateType, type TagDelimiter,
} from "@/lib/contacts-csv";
import { toast } from "sonner";
import React from "react";

const TAG_FILTERS = ["All", "Homeowner", "Lead", "VIP", "Past Client", "Architect"] as const;
type TagFilter = (typeof TAG_FILTERS)[number];

type ContactsSearch = { contactId?: string };

export const Route = createFileRoute("/contacts")({
  validateSearch: (raw: Record<string, unknown>): ContactsSearch => ({
    contactId: typeof raw.contactId === "string" ? raw.contactId : undefined,
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { contactId } = useSearch({ from: "/contacts" });
  const navigate = useNavigate({ from: "/contacts" });
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<TagFilter>("All");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [csvRaw, setCsvRaw] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [colMapping, setColMapping] = useState<ContactColumnMapping | null>(null);
  const [templateType, setTemplateType] = useState<ContactTemplateType>("contact");
  const [tagDelimiter, setTagDelimiter] = useState<TagDelimiter>("auto");

  const storeContacts = useContacts();
  const contacts = storeContacts;
  const isLoading = false;

  // Deep-link: open the matching contact drawer when ?contactId=... is present.
  useEffect(() => {
    if (!contacts) return;
    if (contactId) {
      const found = contacts.find((c) => c.id === contactId);
      if (found && found.id !== selected?.id) setSelected(found);
    } else if (selected) {
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, contacts]);

  const stats = useMemo(() => {
    if (!contacts) return { total: 0, newThisMonth: 0, vip: 0, activeWeek: 0 };
    const now = Date.now();
    const month = 30 * 86_400_000;
    const week = 7 * 86_400_000;
    return {
      total: contacts.length,
      newThisMonth: contacts.filter((c) => now - new Date(c.createdAt).getTime() < month).length,
      vip: contacts.filter((c) => c.tags.some((t) => /vip/i.test(t))).length,
      activeWeek: contacts.filter((c) => now - new Date(c.lastActivity).getTime() < week).length,
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.toLowerCase().trim();
    return contacts.filter((c) => {
      if (tagFilter !== "All" && !c.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
      );
    });
  }, [contacts, search, tagFilter]);

  const handleExport = () => {
    if (!contacts) return;
    const csv = contactsToCSV(contacts);
    downloadCSV(csv, `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${contacts.length} contacts`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, preview, totalRows } = parseCSVPreview(text);
      if (headers.length === 0 || totalRows === 0) {
        toast.error("Empty or invalid CSV file");
        return;
      }
      setCsvRaw(text);
      setCsvHeaders(headers);
      setCsvPreview(preview);
      setCsvTotalRows(totalRows);
      setColMapping(autoMapHeaders(headers, templateType));
      setMapOpen(true);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!colMapping) return;
    const { contacts: parsed, errors } = applyMappingToContacts(csvRaw, colMapping, tagDelimiter);
    if (parsed.length === 0) {
      toast.error("No contacts imported", { description: errors[0] || "Check your column mapping." });
      return;
    }
    toast.success(`Imported ${parsed.length} contact${parsed.length !== 1 ? "s" : ""}`, {
      description: errors.length ? `${errors.length} row(s) skipped.` : undefined,
    });
    setMapOpen(false);
  };

  const importValidation = useMemo(() => {
    if (!colMapping || !csvRaw) return null;
    const { contacts: parsed, errors } = applyMappingToContacts(csvRaw, colMapping, tagDelimiter);
    return { validCount: parsed.length, errors };
  }, [colMapping, csvRaw, tagDelimiter]);

  const downloadErrorReport = () => {
    if (!importValidation) return;
    const lines = [
      "Contact Import Error Report",
      `Generated: ${new Date().toLocaleString()}`,
      `File: ${csvTotalRows} total rows, ${importValidation.validCount} valid, ${importValidation.errors.length} skipped`,
      "",
      "Row,Error",
      ...importValidation.errors.map((err) => {
        const match = err.match(/^Row (\d+): (.+)$/);
        return match ? `${match[1]},"${match[2]}"` : `,"${err}"`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="People and homeowners across all your projects."
        breadcrumb={["CRM", "Contacts"]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
                <input type="file" accept=".csv" className="sr-only" onChange={handleImportFile} />
              </label>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Contact
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total contacts" value={stats.total.toString()} sub="All-time records" icon={Users} tone="primary" />
        <Kpi label="New this month" value={stats.newThisMonth.toString()} sub="Added in last 30 days" icon={UserPlus} tone="success" />
        <Kpi label="VIP" value={stats.vip.toString()} sub="High-priority accounts" icon={Star} tone="warning" />
        <Kpi label="Active this week" value={stats.activeWeek.toString()} sub="Touched in last 7 days" icon={Activity} tone="muted" />
      </div>

      {/* Filters bar */}
      <Card className="mb-3 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {TAG_FILTERS.map((t) => (
              <FilterChip key={t} active={tagFilter === t} onClick={() => setTagFilter(t)}>
                {t}
              </FilterChip>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Columns
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            {!isLoading && contacts && (
              <>Showing <span className="font-medium text-foreground">{filtered.length}</span> of {contacts.length}</>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/60 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-8 py-2.5 pl-4 pr-2 text-left">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                </th>
                <th className="py-2.5 pr-4 text-left">Name</th>
                <th className="py-2.5 pr-4 text-left">Company</th>
                <th className="py-2.5 pr-4 text-left">Email</th>
                <th className="py-2.5 pr-4 text-left">Phone</th>
                <th className="py-2.5 pr-4 text-left">Tags</th>
                <th className="py-2.5 pr-4 text-left">Owner</th>
                <th className="py-2.5 pr-4 text-left">Last activity</th>
                <th className="w-10 py-2.5 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-3 pl-4 pr-2"><Skeleton className="h-3.5 w-3.5" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-48" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 pr-4"><Skeleton className="h-4 w-20" /></td>
                    <td></td>
                  </tr>
                ))}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="mx-auto max-w-xs">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <Search className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-medium">No contacts found</div>
                      <div className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</div>
                      <Button size="sm" className="mt-4">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> New Contact
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate({ search: { contactId: c.id }, replace: true })}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-secondary/40"
                >
                  <td className="py-2.5 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary-soft text-[10px] font-medium text-primary">
                          {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{c.name}</div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{c.company}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{c.email}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">{c.phone}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary" className="h-5 rounded px-1.5 text-[10px] font-medium">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{c.owner}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {formatDistanceToNow(new Date(c.lastActivity), { addSuffix: true })}
                  </td>
                  <td className="py-2.5 pr-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View profile</DropdownMenuItem>
                        <DropdownMenuItem>Send email</DropdownMenuItem>
                        <DropdownMenuItem>Send SMS</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ContactDrawer contact={selected} onOpenChange={(o) => { if (!o) navigate({ search: { contactId: undefined }, replace: true }); }} />

      {/* Column mapping dialog */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Map CSV Columns</DialogTitle>
            <DialogDescription>
              Match your CSV columns to contact fields. {csvTotalRows} row(s) detected.{" "}
              <span className="inline-flex items-center gap-1.5">
                <select
                  className="h-6 rounded border border-input bg-transparent px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  value={templateType}
                  onChange={(e) => {
                    const next = e.target.value as ContactTemplateType;
                    setTemplateType(next);
                    if (csvHeaders.length > 0) {
                      setColMapping(autoMapHeaders(csvHeaders, next));
                    }
                  }}
                >
                  <option value="contact">Contact</option>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                </select>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                  onClick={() => {
                    const templates: Record<string, { headers: string; sample: string; filename: string }> = {
                      contact: {
                        headers: "Name,Email,Phone,Company,Tags,Owner",
                        sample: "Jane Doe,jane@example.com,555-123-4567,Acme Corp,Homeowner; VIP,Alex",
                        filename: "contacts-template.csv",
                      },
                      customer: {
                        headers: "Customer Name,Email,Phone,Account,Tier,Account Manager",
                        sample: "John Smith,john@acme.com,555-987-6543,Acme Corp,VIP,Sarah",
                        filename: "customers-template.csv",
                      },
                      vendor: {
                        headers: "Vendor Name,Email,Phone,Company,Trade,Managed By",
                        sample: "Bob Builder,bob@builds.com,555-222-3333,Builder Co,Plumbing,Mike",
                        filename: "vendors-template.csv",
                      },
                    };
                    const t = templates[templateType] ?? templates.contact;
                    downloadCSV(`${t.headers}\n${t.sample}`, t.filename);
                  }}
                >
                  <Download className="inline h-3 w-3" />
                  Download template
                </button>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Contact Field</th>
                  <th className="px-3 py-2">CSV Column</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Preview</th>
                </tr>
              </thead>
              <tbody>
                {colMapping && CONTACT_FIELDS.map((field) => {
                  const mapped = colMapping[field.key];
                  const previewVals = csvPreview.map((row) => mapped >= 0 ? (row[mapped] ?? "") : "").filter(Boolean).slice(0, 2);
                  const isTagsField = field.key === "tags";
                  const tagDetection = isTagsField && tagDelimiter === "auto" && mapped >= 0
                    ? detectTagDelimiterWithConfidence(
                        csvPreview.map((row) => row[mapped] ?? "").filter(Boolean)
                      )
                    : null;
                  const effectiveDelimiter = tagDetection
                    ? tagDetection.delimiter
                    : (isTagsField && tagDelimiter === "auto" ? detectTagDelimiter(previewVals) : tagDelimiter);
                  return (
                    <tr key={field.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{field.label}</span>
                        {"required" in field && <span className="ml-1 text-destructive">*</span>}
                        {isTagsField && mapped >= 0 && (
                          <div className="mt-1">
                            <select
                              className="h-6 rounded border border-input bg-transparent px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                              value={tagDelimiter}
                              onChange={(e) => setTagDelimiter(e.target.value as TagDelimiter)}
                            >
                              <option value="auto">Auto-detect</option>
                              <option value="both">Split on , and ;</option>
                              <option value="comma">Split on , only</option>
                              <option value="semicolon">Split on ; only</option>
                            </select>
                            {tagDetection && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${tagDetection.confidence === "high" ? "bg-emerald-500" : tagDetection.confidence === "medium" ? "bg-amber-500" : "bg-muted-foreground/50"}`} />
                                <span className="text-muted-foreground">{tagDetection.reason}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={String(mapped)}
                          onValueChange={(v) => setColMapping((prev) => prev ? { ...prev, [field.key]: Number(v) } : prev)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1" className="text-xs text-muted-foreground">— Skip —</SelectItem>
                            {csvHeaders.map((h, i) => (
                              <SelectItem key={i} value={String(i)} className="text-xs">{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {isTagsField && previewVals.length
                            ? previewVals.map((v) => splitTags(v, effectiveDelimiter).map((t) => `[${t}]`).join(" ")).join(", ")
                            : previewVals.length ? previewVals.join(", ") : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {importValidation && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {importValidation.validCount} valid
                </span>
                {importValidation.errors.length > 0 && (
                  <span className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {importValidation.errors.length} will be skipped
                    </span>
                    <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={downloadErrorReport}>
                      <Download className="mr-1 h-3 w-3" /> Download error report
                    </Button>
                  </span>
                )}
              </div>
              {importValidation.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
                  {importValidation.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setMapOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmImport} disabled={!colMapping || colMapping.name < 0 || !importValidation?.validCount}>
              Import {importValidation?.validCount ?? 0} Contact{(importValidation?.validCount ?? 0) !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary/30 bg-primary-soft text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-secondary/60"
      }`}
    >
      {children}
    </button>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    muted: "bg-secondary text-muted-foreground",
  }[tone];
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function ContactDrawer({ contact, onOpenChange }: { contact: Contact | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={!!contact} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {contact && (
          <>
            <SheetHeader className="space-y-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary-soft text-sm font-medium text-primary">
                    {contact.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-left">
                  <SheetTitle className="truncate text-base">{contact.name}</SheetTitle>
                  <SheetDescription className="truncate text-xs">{contact.company} · Owned by {contact.owner}</SheetDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1"><Mail className="mr-1.5 h-3.5 w-3.5" />Email</Button>
                <Button size="sm" variant="outline" className="flex-1"><Phone className="mr-1.5 h-3.5 w-3.5" />Call</Button>
                <Button size="sm" className="flex-1">+ New Deal</Button>
              </div>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="w-full justify-start gap-1 bg-transparent p-0">
                {["overview", "activity", "deals", "projects", "notes", "files"].map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="rounded-md px-3 py-1.5 text-xs capitalize data-[state=active]:bg-secondary data-[state=active]:shadow-none"
                  >
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Email" value={contact.email} />
                  <Field label="Phone" value={contact.phone} />
                  <Field label="Company" value={contact.company} />
                  <Field label="Owner" value={contact.owner} />
                </div>
                <Separator />
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="h-6 rounded text-[11px]">{t}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  Created {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })} · Last activity {formatDistanceToNow(new Date(contact.lastActivity), { addSuffix: true })}.
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <ActivityTab contact={contact} />
              </TabsContent>
              <TabsContent value="deals" className="mt-4">
                <DealsTab contact={contact} />
              </TabsContent>
              <TabsContent value="projects" className="mt-4">
                <ProjectsTab contact={contact} />
              </TabsContent>
              <TabsContent value="notes" className="mt-4 text-sm text-muted-foreground">No notes yet.</TabsContent>
              <TabsContent value="files" className="mt-4 text-sm text-muted-foreground">No files attached.</TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm">{value}</div>
    </div>
  );
}

// ===== Drawer tabs =====

type ActivityKind = "email-out" | "email-in" | "sms-out" | "sms-in" | "call" | "note" | "deal" | "invoice";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  at: string; // iso
  by: string;
};

function buildActivity(contact: Contact): ActivityItem[] {
  // Deterministic per-contact pseudo-random using id hash
  const seed = contact.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const lastMs = new Date(contact.lastActivity).getTime();
  const day = 86_400_000;
  const owner = contact.owner;
  const first = contact.name.split(" ")[0];

  const templates: Omit<ActivityItem, "id" | "at">[] = [
    { kind: "email-out", title: "Sent estimate follow-up", body: `Hi ${first}, just circling back on the proposal we sent over. Happy to walk through any line items.`, by: owner },
    { kind: "sms-in", title: "SMS received", body: "Sounds good — when can you swing by for the site visit?", by: first },
    { kind: "call", title: "Call · 8 min", body: "Discussed scope, timeline, and HOA constraints. Sending revised estimate Thursday.", by: owner },
    { kind: "email-in", title: "Reply received", body: "Thanks for the breakdown. We're aligned on the kitchen scope. Couple questions on the bath…", by: first },
    { kind: "note", title: "Internal note", body: "Client mentioned budget ceiling around $85k. Prefers neutral palette.", by: owner },
    { kind: "sms-out", title: "SMS sent", body: "Crew arriving 8am Tuesday. Lockbox code unchanged.", by: owner },
    { kind: "invoice", title: "Invoice INV-2026-041 sent", body: "Progress draw #2 · $14,200 · Net 15.", by: owner },
    { kind: "deal", title: "Deal moved to Proposal", body: "Stage updated from Site Visit → Proposal.", by: owner },
    { kind: "email-out", title: "Sent welcome packet", body: "Welcome aboard! Attached is your client handbook and project portal login.", by: owner },
  ];

  return templates.map((t, i) => ({
    ...t,
    id: `${contact.id}-act-${i}`,
    at: new Date(lastMs - ((seed + i * 17) % 9) * day - i * day * 2).toISOString(),
  }));
}

function activityIcon(kind: ActivityKind) {
  switch (kind) {
    case "email-out":
    case "email-in":
      return { Icon: MailIcon, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    case "sms-out":
    case "sms-in":
      return { Icon: MessageSquare, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
    case "call":
      return { Icon: PhoneIcon, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "note":
      return { Icon: StickyNote, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    case "invoice":
      return { Icon: FileText, tone: "bg-primary-soft text-primary" };
    case "deal":
      return { Icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  }
}

function ActivityTab({ contact }: { contact: Contact }) {
  const items = useMemo(() => buildActivity(contact), [contact]);
  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const { Icon, tone } = activityIcon(item.kind);
        const isLast = i === items.length - 1;
        return (
          <div key={item.id} className="relative flex gap-3 pb-4">
            {!isLast && <div className="absolute left-[15px] top-8 h-full w-px bg-border" />}
            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background ${tone}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                </div>
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">By {item.by}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function stageLabel(id: string) {
  return pipelineStages.find((s) => s.id === id)?.name ?? id;
}

function stageTone(id: string) {
  switch (id) {
    case "won": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "negotiation": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "proposal": return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "site-visit": return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "qualified": return "bg-primary-soft text-primary";
    default: return "bg-secondary text-muted-foreground";
  }
}

function DealsTab({ contact }: { contact: Contact }) {
  const deals: Deal[] = useMemo(
    () => mockDeals.filter((d) => d.contactId === contact.id),
    [contact],
  );

  if (deals.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/30 p-6 text-center">
        <div className="text-sm font-medium">No deals yet</div>
        <div className="mt-1 text-xs text-muted-foreground">Create a deal to start tracking opportunities with {contact.name.split(" ")[0]}.</div>
        <Button size="sm" className="mt-3"><Plus className="mr-1.5 h-3.5 w-3.5" />New Deal</Button>
      </div>
    );
  }

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{deals.length}</span> deal{deals.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground">{formatMoney(totalValue)}</span> total
        </div>
        <Button size="sm" variant="outline" className="h-7"><Plus className="mr-1 h-3 w-3" />Add</Button>
      </div>
      {deals.map((d) => (
        <div key={d.id} className="group rounded-md border border-border bg-card p-3 transition-colors hover:bg-secondary/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.name}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Owned by {d.owner} · {d.ageDays}d in stage
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">{formatMoney(d.value)}</div>
              <div className="text-[10px] text-muted-foreground">Close {formatDateShort(d.expectedClose)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Badge className={`h-5 rounded px-1.5 text-[10px] font-medium ${stageTone(d.stage)}`} variant="outline">
              {stageLabel(d.stage)}
            </Badge>
            <button className="flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              Open <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function projectStageTone(stage: Project["stage"]) {
  switch (stage) {
    case "in-progress": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "punch-list": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "completed": return "bg-secondary text-muted-foreground";
    case "pre-construction": return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "contracted": return "bg-primary-soft text-primary";
    default: return "bg-secondary text-muted-foreground";
  }
}

function ProjectsTab({ contact }: { contact: Contact }) {
  const first = contact.name.split(" ")[0].toLowerCase();
  // Match by first name token since mock projects use different client names
  const projects: Project[] = useMemo(
    () =>
      mockProjects.filter(
        (p) =>
          p.client.toLowerCase() === contact.name.toLowerCase() ||
          p.client.toLowerCase().startsWith(first + " "),
      ),
    [contact, first],
  );

  // Fallback: show 1-2 deterministic projects based on contact id hash so the tab always feels populated
  const display = projects.length > 0
    ? projects
    : (() => {
        const seed = contact.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const a = mockProjects[seed % mockProjects.length];
        const b = mockProjects[(seed * 7 + 3) % mockProjects.length];
        return a && b && a.id !== b.id ? [a, b] : [a].filter(Boolean);
      })();

  if (display.length === 0) {
    return <div className="text-sm text-muted-foreground">No active projects.</div>;
  }

  return (
    <div className="space-y-3">
      {display.map((p) => (
        <div key={p.id} className="rounded-md border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {p.projectNumber} · {p.type} · {p.address.split(",").slice(-1)[0]?.trim()}
              </div>
            </div>
            <Badge className={`h-5 rounded px-1.5 text-[10px] font-medium capitalize ${projectStageTone(p.stage)}`} variant="outline">
              {p.stage.replace("-", " ")}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">Budget</div>
              <div className="mt-0.5 font-medium tabular-nums">{formatMoney(p.budget)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Paid</div>
              <div className="mt-0.5 font-medium tabular-nums">{formatMoney(p.paid)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Progress</div>
              <div className="mt-0.5 font-medium tabular-nums">{p.progress}%</div>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
