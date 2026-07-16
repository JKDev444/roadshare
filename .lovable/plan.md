## What went wrong

The screenshots are showing the old unauthenticated **RoadShare tour** from the sign-in page, not the real signed-in setup wizard. That preview still has fake steps and non-clickable placeholders, so it promises upload, spreadsheet paste, map editing, scenarios, neighbor input, and reports without actually doing them. That is the core problem.

The real onboarding should not be a tour. It should help a new user create the minimum useful workspace as fast as possible.

## New onboarding experience

I will replace the preview/tour with a functional, simple setup flow:

```text
Start
  -> Upload CCR / plat PDF
      -> AI extracts community, lots/parcels, roads, maintenance rules
      -> User reviews and edits
      -> Create workspace
      -> Open community/GIS review

  -> Or type it manually
      -> Community name + optional lot/road list
      -> Create workspace

  -> Or try sample
      -> Create sample workspace
```

## What I will change

1. **Remove the broken 6-step tour from the auth page**
   - Delete the misleading “ONBOARDING” preview button or replace it with a clear “Preview setup flow” that uses the real functional setup UI.
   - Remove fake steps for map editor, scenario, neighbor input, and report from the onboarding preview.

2. **Make CCR upload obvious and usable**
   - The first screen will have a real primary button: **Upload CCR / plat PDF**.
   - Clicking it immediately opens the file picker.
   - Drag-and-drop remains available, but not hidden as the only interaction.
   - The user sees clear states: uploading, reading, draft ready, or failed.

3. **Stop requiring spreadsheet, map, scenarios, neighbor input, and reports during onboarding**
   - Spreadsheet paste becomes an optional post-setup tool, only if the CCR did not include enough parcel/lot data.
   - GIS/map refinement becomes a post-setup review step, not a blocker.
   - Cost scenarios, neighbor input, and reports become dashboard next actions after setup.

4. **Tie onboarding to GIS in a realistic way**
   - From CCR/plat extraction, automatically create lots/parcels and named roads where available.
   - Mark imported geometry/data as **Needs review** so users understand it is a starter map, not a finalized survey.
   - After setup, send the user to the community/GIS review screen to refine parcels and road lines.

5. **Update the getting-started checklist**
   - Replace “six steps” with a short post-onboarding checklist:
     - Review imported lots
     - Review road map
     - Build first cost scenario
   - Neighbor input and reports stay visible as later actions, not first-run requirements.

6. **Test before calling it done**
   - Verify the auth-page onboarding preview no longer shows fake 6-step content.
   - Verify upload path displays an actual file picker/button.
   - Verify manual setup creates a community.
   - Verify sample setup creates a usable community.
   - Check console/network errors during the flow.

## Result

The user sees one easy promise: **“Upload your CCR/plat and we’ll build the starting workspace for you.”** Everything else becomes optional refinement after the workspace exists.