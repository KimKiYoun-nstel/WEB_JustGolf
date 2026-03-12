# Test Files Classification

This file defines what is included in the automated test suite.

## Git-Tracked Automated Tests
- `tests/unit/**/*.test.ts(x)`
- `tests/integration/**/*.test.ts(x)`
- `tests/e2e/**/*.spec.ts`
- `tests/helpers/**/*.ts` (shared test utility code)

## Git-Ignored Local Manual Scripts
- `tests/manual/**`
- Purpose: one-off inspection, troubleshooting, ad-hoc data checks
- Not required for CI reproducibility

## Git-Ignored Generated Outputs
- `coverage/`
- `test-results/`
- `playwright-report/`
- `.nyc_output/`

## Standard Commands
- Unit/Integration: `npm run test`
- Coverage: `npm run test:coverage`
- E2E: `npm run test:e2e`
- Build gate: `npm run build`
