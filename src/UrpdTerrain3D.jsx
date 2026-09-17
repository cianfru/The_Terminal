import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { loadUrpdHistory, loadOnchain } from "./history-data.js";
import { SANS, MONO, ViewTabs } from "./chart-ui.jsx";
import { DATA_MODES, VIEW_MODES, terrainSeries, heightRef, axisTicks, fmtValue } from "./urpd-terrain.js";

// URPD TERRAIN OVER TIME — the cost-basis distribution as a landscape that deforms week by week, with
// the live price sweeping through it as a curtain. X = cost basis (log price), Z = time (week), Y =
// share of supply held at that price. Every week's slice sits on ONE fixed price grid (built in the
// FIFO engine), so the slices stack into a coherent surface. The terrain is coloured by profit vs THAT
// week's spot — GREEN where the coins sitting there are in profit (cost ≤ price), RED where they're
// underwater — and a translucent white curtain marks spot, so you watch the price wall sweep across the
// bags: walls of supply forming, ageing, going green as price climbs past them or red as it falls back.
//
// Two axes sit on top of that. DATA swaps what is stacked — supply, the USD it cost (invested
// capital), or what it has made or lost since (unrealized P&L). VIEW swaps level for CHANGE over a
// window, which turns the landscape into a delta surface: the only view that shows WHICH cost-basis
// bands are being accumulated or distributed rather than merely where supply sits. Both are pure
// arithmetic over data we already ship (src/urpd-terrain.js) — no new feed.
//
// A signed surface (P&L, or any change) is drawn around a ZERO PLANE, dipping below it where the
// value is negative, and coloured by its own sign. An unsigned one sits on the floor and is coloured
// in profit / underwater against that day's spot.
//
// A reconstruction, not a signal. three.js is code-split, so nothing here touches the base bundle.

const fp = p => p >= 1 ? "$" + p.toFixed(1) : p >= 0.01 ? "$" + p.toFixed(2) : "$" + p.toFixed(3);
const GREEN = [0.13, 0.77, 0.37], RED = [0.98, 0.44, 0.52];

// The cost-basis history is now DAILY (~1000+ slices). The terrain is a coarse landscape, so
// downsample it to ~weekly here — 7× fewer slices keeps the 3D light and readable while the 2D
// ladder (CostBasisLadder) uses the full daily resolution off the same file.
function toWeekly(weeks) {
  if (!Array.isArray(weeks) || weeks.length <= 180) return weeks;
  const stride = Math.ceil(weeks.length / 180);
  const out = weeks.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== weeks[weeks.length - 1]) out.push(weeks[weeks.length - 1]); // always keep the live edge
  return out;
}

