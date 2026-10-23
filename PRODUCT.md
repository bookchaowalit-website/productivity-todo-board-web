# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing Next.js App Router, TypeScript, Tailwind CSS, and browser `localStorage` persistence.

## Users

Inferred from `README.md`; user confirmation pending. A solo operator who needs a lightweight place to capture and triage personal tasks while working in one browser.

## Product Purpose

Inferred from `README.md`; user confirmation pending. Capture tasks, mark them complete, and keep attention on the right work through priority, category, and all/active/completed filters.

## Positioning

Inferred from the implementation; user confirmation pending. A local-first, single-user task board that stays useful without an account, team backend, or multi-tenant claims.

## Operating Context

Inferred from the implementation; user confirmation pending. A quick browser session where a person adds a task, chooses priority and category, works from the active view, then checks off or removes finished work.

## Capabilities and Constraints

- Add tasks with text, priority (`high`, `medium`, `low`), and category (`work`, `personal`, `shopping`).
- Filter all, active, or completed tasks.
- Toggle completion and delete tasks.
- Filter by area (work / personal / shopping); open work sorts high → low priority, completed items sink; clear completed.
- Persist state in browser `localStorage` only.
- `/api/mcp` answers JSON-RPC with one tool, `get_app_info`, that returns the app's public descriptor.
- Front-end errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.
- Not a multi-user SaaS, synchronized task service, or payroll/enterprise workflow.

## What Does Not Work (must not be claimed)

Checked against the portfolio card claims review (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`,
row `todo-board`) on 2026-10-22. The card claimed the items below; none exists in the code, and the review downgraded
the card from Live to Prototype:

- One list only: no multiple boards.
- No drag-and-drop ordering (order comes from priority).
- No due dates, no keyboard shortcuts beyond normal form/button keyboard use.
- No export/import, no sync, no account; clearing site data deletes the tasks.
- No product analytics are live.

## Live URL and Deploy State

- Live: https://todo-board.bookchaowalit.com (HTTP 200 on 2026-10-22).
- The Vercel project is still linked to the old repository name (`bookchaowalit/bookchaowalit-todo-board-frontend`), so
  a push to `main` does not deploy. Production runs the Next.js security patch build (`dc88df4`, deployed by CLI on
  2026-10-23, owner-approved D9a). Later commits on `main` (shared CI, Sentry, dependency fixes, docs) wait until the
  owner reconnects Vercel Git to this repository (owner action D9). Until then the live site has no Sentry.

## Evidence on Hand

- Existing runnable interface in `app/page.tsx`.
- README feature list and limitations.
- No backend, account system, remote sync, or external task data is present.

## Product Principles

- Capture should be immediate.
- Priority should be legible at a glance.
- Local state should be honest and reversible.
- Filters should reduce attention cost, not add ceremony.

