## Kanban Board — Dark Glassmorphism

A beautiful, interactive Kanban board with three columns (To Do, In Progress, Done), persistent storage in Lovable Cloud, and optional sign-in for cross-device sync.

### Features

- **3 columns**: To Do, In Progress, Done — with task counts and quick "+ Add" per column
- **Task cards** include: title, description, due date, priority (Low / Medium / High), tag (free-form text/colored chip)
- **Drag & drop** between columns and reorder within a column (smooth animations)
- **Create / edit / delete** tasks via a glassy modal with date picker, priority selector, tag input
- **Filters**: by priority, by tag, plus search
- **Login optional**: works instantly anonymously (data tied to a local anon ID); a "Sign in" button enables real account sync across devices
- **Empty states**, hover lift, subtle parallax on cards, animated column highlights when dragging

### Visual direction (Dark glassmorphism, inspired by reference 2)

- Deep gradient background (indigo → slate → black) with soft blurred orbs
- Frosted glass column panels (`backdrop-blur`, translucent borders, soft inner glow)
- Vivid accent gradients for priority chips (red/amber/emerald)
- Typography: clean sans, generous spacing, subtle motion via Framer Motion
- All colors as semantic tokens in `src/styles.css` (oklch)

### Pages / routes

- `/` — landing redirects into the board (or a tiny hero + "Open board" CTA)
- `/board` — the Kanban workspace
- `/login` — optional auth (email magic link / password)

### Data model (Lovable Cloud)

```
tasks
  id uuid pk
  owner_id uuid null         -- auth.uid() when signed in
  anon_id text null          -- localStorage uuid for anonymous users
  title text
  description text
  status text  -- 'todo' | 'in_progress' | 'done'
  priority text -- 'low' | 'medium' | 'high'
  tag text
  due_date date
  position int  -- ordering within a column
  created_at, updated_at timestamptz
```

RLS:
- Signed-in users: `owner_id = auth.uid()` for select/insert/update/delete
- Anonymous: `anon_id = current_setting('request.headers')::json->>'x-anon-id'` (passed from client) — or simpler: anon rows readable by anyone with the matching anon_id sent in query filter (we'll keep RLS strict and rely on the client sending its anon_id)

When a user signs in for the first time, anon rows with their `anon_id` are migrated to their `owner_id`.

### Tech

- Lovable Cloud (Postgres + Auth)
- TanStack Router routes: `/`, `/board`, `/login`
- TanStack Query for cache + optimistic updates
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag & drop
- `framer-motion` for entrance/hover/drag animations
- shadcn Dialog, Popover, Calendar (date picker), Select, Input, Button

### Build steps

1. Enable Lovable Cloud, create `tasks` table + RLS policies
2. Add design tokens (dark glass palette, gradients, glow shadows) in `src/styles.css`
3. Install `@dnd-kit/core`, `@dnd-kit/sortable`, `framer-motion`, `date-fns`
4. Build `/board` route: column layout, glass panels, animated background
5. Task card component + create/edit dialog with all fields
6. Wire CRUD via TanStack Query with optimistic updates
7. Drag-and-drop with position persistence
8. Filters + search bar
9. Optional auth: login page, anon→user migration on first sign-in
10. Polish: empty states, loading skeletons, toasts, responsive mobile layout
