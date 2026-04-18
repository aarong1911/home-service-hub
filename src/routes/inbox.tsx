import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, MessageSquare, Phone, Inbox as InboxIcon, Send, Sparkles, Paperclip, Search } from "lucide-react";
import { mockConversations, mockMessages, type Conversation } from "@/lib/mock-data";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

const folders = [
  { id: "all", label: "All", icon: InboxIcon, count: mockConversations.length },
  { id: "email", label: "Email", icon: Mail, count: mockConversations.filter((c) => c.channel === "email").length },
  { id: "sms", label: "SMS", icon: MessageSquare, count: mockConversations.filter((c) => c.channel === "sms").length },
  { id: "voice", label: "Voice", icon: Phone, count: mockConversations.filter((c) => c.channel === "voice").length },
];

function InboxPage() {
  const [folder, setFolder] = useState("all");
  const [activeId, setActiveId] = useState(mockConversations[0]?.id);
  const [draft, setDraft] = useState("");
  const [composeChannel, setComposeChannel] = useState<"email" | "sms">("email");

  const conversations = mockConversations.filter((c) => folder === "all" || c.channel === folder);
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const thread = active ? mockMessages.filter((m) => m.conversationId === active.id) : [];

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Unified email, SMS, and voice across every contact"
        breadcrumb={["Inbox"]}
      />

      <Card className="overflow-hidden p-0">
        <div className="grid h-[calc(100vh-13.5rem)] grid-cols-[200px_320px_1fr]">
          {/* Folders */}
          <div className="border-r border-border bg-secondary/30 p-2">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Channels
            </div>
            {folders.map((f) => {
              const Icon = f.icon;
              const active = folder === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFolder(f.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {f.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{f.count}</span>
                </button>
              );
            })}
          </div>

          {/* Conversation list */}
          <div className="flex flex-col border-r border-border">
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search conversations…" className="h-8 pl-7 text-xs" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  active={c.id === active?.id}
                  onClick={() => setActiveId(c.id)}
                />
              ))}
              {conversations.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">No conversations</div>
              )}
            </div>
          </div>

          {/* Thread */}
          <div className="flex flex-col">
            {active ? (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
                        {initials(active.contactName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold">{active.contactName}</div>
                      <div className="text-xs text-muted-foreground">Customer · 3 deals · 2 projects</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Mail className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2"><MessageSquare className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Phone className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin bg-secondary/20 p-4">
                  {thread.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] ${m.direction === "out" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <ChannelIcon channel={m.channel} />
                          <span className="uppercase tracking-wider">{m.channel}</span>
                          <span>·</span>
                          <span>{new Date(m.at).toLocaleDateString()}</span>
                        </div>
                        <div
                          className={`rounded-lg px-3 py-2 text-sm ${
                            m.direction === "out"
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-card"
                          }`}
                        >
                          {m.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border p-3">
                  <div className="mb-2 flex items-center gap-1">
                    <div className="flex h-7 items-center rounded-md border border-border bg-card p-0.5">
                      <Button
                        size="sm"
                        variant={composeChannel === "email" ? "secondary" : "ghost"}
                        onClick={() => setComposeChannel("email")}
                        className="h-6 px-2 text-xs"
                      >
                        <Mail className="mr-1 h-3 w-3" /> Email
                      </Button>
                      <Button
                        size="sm"
                        variant={composeChannel === "sms" ? "secondary" : "ghost"}
                        onClick={() => setComposeChannel("sms")}
                        className="h-6 px-2 text-xs"
                      >
                        <MessageSquare className="mr-1 h-3 w-3" /> SMS
                      </Button>
                    </div>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Sparkles className="mr-1 h-3 w-3" /> Draft with AI
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2"><Paperclip className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder={composeChannel === "email" ? "Write an email…" : "Send a text message…"}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[80px] resize-none text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" className="h-8">
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

function ConversationRow({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
        active ? "bg-primary-soft/60" : "hover:bg-secondary/40"
      }`}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-secondary text-[10px] font-medium">{initials(conv.contactName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${conv.unread ? "font-semibold" : "font-medium"}`}>{conv.contactName}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{relativeShort(conv.lastAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChannelIcon channel={conv.channel} />
          <span className="truncate text-xs text-muted-foreground">{conv.preview}</span>
        </div>
      </div>
      {conv.unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}

function ChannelIcon({ channel }: { channel: "email" | "sms" | "voice" }) {
  if (channel === "email") return <Mail className="h-3 w-3 text-muted-foreground" />;
  if (channel === "sms") return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
  return <Phone className="h-3 w-3 text-muted-foreground" />;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function relativeShort(iso: string) {
  const days = Math.round((Date.UTC(2026, 3, 18) - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}
