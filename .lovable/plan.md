
## What's wrong

1. **Autocomplete dropdown never appears.** In `BasicInfoStep.tsx` the "Pick my neighbors on a map" button is disabled until `picked === true`, and `picked` only flips true when the user clicks a Nominatim suggestion. If Nominatim returns nothing (rate-limited, offline, unusual address), the user is stuck — typing a full address does nothing and the CTA stays greyed out. That's exactly what the screenshot shows: full address typed, button dead.

2. **No visible failure signal.** The catch block in the debounce effect swallows errors silently, so the user has no idea why suggestions aren't showing.

3. **Repetitive header.** The wizard shell already shows a big rounded card "Set up your road group / Takes about 2 minutes" with a Home icon. Step 1 then shows a second gradient banner "Step 1 of 2 / Where's your road? …" with another Home icon and Sparkles. Two hero cards stacked = visual noise and wasted vertical space.

## Fix plan

### 1. Make the address field forgiving (`src/components/onboarding/steps/BasicInfoStep.tsx`)

- Enable the primary CTA whenever the address input has a reasonable value (trimmed length ≥ 5), not only after a suggestion is clicked. Selecting a suggestion still auto-fills city/state and is preferred, but typing a full address is enough to proceed. Downstream steps already tolerate missing city/state (map step geocodes the address itself).
- Keep the suggestions dropdown as a helpful accelerator, not a gate.
- Surface a small inline message under the field when the lookup fails or returns zero results after the debounce settles: "Can't reach the address lookup right now — you can type your full address and continue." Distinct from the neutral helper text.
- Log Nominatim failures to the console so we can diagnose (currently swallowed).
- Minor: trigger a fresh search when the user edits after picking (already handled) and make sure blur doesn't hide the dropdown while the user is still moving toward it (mousedown-based close is fine, keep as-is).

### 2. Collapse the duplicate header

Two options; recommend **B**.

- **A.** Remove the inner Step 1 gradient banner and rely on the wizard shell header + a plain heading. Loses the "Step 1 of 2" cue.
- **B. (Recommended)** Keep the wizard shell header minimal (title + "Takes about 2 minutes", no Home icon) and keep the richer Step 1 gradient banner (which carries the step counter, subtitle, and iconography). This preserves the playful feel where it matters and removes the doubled Home icon + doubled title.

Concretely in `src/components/onboarding/WelcomeWizard.tsx`: drop the decorative Home icon from the shell header and tighten its padding so the step banner is the visual anchor.

### 3. Verify

- Playwright a non-Dallas address (e.g. the Kalama, WA address from the screenshot):
  - Type address → confirm suggestions appear OR the fallback message appears and the CTA becomes enabled.
  - Click "Pick my neighbors on a map" → confirm navigation to the map step (no dead click).
- Confirm only one hero banner is visible on Step 1.
- Screenshot both states and read them back before reporting done (per the user's standing rule: verified testing only).

## Out of scope

- No changes to the map step, parcels pipeline, or wizard flow beyond the header trim.
- No new dependencies.
