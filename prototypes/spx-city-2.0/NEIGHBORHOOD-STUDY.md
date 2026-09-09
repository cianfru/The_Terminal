# SPX City — New York identity study / 03

Stable built preview: http://127.0.0.1:5179/

Development preview: http://127.0.0.1:5178/

Study 02 extended the approved neighborhood visual direction with 12 individually modeled New York wallet landmarks and two geographically anchored harbor landmarks. Source data and inherited render/map code: [SPX6900 Rainbow](https://spx6900rainbow.xyz), repository commit `eafb456b5c13987e7f682dccded861bd96401703` in [The_Terminal](https://github.com/cianfru/The_Terminal/tree/eafb456b5c13987e7f682dccded861bd96401703). Source license is retained in `UPSTREAM-LICENSE`.


## Study 03: realism and personal buildings

- Liberty is now a **licensed scan of a physical Statue of Liberty model by GoMeasure3D**, not the procedural approximation. It is not a scan of the full-size monument. The upright, recolored browser asset is simplified to approximately 4.47 MB. Credits, license link and modification notice appear in the app, exported views and `public/models/ATTRIBUTION.md`.
- Brooklyn Bridge now uses a 1-unit-per-100-metre scale: approximately 1,834 m including approaches, 486 m main span, 41 m central clearance, 84 m towers and 25.9 m deck width. Total length/main span/clearance follow [NYC DOT](https://www.nyc.gov/html/dot/html/infrastructure/brooklyn-bridge.shtml); tower/width are approximate. It keeps the source bridge centerline, with authored extensions to ground-level streets. Supported ramps replace the floating road ends. This is a proportioned architectural model, not surveyed engineering geometry.
- Central Park has approximately 1,000 seeded trees, lawns, the Reservoir, the Lake, paths, Bow Bridge and Bethesda Terrace/Fountain. The park outline comes from the repository; landscape geometry is an authored interpretation. Reference: [Central Park Conservancy — Bow Bridge](https://www.centralparknyc.org/locations/bow-bridge).
- Regular wallets draw from **50 combinatorial base types**: ten architectural families × five roof profiles, plus address-seeded palettes, window treatments, entrances, balconies, awnings, gardens and proportions. There are 44 base types among this sample's 84 regular buildings. These are a modular procedural library, not 50 separately downloaded models.
- Design identity uses a lowercased wallet address and the immutable `spx-architecture-v1` seed namespace. It is independent of balance, age, flows and population order. Runtime height and data lighting remain live data channels. The actual rendered form can change in height; the trait identity remains fixed. `public/building-identities.json` records the type catalogue and this snapshot's assignments.

**Licensed tower models:** A CC BY Empire State Building candidate by Brian Trepanier was verified ([source](https://sketchfab.com/3d-models/empire-state-building-new-york-city-ny-usa-941cad02f4db4883b40bddf4c5d20c94), about 1.45 million triangles). It is not included in the renderer. The 12 existing procedural landmarks remain in use; a full ten-asset licensed replacement library has not been assembled. Imported towers need geometry optimization, style matching and material separation for age/flow signals before replacing this working set.

**Collectible groundwork:** The identity manifest can support a future mint snapshot, but there is no minting, payment, smart contract or ownership verification in this prototype. A future collectible should freeze the identity version, trait manifest, asset versions, render settings and relevant data snapshot so a later algorithm update cannot silently change the minted art. This study does not enforce global visual uniqueness; many trait combinations create variety, while the wallet address is the unique identifier.

Ten automated tests now pass, including address normalization, data-independent traits and continuous bridge approach heights. Browser renders were inspected for Liberty, bridge, park, fountain and the varied neighborhood. This remains a local study, with no changes to the deployed site.

## Explore

- **NYC landmarks** opens the 12-building library; selecting one focuses its real wallet and balance.
- **Explore the harbor** opens Statue of Liberty, Brooklyn Bridge, and geographic-context views. Drag to orbit and scroll to zoom.
- **Wallet light** controls data lighting: warm amber to cyan windows indicate newer to older holding age; vivid green/red roof edges indicate positive/negative 30-day net flow. Tiny flows retain their direction. Colors represent net changes, not individual transaction events. Age remains visible for moving wallets.
- **Production / Compare / Proposed** shows matched neighborhood views. Export saves six fixed-camera images and a contact sheet. Harbor has its own export button.

## The 12 wallet landmarks

| Balance rank | Architecture |
|---|---|
| 1 | Empire State Building |
| 2 | Chrysler Building |
| 3 | One World Trade Center |
| 4 | Woolworth Building |
| 5 | 30 Rockefeller Plaza |
| 6 | Flatiron Building |
| 7 | MetLife Tower |
| 8 | 40 Wall Street |
| 9 | 70 Pine Street |
| 10 | 432 Park Avenue |
| 11 | 30 Hudson Yards |
| 12 | 56 Leonard Street |

These are stylized, procedural architectural interpretations, not surveyed replicas. Crown geometry, silhouette, materials, and details distinguish the landmarks. Normalized body and crown heights retain the production height envelope; real-world relative building heights are deliberately not reproduced because height carries wallet data.

## Data and placement

The fixture contains 96 real wallets from the **2026-09-07** repository snapshot (4,825 eligible rows, using the production `res !== false` rule). Study 02 contains the 12 largest eligible balances plus 84 lower-scale wallets retained from Study 01. All addresses, balances, holding ages and 7/30-day flows were checked against the upstream snapshot. The top 12 were verified against the full eligible population, not just this sample. Balances determine landmark assignment; existing size-and-age scores determine height, using full-population bounds. Assignments are frozen to this snapshot, with no implicit live reassignment policy.

Both neighborhood treatments use the same 96 wallets, calculated heights, staged parcels, and cameras. The baseline reuses production building geometry, facade functions and material families inside the study renderer. It does not reproduce the full live renderer, its complete geography or postprocessing. Study 01 outputs and fixture are retained in `review/study-01/`.

The harbor preserves upstream source anchors and projection independently of the staged neighborhood: Liberty Island at **40.6892, −74.0445** represents the burn address; Brooklyn Bridge follows the line from **40.7115, −74.0038** to **40.7003, −73.9903**, with new approach extensions beyond these anchors, representing Wormhole bridge infrastructure. It is not a holder wallet. No live or estimated supply totals are presented. Sculpture size, bridge cross-section and island outline are illustrative. Geographic context uses the repository's baked coastline and harbor water patch, attributed to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Wallet architectural assignments do not describe owners' real locations or identities.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
```

The original eight automated tests cover sample identity/tier counts, production height bounds, model envelopes, footprint spacing, determinism, small-flow visibility, independent age coloring and landmark balance order. Desktop browser checks cover library selection, real wallet details, harbor navigation, geometry rendering and exported images. Full-city performance and physical-device mobile benchmarking remain outside this visual proof. The production build succeeds with a bundle-size warning (~994 kB before gzip); this standalone study is not optimized as a production route.

Main outputs: `review/spx-city-matched-views.png`, `review/spx-city-skyline-proposed.png`, `review/spx-city-liberty.png`, `review/spx-city-bridge.png`, and `review/spx-city-map.png`. Export PNGs carry visible source credits. The dev-only export middleware writes to the review directory; a built app downloads images instead.

## Architectural references

Recognition cues checked against [Empire State Building architecture](https://www.esbnyc.com/about/architecture-design), [National Park Service Statue of Liberty facts](https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm), and [NYC DOT Brooklyn Bridge](https://www.nyc.gov/html/dot/html/infrastructure/brooklyn-bridge.shtml).

Next integration step: move the reusable landmark geometry and fixed assignment manifest into the live city renderer, retaining its existing geographic placement, picking, supply semantics and level-of-detail system. Decide a stable assignment policy before enabling live rank changes so buildings do not swap identities on every trade. This deliverable remains a local design study; it has not changed the deployed site.

## Full city / Activity map — September 8

Open **Activity map** in the preview. This additional view uses all 4,825 eligible wallets from the fixed September 7 snapshot, with the upstream eligibility flag, score formula, city scale and `placeCity` coordinates. The 96-wallet architecture study remains a separate fixture. No production files or on-chain rules are changed.

- North-up night map: one light per eligible wallet, green/red for positive/negative **net balance change**. Quiet wallets remain dim. 1/7/30-day controls use d1/d7/d30. These are not gross trading volumes or individual transfers.
- Brightness is log(1+abs(change))/log(1+largest abs(change)) in the selected window; relative scales differ between windows. Neighborhood ranking sums positive and negative magnitudes separately, avoiding cancellation.
- The map flattens the presentation, not the eligibility/ranking/placement logic. North-up display reflects the source map’s +z-north coordinates. All wallet picks use the same scene transform. Normal skyline beams retain the upstream rule (flow cut .02 and magnitude > .12); the 96-wallet study now also shows those qualifying beams.
- Full-city skyline uses production forms, with an optional imported Empire State Building comparison for the first score-ranked wallet. It does not silently apply the fixture’s twelve static landmark assignments. The import is cropped to the building and fitted to the current envelope; shared .42 floor/.46 window UV pitch improves material consistency but modeled architectural details retain the source geometry.
- Optional ambient traffic follows existing road segments. It is decorative, unrelated to transactions, and stationary under reduced-motion preference. Branding remains restrained in the interface.
- Full-city rendering is lazy loaded. Geometry/assets and renderer resources are disposed when the view closes. This is a local snapshot prototype, not a live-data deployment.

Validation: 14 tests include unchanged eligibility, score and parcel placement across activity windows; signed aggregation without cancellation; zero-safe monotonic brightness; north-up parcel picking; existing building identity and envelope checks. `npm run build` succeeds. Large bundle warning remains for the local study.

## Study 03 expanded to the city — September 8 follow-up

**Study 03 · Full city** now applies the approved architectural treatment to the entire 4,825-wallet snapshot, superseding the previous full-city renderer's original-building-only comparison. Façade palettes, entrance details, balconies, cornices and five roof families are carried over from the small study. Geometry is merged by material, and all details are fitted inside each production building envelope. Score, eligibility, height calculation and wallet coordinates are unchanged. Twelve score-ranked wallets wear landmark designs as visual skins; the optional imported Empire State Building still replaces the leading skin. These skins do not establish permanent wallet ownership of landmarks.

The expanded city includes the licensed Liberty model, the completed Brooklyn Bridge geometry, and the park/fountain design. Liberty is intentionally displayed at five times geographic scale; bridge width/height are exaggerated three times while its centerline and length remain fixed, to read beside data-scaled wallet buildings. Views cover Midtown, residential blocks, the park, the harbor and the overall city, with day/dusk/night lighting and an original-treatment comparison. The camera is retained when changing treatment or lighting.

Tree correction: removed the small study's tree placements on street centerlines. Park trees now reject complete path segments (not just path sample points), transverse-road polygons and road/park-edge clearance buffers. The same corrected park generator is used by the harbor and expanded city.

Validation: 16 tests pass, including actual generated park tree locations against road polygons and path-clearance edge cases. Full-city Midtown and residential views were inspected in the browser. This remains a local, fixed-snapshot visual prototype, not a production deployment.

## District Study 04

Open **New landmark district**, or `/?district=1`. This proposal replaces the inherited plot proportions with 384 real wallets arranged around broad landmark plots. It includes a compact layout and a garden layout using identical building dimensions. See [DISTRICT-STUDY.md](./DISTRICT-STUDY.md) for the cohort, comparison, proposed height treatment, source references and performance scope. The full-city and activity prototypes remain available as earlier studies.
