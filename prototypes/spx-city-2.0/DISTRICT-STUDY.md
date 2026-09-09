## Continuous fly-through film — 9 September

- Added `?flypass=1`, an 84-second continuous 3D camera flight from Liberty Island past the aggregate exchange terminal, into the Fifth Avenue corridor and through a banked right/left approach to Central Park.
- Camera follows a continuous centripetal spline. A sampled height envelope clears wallet geometry; camera aim stays below the horizon through climbs. Only the film opening and ending fade.
- Traffic, water and local architecture details follow the camera during rendering. Existing interactive city controls are unaffected.
- 1920×1080 recording, silent; MP4 export in `outputs/spx-city-film`. No external footage or music. Source sculpture attribution is unchanged.
- Build passed; 66 tests passed, including full-route building clearance. Browser checked the turn/climb framing and park approach.

## Open harbor and single exchange terminal — 9 September

Supersedes the multi-venue dock layout below.

- One compact Red Hook terminal now represents the aggregate CEX balance (194.0M SPX in the 2026-09-07 snapshot). Venue-by-venue warehouses and labels removed.
- Harbor-facing Brooklyn and Jersey outlines redrawn as simplified shoreline traces. The former water-inclusive polygon tips met across the bay; the lower harbor channel is now open. Jersey parcel support no longer adds a broad 40-unit westward strip, and occupied wallet envelopes remain supported.
- Governors Island retains its source coordinate east of Liberty Island and south of Manhattan. Its visual model is retained; the corrected surrounding coastline makes its position legible. Both island centers and approach channels are regression-tested as water in the mainland polygons.
- NPS location reference: https://www.nps.gov/gois/planyourvisit/maps.htm . These are deliberately simplified visual shores, not surveyed coastlines.
- Harbor preset now frames the bay, both islands and the terminal together. Terminal landscaping exclusion clears trees, garden paths and beds from the loading apron.
- Browser reviewed harbor overview and terminal close-up. Build passed; all 65 tests passed. Existing wallet positions, eligibility and activity logic unchanged.

## Avenue traffic and harbor infrastructure — 8 September

- Fleet size remains 288; 78% assigned to avenue routes, 22% cross streets. Existing two-way route loops and moving headlight pools retained.
- Restored the exchange terminal and Uniswap pool from City 1.0 semantics and geographic source anchors. Data copied from `work/the-terminal/public/onchain.json`, dated 2026-09-07, into `src/fullcity/infrastructure.json`; this is a preview snapshot, not a live fetch.
- Exchange warehouse size follows original venue shares, with minimum berth spacing and a continuous quay/service lane. Major venues have names and SPX balances. Dedicated Exchange docks and Uniswap Island camera shortcuts added.
- Uniswap retains its source pool-volume pavilion count on an illustrative landscaped island. Added a Castle Williams-inspired circular masonry courtyard (not a surveyed replica or downloaded model). Reference: https://www.nps.gov/gois/learn/historyculture/castle-williams.htm . Compact island outline is illustrative, not a traced Governors Island shoreline.
- No wallet eligibility, placement, balances or landmark rankings changed. Build and 64 tests passed; compact quay clearance and traffic regression checks avenue preference and continuous movement.

## Road detail and night illumination — 8 September

- Geographic Central Park footpath ribbons now stay at least 0.60 source units inside the park boundary, leaving the perimeter drive clear; original small study path routing remains unchanged.
- Land-safe street runs receive lane separators, approach stop lines, selected stop signs, sidewalk bus shelters and boarding-zone markings. Road geometry, wallet population and activity logic are unchanged.
- Street lamps have warm soft surface pools at dusk/night. Vehicle headlights have paired animated road pools following each vehicle. Both effects are instanced, without extra per-vehicle lights or shadow maps; they are surface illumination effects, not physically traced light cones.
- Verified park overview and close street composition in the browser. Night overview showed the road pools; observed 60 FPS in that view (not a mobile benchmark).
- Build passed. All 63 tests passed, including park path boundary clearance and the updated vehicle batch budget (one additional shared light-pool draw).

## 30 Hudson Yards crown — 8 September 2026

Replaced the inward-facing, window-textured wedge with a closed, flat-shaded crown whose lower shoulder rises to 91% of the landmark height. Full tower depth is retained, the cap uses untextured metal, and the observation deck has a small protective rim. The overall height, wallet assignment and tower footprint are unchanged. Production build and a dedicated closed-mesh / outward-normal regression test pass.

