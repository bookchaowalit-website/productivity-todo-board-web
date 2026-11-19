"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { AppFoot, AppTop, ListButton, Pill, type Tone } from "@/components/app-shell";
import { addTodo, boardView, exportTodos, readBackup, restoreBackup, SAMPLE_TODOS, CATEGORIES, countTodos, MAX_TEXT, parseTodos, PRIORITIES, removalOf, restoreTodos, toggleTodo, type AreaFilter, type Category, type Filter, type Priority, type Removal, type RestoreResult } from "@/lib/todos";
import { useStoredState } from "@/lib/use-stored-state";

const STORE_KEY = "todo-board-v2";
const TONE: Record<Priority, Tone> = { high: "red", medium: "amber", low: "grey" };
const AREA_TONE: Record<Category, Tone> = { work: "green", personal: "amber", shopping: "grey" };
const label = (value: string) => value[0].toUpperCase() + value.slice(1);
const FILTERS: Filter[] = ["all", "active", "completed"];

const plural = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;
function importMessage({ added, replaced, droppedSamples, skipped }: RestoreResult): string {
  const restored = added + replaced;
  if (!restored) return skipped ? "Every task in that file is already on the board." : "Nothing new in that file.";
  const parts = [`Imported ${plural(restored)}.`];
  if (droppedSamples) parts.push(`Removed ${droppedSamples} unchanged sample ${droppedSamples === 1 ? "task" : "tasks"}.`);
  if (skipped) parts.push(`${plural(skipped)} already on the board ${skipped === 1 ? "was" : "were"} kept as ${skipped === 1 ? "it is" : "they are"}.`);
  return parts.join(" ");
}

