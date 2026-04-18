import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Filter, SlidersHorizontal, Mail, Phone, MoreHorizontal, Download, Tag,
} from "lucide-react";
import { mockContacts, type Contact } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 250));
      return mockContacts;
    },
  });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="People and homeowners across all your projects."
        breadcrumb={["CRM", "Contacts"]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Contact
            </Button>
          </>
        }
      />

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
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="mr-1.5 h-3.5 w-3.5" /> Filters
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Tag className="mr-1.5 h-3.5 w-3.5" /> Tags
          </Button>
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
                      <div className="mt-1 text-xs text-muted-foreground">Try adjusting your search or add a new contact.</div>
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
                  onClick={() => setSelected(c)}
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

      <ContactDrawer contact={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
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

              <TabsContent value="activity" className="mt-4 text-sm text-muted-foreground">
                Activity timeline coming next.
              </TabsContent>
              <TabsContent value="deals" className="mt-4 text-sm text-muted-foreground">No open deals.</TabsContent>
              <TabsContent value="projects" className="mt-4 text-sm text-muted-foreground">No active projects.</TabsContent>
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