## Neighborhoods, landscape composition and camera approaches — 8 September 2026

Geographic ordinary buildings now use deterministic local character zones: masonry skylines, glass offices, residential towers, brick-and-stoop areas, loft districts, courtyards and modest infill. Nearby blocks share curated silhouette and material pools; individual addresses retain variation. The 12 landmark assignments, wallet positions, eligibility, balances and dimensional envelopes are unchanged. Selected-wallet cards show the architectural character.

Central Park now mixes spreading deciduous crowns, upright trees and conifers, with spacing between trunks and fewer trees crowding existing lawns and paths. Outer open space uses planted garden loops with varied proportions, seating, open centres, connections to neighboring gardens and screened waterfront access paths. Land, building and road clearance checks screen new planting and paths.

Street and Landmark presets now choose road-based camera approaches scored for building obstruction. The study panel can collapse to reveal the full viewport and reopen from Study controls; resizing preserves the camera.

Validation: production build and 61 tests pass. Added deterministic neighborhood / dimension tests and road-based camera tests; existing placement, entrance support and rendering checks pass. Browser reviewed street approach, collapsed / restored panel, Central Park, and Jersey neighborhoods. Reviewed settled views showed roughly 58–60 FPS. These are local prototype changes, not a live-site deployment.

## Attached low-rise entrances — 8 September 2026

Corrected doors and shopfronts that were placed on rectangular footprint edges across recessed façades and courtyard gaps. Placement now uses the exact representative silhouette and instance scaling used by the population renderer, verifies a full door-sized wall rectangle with rays at multiple heights and widths, and places details against the supported surface. Stoops move with the entrance. Unsupported shop locations are omitted. Removed long frontage trim strips that bridged open wings.

Production build and 59 tests pass. New regressions cover split wings, recessed façades, insufficient wall width and both street sides across low-rise silhouette families. Reviewed the low-rise camera in the browser; doors now meet walls and the floating cross-courtyard trim is gone.

## Citywide rollout and low-rise architecture — 8 September 2026

The approved architectural treatment is now enabled by default throughout the geographic prototype. All 4,813 ordinary wallet buildings receive detailing; the 12 bespoke landmarks keep their existing architecture. Before / After remains available, and Low-rise streets frames a Brooklyn residential block.

Manhattan receives lobby/storefront bases, canopies, parapets and roof equipment. Outer boroughs and the lower-rise Village / Tribeca treatment use smaller doors, masonry lintels, stoops where frontage clearance permits, occasional shops / awnings, modest roof equipment and lighter sidewalk furniture. Courtyard planting is screened against wallet footprints and land boundaries. Bus shelters are spaced among Manhattan blocks rather than repeated on every block. Wallet positions, balances, heights, ranks and signals are unchanged.

Performance: detail boxes share one instanced unit geometry; roof topology is cached per population family. Small detail instances are selected in spatial cells around the camera, and landscape detail meshes are culled locally. Stable building silhouettes and wallet signals remain in the population renderer at all distances. Preset camera moves refresh local detail immediately. The first all-at-once rollout showed roughly 46 FPS / 12.8M triangles; the optimized reviewed low-rise view showed roughly 55–60 FPS / 7.8M triangles. This is desktop observation, not mobile validation.

Validation: production build and 56 tests pass, including full ordinary-wallet coverage, unchanged wallet data, finite shared transforms and distance-culling behavior. Reviewed Manhattan roofs / bases and low-rise entrances, stoops, planting and traffic in the browser. Deployment to the live upstream website has not been performed.

## Finished Manhattan block proof — 8 September 2026

Open `/?district=1&geography=1&quality=1`. The top panel provides Block overview / Shopfronts cameras and instant Before / After controls. Ten real wallets in Midtown block original-60 receive architectural detailing; balances, assignment, heights, silhouettes, activity signals and other blocks remain intact. Daylight After also previews lower ambient/environment fill and exposure across the scene, so lighting can be compared in context.

Added distinct storefront / lobby bases with recessed glass and projecting piers, entrance canopies, actual roof-boundary parapets and mechanical equipment, sidewalk paving joints, tactile corner pads, planted benches, a bus shelter, static pedestrians, signal poles and selective warm shop displays. Roof details use the same representative geometry and instance scaling as the population mesh. Details are merged into a small material set, and Before/After changes visibility and uniforms without rebuilding the world. Day/night changes still use the existing rebuild path.