export default function Home() {
  const [todos, setTodos] = useStoredState(STORE_KEY, SAMPLE_TODOS, parseTodos);
  const [area, setArea] = useState<AreaFilter>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<Category>("work");
  const [undo, setUndo] = useState<{ removal: Removal; message: string; viaKeyboard: boolean } | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // The last added task: highlighted in the list and named in a visible line under the composer.
  const [added, setAdded] = useState<{ id: string; message: string } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // A mouse or touch press that moves focus out of the composer must not collapse it before the click lands
  // (the rows would jump and the press could miss its button), so collapsing waits for the press to end.
  const pressing = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [backupNote, setBackupNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = boardView(todos, filter, area);
  const counts = countTodos(todos, area);
  const openIn = (value: AreaFilter) => countTodos(todos, value).active;

  // Removing with the keyboard moves focus to Undo (the focused Remove button is gone); the toast
  // never times out while it has focus. A mouse removal leaves focus where it was.
  useEffect(() => { if (undo?.viaKeyboard) undoRef.current?.focus(); }, [undo]);
  useEffect(() => {
    if (!undo || toastFocused) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo, toastFocused]);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 4000);
    return () => window.clearTimeout(timer);
  }, [added]);
  useEffect(() => {
    const down = () => { pressing.current = true; };
    const up = () => {
      pressing.current = false;
      // After the click that follows this pointerup has run.
      window.setTimeout(() => { if (!formRef.current?.contains(document.activeElement)) setComposerOpen(false); }, 0);
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);

  function chooseArea(next: AreaFilter) {
    setArea(next);
    if (next !== "all") setCategory(next);
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    const id = crypto.randomUUID();
    setTodos((current) => addTodo(current, text, priority, category, id));
    setAdded({ id, message: `Added “${text.trim()}” to ${label(category)} · ${label(priority)} priority.` });
    setText("");
    inputRef.current?.focus();
  }
  function remove(ids: Set<string>, message: string, viaKeyboard: boolean) {
    setUndo({ removal: removalOf(todos, ids), message, viaKeyboard });
    setTodos((current) => current.filter((todo) => !ids.has(todo.id)));
    setAnnouncement(`${message}. Undo is available for a few seconds.`);
  }
  function exportBackup() {
    const blob = new Blob([exportTodos(todos)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `todo-board-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupNote(`Exported ${todos.length} ${todos.length === 1 ? "task" : "tasks"}.`);
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Read and validate the whole file first; only then merge, onto the latest board (tasks added, ticked or
    // removed while the file was being read are kept).
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      setBackupNote("Could not read that file. Nothing was changed.");
      return;
    }
    const backup = readBackup(raw);
    if (!backup) {
      setBackupNote("That file is not a Todo Board backup. Nothing was changed.");
      return;
    }
    if (!backup.length) {
      setBackupNote("That backup has no tasks. Nothing was changed.");
      return;
    }
    let result: RestoreResult | undefined;
    flushSync(() => setTodos((current) => {
      result = restoreBackup(current, backup);
      return result.todos;
    }));
    setBackupNote(importMessage(result!));
  }
  function closeToast() {
    setUndo(null);
    setToastFocused(false);
    inputRef.current?.focus();
  }
  function restore() {
    if (!undo) return;
    const { removal } = undo;
    setTodos((current) => restoreTodos(current, removal));
    setAnnouncement(removal.length === 1 ? `Restored “${removal[0].item.text}”.` : `Restored ${removal.length} tasks.`);
    closeToast();
  }

  const title = area === "all" ? "All tasks" : label(area);
  const doneIds = new Set(todos.filter((todo) => todo.completed && (area === "all" || todo.category === area)).map((todo) => todo.id));

  return (
    <div className="as" data-toast={undo ? "true" : undefined}>
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Todo Board" tagline="Today’s tasks, highest priority first" />

      <div className="as-body">
        <aside className="as-side" aria-label="Lists">
          <p className="as-side-title" aria-hidden="true">Lists</p>
          <ul className="as-lists">
            <ListButton label="All tasks" count={openIn("all")} current={area === "all"} onSelect={() => chooseArea("all")} />
            {CATEGORIES.map((value) => (
              <ListButton key={value} label={label(value)} count={openIn(value)} tone={AREA_TONE[value]} current={area === value} onSelect={() => chooseArea(value)} />
            ))}
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{title}</h1>
              <p aria-live="polite">{counts.active} open · {counts.completed} done</p>
            </div>
            <div className="as-tools">
              <span className="as-tools-label" id="show-label">Show</span>
              <div className="as-segmented as-filter" role="group" aria-labelledby="show-label">
                {FILTERS.map((value) => (
                  <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label(value)} {counts[value]}</button>
                ))}
              </div>
            </div>
          </div>

          <form
            ref={formRef}
            className="as-composer"
            onSubmit={add}
            aria-label="Add a task"
            data-open={composerOpen || text ? "true" : undefined}
            onFocus={() => setComposerOpen(true)}
            onBlur={(event) => { if (!pressing.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerOpen(false); }}
          >
            <label className="as-field">New task
              <input ref={inputRef} value={text} maxLength={MAX_TEXT} onChange={(event) => setText(event.target.value)} placeholder="What needs doing?" autoComplete="off" aria-describedby="task-count" />
            </label>
            <p className="as-counter" id="task-count" data-near={text.length >= MAX_TEXT - 20 ? "true" : undefined}>
              {text.length}/{MAX_TEXT}<span className="as-sr"> characters</span>
            </p>
            <div className="as-composer-foot">
              <div className="as-chips">
                <div className="as-segmented-wrap">
                  <span id="priority-label">Priority</span>
                  <div className="as-segmented" role="group" aria-labelledby="priority-label">
                    {PRIORITIES.map((value) => (
                      <button key={value} type="button" aria-pressed={priority === value} onClick={() => setPriority(value)}>{label(value)}</button>
                    ))}
                  </div>
                </div>
                {area === "all" ? (
                  <div className="as-segmented-wrap">
                    <span id="area-label">List</span>
                    <div className="as-segmented" role="group" aria-labelledby="area-label">
                      {CATEGORIES.map((value) => (
                        <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{label(value)}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <button type="submit" className="as-button" disabled={!text.trim()}>Add</button>
            </div>
          </form>
          <p className="as-added" role="status">{added?.message ?? ""}</p>

          {visible.length ? (
            <ul className="as-list" aria-label={title}>
              {visible.map((todo) => (
                <li className="as-row as-row-check" key={todo.id} data-done={todo.completed ? "true" : undefined} data-new={added?.id === todo.id ? "true" : undefined}>
                  <label className="as-check">
                    <input type="checkbox" checked={todo.completed} onChange={() => setTodos((current) => toggleTodo(current, todo.id))} aria-label={`${todo.text}: mark as ${todo.completed ? "not done" : "done"}`} />
                    <span aria-hidden="true" />
                  </label>
                  <div>
                    <p className="as-row-title">{todo.text}</p>
                    <p>{label(todo.category)}</p>
                  </div>
                  <Pill tone={TONE[todo.priority]}>{label(todo.priority)}</Pill>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${todo.text}`} onClick={(event) => remove(new Set([todo.id]), `Removed “${todo.text}”`, event.detail === 0)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {counts.all === 0 ? (
                <><strong>No tasks yet</strong>Type a task above and press Add.</>
              ) : filter === "completed" ? (
                <><strong>Nothing done yet</strong>Tick a task when you finish it.</>
              ) : (
                <><strong>All done</strong>Every task in this list is complete.</>
              )}
            </div>
          )}

          {counts.completed > 0 ? (
            <div className="as-actions-row">
              <button type="button" className="as-plain" onClick={(event) => remove(doneIds, `Cleared ${doneIds.size} done ${doneIds.size === 1 ? "task" : "tasks"}`, event.detail === 0)}>Clear {counts.completed} done</button>
            </div>
          ) : null}

          <p className="as-note">Saved in this browser only. No account and nothing is uploaded. Export a backup before clearing browser data.</p>
          <div className="as-backup">
            <button type="button" className="as-plain" onClick={exportBackup}>Export JSON</button>
            <button type="button" className="as-plain" onClick={() => fileRef.current?.click()}>Import JSON</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} aria-label="Import a Todo Board backup" />
            <span role="status">{backupNote}</span>
          </div>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {undo ? (
        <div
          className="as-toast"
          role="group"
          aria-label="Undo"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{undo.message}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={restore}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/productivity-todo-board-web" />
    </div>
  );
}
