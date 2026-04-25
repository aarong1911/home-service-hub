import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Plus, Search, LayoutGrid, List as ListIcon, AlertCircle, CheckCircle2,
  Clock, Loader2, Eye, MoreHorizontal, Trash2, Calendar as CalendarIcon, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mockProjects, type Task } from "@/lib/mock-data";
import { useTasks, addTask, updateTask, deleteTask, completeTask } from "@/lib/tasks-store";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

type Status = Task["status"];
type Priority = Task["priority"];
type Recurrence = NonNullable<Task["recurrence"]>;
type View = "board" | "list";

const STATUS_COLUMNS: { id: Status; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "todo", label: "To Do", icon: Clock },
  { id: "in_progress", label: "In Progress", icon: Loader2 },
  { id: "review", label: "Review", icon: Eye },
  { id: "done", label: "Done", icon: CheckCircle2 },
];

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "med", label: "Medium" },
  { id: "high", label: "High" },
];

const RECURRENCES: { id: Recurrence; label: string; short: string }[] = [
  { id: "none", label: "Does not repeat", short: "One-time" },
  { id: "daily", label: "Daily", short: "Daily" },
  { id: "weekly", label: "Weekly", short: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks", short: "Bi-weekly" },
  { id: "monthly", label: "Monthly", short: "Monthly" },
];

function recurrenceLabel(r: Recurrence | undefined) {
  return RECURRENCES.find((x) => x.id === (r ?? "none"))?.short ?? "One-time";
}

function handleComplete(id: string) {
  const next = completeTask(id);
  if (next) {
    toast.success("Task complete — next instance scheduled", {
      description: `Due ${fmtDue(next.due)}`,
    });
  } else {
    toast.success("Task marked complete");
  }
}

const OWNERS = [
  { name: "Alex Romero", initials: "AR" },
  { name: "Priya Shah", initials: "PS" },
  { name: "Jamal Burke", initials: "JB" },
  { name: "Mei Lin", initials: "ML" },
  { name: "Sara Holt", initials: "SH" },
];

function fmtDue(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));
}
function isOverdue(iso: string, status: Status) {
  if (status === "done") return false;
  return new Date(iso).getTime() < Date.UTC(2026, 3, 18);
}
function projectName(id: string) {
  return mockProjects.find((p) => p.id === id)?.name ?? "Unassigned";
}
function priorityClass(p: Priority) {
  if (p === "high") return "bg-destructive/10 text-destructive border-destructive/20";
  if (p === "med") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}