Validation: production build; 55 tests passed, with targeted geometry/population tests rerun after final sidewalk changes. Browser checked identical-camera daylight Before and After, plus dusk and night architecture; proof views displayed approximately 59–60 FPS. No full-city rollout or mobile performance claim. Pedestrians are static; signal props do not control traffic simulation.

## Architectural activity accents — 8 September 2026

Replaced the full-façade color wash with narrow cornice bands and short upper-corner returns on the actual wall planes. Accents follow setbacks, preserve opaque neutral roofs and natural façade materials, and use the existing buy/sell threshold and colors. Distance filtering reduces thin-band shimmer without expanding the signal across the building. Accents is now the default; Windows and Edges remain comparison choices. Bespoke landmarks and existing beams retain their current behavior.

Production build and all 54 tests pass. Reviewed the night landmark view in the browser: natural building bodies retained, 60 FPS shown after lighting finished rebuilding.

## Navigation and city character — 8 September 2026

Restored production desktop navigation: left drag ground-pan, right drag orbit, damping .08, pan speed .9; trackpad slide orbits, pinch / mouse wheel / shift-scroll zooms. Touch remains OrbitControls rotate and two-finger dolly/pan. Physical trackpad feel still needs user evaluation.

Full-population ordinary buildings now offer Windows / Edges / Façades signal comparison, using shader uniforms without rebuilding the city. Existing flow threshold and age colors are preserved; quiet wallets do not get activity borders. The 12 bespoke landmarks retain their existing treatment and beams. The original waterfront study at `/` also retains its earlier roofline accents.

Lighter stone and cooler glass palettes, more balanced dusk fill, and address-stable bay spacing / lit-window patterns improve differentiation. Wallet heights, positions, ranks and balances remain unchanged. Avenue medians now have stone edges, taller crowns and paired shrubs. The same 288-car fleet is balanced equally between avenue and cross-street routes, instead of distributing predominantly onto the numerous cross streets.

Validation: production build and 54 tests pass, including an unbalanced street-network test confirming avenue traffic allocation. Browser reviewed final landmark view and both new signal selectors; displayed 60 FPS / 472 draws / 6.2M triangles. This is an observed desktop frame rate, not a mobile benchmark.

## SPX City 2.0 cinematic introduction

Open `/?intro=1`, or use the district header's introduction link. A 32-second silent film prepares the original Skyline3D renderer with study=false and the new geographic district from the same wallet snapshot, disposes the 3D scenes, and presents captured renders with pans, a before/after wipe, dissolves and title cards. Sequence: original city, new Manhattan reveal, landmark cluster, Central Park, Liberty Island finale. It is a visual evolution montage, not a camera-matched comparison or a live flythrough.

Playback includes pause, replay, seek and skip-to-city. Reduced-motion users get stationary shot framing. A WebM export uses the composed 1280×720 canvas at 30 FPS, including titles; the 32-second recording runs in the browser after clicking Download. No soundtrack or external media is used. The prototype remains separate from production.

## Jersey support, finished road ends and clean waterfront joins

The earlier authored Jersey harbor inset intersected 67 occupied wallet locations; clipping the block ground to that inset exposed water beneath those buildings. The Jersey polygon now unions with connected support strips around affected occupied block envelopes, producing a single mainland embankment. Wallet positions remain unchanged and Liberty Island remains offshore. This is a prototype coastline adjustment, not a claim of survey accuracy.

Removed the legacy overlapping shoreline walkways, fragmented railings and curved edge tubes. Promenade rectangles are dissolved into joined planar surfaces, intersected with land, with sparse lighting only on straight reaches. Polygon inputs are snapped to 0.001 scene units to avoid floating-point ring failures at coincident joins. Shore skirts follow the land boundary directly. Low block decorations are clipped as well; benches and trees are omitted when their supporting footprint would extend over water.

Suitable isolated inland road ends receive a paved forecourt, transverse curb returns, paired bollards and a central pedestrian opening. Tests verify supporting ground at every Jersey building corner, separation of the harbor, unique land-supported forecourts, and full shoreline surface assembly. Build and 53 tests pass.

## Island edges, vacant land and street life — screenshot follow-up

Road carriageways, continuous 1.2-unit sidewalk margins and geographic block base surfaces are now intersected with the land polygons. This removes the rectangular asphalt and paving extensions over the rivers shown in the supplied screenshots. Crosswalk stripes at the coastline are omitted when their corners are off land. Bridge geometry remains a separate crossing.

