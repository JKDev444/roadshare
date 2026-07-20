## Goal

Make onboarding work even when the CC&R doesn't contain addresses/roads, and stop the wizard from vanishing when the user clicks outside.

## Changes

### 1. Reorder onboarding — map first, docs later
- **`StartChoiceStep.tsx`**: Remove the "Upload CC&Rs" card from Step 1. Keep two playful choices: **Address lookup** and **Draw on a map**. Update headline to "Let's find your road."
- **`WelcomeWizard.tsx`**: Drop the CC&R branch from the initial flow. After the map/parcels step succeeds, route to a new **"Add your HOA rules (optional)"** step instead of finishing straight to the dashboard.
- **New `AddRulesStep.tsx`** (post-success): friendly card explaining the *why* — "Upload your CC&Rs and we'll pull out the cost-share formula, maintenance responsibilities, and HOA rules so you don't have to dig through the PDF later." Two buttons: **Upload now** and **Skip for now — I'll add later**.
- **`NoDocsStep.tsx`**: Retire or repurpose — its role is now covered by defaulting to map-first.

### 2. Fix the "click outside kills onboarding" bug
- **`WelcomeWizard.tsx`** dialog: set `onPointerDownOutside`/`onEscapeKeyDown` to `preventDefault()` so the wizard can only be dismissed via its own "Save & exit" / "Close" controls. Same treatment for any nested Dialog steps.

### 3. Reinforce the value of uploading later
- On the **Documents** tab and the post-onboarding **Home Hub**, add a soft prompt: *"Add your HOA rules — we'll surface the cost-share formula and maintenance responsibilities here."* Single CTA to the upload flow.

## Out of scope
- No changes to parcel detection, map rendering, voting, or report generation.
- No new extraction logic — the existing clause extractor already handles rules/formulas when a doc is uploaded.

## Verification
- Playwright run as a signed-in non-tech user:
  1. Reset via `roadshare` easter egg.
  2. Complete onboarding with **address lookup**, confirm the CC&R step no longer appears in Step 1, and the new "Add rules (optional)" step appears after success.
  3. Click outside the wizard mid-flow — confirm it stays open.
  4. Skip rules → land on dashboard. Re-enter via Documents tab and upload — confirm rules appear under "Rules from your documents."
- Save screenshots to `/tmp/browser/reorder-docs/screenshots/`.
- Answer the standard three questions (easy? confusing? got what I wanted?).
