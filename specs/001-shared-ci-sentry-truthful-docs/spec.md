---
title: "SPEC-001 — Shared CI, Sentry, scan fixes and truthful docs"
status: implemented
tags: [spec, sdd, tdd, ci, sentry, security, docs]
created: 2026-10-22
updated: 2026-10-23
description: "Move to the shared CI and security scan, report front-end errors to Sentry without personal data, clear the scan's dependency findings, and make README/PRODUCT/TRUTH-PASS match the code."
---

# SPEC-001 — Shared CI, Sentry, scan fixes and truthful docs

Standard: ADR-0004 (TDD + SDD). Plan: Big Loop, b-tier-b wave (target L3).

## Document control

| Field | Value |
|---|---|
| Spec ID / version | SPEC-001 / 1.0 |
| Status | implemented |
| Repository | bookchaowalit-website/productivity-todo-board-web |
| Owner (maker) | Claude Code (b-tier-b repo agent) |
| Approver | Owner (bookchaowalit) |

## 1. Problem and intent

- **Problem:** CI was a hand-written job with no security scan; no error reporting; the portfolio card claimed multiple
  boards, drag-and-drop, due dates, keyboard shortcuts and export/import that do not exist; TRUTH-PASS recorded the title
  as "or"; once the shared security scan ran, it failed on dev-dependency advisories (vitest 3, tinypool, vite,
  brace-expansion) and on `source-map-js` (Trivy and OSV).
- **Outcome:** every push and PR to `main` runs the shared Node CI and the shared security scan, fail-closed; browser and
  server errors reach Sentry with personal data (including task text) stripped; the docs say what the app does and does not do.

## 2. Behaviour — acceptance criteria

| AC | Given / When / Then | Test |
|---|---|---|
| AC-01 | Sentry is off when `NEXT_PUBLIC_SENTRY_DSN` is unset or empty | `lib/sentry.test.ts` "stays disabled" |
| AC-02 | With a DSN: errors only (no PII, tracing, trace headers, breadcrumbs, transactions) | `lib/sentry.test.ts` "reports errors only" |
| AC-03 | Before send, request, user, breadcrumbs and extra are removed | `lib/sentry.test.ts` "drops request data …" |
| AC-04 | Stack-frame locals (which can hold task text) are removed | `lib/sentry.test.ts` "removes local variables …" |
| AC-04b | Only platform contexts (os, runtime, browser, device, app) are kept, so `contexts.nextjs.request_path` is dropped; query strings are stripped from `transaction` and tags, and the `url` tag is removed (security review 2026-10-23) | `lib/sentry.test.ts` "drops the request path …" (red 1/5 against the first scrubber, then green) |
| AC-03c | ?query and #hash are stripped from URLs in `exception.values[].value`, frame `filename`/`abs_path` and `debug_meta.images[].code_file` (second security review 2026-10-23) | `lib/sentry.test.ts` "strips query strings from URLs in the exception message, frames and debug images" (red 5/6 against the previous scrubber, then green) |
| AC-05 | Board behaviour unchanged (add, toggle, delete, filters, priority sort, clear completed, storage) | existing `lib/todos.test.ts`, `lib/stored-state.test.ts`, `lib/mcp.test.ts`, `lib/site.test.ts`, `lib/related-projects.test.ts`, all passing on vitest 4 |
| AC-06 | CI runs lint, typecheck, `npm test`, `next build` and gitleaks/Semgrep/OSV/Trivy, and fails on any of them | `.github/workflows/ci.yml` runs on `main` |

## 3. Red-first evidence

- `lib/sentry.test.ts` written first: `npx vitest run lib/sentry.test.ts` failed (1 file failed, "no tests": `./sentry` not found).
- After `lib/sentry.ts`: `npx vitest run` → 6 files, 33 tests pass (35 after AC-04b and AC-03c). `npm run lint` and `npm run typecheck` clean, `npm run build` passes.
- First shared-CI run `39905721878` (commit `8b9721b`): `web` green, `security / osv-scanner` and `security / trivy-fs`
  red with the findings above. Fixed in `f777593` (vitest ^4.1.12, vite 8.3.5 via `npm update`, overrides
  `source-map-js ^1.2.2` and `brace-expansion@^1 ^1.1.21`); `npm ci` with npm 10 still works on the new lockfile.
- `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm) has no fixed release; dev-only (`eslint-config-next > @next/eslint-plugin-next >
  fast-glob > micromatch`), never shipped or fed user input: ignored in `osv-scanner.toml` until 2027-01-31.

## 4. Interfaces and data

| Area | Change |
|---|---|
| `package.json` | `@sentry/nextjs` ^11.8.0; `vitest` ^4.1.12; `overrides` for `source-map-js` and `brace-expansion@^1` |
| `lib/sentry.ts`, `instrumentation.ts`, `instrumentation-client.ts` | Sentry init for browser, Node and Edge; DSN from `NEXT_PUBLIC_SENTRY_DSN`; no `withSentryConfig`, no source-map upload |
| `.github/workflows/ci.yml` | shared `ci-node.yml` + `security.yml` pinned to v1.1.1 (`87dc5e1`), GitHub-hosted (public repo) |
| `osv-scanner.toml` | one dated ignore (braces, no fix) |
| docs | PRODUCT.md states what works / does not / deploy state; README limitations and config; TRUTH-PASS title; `docs/measurement/KPI-PLAN.md` (draft) |

## 5. UI review sign-off

No rendered UI or copy changed. Regression pass on the local production build (`next start`) with Sentry and the new
dependencies, `/` and `/more-projects` at 375 / 768 / 1440: HTTP 200, 0 horizontal overflow, 0 console errors. Looked
at each image: header, hero, add form, board list with priority badges and filters, and footer render correctly at
every width; `/more-projects` list renders. Screenshots: `~/work/b-tier-b/shots/productivity-todo-board-web-sentry/`.

## 6. Out of scope

- Multiple boards, drag-and-drop, due dates, keyboard shortcuts, export/import (not built; the docs now say so).
- Product analytics (PostHog, owner decision D4); `@vercel/analytics` stays unmounted.
- Browser/e2e tests.

## 7. Deployment state

- No deploy from this change. Production runs the Next.js security patch build `dc88df4` (CLI deploy 2026-10-23, D9a).
  The Vercel project is linked to the old repo name, so pushes to `main` create no deployment; the commits in this spec
  wait for the owner to reconnect Vercel Git (D9). `deploy_workflow` stays a scorecard gap for that reason; no deploy job was added.
- After D9: confirm Sentry receives a test error from the live site.
