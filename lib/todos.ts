export const PRIORITIES = ["high", "medium", "low"] as const;
export const CATEGORIES = ["work", "personal", "shopping"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Filter = "all" | "active" | "completed";
export type AreaFilter = Category | "all";
export type Todo = { id: string; text: string; completed: boolean; priority: Priority; category: Category };

export const MAX_TEXT = 140;
const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function inArea(todo: Todo, area: AreaFilter): boolean {
  return area === "all" || todo.category === area;
}

/** Open work first, then by priority; original order breaks ties. Optionally limited to one area. */
export function boardView(todos: Todo[], filter: Filter, area: AreaFilter = "all"): Todo[] {
  return todos
    .map((todo, index) => ({ todo, index }))
    .filter(({ todo }) => inArea(todo, area))
    .filter(({ todo }) => filter === "all" || (filter === "active" ? !todo.completed : todo.completed))
    .sort((a, b) => Number(a.todo.completed) - Number(b.todo.completed) || RANK[a.todo.priority] - RANK[b.todo.priority] || a.index - b.index)
    .map(({ todo }) => todo);
}

/** Counts per status tab, within the selected area. */
export function countTodos(todos: Todo[], area: AreaFilter = "all"): Record<Filter, number> {
  todos = todos.filter((todo) => inArea(todo, area));
  const completed = todos.filter((todo) => todo.completed).length;
  return { all: todos.length, active: todos.length - completed, completed };
}

/** Trim, drop zero-width characters / BOM, cut to MAX_TEXT without splitting an emoji. */
export function cleanText(text: string): string {
  const value = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  if (value.length <= MAX_TEXT) return value;
  return value.slice(0, /[\uD800-\uDBFF]/.test(value[MAX_TEXT - 1]) ? MAX_TEXT - 1 : MAX_TEXT).trimEnd();
}

export function addTodo(todos: Todo[], text: string, priority: Priority, category: Category, id: string): Todo[] {
  const clean = cleanText(text);
  if (!clean) return todos;
  return [{ id, text: clean, completed: false, priority, category }, ...todos];
}

export function toggleTodo(todos: Todo[], id: string): Todo[] {
  return todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo));
}

export function deleteTodo(todos: Todo[], id: string): Todo[] {
  return todos.filter(todo => todo.id !== id);
}

export function clearCompleted(todos: Todo[]): Todo[] {
  return todos.filter((todo) => !todo.completed);
}

export function parseTodos(raw: string | null): Todo[] | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    // Ids key the rows and toggles; a repeated id keeps only its first todo.
    const seen = new Set<string>();
    return data.filter((item): item is Todo => {
      if (typeof item !== "object" || item === null) return false;
      const t = item as Record<string, unknown>;
      const valid = typeof t.id === "string" && typeof t.text === "string" && typeof t.completed === "boolean" && (PRIORITIES as readonly unknown[]).includes(t.priority) && (CATEGORIES as readonly unknown[]).includes(t.category);
      if (!valid || seen.has(t.id as string)) return false;
      seen.add(t.id as string);
      return true;
    });
  } catch {
    return null;
  }
}

/** What was removed and where each item sat, so Undo can put it back (see restoreTodos). */
export type Removal = { item: Todo; beforeId: string | null }[];

/** Record removals with the id of the next surviving row, so later additions do not shift them. */
export function removalOf(todos: Todo[], ids: Set<string>): Removal {
  return todos.flatMap((todo, index) => {
    if (!ids.has(todo.id)) return [];
    const next = todos.slice(index + 1).find((later) => !ids.has(later.id));
    return [{ item: todo, beforeId: next?.id ?? null }];
  });
}

/** Undo: reinsert each removed todo before the row that followed it, or at the end; never duplicates. */
export function restoreTodos(todos: Todo[], removal: Removal): Todo[] {
  let result = todos;
  for (const { item, beforeId } of removal) {
    if (result.some((todo) => todo.id === item.id)) continue;
    const at = beforeId ? result.findIndex((todo) => todo.id === beforeId) : -1;
    result = at < 0 ? [...result, item] : [...result.slice(0, at), item, ...result.slice(at)];
  }
  return result;
}

/** Backup file: the board as pretty JSON, read back by mergeImported. */
export function exportTodos(todos: Todo[]): string {
  return JSON.stringify(todos, null, 2);
}

/**
 * Import a backup: valid todos whose id is not on the board yet are added after the current tasks.
 * Returns null when the file is not a todo list (not JSON or not an array), so nothing changes.
 */
export function mergeImported(todos: Todo[], raw: string): { todos: Todo[]; added: number } | null {
  const incoming = parseTodos(raw);
  if (!incoming) return null;
  const ids = new Set(todos.map((todo) => todo.id));
  const fresh = incoming.filter((todo) => !ids.has(todo.id)).map((todo) => ({ ...todo, text: cleanText(todo.text) })).filter((todo) => todo.text);
  return { todos: [...todos, ...fresh], added: fresh.length };
}
