// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

// Mounted tests for the todo board on the App shell: lists, filters, add, check, remove, undo, focus.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-row .as-row-title")].map((h) => h.textContent);
const press = (el: Element, detail = 0) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
function type(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const stored = () => JSON.parse(localStorage.getItem("todo-board-v2") ?? "[]") as { text: string; priority: string; category: string; completed: boolean }[];

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("server render", () => {
  it("shows the sample board with lists, priority pills and the local-only note", () => {
    const html = renderToString(<Home />);
    expect(html).toContain('class="as"');
    expect(html).toContain("Complete project proposal");
    expect(html).toMatch(/data-tone="red"[^>]*>High</);
    expect(html).toContain("Saved in this browser only");
    expect(html).not.toMatch(/dispatch/i);
  });
});

describe("adding", () => {
  it("keeps Add disabled until there is text, adds with the chosen priority and list, and keeps focus in the field", () => {
    const input = $<HTMLInputElement>(".as-composer input")!;
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    type(input, "Call the bank");
    press(button("High", $(".as-composer")!));
    press(button("Personal", $(".as-composer")!));
    press(button("Add", $(".as-composer")!));
    expect(stored()[0]).toMatchObject({ text: "Call the bank", priority: "high", category: "personal", completed: false });
    expect(rows()[0]).toBe("Call the bank");
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("");
  });

  it("inside a list, new tasks go to that list and the list picker is hidden", () => {
    press(button("Shopping", $(".as-side")!));
    expect($("h1")!.textContent).toBe("Shopping");
    expect($('[aria-labelledby="area-label"]')).toBeNull();
    type($<HTMLInputElement>(".as-composer input")!, "Milk");
    press(button("Add", $(".as-composer")!));
    expect(stored()[0].category).toBe("shopping");
    expect(rows()).toEqual(["Milk", "Buy groceries"]);
  });
});

describe("filters and checking", () => {
  it("ticking a task moves it to Completed and updates the counts", () => {
    act(() => { $<HTMLInputElement>('[aria-label="Buy groceries: mark as done"]')!.click(); });
    expect($(".as-head p")!.textContent).toBe("1 open · 2 done");
    press(button("Completed"));
    expect(rows()).toEqual(["Buy groceries", "Morning workout"]);
    press(button("Active"));
    expect(rows()).toEqual(["Complete project proposal"]);
  });

  it("shows the right empty state for each case", () => {
    press(button("Personal", $(".as-side")!));
    press(button("Active"));
    expect(host.textContent).toContain("All done");
    press(button("Work", $(".as-side")!));
    press(button("Completed"));
    expect(host.textContent).toContain("Nothing done yet");
    press(button("All", $(".as-tools")!));
    press($('[aria-label="Remove Complete project proposal"]')!, 1);
    expect(host.textContent).toContain("No tasks yet");
  });
});

describe("remove, clear and undo", () => {
  it("a keyboard removal focuses Undo, and Undo puts the task back in place and focuses the task field", () => {
    press($('[aria-label="Remove Buy groceries"]')!, 0);
    expect(rows()).not.toContain("Buy groceries");
    expect(document.activeElement?.textContent).toBe("Undo");
    press(button("Undo"));
    expect(rows()).toEqual(["Complete project proposal", "Buy groceries", "Morning workout"]);
    expect(document.activeElement).toBe($(".as-composer input"));
  });

  it("Clear done removes completed tasks in the list and Undo restores them", () => {
    press(button("Clear 1 done"), 1);
    expect(rows()).toEqual(["Complete project proposal", "Buy groceries"]);
    expect($(".as-toast")!.textContent).toContain("Cleared 1 done task");
    press(button("Undo"));
    expect(rows()).toContain("Morning workout");
  });

  it("Escape dismisses without restoring; a mouse removal times out after six seconds", () => {
    press($('[aria-label="Remove Buy groceries"]')!, 0);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    expect(rows()).not.toContain("Buy groceries");

    vi.useFakeTimers();
    press($('[aria-label="Remove Morning workout"]')!, 1);
    expect(document.activeElement?.textContent).not.toBe("Undo");
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });
});

describe("2026-11-19 review fixes", () => {
  it("has one h1 as the first heading and no skipped levels in the rows", () => {
    const headings = [...host.querySelectorAll("h1, h2, h3, h4")].map((h) => h.tagName);
    expect(headings[0]).toBe("H1");
    expect(headings).not.toContain("H3");
  });

  it("shows a character counter tied to the task field", () => {
    const input = $<HTMLInputElement>(".as-composer input")!;
    expect(input.getAttribute("aria-describedby")).toBe("task-count");
    type(input, "x".repeat(125));
    expect($("#task-count")!.textContent).toBe("125/140 characters");
    expect($("#task-count")!.dataset.near).toBe("true");
  });

  it("names a new task in a visible status line and highlights its row, even when it sorts below others", () => {
    vi.useFakeTimers();
    type($<HTMLInputElement>(".as-composer input")!, "Water plants");
    press(button("Low", $(".as-composer")!));
    press(button("Add", $(".as-composer")!));
    expect($(".as-added")!.textContent).toBe("Added “Water plants” to Work · Low priority.");
    const row = $('.as-row[data-new="true"]')!;
    expect(row.textContent).toContain("Water plants");
    act(() => { vi.advanceTimersByTime(4000); });
    expect($('.as-row[data-new="true"]')).toBeNull();
    expect($(".as-added")!.textContent).toBe("");
  });

  it("marks the composer open while it has focus so phones can hide Priority and List until then", () => {
    const form = $<HTMLFormElement>(".as-composer")!;
    expect(form.dataset.open).toBeUndefined();
    act(() => { $<HTMLInputElement>(".as-composer input")!.focus(); });
    expect(form.dataset.open).toBe("true");
  });

  it("flags the page while the Undo toast shows so the body leaves room under it", () => {
    press($('[aria-label="Remove Buy groceries"]')!, 1);
    expect($(".as")!.dataset.toast).toBe("true");
  });

  const choose = async (contents: string | Error) => {
    const input = $<HTMLInputElement>('input[type="file"]')!;
    const file = new File([typeof contents === "string" ? contents : ""], "backup.json", { type: "application/json" });
    if (contents instanceof Error) Object.defineProperty(file, "text", { value: () => Promise.reject(contents) });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  };

  it("restoring onto the untouched sample board lets the backup win", async () => {
    await choose(JSON.stringify([{ id: "2", text: "Buy groceries", completed: true, priority: "medium", category: "shopping" }, { id: "z", text: "Renew passport", completed: false, priority: "high", category: "personal" }]));
    expect(host.textContent).toContain("Imported 2 tasks. Removed 2 unchanged sample tasks.");
    expect(rows()).toEqual(["Renew passport", "Buy groceries"]);
    expect(stored().find((t) => t.text === "Buy groceries")!.completed).toBe(true);
  });

  it("keeps the person's own and edited tasks, adds only new ones", async () => {
    act(() => { $<HTMLInputElement>('[aria-label="Buy groceries: mark as done"]')!.click(); });
    await choose(JSON.stringify([{ id: "2", text: "Buy groceries", completed: false, priority: "medium", category: "shopping" }, { id: "z", text: "Renew passport", completed: false, priority: "high", category: "personal" }]));
    expect(rows()).toContain("Renew passport");
    expect(stored().find((t) => t.text === "Buy groceries")!.completed).toBe(true);
    expect(host.textContent).toContain("1 task already on the board was kept as it is.");
  });

  it("rejects a file that is not a backup or cannot be read, without changing the board", async () => {
    const before = rows();
    await choose("not json");
    expect(host.textContent).toContain("That file is not a Todo Board backup.");
    await choose(JSON.stringify([{ id: "x", title: "Other app" }]));
    expect(host.textContent).toContain("That file is not a Todo Board backup.");
    await choose(new Error("gone"));
    expect(host.textContent).toContain("Could not read that file. Nothing was changed.");
    expect(rows()).toEqual(before);
  });

  it("keeps the composer open during a press outside it and collapses once the press ends", () => {
    vi.useFakeTimers();
    const form = $<HTMLFormElement>(".as-composer")!;
    const input = $<HTMLInputElement>(".as-composer input")!;
    act(() => { input.focus(); });
    act(() => { window.dispatchEvent(new Event("pointerdown")); });
    act(() => { input.blur(); });
    expect(form.dataset.open).toBe("true");
    act(() => { window.dispatchEvent(new Event("pointerup")); vi.advanceTimersByTime(0); });
    expect(form.dataset.open).toBeUndefined();
  });

  it("keeps the Added live region in the page while it is empty", () => {
    expect($('.as-added[role="status"]')).not.toBeNull();
    expect($(".as-added")!.textContent).toBe("");
  });

  it("exports the board as a JSON download", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    press(button("Export JSON"));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Exported 3 tasks.");
    click.mockRestore();
  });
});

