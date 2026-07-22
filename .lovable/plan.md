## What's broken

Root cause: **Step 1's "Add homes by hand" and "Paste address list" don't do what they say.** Both drop the user into `NoDocsStep`'s *menu* — a second screen that shows four more cards including another "Add homes by hand" and "Paste a list". So the user's click appears to jump one step forward while landing on a nearly identical chooser. On top of that, the `NoDocsStep` menu's own Back button goes to Start, but sub-modes' Back only returns to that menu, so users bounce between two menus and can never actually exit. And Save & Exit closes the dialog but leaves `?welcome=1` in the URL — revealing the dashboard behind, which reads as "weird graphic on the same page".

## Fixes

1. **Route Step 1 choices directly to the matching input form**
   - `NoDocsStep` gets an optional `initialMode: "menu" | "search" | "paste" | "manual" | "empty"` prop.
   - `WelcomeWizard.tsx`:
     - `"paste"` from `StartChoiceStep` → `setStep("nodocs")` with `initialMode="paste"` (no more chooser in between).
     - `"manual"` from `StartChoiceStep` → `setStep("nodocs")` with `initialMode="manual"`.
     - `"address"` path (Basic → Find Neighbors) unchanged.
     - After documents flow (`docsQ` → nodocs, or Upload → nodocs skip) it still opens on `"menu"` because those users genuinely want the chooser.

2. **Back button always exits to Step 1**
   - When `NoDocsStep` was opened with an `initialMode` other than `"menu"`, the sub-mode's "Back" button calls `onBack` (which routes to Start / Step 1) instead of `setMode("menu")`.
   - The `NoDocsStep` menu screen keeps its existing Back → Start behavior; adds a visible "Cancel & exit setup" ghost button for clarity.

3. **Save & Exit actually leaves onboarding**
   - `close(markSkip)` navigates to `/dashboard` (without the `?welcome=1` search param) instead of just hiding the dialog. This removes the "wizard reopens on refresh" trap and eliminates the "weird graphic" (the dashboard empty state showing through) by taking the user to a clean, purposeful landing.
   - Also clears the `?welcome=1` param when the wizard finishes via `applyDraft`.

4. **Copy tweak (small)**
   - `NoDocsStep` menu header currently reads "Step 2 of 3 · How do you want to add homes?" — when it's reached via the docs-question path, keep that; otherwise it never renders (since we skip straight to manual/paste), which resolves the "Step 2 of 3" confusion the user hit.

## Files to touch

- `src/components/onboarding/steps/NoDocsStep.tsx` — accept `initialMode`, thread `onBack` through sub-modes when opened directly.
- `src/components/onboarding/WelcomeWizard.tsx` — pass `initialMode` from `StartChoiceStep` picks; make `close()` navigate to `/dashboard`; strip `?welcome` on completion.

## Verification (Playwright, as a non-tech user)

Run four flows, screenshot each and answer the standard three questions:

1. Start → "Add homes by hand" → confirm the manual form appears immediately (no intermediate menu). Click Back → back on Step 1.
2. Start → "Paste address list" → paste form appears immediately. Back → Step 1.
3. Start → "Type your address" → verify unchanged (Basic → Find Neighbors).
4. Start (mid-flow) → Save & Exit → confirm we land on `/dashboard` with no `?welcome` param and the dialog is gone.

Save screenshots under `/tmp/browser/screenshots_backfix/`. Report back with the three answers ("easy?", "confusing?", "did you get the result you wanted?").
