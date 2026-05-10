import { createFileRoute } from "@tanstack/react-router";
import { Board } from "@/components/board/Board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kanban — Plan, drag, ship" },
      {
        name: "description",
        content:
          "A gorgeous, interactive Kanban board with drag-and-drop, priorities, due dates and cloud sync.",
      },
      { property: "og:title", content: "Kanban — Plan, drag, ship" },
      {
        property: "og:description",
        content: "Beautiful dark glassmorphism Kanban with drag-and-drop and cloud sync.",
      },
    ],
  }),
  component: Board,
});
