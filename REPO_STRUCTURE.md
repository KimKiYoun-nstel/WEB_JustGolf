# Repository Structure Guide

## 1) Runtime Source (Git tracked)
- `app/`: Next.js App Router pages, layouts, route handlers
- `components/`: shared UI components
- `lib/`: domain/service logic, utilities
- `public/`: static assets
- `db/`, `supabase/`: schema, migrations, Supabase config
- `scripts/`: reusable project scripts (build/seed/migration helpers)

## 2) Test Source (Git tracked)
- `tests/unit/`: Vitest unit/component/page tests
- `tests/integration/`: Vitest integration/regression tests
- `tests/e2e/`: Playwright E2E specs
- `tests/helpers/`: shared test helpers/mocks

## 3) Local Manual Checks (Git ignored)
- `tests/manual/`: one-off local/manual verification scripts
- These files are not part of CI and should not be committed.

## 4) Environment & Project Config
- Tracked:
  - `package.json`, `package-lock.json`
  - `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`
  - `vitest.config.ts`, `playwright.config.ts`, `postcss.config.mjs`
  - `.env.example`
- Not tracked:
  - `.env.local`, `.env.production.local`, and any real secret values

## 5) Generated Outputs / Caches (Git ignored)
- `.next/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `node_modules/`
- `*.tsbuildinfo`

## 6) Recommended Commands
- Unit/Integration: `npm run test`
- Coverage: `npm run test:coverage`
- E2E: `npm run test:e2e`
- Build gate: `npm run build`
