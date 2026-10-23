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

  it("removes local variables (which can hold task text) from stack frames", () => {
    const event = scrubEvent({
      exception: { values: [{ type: "Error", stacktrace: { frames: [{ function: "addTodo", vars: { text: "private" } }] } }] },
    });
    const frame = event.exception?.values?.[0]?.stacktrace?.frames?.[0] as { function?: string; vars?: unknown } | undefined;
    expect(frame?.function).toBe("addTodo");
    expect(frame?.vars).toBeUndefined();
  });
});
