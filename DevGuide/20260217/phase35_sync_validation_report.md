# Phase 3.5 Live Sync Validation Report

## Scope
- Admin: PC browser draw control + animation
- Viewer: PC browser live draw page
- Viewer: Mobile browser live draw page
- Toast propagation: admin/viewer/mobile
- Header/anchor layout validation on admin draw and viewer participants page
- Re-pick availability before assignment confirmation
- Group lock UI state (full group = locked badge)

## Execution
- Date: 2026-02-18
- Command:
```bash
npx playwright test e2e/live-draw-verify.spec.ts --project=chromium
```
- Artifact directory: `artifacts/live-draw/20260218_002101`
- Machine report: `artifacts/live-draw/20260218_002101/report.json`

## Build and Unit Validation
- `npm run lint -- app/admin/tournaments/[id]/draw/page.tsx app/t/[id]/draw/page.tsx app/admin/tournaments/[id]/layout.tsx app/t/[id]/participants/page.tsx app/api/admin/tournaments/[id]/draw/route.ts lib/draw/reducer.ts lib/draw/reducer.test.ts e2e/live-draw-verify.spec.ts`: PASS
- `npm run test -- lib/draw/reducer.test.ts`: PASS (10 tests)
- `npm run build`: PASS

## Mobile Behavior (Updated)
- During early `picked` lock, winner text is hidden.
- After `picked` animation settles, winner text is shown on mobile immediately.
- `confirmed` keeps the same winner text, synced across admin/viewer/mobile.

## Validation Checklist
- Configured-step sync across admin/viewer/mobile: PASS
- Picked-lock winner hidden across admin/viewer/mobile: PASS
- Picked-settled winner visible across admin/viewer/mobile: PASS
- Confirmed winner remains same as picked-settled winner: PASS
- Shuffle toast visible on admin mobile: PASS
- Shuffle toast visible on viewer PC/mobile: PASS
- Mobile draw-state nickname leak during configured: PASS
- Participants page anchor moved from right overlay to header-line nav: PASS
- Participants sticky second header visible after scroll: PASS
- Admin top tab/header overlap regression: PASS (new sticky two-line layout + horizontal overflow)
- Re-pick before assign confirm: PASS (API/reducer/UI guard updated, reducer test covered)
- Group lock visual state (`확정`) for full groups: PASS (admin/viewer draw pages)
- Console errors during run: PASS

## Evidence
- Report JSON: `artifacts/live-draw/20260218_002101/report.json`
- Admin initial: `artifacts/live-draw/20260218_002101/01_initial.png`
- Viewer initial: `artifacts/live-draw/20260218_002101/01_viewer_initial.png`
- Viewer mobile initial: `artifacts/live-draw/20260218_002101/01_viewer_mobile_initial.png`
- Viewer mobile shuffle toast: `artifacts/live-draw/20260218_002101/01_viewer_mobile_shuffle_toast.png`
- Viewer mobile picked locking: `artifacts/live-draw/20260218_002101/03_viewer_mobile_picked_locking.png`
- Viewer mobile picked settled: `artifacts/live-draw/20260218_002101/03b_viewer_mobile_picked_settled.png`
- Viewer mobile confirmed: `artifacts/live-draw/20260218_002101/04_viewer_mobile_confirmed.png`
- Participants header anchor (top): `artifacts/live-draw/20260218_002101/06_viewer_participants_anchor_top.png`
- Participants header anchor (scrolled): `artifacts/live-draw/20260218_002101/06b_viewer_participants_anchor_scrolled.png`

## Notes
- Full-page screenshots can show sticky header sections multiple times in one stitched image. This is a capture artifact, not duplicated DOM content.
