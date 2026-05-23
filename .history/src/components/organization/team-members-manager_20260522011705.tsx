// src/components/organization/team-members-manager.tsx
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inviteMember, removeMemberFromOrg } from "@/lib/team";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  ALL_ROLES, ROLE_LABELS, memberInitials,
  type Role, type TeamMember, type WorkerType,
} from "@/lib/organization";

export type TeamMembersManagerProps = {
  members: TeamMember[];
  onAdd: (member: Omit<TeamMember, "id">) => void;
  onUpdate: (id: string, patch: Partial<TeamMember>) => void;
  onRemove: (id: string) => void;
  inviteMode?: boolean;
  title?: string;
  subtitle?: string;
};

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// ── Email compose modal ───────────────────────────────────────────────────────

function EmailModal({ to, onClose }: { to: string; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("Subject and message are required"); return; }
    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); setSending(false); return; }

    const res = await fetch("/.netlify/functions/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ to, subject: subject.trim(), body: body.trim() }),
    });

    setSending(false);
    if (res.ok) { toast.success(`Email sent to ${to}`); onClose(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed to send"); }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Send email to {to}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Subject</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject…" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Message</Label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" rows={6} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSend} disabled={sending}>
          {sending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</> : "Send"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamMembersManager({
  members, onAdd, onUpdate, onRemove, inviteMode,
  title = "Team & Roles", subtitle,
}: TeamMembersManagerProps) {
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<string | null>(null);
  const confirmMember = members.find(m => m.id === confirmId);

  const handleConfirmRemove = async () => {
    if (!confirmId) return;
    const m = confirmMember;
    setConfirmId(null);
    onRemove(confirmId);
    const result = await removeMemberFromOrg(
      m?.status === "invited" ? { invitationId: confirmId } : { memberId: confirmId }
    );
    if (!result.success) toast.error(result.error);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle ?? `${members.length} member${members.length === 1 ? "" : "s"} in this workspace`}
          </p>
        </div>
        <MemberDialog mode="add" inviteDefault={!!inviteMode} onSave={onAdd}
          trigger={
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {inviteMode ? "Invite member" : "Add member"}
            </Button>
          }
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Member</th>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Phone</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="w-24 px-4" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                {/* Member */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-primary-soft text-[10px] font-medium text-primary">
                        {memberInitials(m.name && m.name !== m.email ? m.name : m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {m.name && m.name !== m.email ? m.name : "—"}
                    </span>
                  </div>
                </td>

                {/* Email — clickable to open compose modal */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEmailTarget(m.email)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="max-w-[180px] truncate">{m.email}</span>
                  </button>
                </td>

                {/* Phone — clickable to call */}
                <td className="px-4 py-3">
                  {m.phone ? (
                    <a
                      href={`tel:${m.phone}`}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {m.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">
                    {ROLE_LABELS[m.role]}
                  </Badge>
                </td>

                {/* Type */}
                <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                  {m.workerType === "subcontractor" ? "Sub-contractor" : "Employee"}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Badge variant="secondary"
                    className={"h-5 rounded px-1.5 text-[10px] " +
                      (m.status === "invited" ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
                    {m.status === "invited" ? "Invited" : "Active"}
                  </Badge>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <MemberDialog mode="edit" initial={m}
                      onSave={(patch) => onUpdate(m.id, patch)}
                      trigger={
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmId(m.id)}
                      disabled={m.role === "owner"}
                      title={m.role === "owner" ? "Owner cannot be removed" : "Remove member"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Email compose modal */}
      <Dialog open={!!emailTarget} onOpenChange={o => !o && setEmailTarget(null)}>
        {emailTarget && <EmailModal to={emailTarget} onClose={() => setEmailTarget(null)} />}
      </Dialog>

      {/* Confirm remove dialog */}
      <AlertDialog open={!!confirmId} onOpenChange={o => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMember
                ? `This will remove ${confirmMember.name && confirmMember.name !== confirmMember.email ? confirmMember.name : confirmMember.email} from the workspace and delete their account. This cannot be undone.`
                : "This will remove the member from the workspace. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmRemove}>
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── MemberDialog ──────────────────────────────────────────────────────────────

function MemberDialog({
  mode, initial, inviteDefault, onSave, trigger,
}: {
  mode: "add" | "edit";
  initial?: TeamMember;
  inviteDefault?: boolean;
  onSave: (m: Omit<TeamMember, "id">) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen]             = useState(false);
  const [name, setName]             = useState(initial?.name && initial.name !== initial.email ? initial.name : "");
  const [email, setEmail]           = useState(initial?.email ?? "");
  const [phone, setPhone]           = useState(initial?.phone ?? "");
  const [role, setRole]             = useState<Role>(initial?.role ?? "viewer");
  const [workerType, setWorkerType] = useState<WorkerType>(initial?.workerType ?? "employee");
  const [sendNow, setSendNow]       = useState(true);
  const [sending, setSending]       = useState(false);

  function reset() {
    setName(initial?.name && initial.name !== initial.email ? initial.name : "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setRole(initial?.role ?? "viewer");
    setWorkerType(initial?.workerType ?? "employee");
    setSendNow(true);
    setSending(false);
  }

  async function handleSubmit() {
    if (!email.trim()) return;
    const shouldInvite = mode === "add" && (inviteDefault || sendNow);
    const status: TeamMember["status"] = shouldInvite ? "invited" : initial?.status ?? "active";

    onSave({
      name: name.trim(), email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined, role, workerType, status,
      invitedAt: status === "invited" ? new Date().toISOString() : initial?.invitedAt,
    });

    setOpen(false);
    if (mode === "add") reset();

    if (shouldInvite) {
      setSending(true);
      const result = await inviteMember({
        email: email.trim().toLowerCase(), role,
        name: name.trim() || undefined, phone: phone.trim() || undefined,
      });
      setSending(false);
      if (result.success) toast.success(`Invitation sent to ${email.trim()}`);
      else toast.error(`Member added but email failed: ${result.error}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? (inviteDefault ? "Invite member" : "Add member") : "Edit member"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input className="h-9" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="h-9" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input className="h-9" value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="555-123-4567" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={v => setRole(v as Role)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Employment type</Label>
              <Select value={workerType} onValueChange={v => setWorkerType(v as WorkerType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="subcontractor">Sub-contractor (1099)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "add" && !inviteDefault && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} className="h-3.5 w-3.5" />
              Send invitation email now
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!email.trim() || sending}>
            {sending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</> : mode === "add" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}