Open land has a meadow base instead of uniform paving. Spatially screened groves, planted beds, seating and walking-path sections cover all five territories, with per-territory sampling budgets so Brooklyn cannot exhaust Jersey or Bronx planting. Existing wallet addresses and positions are unchanged. These areas are public landscape, not fabricated wallet buildings.

Central Park tree height compensates for the geography scene's unequal horizontal and vertical scale. Short narrow medians are planted on sufficiently wide roads and omitted near junctions. Traffic now uses land-safe stretches of the actual geographic road network, with 288 vehicles at 2.2 times study scale and looped two-way demonstration routes. Moving fleet meshes are excluded from stale static frustum culling, which could hide the cars. This is ambient traffic, not a traffic simulation.

Validation: build and 50 tests pass, including concave shoreline intersection area/normals and road-run bounds. Browser inspection covered Manhattan, Jersey vacant land and Central Park; cars were visible. Those views reported 60 FPS and approximately 5.5–5.6M triangles. Mobile hardware remains untested.

## Manhattan waterfront, Central Park and Liberty Island refinement

Manhattan and Bronx shorelines now receive wider paved promenade sections, low seawalls/railings, planting beds, additional trees, benches and lamps. Ninety-five safe pedestrian access links connect suitable existing road ends to the waterfront. Road and wallet footprints remain unchanged; open Bronx shoreline space is treated as public landscape rather than populated with fictional wallets. Planting and access links are screened against homes, roads and land boundaries. Waterfront beds sit above the existing block paving to avoid being hidden by it.

Central Park previously had paths, lakes, feature lawns and trees but no continuous green floor; a park-boundary lawn surface now fills that omission below the existing paths and lakes.

The geographic Liberty Island cylinder is replaced by a stylized elongated polygon, shoreline promenade, lawns, main path, landing and eleven-point Fort Wood platform. It is an authored approximation, not surveyed GIS geometry. Reference: National Park Service Liberty Island cultural landscape and Fort Wood pages: https://www.nps.gov/articles/000/stli-liberty-island-650003.htm and https://www.nps.gov/places/000/fort-wood.htm . The statue receives restrained emissive fill and two local shadowless warm lights at dusk/night.

Build and 48 tests pass, including new land-boundary, planting clearance and unchanged-wallet checks. Manhattan park and harbor were inspected in-browser; observed approximately 50–52 FPS, about 4M triangles and 444–468 draws in those views. Physical mobile performance remains unverified.

## Approved restrained treatment — city rollout

The 4,825-wallet geography and population prototypes now use the approved neutral glazing, warmer masonry and restrained illumination. The 384-wallet district also uses the approved material option. Eligibility, addresses, ranking, positions, landmarks and activity beams are unchanged.

Ordinary full-city buildings use persistent instanced silhouette meshes with window bays shaded directly on vertical wall planes. Opaque roofs and sloping crowns are excluded. Inset edges, mullions and sills are shaded; distant bays are filtered rather than replaced. This deliberately avoids thousands of separate detailed window meshes. Groups use representative envelope geometry scaled to each wallet's existing dimensions. The original static proof is retained as a previous-treatment comparison.

Initial full-detail instancing cost 27.5M triangles and was replaced before completion. Optimized browser observations: about 3.8M triangles / 460 draws in Manhattan, 3.6M / 435 at street level, roughly 48 FPS in initial checks and 52 FPS in the final street view. Window frames, transoms, sill shading and inset edges were visually inspected in the final street view. Night street view was also inspected: approximately 37–46 FPS during checks, with subdued façades and clearly illuminated individual panes. Physical mobile performance is not verified. Do not interpret these measurements as a guarantee of 60 FPS on every device.

Validation: tests cover all 50 silhouette wall bounds and opaque roof exclusion, plus stable instance identity and wallet positions through camera changes. Existing wallet/placement/geometry tests remain in place.

## Controlled visual calibration — September 8

Open `/?proof=1` for paired static renders of one Midtown block and one Bronx block, each containing eight real wallets from the full-city snapshot. Each pair uses identical wallet positions, dimensions, lighting, and camera. Day/dusk/night and wide/close controls regenerate the views through one temporary renderer.

The isolated proposed treatment uses neutral unlit glazing, lower emissive intensity, 2/11 lit bays instead of 4/11, warmer masonry, and persistent detailed façade geometry. The current side retains the existing population renderer and settled distance detail. The default city materials and wallet logic are unchanged. Ground and planting are simplified and identical within each pair: this is a façade calibration, not a streetscape proposal.

