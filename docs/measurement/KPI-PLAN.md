---
title: "Todo Board — KPI and Instrumentation Plan"
status: approved
created: 2026-10-22
updated: 2026-10-23
description: "What would show that the Todo Board is used and works, which events are planned, and what is live today (only Sentry)."
template: architecture-docs templates/sdlc/kpi-and-instrumentation-plan.md
---

# Todo Board — KPI and Instrumentation Plan

## Document control

| Field | Value |
|---|---|
| Product | bookchaowalit-website/productivity-todo-board-web (https://todo-board.bookchaowalit.com) |
| Version / status | 0.1 / **approved** (2026-10-24) — definitions only; no analytics is live, no baselines |
| Metric owner | Owner (bookchaowalit) |
| AI maker | Claude Code (b-tier-b wave, 2026-10-22) |
| AI reviewer | independent Claude reviewer subagent (`solo:solo-reviewer`, Sonnet, read-only, no maker context), 2026-10-24: approved (see Approval) |
| Charter objectives | OBJ-01 below (Tier B showcase; no charter document) |
| Analytics source of truth | **None live.** Product analytics (PostHog) waits on owner decision D4. `@vercel/analytics` is a dependency but is not mounted in `app/layout.tsx`. Sentry (org `personal-yu0`, project `productivity-todo-board-web`) is the only live signal, and only once production is redeployed from `main` (D9; the live D9a patch build `dc88df4` predates Sentry). |
| Dashboard | none |
| Next review | 2026-11-15 (Milestone M1) |

## KPI tree

```text
OBJ-01 A visitor can capture tasks and finish them in the browser without errors
  └─ KPI-O-01 Task completion rate: tasks completed / tasks added
       ├─ KPI-L-01 Capture rate: sessions with todo_added / sessions with a page view
       ├─ KPI-L-02 Return rate: visitors who come back within 7 days with stored tasks
       └─ KPI-G-01 Front-end error rate: sessions with a Sentry error / sessions (must stay low)
```

## KPI definitions

| KPI ID | Type | Name | Formula | Unit | Min volume | Source and events | Baseline | Target | Alert | Cadence | Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KPI-O-01 | outcome | Task completion rate | `todo_completed` / `todo_added` | % | ≥ 100 adds / period | planned events | not yet measured | set after baseline | — | monthly | Owner |
| KPI-L-01 | leading | Capture rate | sessions with `todo_added` / sessions with page view | % | ≥ 200 sessions | planned events | not yet measured | set after baseline | — | monthly | Owner |
| KPI-L-02 | leading | Return rate | visitors with `board_loaded` (stored tasks > 0) within 7 days of their first `todo_added` / visitors with `todo_added` | % | ≥ 100 visitors | planned events | not yet measured | set after baseline | — | monthly | Owner |
| KPI-G-01 | guardrail | Front-end error rate | sessions with a Sentry error / sessions | % | ≥ 200 sessions | Sentry (live after D9 redeploy) + session count (needs analytics) | not yet measured | < 1% | any new unhandled error issue | weekly | Owner |

Below the minimum volume a rate is reported as "not measurable". Today every KPI is not measurable: there are no events.

## Event and data specification

| Event | Trigger | Properties | Personal data? | Emitted by | Status |
|---|---|---|---|---|---|
| `todo_added` | Add form submitted with valid text | `priority`, `category` (never the task text) | no | frontend | planned (needs D4) |
| `todo_completed` | Checkbox ticked to done | `priority`, `category` | no | frontend | planned (needs D4) |
| `board_loaded` | Board hydrated from localStorage | `stored_count` | no | frontend | planned (needs D4) |
| `filter_changed` | Status tab or area select changed | `status`, `area` | no | frontend | planned (needs D4) |
| Sentry error event | Unhandled error in browser, Node or Edge runtime | stack trace only; request, user, breadcrumbs, extra and frame locals are stripped (`lib/sentry.ts`) | no | Sentry SDK | implemented on `main` (`554af81`), not yet deployed (D9) |

Privacy: no names, emails, free text or IDs. Events carry only priority, category, filter and counts; task text is free text and is never sent. KPI-L-02 needs a pseudonymous visitor ID, which is personal data. If an analytics vendor
sets a cookie or device ID, that is personal data under PDPA and needs a consent decision first (part of D4).

## Dashboards and alerts

| Dashboard / alert | KPIs | Location | Status |
|---|---|---|---|
| Sentry issue alerts | KPI-G-01 | Sentry project `productivity-todo-board-web` | planned (project exists; alert rule not set) |
| Product dashboard | KPI-O-01, KPI-L-01, KPI-L-02 | — | planned (needs D4) |

## Instrumentation verification (before G10)

| # | Check | Result |
|---|---|---|
| 1 | Events fire once per action | not run: no events implemented |
| 2 | Counts reconcile | not applicable: the only store is each visitor's localStorage |
| 3 | No PII in payloads | Sentry scrubbing unit-tested (`lib/sentry.test.ts`); analytics not implemented |
| 4 | Dashboard renders | not set up |
| 5 | Alerts fire | not set up |
| 6 | Baselines captured | waived — dated action: capture 30 days of baseline after D4 and D9, review 2026-12-31 |
| 7 | Consent respected | not applicable until analytics exists |

## Change history of definitions

| Date | KPI ID | Change | Reason | Baseline restated? | Approved by |
|---|---|---|---|---|---|
| 2026-10-22 | all | First draft | Big Loop L3 | no | pending owner |

## Approval (2026-10-24)

| Field | Value |
|---|---|
| Checker | independent Claude reviewer subagent (`solo:solo-reviewer`, Sonnet, read-only, no maker context) |
| Approver | AI approval under the owner's process (approvals by the owner or AI with evidence; maker and checker are different agents). Recorded by Claude session oa-remainder on the owner's instruction "ทำที่เหลือให้หน่อย" (2026-10-24) |
| Verdict | **approved** |
| Evidence | Sentry commit 554af81 newer than deployed dc88df4 (as stated); lib/sentry.ts + test; no planned events in code; @vercel/analytics not mounted. |