function buildScene(el, hist, series, isMobile) {
  const { edges, nBuckets } = hist;
  const { signed, unit } = series;
  const weeks = toWeekly(series.frames);      // downsample AFTER the transform — never diff a thinned series
  const nW = weeks.length, nB = nBuckets;
  const price = Array.from({ length: nB }, (_, i) => Math.sqrt(edges[i] * edges[i + 1]));
  const loLog = Math.log(hist.pMin), span = (Math.log(hist.pMax) - loLog) || 1;
  const spotX = spot => Math.max(0, Math.min(nB, ((Math.log(Math.max(spot, hist.pMin)) - loLog) / span) * nB));

  const maxV = Math.max(...weeks.flatMap(w => w.v.map(Math.abs)), 1e-6);
  const DZ = Math.max(0.4, Math.min(0.9, 60 / nW));   // depth per week — keep the whole span ~visible
  // Vertical scale. The launch week parks ~100% of supply in ONE bucket; scaling height to that global
  // max flattens every other week into a plain (the "too shallow" read). Instead scale to a robust
  // PERCENTILE of real walls (p97 ≈ a typical fat wall), exaggerate the relief with a gamma (>1 → taller
  // peaks AND deeper valleys), and CLAMP so the launch spike stays a tall wall without towering off-screen.
  const ref = heightRef(series.frames);        // p97 of |value| over the FULL daily series
  const PEAK = isMobile ? 15 : 18;    // world height a reference wall reaches (kept below the time-depth so it reads as a landscape)
  const GAMMA = 1.25;                 // >1 = punchier relief (deep valleys, tall peaks)
  const CAP = 2.6;                    // clamp only the extreme launch concentration
  // A signed surface keeps its sign in the geometry: negative values hang BELOW the zero plane.
  const mag = v => Math.min(CAP, Math.pow(Math.abs(v) / ref, GAMMA)) * PEAK;
  const hOf = v => (signed ? Math.sign(v) * mag(v) : mag(Math.max(0, v)));
  const topH = PEAK * CAP;            // tallest rendered height — camera / curtain / axis reference
  const botH = signed ? -topH : 0;    // a delta surface needs room underneath the zero plane
  const cx = nB / 2, depth = (nW - 1) * DZ, cz = depth / 2;

  const W = el.clientWidth, H = isMobile ? 400 : 560;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0e1c);
  scene.fog = new THREE.Fog(0x0a0e1c, depth * 1.1, depth * 2.6);
  const cam = new THREE.PerspectiveCamera(46, W / H, 0.1, 2000);
  // The UNSIGNED framing is the original, untouched — that view is live and must not shift. A signed
  // surface spans −topH…+topH, twice the height, so its distance is DERIVED from the geometry (fit the
  // vertical span into the camera's field of view) rather than nudged by hand: guessing constants on a
  // software rasteriser is how you ship a chart framed for a machine nobody uses.
  if (signed) {
    const fovY = (46 * Math.PI) / 180;
    const fit = (topH * 1.15) / Math.tan(fovY / 2);          // half-span ÷ tan(half-fov)
    cam.position.set(nB * 0.5, topH * 0.55, Math.max(fit, depth * 0.85));
  } else {
    cam.position.set(nB * 0.5, Math.max(44, topH * 1.55), depth * 1.12 + 52);
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H);
  el.appendChild(renderer.domElement);

  const labelR = new CSS2DRenderer(); labelR.setSize(W, H);
  Object.assign(labelR.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" });
  el.appendChild(labelR.domElement);
  const addLabel = (text, x, y, z, color, size = 11, weight = 500) => {
    const d = document.createElement("div");
    d.textContent = text;
    Object.assign(d.style, { color, font: `${weight} ${size}px 'Geist', system-ui, sans-serif`, whiteSpace: "nowrap", textShadow: "0 1px 3px #000", opacity: "0.92" });
    const l = new CSS2DObject(d); l.position.set(x, y, z); scene.add(l); return l;
  };

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(nB * 0.5, topH + 34, depth * 0.4); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x88aaff, 0.35); d2.position.set(-nB * 0.4, 24, -depth * 0.3); scene.add(d2);

  const disposables = [], ownMats = [];

  // ── the terrain surface ──────────────────────────────────────────────────────
  const pos = new Float32Array(nW * nB * 3), col = new Float32Array(nW * nB * 3);
  for (let j = 0; j < nW; j++) {
    const spot = weeks[j].spot || 0, vals = weeks[j].v;
    for (let i = 0; i < nB; i++) {
      const v = vals[i] || 0;
      const idx = j * nB + i, h = hOf(v);
      pos[idx * 3] = i - cx; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = j * DZ - cz;
      // signed: green above zero, red below (the sign already IS the story). unsigned: in profit vs
      // THAT week's spot, which is what "where the bags sit" means.
      const base = signed ? (v >= 0 ? GREEN : RED) : ((spot > 0 && price[i] <= spot) ? GREEN : RED);
      const t = 0.22 + 0.78 * Math.min(1, Math.abs(v) / ref);          // dark in the valleys, bright at the walls
      col[idx * 3] = base[0] * t; col[idx * 3 + 1] = base[1] * t; col[idx * 3 + 2] = base[2] * t;
    }
  }
  const idxArr = [];
  for (let j = 0; j < nW - 1; j++) for (let i = 0; i < nB - 1; i++) {
    const a = j * nB + i, b = a + 1, c = a + nB, d = c + 1;
    idxArr.push(a, c, b, b, c, d);
  }
  const surf = new THREE.BufferGeometry();
  surf.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  surf.setAttribute("color", new THREE.BufferAttribute(col, 3));
  surf.setIndex(idxArr); surf.computeVertexNormals();
  const surfMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(surf, surfMat)); disposables.push(surf); ownMats.push(surfMat);

  // ── the spot-price curtain sweeping through the terrain ──────────────────────
  const top = topH * 1.04;
  const cpos = new Float32Array(nW * 2 * 3), tpts = [];
  for (let j = 0; j < nW; j++) {
    const xw = spotX(weeks[j].spot || hist.pMin) - cx, zw = j * DZ - cz;
    cpos[j * 6] = xw; cpos[j * 6 + 1] = botH; cpos[j * 6 + 2] = zw;
    cpos[j * 6 + 3] = xw; cpos[j * 6 + 4] = top; cpos[j * 6 + 5] = zw;
    tpts.push(new THREE.Vector3(xw, top, zw));
  }
  const cidx = [];
  for (let j = 0; j < nW - 1; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; cidx.push(a, b, c, b, d, c); }
  const curtain = new THREE.BufferGeometry();
  curtain.setAttribute("position", new THREE.BufferAttribute(cpos, 3)); curtain.setIndex(cidx);
  const curtMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: signed ? 0.05 : 0.08, side: THREE.DoubleSide, depthWrite: false });
  scene.add(new THREE.Mesh(curtain, curtMat)); disposables.push(curtain); ownMats.push(curtMat);
  const topG = new THREE.BufferGeometry().setFromPoints(tpts);
  const topMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Line(topG, topMat)); disposables.push(topG, topMat);

  // ── axis reference ───────────────────────────────────────────────────────────
  const xL = -cx - 0.5, xR = nB - cx - 0.5, zF = -cz - 0.8, zB = depth - cz + 0.8;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a3550, transparent: true, opacity: 0.55 });
  disposables.push(lineMat);
  const seg = (a, b) => { const g = new THREE.BufferGeometry().setFromPoints([a, b]); scene.add(new THREE.Line(g, lineMat)); disposables.push(g); };
  // y — gridlines placed at their (non-linear) heights, so the axis stays honest whatever the unit.
  // A signed surface mirrors each gridline below the zero plane and draws the plane itself.
  const ticks = axisTicks(ref, signed ? 3 : 5);   // mirrored ⇒ half as many magnitudes, or they pile up at zero
  for (const v of ticks) {
    for (const sgn of (signed ? [1, -1] : [1])) {
      const y = sgn * mag(v); if (Math.abs(y) > topH * 1.02) continue;
      seg(new THREE.Vector3(xL, y, zB), new THREE.Vector3(xR, y, zB));
      seg(new THREE.Vector3(xL, y, zF), new THREE.Vector3(xL, y, zB));
      addLabel((sgn < 0 ? "−" : "") + fmtValue(v, unit), xL - 1.3, y, zB, "#9aa6bd", 11);
    }
  }
  if (signed) {
    const zeroMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 });
    disposables.push(zeroMat);
    const zg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xL, 0, zB), new THREE.Vector3(xR, 0, zB)]);
    scene.add(new THREE.Line(zg, zeroMat)); disposables.push(zg);
    addLabel("0", xL - 1.3, 0, zB, "#cbd5e1", 11, 700);
  }
  addLabel(series.axisLabel, xL - 1.3, topH + 2.4, zB, "#cbd5e1", 12, 700);
  // x (cost basis) along the front edge
  // FOUR price labels, not six: the front edge is foreshortened, so more of them simply overlap.
  const xStep = Math.max(1, Math.round(nB / 3));
  for (let i = 0; i < nB; i += xStep) addLabel(fp(price[i]), i - cx, 0, zF - 0.4, "#9aa6bd", 10.5);
  addLabel("cost basis →", 0, 0, zF - 7.5, "#cbd5e1", 12, 700);   // well forward of the tick row, and off the right edge where the dates live
  // z (time) — first / mid / last week dates along the right edge
  [0, Math.floor(nW / 2), nW - 1].forEach(j => addLabel(weeks[j].d?.slice(0, 7) || "", xR + 1.4, 0, j * DZ - cz, "#9aa6bd", 10.5));
  addLabel("time →", xR + 3.2, 0, zB + 3.0, "#cbd5e1", 12, 700);
  addLabel("spot", spotX(weeks.at(-1).spot || hist.pMin) - cx, top + 1.2, depth - cz, "#f8fafc", 11, 700);

  const controls = new OrbitControls(cam, renderer.domElement);
  controls.target.set(0, signed ? 0 : topH * 0.3, 0); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 20; controls.maxDistance = depth * 2.4 + 60; controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = false;   // fixed 3/4 view — a full spin would swing the price axis right→left

  let raf;
  const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, cam); labelR.render(scene, cam); };
  loop();
  const onResize = () => { const w = el.clientWidth; if (!w) return; cam.aspect = w / H; cam.updateProjectionMatrix(); renderer.setSize(w, H); labelR.setSize(w, H); };
  window.addEventListener("resize", onResize);

  window.__terrainStats = () => ({ data: series.data, view: series.view, weeks: nW, buckets: nB, signed, ref: +ref.toFixed(4), maxAbs: +maxV.toFixed(2), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });

  return () => {
    cancelAnimationFrame(raf); window.removeEventListener("resize", onResize);
    delete window.__terrainStats;
    controls.dispose();
    disposables.forEach(d => d.dispose?.()); ownMats.forEach(m => m.dispose?.());
    renderer.dispose();
    if (labelR.domElement.parentNode) labelR.domElement.parentNode.removeChild(labelR.domElement);
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  };
}

