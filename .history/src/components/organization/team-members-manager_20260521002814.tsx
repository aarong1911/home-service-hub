// Reusable team member manager. Used by /settings/team and the onboarding
// invites step. Adds, edits, removes members; supports invite + active states.
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMember, removeMemberFromOrg } from "@/lib/team";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_ROLES,
  ROLE_LABELS,
  memberInitials,
  type Role,
  type TeamMember,
  type WorkerType,
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

export function TeamMembersManager({
  members,
  onAdd,
  onUpdate,
  onRemove,
  inviteMode,
  title = "Team & Roles",
  subtitle,
}: TeamMembersManagerProps) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle ?? `${members.length} member${members.length === 1 ? "" : "s"} in this workspace`}
          </p>
        </div>
        <MemberDialog
          mode="add"
          inviteDefault={!!inviteMode}
          onSave={(m) => onAdd(m)}
          trigger={
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {inviteMode ? "Invite member" : "Add member"}
            </Button>
          }
        />
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Member</th>
            <th className="px-4 py-2 text-left font-medium">Role</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="w-20 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="h-12 border-b border-border last:border-b-0">
              <td className="px-4">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary-soft text-[10px] font-medium text-primary">
                      {memberInitials(m.name || m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{m.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                    {m.phone && (
                      <div className="text-xs text-muted-foreground">{m.phone}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4">
                <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">
                  {ROLE_LABELS[m.role]}
                </Badge>
              </td>
              <td className="px-4 text-xs capitalize text-muted-foreground">
                {m.workerType === "subcontractor" ? "Sub-contractor" : "Employee"}
              </td>
              <td className="px-4">
                <Badge
                  variant="secondary"
                  className={
                    "h-5 rounded px-1.5 text-[10px] " +
                    (m.status === "invited"
                      ? "bg-warning/15 text-warning"
                      : "bg-success/15 text-success")
                  }
                >
                  {m.status === "invited" ? "Invited" : "Active"}
                </Badge>
              </td>
              <td className="px-4 text-right">
                <div className="flex justify-end gap-1">
                  <MemberDialog
                    mode="edit"
                    initial={m}
                    onSave={(patch) => onUpdate(m.id, patch)}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
  onRemove(m.id); // optimistic local update
  const result = await removeMemberFromOrg(
    m.status === "invited"
      ? { invitationId: m.id }
      : { memberId: m.id }
  );
  if (!result.success) toast.error(result.error);
}}
                    disabled={m.role === "owner"}
                    title={m.role === "owner" ? "Owner can't be removed" : "Remove"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No team members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MemberDialog({
  mode,
  initial,
  inviteDefault,
  onSave,
  trigger,
}: {
  mode: "add" | "edit";
  initial?: TeamMember;
  inviteDefault?: boolean;
  onSave: (m: Omit<TeamMember, "id">) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen]             = useState(false);
  const [name, setName]             = useState(initial?.name ?? "");
  const [email, setEmail]           = useState(initial?.email ?? "");
  const [phone, setPhone]           = useState(initial?.phone ?? "");
  const [role, setRole]             = useState<Role>(initial?.role ?? "viewer");
  const [workerType, setWorkerType] = useState<WorkerType>(initial?.workerType ?? "employee");
  const [sendNow, setSendNow]       = useState(true);
  const [sending, setSending]       = useState(false);

  function reset() {
    setName(initial?.name ?? "");
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
    const status: TeamMember["status"] = shouldInvite
      ? "invited"
      : initial?.status ?? "active";

    // Update local store immediately so UI reflects the change
    onSave({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role,
      workerType,
      status,
      invitedAt: status === "invited" ? new Date().toISOString() : initial?.invitedAt,
    });

    setOpen(false);
    if (mode === "add") reset();

    // Send invitation email via Netlify function
    if (shouldInvite) {
      setSending(true);
      const result = await inviteMember({
        email: email.trim().toLowerCase(),
        role,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setSending(false);

      if (result.success) {
        toast.success(`Invitation sent to ${email.trim()}`);
      } else {
        toast.error(`Member added but email failed: ${result.error}`);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add"
              ? inviteDefault ? "Invite member" : "Add member"
              : "Edit member"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                className="h-9"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                className="h-9"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                className="h-9"
                value={phone}
                onChange={(e) => setPhone(fmtPhone(e.target.value))}
                placeholder="555-123-4567"
                inputMode="tel"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Employment type</Label>
              <Select value={workerType} onValueChange={(v) => setWorkerType(v as WorkerType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="subcontractor">Sub-contractor (1099)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "add" && !inviteDefault && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={sendNow}
                onChange={(e) => setSendNow(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Send invitation email now
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!email.trim() || sending}>
            {sending
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
              : mode === "add" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}