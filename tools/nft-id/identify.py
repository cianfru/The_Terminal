#!/usr/bin/env python3
"""Identify which Project AEON token an image is.

  python3 tools/nft-id/identify.py pfp.png
  python3 tools/nft-id/identify.py crop.jpg --json

TWO METHODS, because two different questions hide behind "which NFT is this":

  WHOLE IMAGE (a profile picture) -> perceptual hash. The query IS the artwork, just resized and
  recompressed, so a 63-bit DCT hash identifies it outright. Measured on 14 tokens degraded to
  200px JPEG q50: 14/14 correct, true-match Hamming distance <= 2 against a runner-up >= 10.

  A CROP (a fragment) -> ORB keypoints + RANSAC. Far weaker here, and the honest reason is in the
  art, not the algorithm: AEON is trait-generated, so tokens share whole layers. A fragment landing
  on a shared background matches dozens of tokens with a PERFECT homography, because those pixels
  really are identical. Measured on 24 random crops: 10/24. So crops return a CANDIDATE SET, never
  a single confident answer.

A tool that always names something is worse than no tool. When the evidence is ambiguous this says
so, and when several tokens tie it lists them all.
"""
import json, os, sys
import cv2, numpy as np

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
INDEX = os.path.join(OUT, "aeon-index.npz")
NFEAT, MAXDIM, SHORTLIST = 4000, 900, 40
HASH_HIT, HASH_GAP = 8, 4        # confident: distance <= 8 AND at least 4 clear of the runner-up
CROP_MIN_INLIERS = 20

def arg(k, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{k}="): return a.split("=", 1)[1]
    return d

def square(img, frac=0.70):
    """The square INSCRIBED in a circular crop — not merely the centre square.

    X renders every profile picture as a circle, blanking the corners. Taking min(h,w) of an
    already-square 240x240 circular image returns the whole thing, blanked corners and all, which is
    exactly the bug that made this fail the first two times. The largest square that fits inside a
    circle has side = diameter/sqrt(2) ~= 0.707, so crop to that and the masked corners are gone.
    The index applies the identical crop to its own centre squares, so both sides see one region."""
    h, w = img.shape[:2]; side = min(h, w)
    sq = img[(h - side) // 2:(h - side) // 2 + side, (w - side) // 2:(w - side) // 2 + side]
    k = int(side * frac); o = (side - k) // 2
    return sq[o:o + k, o:o + k]

def phash(img, hs=8, size=32):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    g = cv2.resize(g, (size, size), interpolation=cv2.INTER_AREA).astype(np.float32)
    v = cv2.dct(g)[:hs, :hs].flatten()[1:]    # drop DC — it only carries overall brightness
    return (v > np.median(v)).astype(np.uint8)

_cache = {}
def load_index(index=INDEX):
    """315 MB, so read once and reuse across queries."""
    if index not in _cache:
        z = np.load(index)
        H = np.array([phash(t) for t in z["thumbs"]])
        C = np.array([phash(square(t)) for t in z["squares"]])  # same inscribed crop as the query
        _cache[index] = (z["ids"], z["desc"], z["pts"], z["off"], H, C)
    return _cache[index]

def good(bf, dq, dt, ratio=0.75):
    if dt is None or len(dt) < 2: return []
    raw = bf.knnMatch(dq, dt, k=2)
    return [m for m, n in (p for p in raw if len(p) == 2) if m.distance < ratio * n.distance]

def by_keypoints(img, ids, desc, pts, off, shortlist=SHORTLIST):
    s = MAXDIM / max(img.shape[:2])
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    if s < 1: g = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    kq, dq = cv2.ORB_create(nfeatures=NFEAT).detectAndCompute(g, None)
    if dq is None or len(dq) < 10: return []
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    counts = np.fromiter((len(good(bf, dq, desc[off[i]:off[i+1]])) for i in range(len(ids))),
                         dtype=np.int32, count=len(ids))
    out = []
    for i in np.argsort(counts)[::-1][:shortlist]:
        gm = good(bf, dq, desc[off[i]:off[i+1]])
        if len(gm) < 8: continue
        src = np.float32([kq[m.queryIdx].pt for m in gm]).reshape(-1, 1, 2)
        dst = np.float32([pts[off[i] + m.trainIdx] for m in gm]).reshape(-1, 1, 2)
        _, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
        out.append({"id": int(ids[i]), "inliers": int(mask.sum()) if mask is not None else 0})
    out.sort(key=lambda r: -r["inliers"])
    return out

def identify(path, index=INDEX):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None: sys.exit(f"cannot read {path}")
    ids, desc, pts, off, H, C = load_index(index)

    # try the whole image first, then the centre square — a circular PFP only matches the latter
    dFull, dCent = (H != phash(img)).sum(1), (C != phash(square(img))).sum(1)
    d, how = (dFull, "hash") if dFull.min() <= dCent.min() else (dCent, "hash-centre")
    order = np.argsort(d)
    best, second = int(d[order[0]]), int(d[order[1]])
    tied = [int(ids[i]) for i in order if int(d[i]) == best][:8]

    if best <= HASH_HIT and (second - best) >= HASH_GAP:
        return {"method": how, "match": int(ids[order[0]]), "distance": best,
                "runnerUp": second, "confident": True, "ambiguous": [],
                "candidates": [{"id": int(ids[i]), "distance": int(d[i])} for i in order[:5]]}
    if best <= HASH_HIT and len(tied) > 1:
        return {"method": how, "match": None, "distance": best, "runnerUp": second,
                "confident": False, "ambiguous": tied,
                "candidates": [{"id": int(ids[i]), "distance": int(d[i])} for i in order[:8]]}

    cands = by_keypoints(img, ids, desc, pts, off)
    top = cands[0]["inliers"] if cands else 0
    return {"method": "keypoints", "match": None, "confident": False,
            "note": "whole-image hash found nothing — treating this as a crop. In a trait-generated "
                    "collection a fragment can genuinely belong to many tokens, so these are "
                    "candidates, not an answer.",
            "hashDistance": best,
            "candidates": [c for c in cands[:8] if c["inliers"] >= CROP_MIN_INLIERS] or cands[:5]}

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    if not os.path.exists(INDEX): sys.exit("no index — run tools/nft-id/build_index.py first")
    r = identify(sys.argv[1])
    if "--json" in sys.argv: print(json.dumps(r, indent=1)); return
    print(f"query: {sys.argv[1]}   method: {r['method']}\n")
    for c in r["candidates"]:
        met = f"distance {c['distance']}" if "distance" in c else f"{c['inliers']} inliers"
        print(f"  AEON #{c['id']:<5} {met}")
    print()
    if r["confident"]:
        print(f"VERDICT: AEON #{r['match']}  (hash distance {r['distance']}, runner-up {r['runnerUp']})")
    elif r.get("ambiguous"):
        print(f"VERDICT: ambiguous — {len(r['ambiguous'])} tokens are visually identical at this resolution:")
        print("         " + ", ".join(f"#{i}" for i in r["ambiguous"]))
    else:
        print("VERDICT: no confident match —", r.get("note", ""))

if __name__ == "__main__":
    main()
