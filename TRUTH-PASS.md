# Truth-pass (BD-028) — bookchaowalit-todo-board-frontend

**Date:** 2026-08-11  
**Tier:** B (showcase)  
**Title (from README):** Todo Board

## Who / problem

See README for product narrative. This file records an honest portfolio claim class only.

## How to run

```bash
# From this repository root
npm install   # or npm ci if lockfile present
npm run dev
# production build (if available)
npm run build
```

Package name: `bookchaowalit-todo-board-frontend`  
Scripts seen: dev, build, start, lint, typecheck, test  
Docker marker: no  
Tests signal: yes (vitest unit tests for `lib/`, run in CI)

## Claim classes

| Claim | Class |
|---|---|
| README describes purpose | Observed |
| Local install + dev server works on this machine | Planned (not re-verified this pass) |
| Production users / revenue | **Not claimed** |
| Store / public SLA | **Not claimed** |

## Limitations (honest)

- Unit tests cover board logic only; no browser/e2e tests yet.
- PRODUCT.md is inferred from the code, not from a user interview.

## Do not

- Inflate metrics or invent live customer counts
- Promote website empty twins over canonical game/products owners
- Bulk-commit unrelated dirty files without review
