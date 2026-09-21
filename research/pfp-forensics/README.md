# PFP forensics — the social / trading / on-chain intersection

**The question.** A lot of X profiles wear a Project AEON NFT as their picture. The picture reads as
conviction in SPX6900. Does the wallet behind it behave that way?

**The finding so far, across four cases: no.** Not one is a buy-and-hold or DCA holder. There is no
case yet of someone accumulating steadily and sitting on it — the thing the picture implies.

| token | archetype | buy $ in "Bubble?"+ | sell $ in "Bubble?"+ | holds today |
|---|---|---|---|---|
| **#2451** | sold into strength | 57% | **80%** | 410,591 |
| **#3062** | bought the top, sold the dip | **83%** | 0% | 58,918 |
| **#2559** | FOMO, then diamond hands | **100%** | — never sold | 8,558 *(38,618 across 5 wallets)* |
| **#14** | distributor, exited | 0% | 43% | **0** |

Four cases is four cases — it is a pattern, not a proven population claim. The honest framing is
"every profile we have opened so far," and the count belongs in any post.

## How a case runs

1. **Picture → token.** `tools/nft-id/` — a perceptual hash for a whole image, ORB + RANSAC for a
   crop, and **trait intersection against the published metadata**, which is the one that generalises.
   AEON is trait-generated, so naming a visible feature narrows multiplicatively before a pixel is
   compared. Every step is a count anyone can re-derive; no model is asked to guess.
2. **Token → address.** `ownerOf(tokenId)` live, cross-checked against `dune/out/aeon_transfers.csv`.
   The holder is often a **cold shelf** that has never touched SPX — the trader is upstream in the
   custody chain.
3. **Address → cluster.** `scripts/cluster-pfp.mjs` (see below). **Not** the production
   `clusterEntities` rules — those are wrong for this job, see the next section.
4. **Cluster → behaviour.** Classify every transfer **at the transaction level**, then place the
   trades on the frozen rainbow.

### Two traps that produce confident, wrong, postable numbers

- **"A transfer to an SPX pool is a sale" is wrong twice over.** An **LP mint** sends tokens straight
  to the pool and is not a sale (they come back). An **aggregator sell** — CoW, 0x, 1inch, Paraswap —
  routes through a settlement contract and never looks like a transfer to a pool. On case #14 the
  shortcut reported 2,424,642 SPX sold; the real figure is **839,674**. Open the transaction.
- **The daily close is not the execution price.** On case #14 it overstated every trade by 14–28%.
  Read what actually changed hands: WETH crossing the SPX pool boundary × that day's ETH close.
  Validated against a 2,800.38 USDC input recorded in the same transaction — 3% error.

## Why the production clustering rules do NOT apply here

`clusterEntities` links a wallet on **FUND** when a fresh wallet is seeded **≥50,000 SPX**. That
constant is a **token count**, and it is wrong for this work in both directions:

**It over-merges in the launch era.** SPX has moved roughly 1,000× since launch:

| date | SPX price | 50,000 SPX was worth |
|---|---|---|
| 2023-09-04 | $0.00216 | **$108** |
| 2025-07-28 (ATH) | $2.13940 | **$106,970** |

In 2023 the community passed round 69,420 / 111,111 / 123,456 constantly — $150–300 tips. Every one
cleared the floor as "seeding a fresh wallet." Run from case #14's trader it produced **63 wallets and
116 links** and sprawled into an unrelated neighbourhood, past the engine's own >30 flag.

**And it under-merges for exactly the wallets this project cares about.** An influencer can be loud and
hold almost nothing. #2559 holds 8,558 SPX; #3062's trader wallet keeps **138**. A 50,000-token floor
does not see them at all. **For PFP work there is no minimum holding — small is the finding.**

### `scripts/cluster-pfp.mjs` — the rules that do apply

No value bar on self-moves. Structure over size:

- **NFT custody chain** — free transfers of the token itself, signed by the sending wallet.
- **ETH gas funding**, low fan-out. The production engine reads SPX flows only, so a shared gas funder
  that never touched SPX is invisible to it. On case #14 this found four links SPX flow could not,
  including the wallet that funded the shelf holding the NFT four minutes after moving it.
  ⚠ Guard hard: one funder in that case fed **42 distinct wallets** — a service, worth nothing.
- **Drain into empty** — a wallet empties ≥90% into a wallet that held nothing before. Both
  conditions. At **any** size, because a 500-SPX self-move is still a self-move.
  ⚠ Guarded the same way: a wallet that repeatedly empties itself into *different* fresh wallets
  is distributing, not migrating. A drain empties the sender, so a person can only do it once per
  refill — the bound is tighter than the gas one.

**Proof the bar mattered.** Run on #2559, these rules find **5 wallets holding 38,618 SPX**, linked by
drains of **876 and 98 SPX**. The production engine reported one wallet with 8,558, because every one
of those links is three orders of magnitude below its 50,000 floor. One of the wallets it missed,
`0xf87fb68d`, holds **28,921 SPX — more than the wallet wearing the picture**.
- **Never** through a tagged CEX / LP / contract, and never a partial send between two live wallets.

Also: **an EIP-7702 delegated EOA is not a contract.** Code beginning `0xef0100` is a delegation
designator; Pectra shipped May 2025, so code today says nothing about 2023–24. `enrich-addr-types.mjs`
calls its cache "monotonic, immutable" and gets this backwards, silently dropping historical links.

## What can never be claimed

**A profile picture does not prove ownership of a wallet.** X ended NFT verification in 2023, using
someone's art is routine, and tokens move — #3062 changed hands five days before we looked. Say it in
the post; someone will find the transfer in a minute if you don't.

X handles are deliberately **not** stored in `cases.json`. The repo is public. Cases are keyed by token
id and address — both public chain data, both independently checkable.

## Files

- `cases.json` — the registry. One object per case; append to `cases[]`.
- `charts/` — every rendered chart, named `<token>-<what>.png`.
- `case-14-evidence.md` — the full transaction-level evidence file for #14, the template for future ones.

Charts use `font-family="sans-serif"` only; `scripts/bot/font.mjs` remaps generic sans to the house
face. Hardcoding a family bypasses the remap and renders wrong.