function statusClass(s: Status) {
  if (s === "done") return "bg-success/10 text-success border-success/20";
  if (s === "review") return "bg-primary/10 text-primary border-primary/20";
  if (s === "in_progress") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

function TasksPage() {
  const tasks = useTasks();
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.assignee.toLowerCase().includes(q)) return false;
      if (ownerFilter !== "all" && t.assignee !== ownerFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
      return true;
    });
  }, [tasks, query, ownerFilter, priorityFilter, projectFilter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue = tasks.filter((t) => isOverdue(t.due, t.status)).length;
    return { total, done, inProgress, overdue };
  }, [tasks]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId as Status;
    if (newStatus === "done") {
      handleComplete(draggableId);
    } else {
      updateTask(draggableId, { status: newStatus });
    }
  };

  const grouped = useMemo(() => {
    const map: Record<Status, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    return map;
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Track work across every project — drag to update status."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total" value={stats.total} icon={ListIcon} />
        <Kpi label="In Progress" value={stats.inProgress} icon={Loader2} tone="warning" />
        <Kpi label="Completed" value={stats.done} icon={CheckCircle2} tone="success" />
        <Kpi label="Overdue" value={stats.overdue} icon={AlertCircle} tone="destructive" />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8"
            />
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {OWNERS.map((o) => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {mockProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          <Button
            variant={view === "board" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("board")}
          >
            <LayoutGrid className="h-4 w-4" /> Board
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
          >
            <ListIcon className="h-4 w-4" /> List
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_COLUMNS.map((col) => {
              const items = grouped[col.id];
              const Icon = col.icon;
              return (
                <Droppable droppableId={col.id} key={col.id}>
                  {(dropProvided, snapshot) => (
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className={cn(
                        "rounded-lg border border-border bg-secondary/40 p-2 transition-colors",
                        snapshot.isDraggingOver && "border-primary/40 bg-primary-soft/40",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between px-1.5 py-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {col.label}
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{items.length}</Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {items.map((t, idx) => (
                          <Draggable draggableId={t.id} index={idx} key={t.id}>
                            {(p, snap) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                              >
                                <TaskCard
                                  task={t}
                                  dragging={snap.isDragging}
                                  onView={() => setViewing(t)}
                                  onEdit={() => setEditing(t)}
                                  onDelete={() => {
                                    deleteTask(t.id);
                                    toast.success("Task deleted");
                                  }}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                        {items.length === 0 && (
                          <div className="rounded-md border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
                            Drop tasks here
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => setViewing(t)}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-muted-foreground">{projectName(t.projectId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                        {t.assigneeInitials}
                      </span>
                      <span className="text-sm">{t.assignee}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm", isOverdue(t.due, t.status) && "text-destructive font-medium")}>
                      {fmtDue(t.due)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityClass(t.priority)}>
                      {PRIORITIES.find((p) => p.id === t.priority)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass(t.status)}>
                      {STATUS_COLUMNS.find((s) => s.id === t.status)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleComplete(t.id);
                          }}
                        >
                          Mark complete
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            deleteTask(t.id);
                            toast.success("Task deleted");
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No tasks match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <TaskFormDialog
        open={createOpen || editing !== null}
        task={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
      />

      {/* View sheet */}
      <Sheet open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.title}</SheetTitle>
                <SheetDescription>{projectName(viewing.projectId)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <Fact label="Assignee" value={`${viewing.assignee} (${viewing.assigneeInitials})`} />
                <Fact label="Due" value={fmtDue(viewing.due)} />
                <Fact label="Priority" value={PRIORITIES.find((p) => p.id === viewing.priority)?.label ?? ""} />
                <Fact label="Status" value={STATUS_COLUMNS.find((s) => s.id === viewing.status)?.label ?? ""} />
                <Fact label="Repeats" value={recurrenceLabel(viewing.recurrence)} />
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const cur = viewing;
                      setViewing(null);
                      setEditing(cur);
                    }}
                  >
                    Edit
                  </Button>
                  {viewing.status !== "done" && (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        handleComplete(viewing.id);
                        setViewing(null);
                      }}
                    >
                      Mark complete
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tone = "muted",
}: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "muted" | "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success" ? "text-success bg-success/10" :
    tone === "warning" ? "text-warning bg-warning/10" :
    tone === "destructive" ? "text-destructive bg-destructive/10" :
    "text-muted-foreground bg-secondary";
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", toneClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold leading-none">{value}</div>
      </div>
    </Card>
  );
}

function TaskCard({
  task, dragging, onView, onEdit, onDelete,
}: {
  task: Task; dragging: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const overdue = isOverdue(task.due, task.status);
  return (
    <Card
      className={cn(
        "cursor-grab p-3 transition-shadow hover:shadow-md active:cursor-grabbing",
        dragging && "shadow-lg ring-1 ring-primary/40",
      )}
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 text-sm font-medium leading-snug">{task.title}</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-1 -mt-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-1.5 truncate text-xs text-muted-foreground">{projectName(task.projectId)}</div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", priorityClass(task.priority))}>
            {PRIORITIES.find((p) => p.id === task.priority)?.label}
          </Badge>
          <span className={cn(
            "inline-flex items-center gap-1 text-[11px]",
            overdue ? "text-destructive font-medium" : "text-muted-foreground",
          )}>
            <CalendarIcon className="h-3 w-3" /> {fmtDue(task.due)}
          </span>
          {task.recurrence && task.recurrence !== "none" && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary"
              title={`Repeats ${recurrenceLabel(task.recurrence).toLowerCase()}`}
            >
              <Repeat className="h-3 w-3" /> {recurrenceLabel(task.recurrence)}
            </span>
          )}
        </div>
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary"
          title={task.assignee}
        >
          {task.assigneeInitials}
        </span>
      </div>
    </Card>
  );
}

function TaskFormDialog({
  open, task, onClose,
}: { open: boolean; task: Task | null; onClose: () => void }) {
  const isEdit = task !== null;
  const [title, setTitle] = useState(task?.title ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? mockProjects[0]?.id ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? OWNERS[0].name);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "med");
  const [status, setStatus] = useState<Status>(task?.status ?? "todo");
  const [due, setDue] = useState(task ? task.due.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<Recurrence>(task?.recurrence ?? "none");
  type EndMode = "never" | "on" | "after";
  const initialEndMode: EndMode =
    task?.recurrenceEndDate ? "on" : task?.recurrenceCount ? "after" : "never";
  const [endMode, setEndMode] = useState<EndMode>(initialEndMode);
  const [endDate, setEndDate] = useState<string>(task?.recurrenceEndDate?.slice(0, 10) ?? "");
  const [occurrences, setOccurrences] = useState<string>(
    task?.recurrenceCount ? String(task.recurrenceCount) : "5",
  );
  const [notes, setNotes] = useState("");

  // Reset on open change
  useMemo(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setProjectId(task?.projectId ?? mockProjects[0]?.id ?? "");
      setAssignee(task?.assignee ?? OWNERS[0].name);
      setPriority(task?.priority ?? "med");
      setStatus(task?.status ?? "todo");
      setDue(task ? task.due.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setRecurrence(task?.recurrence ?? "none");
      setEndMode(task?.recurrenceEndDate ? "on" : task?.recurrenceCount ? "after" : "never");
      setEndDate(task?.recurrenceEndDate?.slice(0, 10) ?? "");
      setOccurrences(task?.recurrenceCount ? String(task.recurrenceCount) : "5");
      setNotes("");
    }
  }, [open, task]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const owner = OWNERS.find((o) => o.name === assignee) ?? OWNERS[0];
    let recurrenceEndDate: string | undefined;
    let recurrenceCount: number | undefined;
    if (recurrence !== "none") {
      if (endMode === "on" && endDate) {
        recurrenceEndDate = new Date(endDate).toISOString();
      } else if (endMode === "after") {
        const n = parseInt(occurrences, 10);
        if (!Number.isFinite(n) || n < 1) {
          toast.error("Occurrences must be at least 1");
          return;
        }
        recurrenceCount = n;
      }
    }
    const payload: Omit<Task, "id"> = {
      title: title.trim(),
      projectId,
      assignee: owner.name,
      assigneeInitials: owner.initials,
      due: new Date(due).toISOString(),
      priority,
      status,
      recurrence,
      recurrenceEndDate,
      recurrenceCount,
      recurrenceIndex: task?.recurrenceIndex ?? (recurrence !== "none" ? 1 : undefined),
    };
    if (isEdit && task) {
      updateTask(task.id, payload);
      toast.success("Task updated");
    } else {
      addTask(payload);
      toast.success("Task created");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the task details." : "Add a new task to a project."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Order quartz countertops"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mockProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OWNERS.map((o) => (
                    <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Repeats</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRENCES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {recurrence !== "none" && (
              <p className="text-[11px] text-muted-foreground">
                When marked complete, the next instance will be created automatically.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes (optional)</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any context or details…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{isEdit ? "Save changes" : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
