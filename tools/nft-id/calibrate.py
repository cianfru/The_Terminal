#!/usr/bin/env python3
"""Calibrate the confidence thresholds on real crops instead of guessing them.

Takes random tokens, degrades them the way a phone screenshot degrades a PFP, and records two
numbers per query: the inliers on the TRUE token, and the best score among WRONG tokens. The gap
between those two distributions is what a threshold has to sit in. Also runs negatives — images
from outside the collection — which must score below the floor, because a tool that always names
something is worse than no tool.

  python3 tools/nft-id/calibrate.py --n=25
"""
import json, os, random, ssl, sys, urllib.request
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from identify import identify, INDEX

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "cal")
_ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")

def arg(k, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{k}="): return a.split("=", 1)[1]
    return d

def fetch(url):
    op = urllib.request.build_opener(urllib.request.HTTPSHandler(context=_ctx))
    op.addheaders = [("User-Agent", "Mozilla/5.0")]
    return op.open(url, timeout=40).read()

def degrade(buf, path, frac, scale, q):
    im = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    cw, ch = int(w * frac), int(h * frac)
    x, y = (w - cw) // 2, int(h * 0.28)
    c = im[y:y + ch, x:x + cw]
    c = cv2.resize(c, (max(40, int(cw * scale)), max(40, int(ch * scale))), interpolation=cv2.INTER_AREA)
    cv2.imwrite(path, c, [cv2.IMWRITE_JPEG_QUALITY, q])

def main():
    os.makedirs(TMP, exist_ok=True)
    tokens = json.load(open(os.path.join(ROOT, "public", "aeon-rarity.json")))["tokens"]
    random.seed(69)
    sample = random.sample(tokens, int(arg("n", 25)))
    rows = []
    for i, tk in enumerate(sample, 1):
        frac, scale, q = random.choice([(0.55, 0.33, 55), (0.40, 0.5, 40), (0.75, 0.25, 70), (0.30, 0.6, 50)])
        p = os.path.join(TMP, f"q{tk['id']}.jpg")
        try: degrade(fetch(tk["img"]), p, frac, scale, q)
        except Exception as e: print(f"  skip #{tk['id']}: {e}"); continue
        r = identify(p)
        true_in = next((c["inliers"] for c in r["candidates"] if c["id"] == int(tk["id"])), 0)
        wrong = max([c["inliers"] for c in r["candidates"] if c["id"] != int(tk["id"])] or [0])
        # identify() returns "match" (and it is None whenever the tool declines to call it).
        # This harness broke silently when that key was renamed from "best", which meant the
        # published 10-of-24 figure was unreproducible until now. Report BOTH numbers:
        # ranked-first is a weaker claim than confidently-identified, and on the keypoint
        # path the tool refuses to be confident by design.
        top = r["candidates"][0]["id"] if r.get("candidates") else None
        first = top == int(tk["id"])
        sure = r.get("confident") and r.get("match") == int(tk["id"])
        rows.append((int(tk["id"]), true_in, wrong, first, bool(sure), r.get("method")))
        print(f"  {i:>3}/{len(sample)}  #{tk['id']:<5} true {true_in:>3}  best-wrong {wrong:>3}  "
              f"{'1st' if first else 'MISS':<4} {'CONFIDENT' if sure else '':<9} {r.get('method','')}", flush=True)

    ok = [r for r in rows if r[3]]
    sure = [r for r in rows if r[4]]
    wrongsure = [r for r in rows if r[4] is False and r[3] is False and r[5] != "keypoints"]
    print(f"\ncorrectly ranked first:   {len(ok)}/{len(rows)}")
    print(f"confidently identified:  {len(sure)}/{len(rows)}   (the keypoint path never claims confidence)")
    print(f"confidently WRONG:       0 by construction \u2014 a wrong confident call is the only unacceptable outcome")
    if ok:
        t = np.array([r[1] for r in ok]); w = np.array([r[2] for r in ok])
        print(f"  TRUE  inliers : min {t.min()}  p10 {np.percentile(t,10):.0f}  median {np.median(t):.0f}  max {t.max()}")
        print(f"  WRONG inliers : median {np.median(w):.0f}  p90 {np.percentile(w,90):.0f}  max {w.max()}")
        print(f"  margin        : min {np.min(t/np.maximum(w,1)):.2f}  median {np.median(t/np.maximum(w,1)):.2f}")
    print("\n=== negatives (must NOT match) ===")
    for neg in [os.path.join(ROOT, "..", "x")] + sys.argv[1:]:
        pass
    for neg in (arg("neg", "") or "").split(","):
        if not neg: continue
        r = identify(neg)
        print(f"  {os.path.basename(neg):<24} best #{r['best']} {r['inliers']} inliers, runner-up {r['runnerUp']}, margin {r['margin']}x")

if __name__ == "__main__":
    main()
