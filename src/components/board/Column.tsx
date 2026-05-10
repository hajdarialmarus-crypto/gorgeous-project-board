import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { TaskCard } from "./TaskCard";
import type { Task, Status } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface Props {
  status: Status;
  title: string;
  accent: string;
  tasks: Task[];
  onAdd: (status: Status) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function Column({ status, title, accent, tasks, onAdd, onEdit, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass shadow-card flex w-[340px] shrink-0 flex-col rounded-3xl p-4 transition-all duration-200",
        isOver && "border-[oklch(1_0_0/0.3)] bg-white/[0.08] shadow-glow",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(status)}
          className="rounded-lg bg-white/5 p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition"
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-col gap-3">
          <AnimatePresence>
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-glass-border py-10 text-xs text-muted-foreground">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
