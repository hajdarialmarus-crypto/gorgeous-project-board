import { useState } from "react";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import type { Task, Priority } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const priorityStyles: Record<Priority, string> = {
  low: "bg-[oklch(0.78_0.18_150/0.15)] text-[oklch(0.85_0.18_150)] border-[oklch(0.78_0.18_150/0.3)]",
  medium: "bg-[oklch(0.82_0.17_80/0.15)] text-[oklch(0.88_0.17_80)] border-[oklch(0.82_0.17_80/0.3)]",
  high: "bg-[oklch(0.72_0.22_20/0.18)] text-[oklch(0.82_0.22_20)] border-[oklch(0.72_0.22_20/0.35)]",
};

const priorityDot: Record<Priority, string> = {
  low: "bg-[oklch(0.78_0.18_150)]",
  medium: "bg-[oklch(0.82_0.17_80)]",
  high: "bg-[oklch(0.72_0.22_20)]",
};

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const [hover, setHover] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const due = task.due_date ? new Date(task.due_date) : null;
  const dueOverdue = due && isPast(due) && !isToday(due) && task.status !== "done";

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...attributes}
      {...listeners}
      className="group glass-strong shadow-card relative cursor-grab touch-none rounded-2xl p-4 active:cursor-grabbing hover:border-[oklch(1_0_0/0.22)] transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority])} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {task.tag && (
              <span className="rounded-full border border-glass-border bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {task.tag}
              </span>
            )}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                priorityStyles[task.priority],
              )}
            >
              {task.priority}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground break-words">
            {task.title}
          </h3>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground break-words">
              {task.description}
            </p>
          )}
          {due && (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-md border border-glass-border bg-white/5 px-2 py-1 text-[11px]",
                dueOverdue ? "text-[oklch(0.82_0.22_20)]" : "text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(due, "MMM d")}
            </div>
          )}
        </div>
      </div>

      {hover && (
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="rounded-md bg-white/5 p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="rounded-md bg-white/5 p-1.5 text-muted-foreground hover:text-[oklch(0.82_0.22_20)] hover:bg-white/10 transition"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
