I agree with your assessment: the current onboarding is too much like a tour. The onboarding should only do the minimum needed to get a new, non-technical client started: create their community record, get parcels/lots in, get roads/common-maintenance basics in, then land them in the app with clear next actions.

## Proposed onboarding flow

```text
1. Start setup
   Choose one path:
   - Upload CC&R / plat PDF (recommended)
   - Enter manually
   - Try sample community

2. Review what we found
   One friendly review screen:
   - Community name / location
   - Lots or parcels found
   - Roads / common areas found
   - Maintenance rules / assessment formula found
   User can edit obvious mistakes before saving.

3. Finish setup
   Save community + parcels + roads.
   Show a simple success screen:
   - “Your community is ready”
   - Primary button: “Open my community”
   - Secondary next actions outside onboarding: build scenario, invite neighbors, create report
```

## What will be removed from onboarding

- Remove “Build a cost scenario” as a required onboarding step.
- Remove “Gather neighbor input” as a required onboarding step.
- Remove “Ship a report” as a required onboarding step.
- Keep those as post-onboarding dashboard actions, because they are real workflows, not first-run setup.

## CC&R upload fix

I will fix the upload path so it works as a real setup action, not a preview idea:

- Repair the server-side AI request to use the correct Lovable AI Gateway pattern and headers.
- Add clear upload states: selected file, reading, extracting, review-ready, failed.
- Surface specific errors instead of a vague “couldn’t read PDF.”
- Keep the PDF extraction behind signed-in onboarding only.
- Test with a real CC&R PDF path and verify it produces a review screen before saying it works.

## Parcels and roads automation

For a non-technical client, the best practical version is:

- First automate from the CC&R / plat PDF when possible.
  - Extract lot numbers, community name, roads, maintenance language, and cost-sharing language.
  - Create starter parcels and road records automatically.
  - Mark them as “Needs review” rather than pretending they are survey-grade GIS.

- Add a “County parcel data” helper after the initial save, not as a blocker.
  - Real GIS parcel integrations vary by county, so onboarding should not depend on a county API working.
  - The app can guide users to upload/export a parcel CSV or paste a parcel list.
  - Later, we can add county-specific integrations where data is available.

- Make the manual fallback painless.
  - “Add lot numbers only” should be enough to start.
  - Owners, addresses, frontage, and exact road geometry can be filled in later.

## UI/UX changes

- Rename the modal from “RoadShare tour” to “Set up your community.”
- Use plain-client language, not feature language.
- Add one fun progress moment after the setup is actually saved.
- Keep celebration light and useful, not distracting.
- Dashboard should show next recommended actions after onboarding:
  - Create a cost scenario
  - Invite neighbors / start a decision
  - Generate a report

## Technical implementation

- Refactor `WelcomeWizard` from 6 stations to a focused 3-step setup flow.
- Keep/rework `CcrImportStep`, but make it robust and testable.
- Fix `extractCcr.functions.ts` to call Lovable AI correctly and return useful failure messages.
- Keep `applyCcrDraft`, but improve review/apply behavior and confidence labeling.
- Update `/auth` ONBOARDING preview so it mirrors the real simplified setup instead of showing a tour.
- Update dashboard checklist so advanced workflows are “Next steps,” not onboarding gates.

## Verification before I call it done

- Test signed-in onboarding end-to-end.
- Test CC&R PDF upload through the real UI.
- Verify extracted data reaches the review screen.
- Verify “Create everything” creates a community, parcels, and roads.
- Verify onboarding completes only after setup is saved.
- Verify dashboard shows post-onboarding next actions.
- Check browser console and network errors during the flow.