import { describe, expect, it } from "vitest";
import { scrubEvent, sentryOptions } from "./sentry";

describe("sentryOptions", () => {
  it("stays disabled when no DSN is configured", () => {
    expect(sentryOptions(undefined).enabled).toBe(false);
    expect(sentryOptions("").enabled).toBe(false);
  });

  it("reports errors only: no PII, tracing, trace headers or breadcrumbs", () => {
    const options = sentryOptions("https://key@o0.ingest.sentry.io/1");
    expect(options.enabled).toBe(true);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracePropagationTargets).toEqual([]);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options.beforeSendTransaction()).toBeNull();
  });
});

describe("scrubEvent", () => {
  it("drops request data, user, breadcrumbs and extra context", () => {
    const event = scrubEvent({
      message: "boom",
      request: { url: "https://todo-board.bookchaowalit.com/?token=secret", headers: { cookie: "a=b" } },
      user: { ip_address: "1.2.3.4", email: "x@example.com" },
      breadcrumbs: [{ message: "added todo: buy milk" }],
      extra: { todos: "[{\"text\":\"private\"}]" },
    });
    expect(event.message).toBe("boom");
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
  });

  it("drops the request path that captureRequestError adds and strips query strings", () => {
    const event = scrubEvent({
      transaction: "GET /search?q=private&token=secret",
      tags: { url: "https://todo-board.bookchaowalit.com/search?q=private", route: "/search?q=private" },
      contexts: {
        nextjs: { request_path: "/search?q=private", router_kind: "App Router", route_type: "render" },
        trace: { trace_id: "t" },
        runtime: { name: "node" },
      },
    });
    expect(event.transaction).toBe("GET /search");
    expect(event.tags).toEqual({ route: "/search" });
    expect(event.contexts).toEqual({ runtime: { name: "node" } });
    expect(JSON.stringify(event)).not.toContain("private");
  });

  it("strips query strings from URLs in the exception message, frames and debug images", () => {
    const event = scrubEvent({
      exception: {
        values: [{
          value: "Failed to fetch https://example.com/api?token=secret (from /page?q=private#frag)",
          stacktrace: { frames: [{ filename: "https://example.com/app.js?v=private", abs_path: "/page?q=private" }] },
        }],
      },
      debug_meta: { images: [{ code_file: "https://example.com/chunk.js?private=1" }] },
    });
    const value = event.exception?.values?.[0];
    expect(value?.value).toBe("Failed to fetch https://example.com/api (from /page)");
    expect(value?.stacktrace?.frames?.[0]).toEqual({ filename: "https://example.com/app.js", abs_path: "/page" });
    expect(event.debug_meta?.images?.[0]?.code_file).toBe("https://example.com/chunk.js");
    expect(JSON.stringify(event)).not.toContain("private");
  });

  it("removes local variables (which can hold task text) from stack frames", () => {
    const event = scrubEvent({
      exception: { values: [{ type: "Error", stacktrace: { frames: [{ function: "addTodo", vars: { text: "private" } }] } }] },
    });
    const frame = event.exception?.values?.[0]?.stacktrace?.frames?.[0] as { function?: string; vars?: unknown } | undefined;
    expect(frame?.function).toBe("addTodo");
    expect(frame?.vars).toBeUndefined();
  });
});
