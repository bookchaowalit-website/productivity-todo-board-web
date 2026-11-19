import { describe, expect, it } from "vitest";
import { addTodo, exportTodos, readBackup, restoreBackup, SAMPLE_TODOS, deleteTodo, boardView, MAX_TEXT, clearCompleted, countTodos, parseTodos, removalOf, restoreTodos, toggleTodo, type Todo } from "./todos";

const todos: Todo[] = [
  { id: "1", text: "low open", completed: false, priority: "low", category: "work" },
  { id: "2", text: "high done", completed: true, priority: "high", category: "work" },
  { id: "3", text: "high open", completed: false, priority: "high", category: "personal" },
  { id: "4", text: "medium open", completed: false, priority: "medium", category: "shopping" },
];

describe("boardView", () => {
  it("sorts open work by priority and sinks completed items", () => {
    expect(boardView(todos, "all").map((t) => t.id)).toEqual(["3", "4", "1", "2"]);
  });

  it("filters active and completed", () => {
    expect(boardView(todos, "active").map((t) => t.id)).toEqual(["3", "4", "1"]);
    expect(boardView(todos, "completed").map((t) => t.id)).toEqual(["2"]);
  });
});

describe("mutations", () => {
  it("adds trimmed todos and ignores blanks", () => {
    expect(addTodo([], "  ", "low", "work", "x")).toEqual([]);
    expect(addTodo([], " Call ", "high", "personal", "x")[0]).toEqual({ id: "x", text: "Call", completed: false, priority: "high", category: "personal" });
  });

  it("toggles, counts, and clears completed", () => {
    const toggled = toggleTodo(todos, "1");
    expect(countTodos(toggled)).toEqual({ all: 4, active: 2, completed: 2 });
    expect(clearCompleted(toggled).map((t) => t.id)).toEqual(["3", "4"]);
  });
});

describe("parseTodos", () => {
  it("keeps valid items only", () => {
    expect(parseTodos(JSON.stringify([todos[0], { ...todos[1], priority: "urgent" }]))).toEqual([todos[0]]);
    expect(parseTodos("x")).toBeNull();
  });
});

describe("area filter", () => {
  const todos: Todo[] = [
    { id: "w1", text: "Ship", completed: false, priority: "low", category: "work" },
    { id: "p1", text: "Run", completed: true, priority: "high", category: "personal" },
    { id: "w2", text: "Review", completed: false, priority: "high", category: "work" },
  ];

  it("limits the board to one area and keeps priority order", () => {
    expect(boardView(todos, "all", "work").map((todo) => todo.id)).toEqual(["w2", "w1"]);
    expect(boardView(todos, "completed", "work")).toEqual([]);
    expect(boardView(todos, "all", "all")).toHaveLength(3);
  });

  it("counts tabs within the selected area", () => {
    expect(countTodos(todos, "work")).toEqual({ all: 2, active: 2, completed: 0 });
    expect(countTodos(todos, "personal")).toEqual({ all: 1, active: 0, completed: 1 });
    expect(countTodos(todos)).toEqual({ all: 3, active: 2, completed: 1 });
  });
});

describe("edge cases", () => {
  it("ignores a todo made only of zero-width characters", () => {
    expect(addTodo([], "\u200B\u200D\uFEFF", "high", "work", "x")).toEqual([]);
  });

  it("never cuts an emoji in half at MAX_TEXT", () => {
    const [todo] = addTodo([], `${"a".repeat(MAX_TEXT - 1)}✅🚀`, "low", "work", "x");
    expect(todo.text).toBe(`${"a".repeat(MAX_TEXT - 1)}✅`);
    const [cut] = addTodo([], `${"a".repeat(MAX_TEXT - 1)}🚀`, "low", "work", "x");
    expect(cut.text).toBe("a".repeat(MAX_TEXT - 1));
  });

  it("drops stored todos that repeat an id (one click toggled both)", () => {
    const item = { id: "a", text: "One", completed: false, priority: "high", category: "work" };
    expect(parseTodos(JSON.stringify([item, { ...item, text: "Two" }]))?.map((t) => t.text)).toEqual(["One"]);
  });
});

