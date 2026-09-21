#!/usr/bin/env python3
"""Build the visual index for Project AEON — identify any crop of any token.

WHY THIS IS NOT AN LLM. Asking a model "which token is this a crop of" returns a fluent guess with
nothing behind it. This matches ORB keypoints and then verifies them with RANSAC: it keeps only the
matches that agree on ONE geometric transform between the query and a candidate. Random visual
similarity scatters; a real crop lines up. The confidence is therefore a COUNT anyone can reproduce
from the same two images, not an opinion — which is the only kind of number this project ships.

  python3 tools/nft-id/build_index.py            # downloads 3,333 tokens, writes out/aeon-index.npz
  python3 tools/nft-id/build_index.py --limit=50 # quick smoke run

Images are fetched, described, and DISCARDED — only descriptors and a thumbnail are kept, so the
index is ~100 MB instead of 1.6 GB. out/ is gitignored.
"""
import json, os, ssl, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import cv2, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
RARITY = os.path.join(ROOT, "public", "aeon-rarity.json")
# 2,000 is measured, not guessed: against a 30%-area, 1/3-scale, quality-55 crop the same token
# scores 13 inliers at 1,000 features and 38 at 2,000. 4,000 and 8,000 add nothing (37, 37) because
# the art yields ~7,000 keypoints total. Below 2,000 the index loses real matches to noise.
NFEAT, MAXDIM, THUMB = 2000, 900, 96

def arg(k, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{k}="): return a.split("=", 1)[1]
    return d

_ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt") if os.path.exists("/root/.ccr/ca-bundle.crt") else None
def fetch(url, tries=3):
    op = urllib.request.build_opener(urllib.request.HTTPSHandler(context=_ctx)) if _ctx else urllib.request.build_opener()
    op.addheaders = [("User-Agent", "Mozilla/5.0")]
    for t in range(tries):
        try: return op.open(url, timeout=40).read()
        except Exception:
            if t == tries - 1: return None
            time.sleep(1.5 * (t + 1))

def describe(buf, orb):
    """Grayscale, bounded resize, ORB. Returns (descriptors, keypoints, thumb, square-thumb)."""
    a = np.frombuffer(buf, np.uint8)
    im = cv2.imdecode(a, cv2.IMREAD_COLOR)
    if im is None: return None, None, None, None
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    s = MAXDIM / max(g.shape)
    if s < 1: g = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    kp, des = orb.detectAndCompute(g, None)
    th = cv2.resize(im, (THUMB, THUMB), interpolation=cv2.INTER_AREA)
    # A SQUARE centre crop, aspect preserved. The plain thumbnail squashes a portrait image into a
    # square, so its "centre" is not the same region as the centre of a real square crop — which is
    # what a circular profile picture is. Hashing this instead is what makes X's circle crop work.
    hh, ww = im.shape[:2]; side = min(hh, ww)
    sq = im[(hh - side) // 2:(hh - side) // 2 + side, (ww - side) // 2:(ww - side) // 2 + side]
    sqt = cv2.resize(sq, (THUMB, THUMB), interpolation=cv2.INTER_AREA)
    # Keypoint COORDINATES are stored beside the descriptors. Without them RANSAC cannot fit a
    # homography, and the whole method degrades to "these two images share some features" — which
    # is exactly the unverifiable similarity score this is meant to avoid.
    pts = np.float32([k.pt for k in kp]) if kp else None
    return des, pts, th, sqt

def main():
    tokens = json.load(open(RARITY))["tokens"]
    lim = arg("limit")
    if lim: tokens = tokens[:int(lim)]
    os.makedirs(OUT, exist_ok=True)
    print(f"indexing {len(tokens)} tokens")

    ids, desc, pts_, thumbs, squares, sizes = [], [], [], [], [], []
    done = [0]
    def work(tk):
        orb = cv2.ORB_create(nfeatures=NFEAT)     # not thread-safe to share
        b = fetch(tk["img"])
        if b is None: return None
        d, pts, th, sqt = describe(b, orb)
        done[0] += 1
        if done[0] % 250 == 0: print(f"  {done[0]}/{len(tokens)}", flush=True)
        if d is None or pts is None or len(d) < 20: return None
        return (int(tk["id"]), d, pts, th, sqt)

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=16) as ex:
        for r in ex.map(work, tokens):
            if r is None: continue
            ids.append(r[0]); desc.append(r[1]); pts_.append(r[2]); thumbs.append(r[3]); squares.append(r[4]); sizes.append(len(r[1]))

    flat = np.vstack(desc)                        # one array; offsets slice it back per token
    fpts = np.vstack(pts_)
    off = np.cumsum([0] + sizes)
    np.savez_compressed(os.path.join(OUT, "aeon-index.npz"),
                        ids=np.array(ids, np.int32), desc=flat, pts=fpts, off=off.astype(np.int64),
                        thumbs=np.array(thumbs, np.uint8), squares=np.array(squares, np.uint8))
    mb = os.path.getsize(os.path.join(OUT, "aeon-index.npz")) / 1e6
    print(f"\nindexed {len(ids)}/{len(tokens)} tokens, {flat.shape[0]:,} descriptors, {mb:.0f} MB, {time.time()-t0:.0f}s")
    if len(ids) < len(tokens):
        print(f"! {len(tokens)-len(ids)} token(s) had no usable image — they can never be matched")

if __name__ == "__main__":
    main()
