# SPX City 2.0 — visual prototype

Standalone review of the new city renderer. It does not replace the production `/city` page or connect to production authentication and refresh jobs. Wallet and infrastructure inputs are the September 7, 2026 public snapshot bundled in `src/fullcity/`.

## Run locally

Use Node 22.12+ (or Node 20.19+).

```sh
cd prototypes/spx-city-2.0
npm ci
npm run dev -- --port 5180
```

Open **http://127.0.0.1:5180/?district=1&geography=1** for the full 4,825-wallet city. The City controls overlay starts closed. Open it to select neighborhoods, change lighting, search an address, or compare architectural detail. Click a wallet building for its details and Zerion preview.

Other review routes:

- `/` — original 96-wallet visual study with matched production/proposed views.
- `/?district=1` — 384-wallet block/density comparison.
- `/?catalogue=1` — procedural silhouette catalogue.
- `/?proof=1` — architectural quality proof.
- `/?intro=1` — before/after introduction.
- `/?flypass=1` — continuous Statue of Liberty → docks → Fifth Avenue → Central Park flight.

```sh
npm test
npm run build
npm run preview -- --port 5180
```

## Review scope

- Address-seeded architectural families, landmark proportions, varied low-rise buildings and facade details.
- Day, dusk and night lighting; age-colored windows and buy/sell edge accents.
- Streets, planting, promenades, road lighting, vehicles and headlights.
- Coastal street reclamation: short waterfront fragments become gardens; blind tails stop at their last connected junction. Traffic uses the revised road list.
- Full building/base/entrance envelopes receive supporting ground in every borough. Wallet positions and identities remain unchanged.
- City-first interface with expandable in-window controls, wallet search and Zerion cards.
- Snapshot harbor infrastructure and attributed Liberty/Empire models.

## Validation and limits

72 automated tests pass, including wallet/position invariants, waterfront building support, coastal road pruning, full ground assembly, geometry, traffic and flight continuity. The prototype build also passes. Desktop browser views were visually reviewed; mobile layout and quality limits exist, but performance on real mobile hardware still needs validation.

Zerion previews are fetched on selection from its public image endpoint; failures retain a wallet identity fallback and link. Traffic follows bidirectional looping routes, not a junction-aware traffic simulation. Film export is silent WebM in the browser; the optional localhost export receiver used during authoring is not required (download is the fallback).

This is a visual review deliverable. Production data plumbing, full City 1.0 feature parity, mobile-device profiling and deployment are separate integration work.

## Assets and history

See [model attribution](public/models/ATTRIBUTION.md), the accompanying source metadata, and [upstream license](UPSTREAM-LICENSE). [District study notes](DISTRICT-STUDY.md) and [early neighborhood study](NEIGHBORHOOD-STUDY.md) preserve the design history; older counts and descriptions there refer to earlier studies.

Generated videos, promotional artwork, screenshots, dependency folders and build output are intentionally excluded from source control.
