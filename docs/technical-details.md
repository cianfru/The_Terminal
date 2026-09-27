---
description: Where every number comes from, and how to check it yourself.
---

# Technical Details

Nothing in the city is illustrative. Every figure traces back to two committed data files and the
code that draws them.

## Where the data lives

| Element | Source |
| --- | --- |
| Residency, balances, holding age, flow | `public/whales.json`, written by the FIFO engine |
| Harbour supplies and venue split | `public/onchain.json` — `cexVenues`, `bridgeBal`, `burnBal`, `lpBal` |
| Height curve and building types | `src/city-render.js` — `heightOf`, `archetype` |
| Districts, lots, clearance, boroughs | `src/city-map.js` |
| Landmarks | `src/city-infra.js` — `SITES` |
| Notes | `src/city-messages.js`, `contracts/CityNotes.sol` |

The building distribution in [Architecture](reading-a-building/architecture.md) is a direct replay of
`heightOf` and `archetype` over `whales.json` — not a hand-maintained table.

## How the underlying data is built

Balances, holding ages and flows come from a **FIFO reconstruction** of every SPX transfer on
Ethereum. Each wallet is a queue of lots; a send consumes the earliest lots first, so every held coin
keeps its true acquisition date and cost.

That reconstruction runs locally against a transfer archive, refreshed daily from an incremental
on-chain pull. Exchange, LP, bridge and burn addresses are tagged and excluded from the holder set,
which is what makes the remaining buildings real holders rather than infrastructure.

### When a holder changes wallets

A send normally counts as spending the coins: it books a realized profit or loss and ends their
holding age. That is wrong when a holder is only moving to a new wallet of their own, so three
patterns keep the coins' age and cost instead:

| Pattern | What it looks like |
| --- | --- |
| Split | In one block, a wallet sends at least 90% of its balance to 3–20 empty wallets in near-equal amounts |
| Consolidation | In one block, 2–20 wallets each send at least 90% of their balance into one empty wallet |
| Migration | A wallet sends a small test to an empty wallet, **gets a test back**, then sends at least 90% of its balance — all within 24 hours, with the new wallet dealing with no one else in between |

The return leg is what separates a migration from a sale: an exchange deposit address takes test
sends but never sends one back, and a buyer paying for coins doesn't either. The rule needs at least
100,000 SPX to move, and it is skipped when either side is a contract. Every match is listed in
`public/self-moves.json`, so each one can be checked on Etherscan.

Run over the full history to August 2026, the migration rule found 35 moves covering 46M SPX
(31 carried over; 4 touched a contract and were left as ordinary transfers). The rule was added
after a 1.77M SPX move on 26 September 2026 read as a $2.3M realized loss and 770M coin-days
destroyed in a single day.

## Rebuilding the city on a past date

The city can be rebuilt **as it stood on any date** by truncating the transfer archive at that date
and re-running the engine. The whale snapshot is taken at the end of the replay, so the output is
that date's city — every building, height, colour and beam.

This is how the October 2024 frames in [Flow](reading-a-building/flow.md) were produced. Nothing in
them is reconstructed by hand or approximated.

## Rendering

The city is three.js. Buildings are merged into shared meshes by material family, age band and flow
direction, so the entire city costs on the order of **75 draw calls** regardless of whether it is
drawing 600 buildings or 4,893.

Picking rides an invisible instanced bounding box per building — one draw call for the whole city,
returning the building under the cursor.

{% hint style="info" %}
`window.__cityStats()` reports live buildings, draw calls, triangles and camera position from the
browser console. `window.__cityCam(position, target, fov)` parks the camera anywhere and renders a
single frame.
{% endhint %}