Visually checked both blocks, close and wide views, and all three lighting modes. Build and all 45 existing tests pass. The proof is static; it does not demonstrate that full detailed geometry will perform across all 4,825 wallets. Citywide LOD implementation and signal legibility still need validation before rollout.

## Window signals across detail levels

Overview and detailed facades now use the same window-signal helper for color, flow threshold and lighting strength. Overview emission uses a neutral scalar window mask instead of multiplying the wallet color by warm, dim texture RGB; mask contrast is lifted to keep small windows readable. Detailed glazing uses the same signal color for both lit panes and subtler unlit panes. Roofs remain neutral. Architectural geometry still loads by camera distance; wallet signal meaning does not depend on that detail selection.

The existing 4% normalized-flow activity threshold and age bins are unchanged. Build and all 45 tests pass. Browser verification showed colored overview windows across the city at 60 FPS, with only seven nearby facades detailed in the inspected night view.

## New York study 13 — public-space and landmark refinement

The geographic preview raises the Brooklyn Bridge deck/towers above the unchanged ground-level approach datum (2.8× expansion above that datum). Liberty is uniformly doubled from Study 12 and re-grounded on the island. Bridge and closer Harbor camera presets make both inspectable.

Added a closed perimeter park drive with short connections from nearby street endpoints, rather than leaving avenue stubs at Central Park. Park tree generation now reserves a wider boundary clearance. This is an illustrative street design, not a claim to reproduce current NYC traffic routing.

Landward waterfront paths, railings, benches, lamps and planted pockets add detail where road/building clearance permits. Water uses a slowly drifting normal texture. Outer boroughs now use nine low-rise families with fuller footprints and slightly greater visual heights, preserving all wallet positions and data. No buildings or wallets were invented.

Build and all 43 tests pass. New tests check park-route closure and connections plus planted-pocket clearance from roads and wallets. Visual inspection of the bridge view reported 60 FPS, 625 draws, approximately 4M triangles and 24 detailed buildings in the in-app desktop browser; this is an observation, not a physical-phone benchmark.

## New York study 12 — restore the original city grid

The sparse Study 11 clustering has been removed. The geographic preview now uses `placeCity`, `hoodGrid`, `boroughGrid`, `streetGrid` and `boroughStreets` from the original city. Every wallet keeps its original source coordinate under the common axis rotation and 4.75× map transform. This restores the continuous shallow-block rhythm and original spatial distribution instead of allocating deep rectangular districts around neighborhood centroids.

All 4,825 wallets remain, on 765 occupied source blocks. No filler buildings or empty garden-block allocations are added. Ordinary footprints are enlarged with the map to preserve visual density; the 12 landmark dimensions remain unchanged and their bounds clear neighboring wallet footprints. Borough houses use smaller footprints, lower heights, five masonry families, palette variation and distinct width/depth ratios. Residential blocks have planted yards, perimeter sidewalks and individual entrance paths in place of large paved slabs. Facade texture height now follows instance height, so a low-rise house does not inherit a skyscraper’s compressed rows of windows.

Source streets and avenue crossings are reused. Street furniture is reduced to fit the shallower source blocks. Bridge approach tails are shortened, leaving the main span unchanged, and joined to the source streets without moving the wallet on the Brooklyn approach. The sparse 8/16 density toggle is removed from geographic mode; both standalone studies remain accessible.

Visual reference: inspected the live city in the browser. Initial revised Manhattan observation: roughly 55 FPS, 572 draws and 3.6M triangles. Build and 41 tests pass, including exact transformed wallet positions, unchanged financial/neighborhood data, unique occupied blocks, landmark clearance, and both bridge connections. This is a local visual prototype, not a production deployment.

## New York study 11 — geographic integration preview

`/?district=1&geography=1` fits the approved block dimensions into the bundled OpenStreetMap coastlines. Both density options use the same 4.75× horizontal geographic scale. Candidate road envelopes are checked on land and outside Central Park; the Brooklyn Bridge corridor is excluded. All 4,825 wallet addresses, scores, flows and production neighborhood assignments are preserved. Parcel coordinates change to accommodate the approved block geometry. This remains a static snapshot prototype, not a production deployment or live placement migration.

