import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  MessageSquare,
  Phone,
  Inbox as InboxIcon,
  Send,
  Sparkles,
  Paperclip,
  Search,
  Star,
  AtSign,
  CheckCheck,
  Filter,
  ChevronDown,
  MoreHorizontal,
  StickyNote,
  Smile,
  Hash,
  Video,
  Tag,
  Clock,
  ExternalLink,
  Phone as PhoneIcon,
  PhoneCall,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Pin,
  Archive,
} from "lucide-react";
import {
  mockConversations,
  mockMessages,
  mockContacts,
  mockProjects,
  type Conversation,
  type Message,
} from "@/lib/mock-data";
import {
  messageTemplates,
  resolveMergeTags,
  type MergeContext,
  type SharedMessageTemplate,
} from "@/lib/message-templates";
import { recordTemplateUse } from "@/lib/recent-templates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TemplatePicker } from "@/components/inbox/template-picker";
import { FileText } from "lucide-react";
import { toast } from "sonner";

type InboxSearch = { templateId?: string };

export const Route = createFileRoute("/inbox")({
  validateSearch: (raw: Record<string, unknown>): InboxSearch => ({
    templateId: typeof raw.templateId === "string" && raw.templateId ? raw.templateId : undefined,
  }),
  component: InboxLayout,
});

function InboxLayout() {
  const { pathname } = useLocation();
  // When a child route is active (e.g. /inbox/broadcasts), render it instead
  // of the Conversations UI. /inbox itself still shows InboxPage.
  if (pathname !== "/inbox" && pathname !== "/inbox/") {
    return <Outlet />;
  }
  return <InboxPage />;
}

type FolderId = "all" | "unread" | "assigned" | "mentions" | "starred" | "unassigned" | "archived";
type ChannelFilter = "all" | "email" | "sms" | "voice";
type ComposeChannel = "email" | "sms" | "note";

const folders: { id: FolderId; label: string; icon: typeof InboxIcon }[] = [
  { id: "all", label: "All", icon: InboxIcon },
  { id: "unread", label: "Unread", icon: Circle },
  { id: "assigned", label: "Assigned to me", icon: CheckCheck },
  { id: "mentions", label: "Mentions", icon: AtSign },
  { id: "starred", label: "Starred", icon: Star },
  { id: "unassigned", label: "Unassigned", icon: Filter },
  { id: "archived", label: "Archived", icon: Archive },
];

const channelTabs: { id: ChannelFilter; label: string; icon: typeof Mail }[] = [
  { id: "all", label: "All", icon: InboxIcon },
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "voice", label: "Voice", icon: Phone },
];

const NOW = Date.UTC(2026, 3, 18);

