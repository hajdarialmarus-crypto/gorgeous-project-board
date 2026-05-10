import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search, LogIn, LogOut, Sparkles, Plus, Wand2 } from "lucide-react";
import { AssistantDialog } from "@/components/board/AssistantDialog";
import { Link } from "@tanstack/react-router";
import { useTasks, type Status, type Task, type Priority } from "@/lib/tasks";
import { Column } from "@/components/board/Column";
import { TaskCard } from "@/components/board/TaskCard";
import { TaskDialog } from "@/components/board/TaskDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const COLUMNS: { status: Status; title: string; accent: string }[] = [
  { status: "todo", title: "To Do", accent: "oklch(0.78 0.16 195)" },
  { status: "in_progress", title: "In Progress", accent: "oklch(0.82 0.17 65)" },
  { status: "done", title: "Done", accent: "oklch(0.78 0.18 150)" },
];

export function Board() {
  const { user, tasks, loading, createTask, updateTask, deleteTask, moveTask } = useTasks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [initialStatus, setInitialStatus] = useState<Status>("todo");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [mounted, setMounted] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !t.description.toLowerCase().includes(q) &&
          !t.tag.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tasks, search, priorityFilter]);

  const byStatus = useMemo(() => {
    const map: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    for (const s of Object.keys(map) as Status[])
      map[s].sort((a, b) => a.position - b.position);
    return map;
  }, [filtered]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = String(over.id);
    let targetStatus: Status;
    let overIndex: number;

    if (overId === "todo" || overId === "in_progress" || overId === "done") {
      targetStatus = overId as Status;
      overIndex = byStatus[targetStatus].length;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
      const list = byStatus[targetStatus];
      overIndex = list.findIndex((t) => t.id === overId);
    }

    const list = byStatus[targetStatus].filter((t) => t.id !== active.id);
    const before = list[overIndex - 1];
    const after = list[overIndex];
    let newPosition: number;
    if (!before && !after) newPosition = 1000;
    else if (!before) newPosition = after!.position - 500;
    else if (!after) newPosition = before.position + 500;
    else newPosition = (before.position + after.position) / 2;

    if (activeTask.status === targetStatus && activeTask.position === newPosition) return;
    moveTask(activeTask.id, targetStatus, newPosition);
  };

  const openNew = (status: Status) => {
    setEditing(null);
    setInitialStatus(status);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setInitialStatus(task.status);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    status: Status;
    priority?: Priority;
    tag?: string;
    due_date?: string | null;
  }) => {
    if (editing) {
      await updateTask(editing.id, data);
    } else {
      await createTask(data);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen w-full" suppressHydrationWarning />;
  }

  return (
    <div className="min-h-screen w-full">

      <header className="sticky top-0 z-30 border-b border-glass-border backdrop-blur-xl bg-[oklch(0.13_0.025_270/0.7)]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.20_290)] to-[oklch(0.74_0.18_200)] shadow-glow">
              <Sparkles className="h-4 w-4 text-[oklch(0.10_0.02_270)]" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Kanban</h1>
              <p className="text-[11px] text-muted-foreground mt-1">
                {user ? user.email : "Guest mode — saved locally"}
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 max-w-2xl">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9 bg-white/5 border-glass-border"
              />
            </div>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as "all" | Priority)}>
              <SelectTrigger className="w-[140px] bg-white/5 border-glass-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => openNew("todo")}
              className="bg-gradient-to-r from-[oklch(0.72_0.20_290)] to-[oklch(0.74_0.18_200)] text-[oklch(0.10_0.02_270)] font-semibold hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add task
            </Button>
            {user ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => supabase.auth.signOut()}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Button asChild variant="outline" className="border-glass-border">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
            Loading…
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="flex gap-5 overflow-x-auto pb-6">
              {COLUMNS.map((c) => (
                <Column
                  key={c.status}
                  status={c.status}
                  title={c.title}
                  accent={c.accent}
                  tasks={byStatus[c.status]}
                  onAdd={openNew}
                  onEdit={openEdit}
                  onDelete={deleteTask}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="rotate-3 scale-105">
                  <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialStatus={initialStatus}
        task={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