describe("final Codex round: import safety", () => {
  const pick = (file: File) => {
    const input = $<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const backup = JSON.stringify([
    { id: "2", text: "Buy groceries", completed: false, priority: "medium", category: "shopping" },
    { id: "z", text: "Renew passport", completed: false, priority: "high", category: "personal" },
  ]);

  it("a task removed while the file is being read stays removed", async () => {
    let finish!: (text: string) => void;
    const file = new File([""], "backup.json");
    Object.defineProperty(file, "text", { value: () => new Promise<string>((resolve) => { finish = resolve; }) });
    await act(async () => { pick(file); });
    press($('[aria-label="Remove Buy groceries"]')!, 1);
    await act(async () => { finish(backup); });
    expect(rows()).not.toContain("Buy groceries");
    expect(rows()).toContain("Renew passport");
  });

  it("samples removed by an import come back with Undo", async () => {
    const file = new File([backup], "backup.json");
    await act(async () => { pick(file); });
    expect(rows()).toEqual(["Renew passport", "Buy groceries"]);
    expect($(".as-toast")!.textContent).toContain("Import removed 2 sample tasks");
    press(button("Undo"));
    expect(rows()).toEqual(expect.arrayContaining(["Complete project proposal", "Buy groceries", "Morning workout", "Renew passport"]));
    expect(rows()).toHaveLength(4);
  });

  it("an import the browser refuses to save shows a visible error", async () => {
    const real = window.localStorage;
    const spy = vi.spyOn(window, "localStorage", "get").mockReturnValue(new Proxy(real, {
      get(target, prop) {
        if (prop === "setItem") return () => { throw new DOMException("full", "QuotaExceededError"); };
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    }));
    await act(async () => { pick(new File([backup], "backup.json")); });
    spy.mockRestore();
    expect($('[role="alert"]')!.textContent).toContain("Could not save to this browser’s storage");
  });

  it("a ticked new row keeps 4.5:1 for its title on the highlight", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/app/app-shell.css`, "utf8");
    expect(css).toMatch(/\.as-row\[data-new="true"\]\[data-done="true"\] \.as-row-title \{ color: var\(--as-grey\); \}/);
  });
});