Manhattan uses the tower library, with lower masonry forms in Tribeca/SoHo and the Village. Outer boroughs use nine lower-rise families and a lower visual height range. Top-12 landmark dimensions remain unchanged. Central Park scenery, the bridge and the licensed Liberty model are reused. Bridge approaches connect to nearby street corners. Empty territory remains landscape instead of invented wallet buildings.

The simplified Jersey harbor edge is inset to keep Liberty Island in water; this local shoreline correction is illustrative rather than a new surveyed coastline. The imported statue is centered on its island after geographic scaling.

The preview retains the bounded facade LOD system and traffic fleet. Borough, park and harbor camera presets are available. Initial geographic overview observation: roughly 58–60 FPS, 619 draws and 5.9M triangles in the in-app desktop browser. Physical-phone validation remains outstanding. This first integration does not reproduce every NYC road or densely landscape all unoccupied outer-borough land.

Build and 40 tests pass, including neighborhood preservation, unique geographic blocks, sampled road-envelope/coastline and park clearance, lower outer-borough heights and both bridge road connections.

## Population study 10 — full snapshot scale test

Open `/?district=1&population=1` for all 4,825 eligible snapshot wallets. The original `/?district=1` remains the approved 384-wallet study. Both density layouts expand their grid without squeezing landmark dimensions or changing scores, balances, flows or the sampled wallets’ identities. This is a rendering scale test, not the final borough map or a live-data integration.

Overview buildings use instanced silhouette geometry with neutral roofs and per-wallet window emission. Up to 24 nearby ordinary buildings (12 at phone widths) load the detailed facade treatment, one every 100 ms; detail resources are released when they leave the active set. Twelve landmarks stay detailed. Pixel ratio still adapts under sustained slow frames. Traffic stays bounded at 72 vehicles, now spread across the full grid. The footer reports triangles and detailed-building count alongside FPS and draw calls.

Initial in-app desktop observations: approximately 60 FPS at overview (496 draws, 5.1M triangles) and street scale (630 draws, 5.1M triangles, 24 detailed buildings). These are live preview observations, not a controlled hardware benchmark. Ground scenery remains merged, and additional spatial batching/LOD may be needed on older phones. Physical-device testing and final geographic integration remain outstanding.

Validation: population membership, preserved cohort dimensions/identities, unique placements in both density options, and bounded camera-dependent detail selection are covered by tests.

# Facade Study 09 — articulated walls and neutral roofs

Procedural towers now use opaque wall masses with separately generated window bays. Vertical planar faces receive window surrounds, glazing panels, stone sills/mullions and street-level glazing; horizontal and sloped surfaces receive opaque roof material. Small rooftop equipment adds scale. This replaces the repeating window texture on procedural silhouettes. The separate authored landmark meshes retain their existing facade treatment, with their district accent bands neutralized.

Roof activity caps have been removed. Age and net-flow colors appear in selected windows, with existing activity beams retained. Materials share a cache keyed by facade palette, age bin and active flow direction. Window panels are merged with other geometry by material; this adds geometry and draw calls, so physical-device testing remains necessary.

Cylindrical, elliptical and retro-futurist shapes now represent 19 of 372 ordinary buildings (~5.1%). The deterministic assignment still covers all 34 Manhattan families. Catalogue access is unchanged. No production scoring or eligibility rules changed.

Validation: 27 automated tests, including vertical-only window surfaces, opaque roof separation and rarity bounds; build and browser street-view review. Physical phone and Intel iMac performance is unverified.

---

Earlier study notes follow.

# Silhouette Study 08 — geometry before materials

Two linked deliverables are available: `/?catalogue=1` for the 50-family neutral catalogue and `/?district=1` for the same 384 real wallets using the Manhattan subset.

The catalogue implements all 50 requested base forms, grouped into 10 expressive high-rise, 15 ordinary tower, 15 mid-rise/residential and 10 low-rise/special families. It uses static thumbnails at one camera scale and a single interactive inspector. Three bounded variations adjust proportions; selected forms also change rounding, taper, twist, setbacks or crown height. This is a base-geometry catalogue, not the full future combinatorial crown/façade/roof configuration editor. Exoskeleton, diagrid, fins, bands and balconies currently have dedicated example forms; cross-family treatment composition remains future work.

The district uses 34 appropriate procedural families, all represented in the cohort, with a separate versioned address seed for family assignment. Existing 12 iconic landmark models and their assignment remain separate. The eight/16 density comparison, wallet population, heights, lot envelopes, eligibility and scores are unchanged from Study 07. Multi-volume forms remain one wallet pick target and one activity beam. Roof color overlays follow actual top surfaces rather than a generic floating rectangle.