describe("delete and serialized-data round trip", () => {
  it("deletes only the chosen task without mutating the original board", () => {
    expect(deleteTodo(todos, "1").map(todo => todo.id)).toEqual(["2", "3", "4"]);
    expect(deleteTodo(todos, "missing")).toEqual(todos);
    expect(todos).toHaveLength(4);
  });

  it("restores additions, completions, priorities and categories from stored JSON", () => {
    const storage = new Map<string, string>();
    const saved = deleteTodo(toggleTodo(addTodo(todos, "Ship", "high", "personal", "new"), "new"), "1");
    storage.set("todo-board-v2", JSON.stringify(saved));
    expect(parseTodos(storage.get("todo-board-v2") ?? null)).toEqual(saved);
    expect(parseTodos("[]")).toEqual([]);
    expect(parseTodos(null)).toBeNull();
    expect(parseTodos("{} ")).toBeNull();
  });
});

describe("undo (removalOf / restoreTodos)", () => {
  const t = (id: string, completed = false): Todo => ({ id, text: id, completed, priority: "medium", category: "work" });
  const list = [t("a"), t("b", true), t("c"), t("d", true)];

  it("restores one removed todo before its old neighbour even after a new todo was added on top", () => {
    const removal = removalOf(list, new Set(["c"]));
    const after = [t("new"), ...list.filter((todo) => todo.id !== "c")];
    expect(restoreTodos(after, removal).map((todo) => todo.id)).toEqual(["new", "a", "b", "c", "d"]);
  });

  it("restores a cleared group in place, and appends when the neighbour is gone", () => {
    const ids = new Set(["b", "d"]);
    const removal = removalOf(list, ids);
    expect(removal.map((r) => [r.item.id, r.beforeId])).toEqual([["b", "c"], ["d", null]]);
    expect(restoreTodos(list.filter((todo) => !ids.has(todo.id)), removal).map((todo) => todo.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("never duplicates a todo that is already back", () => {
    expect(restoreTodos(list, removalOf(list, new Set(["a"]))).length).toBe(4);
  });
});

describe("backup", () => {
  const mine: Todo = { id: "a", text: "One", completed: false, priority: "low", category: "work" };
  it("readBackup accepts an export, keeps each task's text unchanged, and rejects files that are not a todo list", () => {
    expect(readBackup(exportTodos([mine]))).toEqual([mine]);
    // Text from an older version that today's typing rules would trim, cut at MAX_TEXT or strip of a ZWJ.
    const long = "x".repeat(MAX_TEXT + 20);
    const kept = [{ ...mine, text: "  One  " }, { ...mine, id: "b", text: long }, { ...mine, id: "c", text: "👩\u200D💻 pair" }];
    expect(readBackup(exportTodos(kept))).toEqual(kept);
    // Nothing visible: dropped.
    expect(readBackup(exportTodos([{ ...mine, text: " \u200B " }]))).toEqual([]);
    expect(readBackup("[]")).toEqual([]);
    expect(readBackup("{}")).toBeNull();
    expect(readBackup("nope")).toBeNull();
    // A non-empty array with no valid task (another app's export) is the wrong format, not "all duplicates".
    expect(readBackup(JSON.stringify([{ id: "x", title: "Other app" }]))).toBeNull();
  });

  it("adds new ids and skips ids already on the board", () => {
    const result = restoreBackup([mine], [mine, { ...mine, id: "b", text: "Two" }], []);
    expect(result.todos.map((t) => t.text)).toEqual(["One", "Two"]);
    expect(result).toMatchObject({ added: 1, skipped: 1, replaced: 0, droppedSamples: 0 });
  });

  it("on a fresh sample board the backup wins: same-id samples are replaced, missing samples do not come back", () => {
    const backup: Todo[] = [{ ...SAMPLE_TODOS[1], completed: true }, mine];
    const result = restoreBackup(SAMPLE_TODOS, backup);
    expect(result.todos).toEqual([{ ...SAMPLE_TODOS[1], completed: true }, mine]);
    expect(result).toMatchObject({ added: 1, replaced: 1, droppedSamples: 2 });
  });

  it("an edited sample counts as the person's task and is kept over the backup copy", () => {
    const edited = { ...SAMPLE_TODOS[0], text: "Proposal v2" };
    const result = restoreBackup([edited, SAMPLE_TODOS[1]], [SAMPLE_TODOS[0], mine]);
    expect(result.todos).toEqual([edited, mine]);
    expect(result).toMatchObject({ skipped: 1, droppedSamples: 1, added: 1 });
  });

  it("an empty backup changes nothing", () => {
    expect(restoreBackup(SAMPLE_TODOS, []).todos).toBe(SAMPLE_TODOS);
  });
});
