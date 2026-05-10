import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  tag: string;
  due_date: string | null;
  position: number;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  tag?: string;
  due_date?: string | null;
}

const LOCAL_KEY = "kanban-local-tasks-v1";

function loadLocal(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLocal(tasks: Task[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks));
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useTasks() {
  const { user, loading: authLoading } = useAuthUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks(loadLocal());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("position", { ascending: true });
    if (!error && data) setTasks(data as Task[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  // Migrate local -> cloud on first sign-in
  useEffect(() => {
    if (!user) return;
    const local = loadLocal();
    if (local.length === 0) return;
    (async () => {
      const rows = local.map((t) => ({
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        tag: t.tag,
        due_date: t.due_date,
        position: t.position,
        owner_id: user.id,
      }));
      await supabase.from("tasks").insert(rows);
      localStorage.removeItem(LOCAL_KEY);
      refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const nextPosition = (status: Status) => {
    const inCol = tasks.filter((t) => t.status === status);
    return inCol.length === 0 ? 1000 : Math.max(...inCol.map((t) => t.position)) + 1000;
  };

  const createTask = async (input: TaskInput) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      tag: input.tag ?? "",
      due_date: input.due_date ?? null,
      position: nextPosition(input.status ?? "todo"),
    };
    if (!user) {
      const next = [...tasks, newTask];
      setTasks(next);
      saveLocal(next);
      return;
    }
    setTasks((prev) => [...prev, newTask]);
    const { error } = await supabase.from("tasks").insert({
      ...newTask,
      owner_id: user.id,
    });
    if (error) refresh();
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (!user) {
      const next = loadLocal().map((t) => (t.id === id ? { ...t, ...patch } : t));
      saveLocal(next);
      return;
    }
    await supabase.from("tasks").update(patch).eq("id", id);
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!user) {
      saveLocal(loadLocal().filter((t) => t.id !== id));
      return;
    }
    await supabase.from("tasks").delete().eq("id", id);
  };

  const moveTask = async (id: string, newStatus: Status, newPosition: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus, position: newPosition } : t)),
    );
    if (!user) {
      const next = loadLocal().map((t) =>
        t.id === id ? { ...t, status: newStatus, position: newPosition } : t,
      );
      saveLocal(next);
      return;
    }
    await supabase
      .from("tasks")
      .update({ status: newStatus, position: newPosition })
      .eq("id", id);
  };

  return {
    user,
    authLoading,
    tasks,
    loading,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    refresh,
  };
}