Geometry is merged into shared-material batches in the district; the catalogue generates thumbnails with one renderer and renders only the selected inspector continuously. This is not a claim of completed mobile optimization. Physical Intel iMac and phone testing remains outstanding.

Validation: 25 automated tests pass, including every family's three variations for finite geometry, grounding and envelope fit; exact catalogue grouping; deterministic Manhattan assignment; population and parcel separation. Build passes. Browser catalogue and district reviewed. The existing large-bundle warning remains.

---

Historical study notes follow.

# Manhattan Study 07 — eight versus sixteen towers

The default is now eight towers per regular block, arranged as two four-building frontages around a planted courtyard. Landmark blocks contain the landmark plus four real wallet towers. The 16-tower alternative preserves Study 06's regular block geometry and eight companions per landmark. Both use exactly the same 384 wallets, building dimensions, heights and visual identities; only placement and landscape change.

The eight-tower option has 41 regular blocks plus 12 landmark blocks; the sixteen-tower option has 18 regular blocks plus 12 landmark blocks. Partial blocks and unused grid cells are landscaped. The enlarged footprint accommodates the existing population; no wallets are fabricated. Plan exports use a shared camera, and the density controls expose both alternatives directly.

Validation: 22 tests pass, covering shared population/dimensions, counts, building separation and parcel/road clearance. Build passes. Physical device performance remains unverified.

---

Historical study notes follow; the current block counts and comparison are defined above.

# Manhattan Study 06 — a distinct high-rise district

The current preview replaces the mixed low-rise/landmark composition with a Manhattan high-rise vocabulary. The same 384 real wallets now occupy 18 regular tower blocks plus 12 landmark blocks in the compact option. Each landmark block includes eight neighboring wallet towers, redistributed from the existing cohort rather than added as decorative buildings. The comparison option has 23 regular tower blocks and the same 12 mixed landmark blocks.

Non-landmark buildings use address-seeded curtain-wall, setback office, limestone, Art Deco and terraced high-rise forms, with palette, glazing, width and roof detail variation. Proposed non-landmark heights range from 7 to 19 design units using the same score ordering. This is a deliberate visual-height change, not an eligibility or scoring change. Landmark dimensions are retained. Broader high-rise footprints and podiums replace townhouse forms; sidewalks, roads and window pitch remain consistent. Sparse landmark plazas are now occupied by real wallet neighbors, while entrances and pedestrian clearance remain open.

The original low-rise vocabulary remains available in the earlier study for a future outer-borough composition. This preview does not claim to map geographic Manhattan or to migrate the entire live population. A small planted court occupies unused compact block slots; the garden comparison retains public garden cells. Existing buy/sell beams and age colors remain.

Validation: production build and 21 automated tests pass, including high-rise classification, eight companion wallets per landmark, shared population, parcel clearance and pairwise building footprint separation. Browser district and street views reviewed. Physical Intel iMac/mobile performance remains unverified.

---

Historical study notes below describe earlier compositions; their layout counts and height treatments are superseded by Study 06 above.

# City composition 05 — approved City blocks direction

The current preview evolves Study 04 into one continuous district, using the same 384-wallet cohort and the same architectural dimensions. City blocks remains the default: 24 housing blocks plus 12 landmark blocks on a shared six-by-six street grid. Empire and Chrysler occupy neighboring blocks; the remaining landmarks are distributed across the district. Each landmark retains its own parcel, entrance apron, seating and corner planting.

The Garden blocks comparison remains available with 31 housing blocks and the same 12 landmarks. Remaining full cells are landscaped public gardens with cross-paths, fountain basins, mature trees and seating. These are public spaces, not invented wallets. Seventy-two decorative vehicles circulate through housing and landmark streets. The plan comparison uses the same camera and building population.

This is a snapshot composition study, not a production placement migration. Eligibility, scoring, flows and architectural identity are unchanged; the study proposes new parcel positions and retains Study 04's proposed visual height treatment. No production files were modified. Existing adaptive resolution remains; physical mobile and Intel iMac performance still require device testing.

Validation: 20 automated checks, including unique parcel occupancy, road clearance and landmark fit; production build; browser review of district and landmark views.

---

The following describes the preceding Study 04 baseline. Its separate landmark rows and footprint ratio have been superseded by the composition above.

# District Study 04 — landmark-led proportions