export default function UrpdTerrain3D({ isMobile }) {
  const mount = useRef(null);
  const [hist, setHist] = useState(null);   // null=loading, false=none, object=ok
  const [held, setHeld] = useState(null);   // date → heldTokens, for the USD modes
  const [data, setData] = useState("supply");
  const [view, setView] = useState("value");

  useEffect(() => { let off = false; loadUrpdHistory().then(d => { if (!off) setHist(d ?? false); }); return () => { off = true; }; }, []);
  // onchain.json supplies the tracked token supply per day — without it "supply" still works and the
  // USD modes are simply unavailable, so this load is allowed to fail quietly.
  useEffect(() => { let off = false; loadOnchain().then(rows => { if (!off) setHeld(Object.fromEntries((rows || []).map(r => [r.d, r.heldTokens]))); }); return () => { off = true; }; }, []);

  const series = hist && held ? terrainSeries(hist, held, { data, view }) : null;

  useEffect(() => {
    if (!hist || !series || !mount.current) return;
    let cleanup = () => {};
    try { cleanup = buildScene(mount.current, hist, series, isMobile); }
    catch (e) { console.error("UrpdTerrain3D:", e); }
    return () => cleanup();
    // rebuild on every axis change — the geometry is baked into buffers, so there is nothing to tween
  }, [hist, held, data, view, isMobile]);

  if (hist === false) return (
    <div style={{ padding: "60px 20px", textAlign: "center", fontFamily: SANS, color: "#94a3b8" }}>
      The cost-basis terrain is being reconstructed — it appears after the next on-chain refresh banks the weekly history.
    </div>
  );

  const signed = series?.signed;
  const changed = series && series.view !== "value";
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 14px", fontFamily: SANS }}>
      <ViewTabs tabs={DATA_MODES.map(([k, l]) => [k, l])} value={data} onChange={setData} />
      <ViewTabs tabs={VIEW_MODES.map(([k, l]) => [k, l])} value={view} onChange={setView} />
      {hist && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between", margin: "6px 0 10px" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: MONO, fontSize: 12, color: "#94a3b8" }}>
            {signed ? (<>
              <span><b style={{ color: "#4ade80" }}>▮</b> {changed ? "added over the window" : "in profit"}</span>
              <span><b style={{ color: "#fb7185" }}>▮</b> {changed ? "removed over the window" : "underwater"}</span>
            </>) : (<>
              <span><b style={{ color: "#4ade80" }}>▮</b> in profit (cost ≤ spot)</span>
              <span><b style={{ color: "#fb7185" }}>▮</b> underwater</span>
            </>)}
            <span><b style={{ color: "#f8fafc" }}>▮</b> spot price</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#64748b" }}>
            {series ? `${series.frames.length} days` : `${hist.weeks.length} days`} · drag to orbit · {hist.updated}
          </div>
        </div>
      )}
      <div ref={mount} style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden", background: "#0a0e1c", cursor: "grab" }} />
      <p style={{ fontSize: 12.5, color: "#7c8a9e", lineHeight: 1.6, margin: "12px 2px 0" }}>
        The cost-basis distribution (URPD) rebuilt every day and stacked through time. Each ridge is a wall of supply — coins
        that last moved around that price — and the white curtain is spot.
        {changed
          ? <> This is the <b style={{ color: "#e2e8f0" }}>change</b> over the window, so the terrain sits around a zero plane:
            ridges <b style={{ color: "#4ade80" }}>above</b> it are cost-basis bands that gained, valleys
            <b style={{ color: "#fb7185" }}> below</b> are bands that lost. Where the supply view shows where the bags sit, this
            shows which bands are being built or emptied.</>
          : data === "supply"
            ? <> Watch walls form as buyers pile in, then turn <b style={{ color: "#4ade80" }}>green</b> as price climbs past
              them or <b style={{ color: "#fb7185" }}>red</b> as it falls back.</>
            : data === "capital"
              ? <> Height is the <b style={{ color: "#e2e8f0" }}>dollars that supply cost</b>, not the coin count — so a small
                wall bought expensively can out-rank a big one bought cheap.</>
              : <> Height is <b style={{ color: "#e2e8f0" }}>unrealized profit and loss</b> against spot: above the zero plane
                the coins in that band are up, below it they are underwater.</>}
        {" "}Reconstructed from on-chain FIFO lots (self-custody holders; exchanges, LP and bridge excluded). A snapshot of
        where the bags sit, not a signal.
      </p>
    </div>
  );
}
