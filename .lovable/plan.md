## Goal
Make `/tools/cedar-hollow` understandable for a first-time, non-technical user and fix the onboarding failure path for `787 Five Peaks Dr, Kalama, WA 98625` so users do not hit a blank map.

## What I found from the current code
- The Cedar Hollow page shows the map, address search, neighbor selection, entrances, surface settings, and allocation controls all at once. That creates no clear starting point.
- The top progress pills mark “Surface” as complete by default because the surface mix starts at 100%, even before the user has picked their home, neighbors, or road entrance.
- Important controls live below the fold, so the user can miss required steps and the results panel only says what is missing after they have already gotten stuck.
- The demo styling uses many card/pill elements and does not match the more playful app/onboarding treatment.
- The onboarding address search currently depends on OpenStreetMap/Nominatim suggestions; if the exact typed address is not returned, the user can continue with text, but the map step then depends on geocoding and building-footprint data that can return empty/blank for rural areas.

## Plan

### 1. Redesign Cedar Hollow as a guided walkthrough, not a control panel
Replace the all-at-once demo with a single focused flow:

```text
Start: Pick your home
  ↓
Choose who shares the road
  ↓
Confirm road entrances
  ↓
Review yearly share
```

- Remove the confusing pill progress bar at the top.
- Add a clear “Start here” panel above the map.
- Show only the current step’s primary controls prominently.
- Keep advanced items like surface mix, funding period, and allocation method tucked into a plain-language “Adjust assumptions” area after the basic result is visible.
- Keep the result panel visible, but make it explain the next missing action in plain language instead of showing technical empty states.

### 2. Make the demo produce a useful result faster
- Preload sane demo defaults so the user is not punished for not knowing road-engineering settings.
- After the user picks their home, auto-suggest nearby homes and provide one obvious action: “Use suggested neighbors.”
- After neighbors are selected, prompt them to confirm entrances directly on the map or with two clear buttons.
- Once enough information exists, scroll/advance to a result state that says “Here’s your estimated yearly share.”

### 3. Clean up visual style to match the newer app direction
- Reduce nested cards and pill-shaped navigation.
- Use a more playful “map workspace” composition: large map first, soft colored step rail, friendly helper copy, and tactile action buttons.
- Use existing semantic tokens from `src/styles.css`; no hardcoded color utility styling.
- Keep the map fun and legible: selected home, sharing homes, and road entrances should be visually obvious without reading a legend first.

### 4. Fix onboarding address/map failure handling
For the specific failure pattern with `787 Five Peaks Dr, Kalama, WA 98625`:
- Improve the address lookup flow so typed full addresses can still be geocoded even when autocomplete suggestions are missing.
- In the map step, show a real loading/error/empty state inside the map area rather than a blank panel.
- If building/home polygons are unavailable for a rural area, fall back to a usable manual map mode: center on the address, show the pin, and let the user continue by drawing/selecting an area or adding addresses manually.
- Add friendlier copy that explains “We found your road, but public map data may not have every home here yet” instead of surfacing technical map/provider failure.

### 5. Testing I will run before reporting back
I will not call this done until I verify:
- `/tools/cedar-hollow` starts with an obvious first action and no “Surface” pill active at launch.
- A non-technical path through the sample reaches a visible yearly-share result without needing to scroll-hunt.
- The Cedar Hollow page works at the current desktop viewport and a mobile-width viewport.
- Onboarding with `787 Five Peaks Dr, Kalama, WA 98625` does not show a blank map; it must show either nearby selectable homes or a clear fallback state with next actions.
- Console errors are checked during both flows.

## Technical areas to change
- `src/routes/tools.cedar-hollow.tsx`
- `src/components/roadshare/Planner.tsx`
- `src/components/roadshare/PlatMap.tsx`
- `src/components/roadshare/ResultsPanel.tsx`
- `src/components/onboarding/steps/BasicInfoStep.tsx`
- `src/components/onboarding/steps/MapPickStepImpl.tsx`
- Potentially `src/lib/onboarding/nominatim.ts` and `src/lib/onboarding/parcels.functions.ts` for lookup/fallback behavior