import { useRef, useState } from "react";
import { Sparkles, Send, Plus, Loader2, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { Task, TaskInput, Priority } from "@/lib/tasks";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Suggestion = {
  title: string;
  description?: string;
  priority: Priority;
  tag?: string;
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const AUTH = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: Task[];
  onCreateTask: (input: TaskInput) => Promise<unknown> | unknown;
}

export function AssistantDialog({ open, onOpenChange, tasks, onCreateTask }: Props) {
  const [tab, setTab] = useState<"chat" | "suggest">("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [goal, setGoal] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [added, setAdded] = useState<Set<number>>(new Set());

  const taskPayload = tasks.map((t) => ({
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    tag: t.tag,
    due_date: t.due_date,
  }));

  const sendChat = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ mode: "chat", messages: next, tasks: taskPayload }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) toast.error("Rate limit exceeded. Try again shortly.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error(err.error || "Failed to reach AI");
        setStreaming(false);
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      let acc = "";

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
              queueMicrotask(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      toast.error("Failed to reach AI");
      console.error(e);
    } finally {
      setStreaming(false);
    }
  };

  const runSuggest = async () => {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestions([]);
    setAdded(new Set());
    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ mode: "suggest", goal, tasks: taskPayload }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 429) toast.error("Rate limit exceeded.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error(data.error || "Failed to suggest");
        return;
      }
      setSuggestions(data.suggestions || []);
    } catch (e) {
      toast.error("Failed to suggest tasks");
      console.error(e);
    } finally {
      setSuggesting(false);
    }
  };

  const addSuggestion = async (s: Suggestion, i: number) => {
    await onCreateTask({
      title: s.title,
      description: s.description ?? "",
      priority: s.priority,
      tag: s.tag ?? "",
      status: "todo",
    });
    setAdded((prev) => new Set(prev).add(i));
    toast.success(`Added "${s.title}"`);
  };

  const priorityColor = (p: Priority) =>
    p === "high"
      ? "bg-[oklch(0.70_0.20_25/0.2)] text-[oklch(0.85_0.18_25)] border-[oklch(0.70_0.20_25/0.4)]"
      : p === "medium"
      ? "bg-[oklch(0.75_0.18_70/0.2)] text-[oklch(0.88_0.16_70)] border-[oklch(0.75_0.18_70/0.4)]"
      : "bg-[oklch(0.75_0.15_200/0.2)] text-[oklch(0.85_0.15_200)] border-[oklch(0.75_0.15_200/0.4)]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl glass border-glass-border p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.72_0.20_290)] to-[oklch(0.74_0.18_200)]">
              <Sparkles className="h-3.5 w-3.5 text-[oklch(0.10_0.02_270)]" />
            </div>
            AI Assistant
          </DialogTitle>
          <DialogDescription>
            Chat about your board or generate task ideas.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "chat" | "suggest")} className="px-6 pb-6">
          <TabsList className="bg-white/5 border border-glass-border">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="suggest">Suggest tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4">
            <ScrollArea className="h-[360px] rounded-xl border border-glass-border bg-white/5 p-4" ref={scrollRef as never}>
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2 py-12">
                  <Sparkles className="h-6 w-6 opacity-60" />
                  <p>Ask anything about your board.</p>
                  <p className="text-xs opacity-70">e.g. "What should I focus on next?"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === "user"
                          ? "ml-auto bg-gradient-to-br from-[oklch(0.72_0.20_290/0.4)] to-[oklch(0.74_0.18_200/0.4)] text-foreground"
                          : "bg-white/5 border border-glass-border"
                      }`}
                    >
                      {m.content || (streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : null)}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="mt-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
                placeholder="Ask the assistant..."
                disabled={streaming}
                className="bg-white/5 border-glass-border"
              />
              <Button
                onClick={sendChat}
                disabled={streaming || !input.trim()}
                className="bg-gradient-to-r from-[oklch(0.72_0.20_290)] to-[oklch(0.74_0.18_200)] text-[oklch(0.10_0.02_270)] font-semibold"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="suggest" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSuggest())}
                placeholder="What's your goal? (optional)"
                className="bg-white/5 border-glass-border"
              />
              <Button
                onClick={runSuggest}
                disabled={suggesting}
                className="bg-gradient-to-r from-[oklch(0.72_0.20_290)] to-[oklch(0.74_0.18_200)] text-[oklch(0.10_0.02_270)] font-semibold"
              >
                {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate
              </Button>
            </div>

            <ScrollArea className="h-[320px] rounded-xl border border-glass-border bg-white/5 p-3">
              {suggestions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2 py-12">
                  <Wand2 className="h-6 w-6 opacity-60" />
                  <p>Click Generate to get task ideas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="rounded-xl border border-glass-border bg-white/[0.04] p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{s.title}</p>
                          <Badge variant="outline" className={priorityColor(s.priority)}>
                            {s.priority}
                          </Badge>
                          {s.tag && (
                            <Badge variant="outline" className="border-glass-border bg-white/5">
                              #{s.tag}
                            </Badge>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addSuggestion(s, i)}
                        disabled={added.has(i)}
                        className="shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {added.has(i) ? "Added" : "Add"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