function InboxPage() {
  const { templateId } = Route.useSearch();
  const navigate = useNavigate({ from: "/inbox" });
  const [folder, setFolder] = useState<FolderId>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [activeId, setActiveId] = useState<string | undefined>(mockConversations[0]?.id);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [composeChannel, setComposeChannel] = useState<ComposeChannel>("sms");
  const [search, setSearch] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [tplSearch, setTplSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const conversations = useMemo(() => {
    return mockConversations.filter((c) => {
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      if (folder === "unread" && !c.unread) return false;
      if (folder === "starred" && !isStarred(c.id)) return false;
      if (folder === "unassigned" && !isUnassigned(c.id)) return false;
      if (folder === "assigned" && !isAssignedToMe(c.id)) return false;
      if (folder === "mentions" && !hasMention(c.id)) return false;
      if (folder === "archived" && !isArchived(c.id)) return false;
      if (folder !== "archived" && isArchived(c.id)) return false;
      if (search && !c.contactName.toLowerCase().includes(search.toLowerCase()) && !c.preview.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [folder, channelFilter, search]);

  const folderCounts = useMemo(() => {
    const list = mockConversations;
    return {
      all: list.filter((c) => !isArchived(c.id)).length,
      unread: list.filter((c) => c.unread && !isArchived(c.id)).length,
      assigned: list.filter((c) => isAssignedToMe(c.id) && !isArchived(c.id)).length,
      mentions: list.filter((c) => hasMention(c.id) && !isArchived(c.id)).length,
      starred: list.filter((c) => isStarred(c.id) && !isArchived(c.id)).length,
      unassigned: list.filter((c) => isUnassigned(c.id) && !isArchived(c.id)).length,
      archived: list.filter((c) => isArchived(c.id)).length,
    } as Record<FolderId, number>;
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const thread = active ? mockMessages.filter((m) => m.conversationId === active.id) : [];
  const contact = active ? mockContacts.find((c) => c.id === active.contactId) : undefined;
  const contactProjects = contact ? mockProjects.filter((p) => p.client === contact.name) : [];

  const mergeCtx: MergeContext = useMemo(() => {
    const firstProject = contactProjects[0];
    const [first_name = "", ...rest] = (contact?.name ?? "").split(" ");
    const last_name = rest.join(" ");
    const total = firstProject?.contractValue ?? 0;
    const fmtMoney = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    return {
      first_name,
      last_name,
      project_address: firstProject?.address ?? "your project address",
      project_type: firstProject?.type ?? "renovation",
      owner_name: "Alex Rivera",
      company_name: "Rivera Construction",
      estimate_total: total ? fmtMoney(total) : "$—",
      deposit_amount: total ? fmtMoney(Math.round(total * 0.5)) : "$—",
      deposit_due: "Friday",
      start_date: firstProject?.startDate
        ? new Date(firstProject.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "next Monday",
    };
  }, [contact, contactProjects]);

  const visibleTemplates = useMemo(() => {
    const channelMatch = (t: SharedMessageTemplate) =>
      composeChannel === "note" ? true : t.channel === composeChannel;
    const q = tplSearch.trim().toLowerCase();
    return messageTemplates.filter((t) => {
      if (!channelMatch(t)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    });
  }, [composeChannel, tplSearch]);

  const applyTemplate = (t: SharedMessageTemplate) => {
    setDraft(resolveMergeTags(t.body, mergeCtx));
    if (t.channel === "email" && t.subject) {
      setSubject(resolveMergeTags(t.subject, mergeCtx));
      if (composeChannel !== "email") setComposeChannel("email");
    } else if (t.channel === "sms" && composeChannel !== "sms") {
      setComposeChannel("sms");
    }
    setTplOpen(false);
    setTplSearch("");
    recordTemplateUse(t.id);
    toast.success(`Inserted "${t.name}"`);
  };

  // Deep-link from /inbox/templates: ?templateId=… inserts and clears the param.
  useEffect(() => {
    if (!templateId) return;
    const tpl = messageTemplates.find((t) => t.id === templateId);
    if (tpl) applyTemplate(tpl);
    navigate({ search: { templateId: undefined }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <PageHeader
        title="Inbox"
        subtitle="Unified email, SMS, voice, and internal notes across every contact"
        breadcrumb={["Workspace", "Inbox"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Filters
            </Button>
            <Button size="sm" className="h-8">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> New Message
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[210px_340px_1fr_300px] overflow-hidden border-t border-border">
        {/* PANE 1 — Folders */}
        <aside className="flex min-h-0 flex-col border-r border-border bg-secondary/30">
          <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Folders
          </div>
          <nav className="flex flex-col gap-0.5 px-2">
            {folders.map((f) => {
              const Icon = f.icon;
              const isActive = folder === f.id;
              const count = folderCounts[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setFolder(f.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive ? "bg-primary-soft text-primary" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {f.label}
                  </span>
                  {count > 0 && (
                    <span className={`text-[10px] tabular-nums ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {[
              { label: "VIP", count: 4 },
              { label: "New Lead", count: 7 },
              { label: "Hot", count: 3 },
              { label: "Punch List", count: 2 },
            ].map((t, i) => (
              <button
                key={t.label}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary"
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${["bg-amber-400","bg-emerald-400","bg-rose-400","bg-sky-400"][i]}`} />
                  {t.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto border-t border-border p-3">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold">
                <Sparkles className="h-3 w-3 text-primary" /> AI Assistant
              </div>
              <p className="text-[11px] text-muted-foreground">
                Drafting & summarizing replies. {folderCounts.unread} unread to triage.
              </p>
            </div>
          </div>
        </aside>

        {/* PANE 2 — Conversation list */}
        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center gap-1 border-b border-border bg-card px-2 py-1.5">
            {channelTabs.map((t) => {
              const Icon = t.icon;
              const isActive = channelFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setChannelFilter(t.id)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{conversations.length} conversations</span>
            <button className="flex items-center gap-1 hover:text-foreground">
              Newest <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conv={c}
                active={c.id === active?.id}
                onClick={() => setActiveId(c.id)}
              />
            ))}
            {conversations.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">No conversations match these filters</div>
            )}
          </div>
        </section>

        {/* PANE 3 — Thread */}
        <section className="flex min-h-0 flex-col bg-secondary/10">
          {active && contact ? (
            <>
              <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
                      {initials(active.contactName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {active.contactName}
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase">
                        {contact.tags?.[0] ?? "Customer"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {contact.email}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {contact.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" title="Call">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2" title="Video">
                    <Video className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2" title="Star">
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2" title="Pin">
                    <Pin className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2" title="More">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {groupByDay(thread).map((group) => (
                  <div key={group.day}>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {group.day}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="space-y-3">
                      {group.messages.map((m) => (
                        <MessageBubble key={m.id} msg={m} />
                      ))}
                    </div>
                  </div>
                ))}
                {thread.length === 0 && (
                  <div className="py-12 text-center text-xs text-muted-foreground">No messages yet</div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1">
                  <div className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                    <ComposeTab id="sms" current={composeChannel} onSelect={setComposeChannel} icon={MessageSquare} label="SMS" />
                    <ComposeTab id="email" current={composeChannel} onSelect={setComposeChannel} icon={Mail} label="Email" />
                    <ComposeTab id="note" current={composeChannel} onSelect={setComposeChannel} icon={StickyNote} label="Note" />
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <Popover open={tplOpen} onOpenChange={setTplOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px]">
                          <FileText className="mr-1 h-3 w-3" /> Templates
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-0">
                        <div className="border-b border-border p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              autoFocus
                              value={tplSearch}
                              onChange={(e) => setTplSearch(e.target.value)}
                              placeholder={`Search ${composeChannel === "email" ? "email" : composeChannel === "sms" ? "SMS" : ""} templates…`}
                              className="h-8 pl-7 text-xs"
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Merging for {contact?.name ?? "—"}</span>
                            <Link to="/settings/templates" className="hover:text-primary">Manage</Link>
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-1">
                          {visibleTemplates.length === 0 ? (
                            <div className="p-6 text-center text-[11px] text-muted-foreground">
                              No templates match
                            </div>
                          ) : (
                            visibleTemplates.map((t) => {
                              const previewSrc = t.channel === "email" && t.subject ? t.subject : t.body;
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => applyTemplate(t)}
                                  className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-secondary"
                                >
                                  <div className="flex items-center gap-1.5">
                                    {t.channel === "email" ? (
                                      <Mail className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span className="truncate text-[12px] font-medium">{t.name}</span>
                                    {t.starred && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                                    <Badge variant="outline" className="ml-auto h-4 px-1 text-[9px]">{t.category}</Badge>
                                  </div>
                                  <div className="line-clamp-1 text-[10px] text-muted-foreground">
                                    {resolveMergeTags(previewSrc, mergeCtx)}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] text-primary hover:text-primary">
                      <Sparkles className="mr-1 h-3 w-3" /> AI Draft
                    </Button>
                    <span className="mx-1 h-4 w-px bg-border" />
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Hash className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Smile className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Paperclip className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {composeChannel === "email" && (
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="mb-2 h-8 text-xs"
                  />
                )}
                <div
                  className={`rounded-md border ${
                    composeChannel === "note"
                      ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                      : "border-border bg-background"
                  }`}
                >
                  <Textarea
                    placeholder={
                      composeChannel === "email"
                        ? "Write an email…"
                        : composeChannel === "sms"
                          ? "Send a text message…"
                          : "Add an internal note (visible to your team only)…"
                    }
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[72px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">
                    {composeChannel === "sms" && `${draft.length}/160 chars · 1 segment`}
                    {composeChannel === "email" && "Will reply from sales@yourco.com"}
                    {composeChannel === "note" && "Internal · @mention to notify"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <Clock className="mr-1 h-3 w-3" /> Schedule
                    </Button>
                    <Button size="sm" className="h-8">
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          )}
        </section>

        {/* PANE 4 — Contact context */}
        <aside className="flex min-h-0 flex-col border-l border-border bg-card">
          {active && contact ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-border p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
                      {initials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{contact.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{contact.email}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{contact.phone}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[11px]"><Mail className="mr-1 h-3 w-3" /> Email</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px]"><MessageSquare className="mr-1 h-3 w-3" /> SMS</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px]"><PhoneIcon className="mr-1 h-3 w-3" /> Call</Button>
                </div>
              </div>

              <ContextSection title="Assignment">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-emerald-100 text-[9px] font-semibold text-emerald-700">AR</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">Alex Rivera</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]">Reassign</Button>
                </div>
              </ContextSection>

              <ContextSection title="Tags">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">VIP</Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Kitchen</Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Repeat</Badge>
                  <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-muted-foreground">
                    <Tag className="mr-0.5 h-2.5 w-2.5" /> Add
                  </Button>
                </div>
              </ContextSection>

              <ContextSection title={`Active Projects (${contactProjects.length})`}>
                {contactProjects.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No active projects</div>
                ) : (
                  <div className="space-y-1.5">
                    {contactProjects.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        to="/projects/$clientSlug"
                        params={{ clientSlug: p.slug }}
                        className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 hover:border-primary/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-medium">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground capitalize">{p.stage.replace("-", " ")}</div>
                        </div>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </ContextSection>

              <ContextSection title="Lifetime Value">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums">${contactProjects.reduce((s, p) => s + (p.contractValue || 0), 0).toLocaleString()}</span>
                  <span className="text-[10px] text-emerald-600">+12% YoY</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{contactProjects.length} projects · 3 invoices</div>
              </ContextSection>

              <ContextSection title="Recent Activity">
                <ul className="space-y-2 text-[11px]">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    <div>
                      <div className="font-medium">Invoice INV-7842 paid</div>
                      <div className="text-muted-foreground">2d ago · $12,400</div>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <Mail className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Estimate EST-4218 sent</div>
                      <div className="text-muted-foreground">5d ago</div>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <PhoneCall className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Outbound call · 8m 12s</div>
                      <div className="text-muted-foreground">1w ago</div>
                    </div>
                  </li>
                </ul>
              </ContextSection>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
              Contact details appear here
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ComposeTab({
  id,
  current,
  onSelect,
  icon: Icon,
  label,
}: {
  id: ComposeChannel;
  current: ComposeChannel;
  onSelect: (id: ComposeChannel) => void;
  icon: typeof Mail;
  label: string;
}) {
  const isActive = current === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors ${
        isActive
          ? id === "note"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            : "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function ContextSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border p-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function ConversationRow({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
        active ? "bg-primary-soft/50" : "hover:bg-secondary/40"
      }`}
    >
      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-secondary text-[11px] font-semibold">{initials(conv.contactName)}</AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-card">
          <ChannelGlyph channel={conv.channel} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-[13px] ${conv.unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
            {conv.contactName}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{relativeShort(conv.lastAt)}</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{conv.preview}</div>
        <div className="mt-1.5 flex items-center gap-1">
          {isStarred(conv.id) && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
          {hasMention(conv.id) && (
            <Badge variant="outline" className="h-4 border-violet-300 bg-violet-50 px-1 text-[9px] text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300">
              @mention
            </Badge>
          )}
          {isUnassigned(conv.id) && (
            <Badge variant="outline" className="h-4 border-amber-300 bg-amber-50 px-1 text-[9px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              unassigned
            </Badge>
          )}
        </div>
      </div>
      {conv.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === "out";
  if (msg.channel === "voice") {
    return (
      <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
        <div className={`flex max-w-[70%] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 ${isOut ? "" : ""}`}>
          {isOut ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownLeft className="h-4 w-4 text-sky-500" />}
          <div className="flex-1">
            <div className="text-xs font-medium">{isOut ? "Outbound call" : "Inbound call"} · 4m 12s</div>
            <div className="text-[10px] text-muted-foreground">Recording available · {fmtTime(msg.at)}</div>
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">Play</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[72%] flex-col gap-1 ${isOut ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isOut
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm border border-border bg-card text-foreground"
          }`}
        >
          {msg.body}
        </div>
        <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <ChannelGlyph channel={msg.channel} />
          <span>{fmtTime(msg.at)}</span>
          {isOut && (
            <>
              <span>·</span>
              <CheckCheck className="h-3 w-3 text-primary/70" />
              <span>Delivered</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelGlyph({ channel }: { channel: "email" | "sms" | "voice" }) {
  if (channel === "email") return <Mail className="h-3 w-3 text-muted-foreground" />;
  if (channel === "sms") return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
  return <Phone className="h-3 w-3 text-muted-foreground" />;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function relativeShort(iso: string) {
  const days = Math.round((NOW - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "now";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso));
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const days = Math.round((NOW - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(d);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

function groupByDay(messages: Message[]) {
  const map = new Map<string, Message[]>();
  for (const m of messages) {
    const key = fmtDay(m.at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([day, messages]) => ({ day, messages }));
}

// Deterministic mock helpers (no random per render → no hydration drift)
function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
function isStarred(id: string) { return hash(id) % 5 === 0; }
function hasMention(id: string) { return hash(id) % 6 === 0; }
function isUnassigned(id: string) { return hash(id) % 4 === 0; }
function isAssignedToMe(id: string) { return hash(id) % 3 === 0; }
function isArchived(id: string) { return hash(id) % 11 === 0; }
