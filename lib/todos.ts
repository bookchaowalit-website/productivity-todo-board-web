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

/** The sample board a first visit starts with (also what a cleared browser starts with again). */
export const SAMPLE_TODOS: Todo[] = [
  { id: "1", text: "Complete project proposal", completed: false, priority: "high", category: "work" },
  { id: "2", text: "Buy groceries", completed: false, priority: "medium", category: "shopping" },
  { id: "3", text: "Morning workout", completed: true, priority: "low", category: "personal" },
];

/** Backup file: the board as pretty JSON, read back by readBackup. */
export function exportTodos(todos: Todo[]): string {
  return JSON.stringify(todos, null, 2);
}

/**
 * Validate a backup file before touching the board. Returns null when it is not a Todo Board backup: not JSON,
 * not an array, or a non-empty array without a single valid task (e.g. another app's export). Text is cleaned
 * the same way as typed tasks; tasks whose text is empty after cleaning are dropped.
 */
export function readBackup(raw: string): Todo[] | null {
  const parsed = parseTodos(raw);
  if (!parsed) return null;
  let data: unknown[] = [];
  try { data = JSON.parse(raw) as unknown[]; } catch { return null; }
  if (data.length > 0 && parsed.length === 0) return null;
  return parsed.map((todo) => ({ ...todo, text: cleanText(todo.text) })).filter((todo) => todo.text);
}

const sameTodo = (a: Todo, b: Todo) => a.text === b.text && a.completed === b.completed && a.priority === b.priority && a.category === b.category;
/** A sample task nobody has changed since the board started (same id and same fields as in SAMPLE_TODOS). */
export function isUntouchedSample(todo: Todo, samples: Todo[] = SAMPLE_TODOS): boolean {
  const sample = samples.find((item) => item.id === todo.id);
  return Boolean(sample && sameTodo(sample, todo));
}

/** droppedIds: the unchanged samples the restore removed, so the page can offer Undo for them. */
export type RestoreResult = { todos: Todo[]; added: number; replaced: number; droppedSamples: number; droppedIds: Set<string>; skipped: number };

/**
 * Apply a validated backup to the latest board (call inside a functional state update).
 * - The backup wins over untouched samples: a backup task with a sample's id replaces it, and untouched samples
 *   the backup does not have are dropped (the backup is the person's real board; the samples were never theirs).
 * - Every other task on the board is kept as it is; a backup task whose id is already there is skipped.
 * - Tasks with new ids are added after the board's tasks, in backup order.
 * An empty backup changes nothing (it never wipes the samples on its own).
 */
export function restoreBackup(todos: Todo[], backup: Todo[], samples: Todo[] = SAMPLE_TODOS): RestoreResult {
  if (!backup.length) return { todos, added: 0, replaced: 0, droppedSamples: 0, droppedIds: new Set(), skipped: 0 };
  const incoming = new Map(backup.map((todo) => [todo.id, todo]));
  let replaced = 0;
  let droppedSamples = 0;
  const droppedIds = new Set<string>();
  let skipped = 0;
  const used = new Set<string>();
  const kept: Todo[] = [];
  for (const todo of todos) {
    const fromBackup = incoming.get(todo.id);
    if (isUntouchedSample(todo, samples)) {
      if (fromBackup) {
        used.add(todo.id);
        if (sameTodo(fromBackup, todo)) kept.push(todo);
        else { kept.push(fromBackup); replaced += 1; }
      } else { droppedSamples += 1; droppedIds.add(todo.id); }
      continue;
    }
    if (fromBackup) { used.add(todo.id); skipped += 1; }
    kept.push(todo);
  }
  const fresh = backup.filter((todo) => !used.has(todo.id));
  return { todos: [...kept, ...fresh], added: fresh.length, replaced, droppedSamples, droppedIds, skipped };
}
