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
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
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
