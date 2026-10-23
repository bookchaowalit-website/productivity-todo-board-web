# Todo Board

Priority-aware todo board with filters.

Live: https://todo-board.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## Features
- Add / complete / delete todos
- Priority + category
- Filter all/active/completed; open work sorted by priority, completed items sink
- Filter by area (work / personal / shopping); counts follow the selected area
- Clear completed
- localStorage persistence

## Limitations
- Single user local demo: one list, no boards, drag-and-drop, due dates or export/import
- Data lives only in this browser's localStorage

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- localStorage persistence

## Run
```bash
npm install
npm run dev
```

## Honesty notes
- Portfolio mini-app showcase
- Not multi-tenant SaaS

## Checks

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (the same checks) and the shared security scan on every push and PR to `main`.

## Configuration

- `NEXT_PUBLIC_SENTRY_DSN` (optional): enables Sentry error reporting (`lib/sentry.ts`, `instrumentation*.ts`), errors only with personal data stripped. Unset means off.

- `NEXT_PUBLIC_SITE_URL` (optional): canonical origin used for metadata, `/sitemap.xml`, `/robots.txt` and the MCP app info. Defaults to `https://bookchaowalit-todo-board-frontend.vercel.app`; must be an absolute http(s) URL.