The benchmark is the original architectural study, not the inherited Manhattan plot grid. This is a new district proposal containing 384 real eligible wallets from the September 7 snapshot: the first 12 by existing score plus 372 deterministic samples across the remaining score distribution. All 50 residential identity types occur in the cohort.

## The controlled comparison

| | City blocks | Garden blocks |
|---|---:|---:|
| Real wallet buildings | 384 | 384 |
| Landmark buildings | 12 | 12 |
| Residential blocks | 24 | 31 |
| Maximum homes per block | 16 | 12 |
| Site area (design units²) | 8,352.64 | 13,959.00 |
| Relative footprint | 1.00× | 1.67× |

Both designs use identical wallet identities, balances, scores, architectural types, building widths and heights. Block dimensions, housing arrangement, sidewalk widths and planting space change. Unoccupied cells become public gardens, never invented wallets. “Save comparison” renders both overhead plans from the same camera into one PNG and restores the interactive view.

## Architecture and landmarks

Ordinary homes retain the original study's natural widths, depths and façade details. They are no longer squeezed into production plots. The 12 landmarks have independent broad plots; their surrounding architecture adapts to that scale. The default uses the authored landmark forms, with corrected façade UVs on custom shapes. A downloaded Empire State model is available as a comparison and is scaled uniformly, preserving its source aspect ratio. It remains a simplified, cropped source mesh, rather than a production-ready replacement for every landmark.

The three principal heights are calibrated together at 20 meters per design unit: Empire State including pinnacle (1,454 ft), Chrysler (318.9 m), and One World Trade Center including spire (1,776 ft). Sources: [Empire State Building](https://www.esbnyc.com/about/architecture-design), [CTBUH Chrysler record](https://www.skyscrapercenter.com/building/chrysler-building/422), [SOM One World Trade Center](https://www.som.com/projects/one-world-trade-center/). The remaining authored profiles and footprints are illustrative architectural approximations, not surveyed models. Floor/window texture pitch is shared across the district for visual consistency.

**This intentionally proposes a new visual height treatment.** Ordinary building heights use a compressed logarithmic score distribution; named landmarks use architectural proportions. Original wallet eligibility, snapshot balances, scores and rank order are retained, but the previous production height-to-footprint geometry is not reproduced. No production files or placement rules have been modified.

## Streets and landscape

Raised continuous sidewalks, kerbs, paving joints, zebra crossings, lane markings, benches, lamp posts, planters and a public waterfront are built with the district. Tree trunks and crowns have explicit sidewalk clearance. Seventy-two decorative vehicles follow closed routes through road corridors; traffic is independent of wallet activity, toggleable and stationary under reduced-motion preference. Buy/sell beams use the original decisive-mover thresholds against the full eligible population's maximum flow.

## Rendering and review

One district renderer is active at a time. Geometry is merged by shared material; vehicles and pick volumes are instanced. Pixel ratio is capped (lower on phone-sized viewports) and decreases under sustained slow frames. The render loop skips hidden documents. Layout and light changes preserve the camera. The phone review page embeds the district at 390 × 844; this checks responsive layout, not actual phone GPU performance. The original iMac and physical phones still need device benchmarks before production adoption.

The local preview offers district, landmark, street and overhead views, per-wallet selection/search, day/dusk/night, individual view export and a comparison export. The downloaded landmark is credited under `public/models/ATTRIBUTION.md`.

Validation: 19 automated checks pass. The city/garden toggle, landmark navigation, overhead comparison export, residential view and 390-pixel phone layout were exercised through the browser. Observed browser frame pacing was around 60 FPS; this is not a physical-device benchmark.

During night-mode validation the browser tab crashed. Inspection found scene rebuilds retained the old world while allocating the new one and kept discarded construction geometry in merge buckets. Rebuilds now dispose and clear the old scene first, clear renderer lists, and release merge buffers immediately after use. A fresh preview reopened successfully at 60 FPS; this observation does not establish the crash cause conclusively.

The recovered preview subsequently completed dusk-to-night switching successfully. Night harbor was visually verified with the statue and pedestal clearly illuminated, and reported 60 FPS / 215 draws / about 4M triangles. The active recovered browser preview is tab 14.

Visual verification of this repair: harbor and Jersey views show continuous support beneath the previously exposed waterfront blocks, separation of Liberty Island, and joined shore paving. Observed 60 FPS, about 5.9–6M triangles and 241–248 draws in those views.
