// Lovable AI assistant for the Kanban board.
// Supports two modes: "chat" (streaming) and "suggest" (structured task suggestions).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface BoardTask {
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  tag?: string;
  due_date?: string | null;
}

interface RequestBody {
  mode: "chat" | "suggest";
  messages?: { role: "user" | "assistant"; content: string }[];
  goal?: string;
  tasks?: BoardTask[];
}

function boardSummary(tasks: BoardTask[] = []) {
  if (!tasks.length) return "The board is currently empty.";
  const by = (s: string) => tasks.filter((t) => t.status === s);
  const fmt = (t: BoardTask) =>
    `- [${t.priority ?? "medium"}] ${t.title}${t.tag ? ` (#${t.tag})` : ""}${
      t.description ? ` — ${t.description}` : ""
    }`;
  return [
    `To Do (${by("todo").length}):`,
    ...by("todo").map(fmt),
    `\nIn Progress (${by("in_progress").length}):`,
    ...by("in_progress").map(fmt),
    `\nDone (${by("done").length}):`,
    ...by("done").map(fmt),
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = (await req.json()) as RequestBody;
    const context = boardSummary(body.tasks ?? []);

    if (body.mode === "suggest") {
      const goal = body.goal?.trim() || "Suggest helpful next tasks for this board.";
      const payload = {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a Kanban planning assistant. Based on the user's goal and current board, propose 3-5 concrete, actionable tasks.",
          },
          {
            role: "user",
            content: `Goal: ${goal}\n\nCurrent board:\n${context}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_tasks",
              description: "Return suggested Kanban tasks.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: {
                          type: "string",
                          enum: ["low", "medium", "high"],
                        },
                        tag: { type: "string" },
                      },
                      required: ["title", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_tasks" } },
      };

      const r = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const t = await r.text();
        return new Response(
          JSON.stringify({ error: t || "AI gateway error" }),
          {
            status: r.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const data = await r.json();
      const args =
        data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { suggestions: [] };
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat mode (streaming)
    const messages = body.messages ?? [];
    const payload = {
      model: MODEL,
      stream: true,
      messages: [
        {
          role: "system",
          content: `You are a friendly assistant embedded in a Kanban board app. Help the user organize, prioritize, and plan their work. Be concise. Here is the current board state:\n\n${context}`,
        },
        ...messages,
      ],
    };

    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      if (r.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (r.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await r.text();
      return new Response(JSON.stringify({ error: t || "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(r.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
