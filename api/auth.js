// DEEP FIELD ACCESS — X (Twitter) OAuth 2.0 login + invite-code membership. ONE serverless function
// (Vercel Hobby cap is 12), every operation behind ?action= or a bare ?code callback:
//   GET  /api/auth?action=login   → redirect to X's OAuth consent (PKCE S256)
//   GET  /api/auth?code=…&state=… → X's callback: exchange code, fetch the user, set the session cookie
//   GET  /api/auth?action=me      → { loggedIn, username, member } from the session cookie (+ KV re-check)
//   GET  /api/auth?action=logout  → clear the session cookie
//   POST /api/auth?action=redeem  {code}       → mark the logged-in user a member if the code is valid
//   POST /api/auth?action=seed    {pw, codes}  → owner: load invite-code hashes (gated by CONTROL_PASSWORD)
//   POST /api/auth?action=members {pw}         → owner: list members + recent failed sign-ins (CONTROL_PASSWORD)
//   POST /api/auth?action=code    {code}       → INVITE-CODE SIGN-IN, no X needed (rate-limited per IP)
//   POST /api/auth?action=invite  {pw,label,owner} → owner: mint a code for one person; returns it ONCE
//   POST /api/auth?action=invites {pw}         → owner: list codes (who, used, last seen)
//   POST /api/auth?action=revoke  {pw,h}       → owner: revoke a code (its member loses access)
//
// ⚠ X SIGN-IN IS SWITCHED OFF BY DEFAULT (2026-09-26). The project's X account was suspended, which took
// its developer app with it (X answers "Client application is not allowed for this operation"), and the
// owner has no other X account for the developer console yet. So every "Log in with X" link lands on the
// invite-code screen instead. Set X_LOGIN=on in Vercel once a working X app's X_CLIENT_ID/SECRET are in.
//
// WHY X-ONLY: the point of the gate is knowing WHO is in. An email can be a burner; an X account is a
// real identity the owner can see. So there is deliberately no email/password path.
//
// Required Vercel env: X_CLIENT_ID, X_CLIENT_SECRET (X app, OAuth2 confidential client), SESSION_SECRET
// (random), a connected KV/Upstash store, and APP_URL (defaults to the production domain). Optional
// OWNER_HANDLES (comma list) = handles auto-granted membership for bootstrapping. Until the env is set
// every action returns {ok:false, err:"not configured"} so the client shows a friendly message.
import crypto from "node:crypto";
import { makePkce, randomState, signSession, verifySession, hashCode, serializeCookie, parseCookies, makeInviteCode, cleanLabel } from "../lib/auth-core.mjs";
import { kvConnected, cmd, pipe, getJSON, setJSON } from "../lib/kv.mjs";

const CID = () => process.env.X_CLIENT_ID;
const CSECRET = () => process.env.X_CLIENT_SECRET;
const SECRET = () => process.env.SESSION_SECRET;
const APP_URL = () => (process.env.APP_URL || "https://spx6900rainbow.xyz").replace(/\/$/, "");
const REDIRECT = () => APP_URL() + "/api/auth";
// OWNER_HANDLES = X handles that get OWNER access (every chart, past every gate). Defaults to the
// project account so the owner always has full access without needing an env var set.
const OWNER_HANDLES = () => new Set((process.env.OWNER_HANDLES || "spx6900rainbow,lanternlabsmain").split(",").map(s => s.trim().toLowerCase().replace(/^@/, "")).filter(Boolean));
const isOwnerHandle = un => OWNER_HANDLES().has(String(un || "").toLowerCase().replace(/^@/, ""));
const SESS = "df_sess", OAUTH = "df_oauth";
const X_LOGIN = () => String(process.env.X_LOGIN || "").toLowerCase() === "on" && !!(CID() && CSECRET());
// Sessions only need the signing secret; X is one optional way in, invite codes the other.
const configured = () => !!SECRET();
const ipOf = req => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim();
const ipHash = req => crypto.createHash("sha256").update(ipOf(req) + "|" + SECRET()).digest("hex").slice(0, 16);
const countryOf = req => String(req.headers["x-vercel-ip-country"] || "").split(",")[0] || "";
// A failed sign-in, kept so the owner can SEE when the way in breaks (the X app died silently for days).
async function logFail(stage, req, extra = {}) {
  if (!kvConnected()) return;
  try {
    const row = JSON.stringify({ at: new Date().toISOString(), stage, country: countryOf(req), ip: ipHash(req).slice(0, 8), ...extra });
    await pipe([["LPUSH", "auth:fails", row], ["LTRIM", "auth:fails", "0", "199"]]);
  } catch { /* never block a sign-in on logging */ }
}
// Count a returning member's visit (not only the moment they sign in). At most once per 30 minutes.
async function touchVisit(uid, req) {
  const u = await getJSON("auth:user:" + uid);
  if (!u) return u;
  const now = Date.now();
  if (!u.lastSeen || now - Date.parse(u.lastSeen) > 30 * 60e3) {
    const next = { ...u, lastSeen: new Date(now).toISOString(), visits: (u.visits || 0) + 1, country: countryOf(req) || u.country || "" };
    await setJSON("auth:user:" + uid, next);
    return next;
  }
  return u;
}
// The members-only feeds served from the private store (KV key "feed:<name>"), pushed by the crons
// via scripts/push-private-feed.mjs. These are the GRANULAR halves (real addresses / per-wallet lots);
// the public site keeps the anonymized/aggregate versions. Whitelisted so ?f= can't read arbitrary keys.
const PRIVATE_FEEDS = new Set(["entities", "smart-money", "whale-entry", "whale-lots"]);

const send = (res, code, obj) => { res.setHeader("Content-Type", "application/json"); res.status(code).json(obj); };
const setCookie = (res, c) => { const prev = res.getHeader("Set-Cookie"); res.setHeader("Set-Cookie", prev ? [].concat(prev, c) : c); };
function safeEq(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
const sessionOf = req => { try { return verifySession(parseCookies(req.headers.cookie)[SESS], SECRET()); } catch { return null; } };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;
  const action = q.get("action");
  if (!configured()) return send(res, 200, { ok: false, err: "not configured" });

  // ---- X CALLBACK (bare ?code from the OAuth redirect) --------------------
  if (q.get("code") && !action) {
    if (!X_LOGIN()) return bounce(res, "/deepfield?auth=xoff");
    try {
      const ck = parseCookies(req.headers.cookie);
      const tmp = verifySession(ck[OAUTH], SECRET());
      if (!tmp || tmp.st !== q.get("state")) { await logFail("x-state", req); return bounce(res, "/deepfield?auth=badstate"); }
      // exchange the authorization code for an access token (confidential client → HTTP Basic)
      const body = new URLSearchParams({ grant_type: "authorization_code", code: q.get("code"),
        redirect_uri: REDIRECT(), code_verifier: tmp.v, client_id: CID() });
      const tr = await fetch("https://api.twitter.com/2/oauth2/token", { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(CID() + ":" + CSECRET()).toString("base64") }, body });
      if (!tr.ok) { await logFail("x-token", req, { status: tr.status, err: (await tr.text().catch(() => "")).slice(0, 160) }); return bounce(res, "/deepfield?auth=token"); }
      const tok = await tr.json();
      const ur = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url", { headers: { Authorization: "Bearer " + tok.access_token } });
      if (!ur.ok) { await logFail("x-user", req, { status: ur.status }); return bounce(res, "/deepfield?auth=user"); }
      const u = (await ur.json()).data || {};
      const uid = String(u.id || ""), un = String(u.username || "");
      if (!uid) return bounce(res, "/deepfield?auth=user");
      // X returns the 48px "_normal" avatar; ask for the 400px so it stays crisp top-right.
      const pfp = String(u.profile_image_url || "").replace("_normal.", "_400x400.");
      // OPEN BETA: a real X login IS membership. Access is granted to everyone who signs in — the ONLY
      // way to lose it is an explicit ban (banned:true in KV, e.g. an obvious burner). We do NOT honour a
      // stale member:false (those are leftovers from the invite-code era and were wrongly pausing real
      // users). We still record who signs in, from where, and how often (power-user signal).
      const now = new Date().toISOString();
      const country = String(req.headers["x-vercel-ip-country"] || req.headers["x-vercel-ip-country-region"] || "").split(",")[0] || "";
      let banned = false;
      if (kvConnected()) {
        const existing = await getJSON("auth:user:" + uid);
        banned = !!(existing && existing.banned);
        await setJSON("auth:user:" + uid, {
          uid, un, name: u.name || "", member: !banned, banned, pfp: pfp || existing?.pfp || "",
          firstSeen: existing?.firstSeen || existing?.joined || now, lastSeen: now,
          logins: (existing?.logins || 0) + 1,
          country: country || existing?.country || "",
          joined: existing?.joined || now,
        });
        await cmd("SADD", "auth:members", uid);
      }
      const member = !banned;
      setCookie(res, serializeCookie(SESS, signSession({ uid, un, mem: member, pfp }, SECRET()), { maxAge: 30 * 86400 }));
      setCookie(res, serializeCookie(OAUTH, "", { maxAge: 0 }));
      return bounce(res, member ? "/deepfield?auth=ok" : "/deepfield?auth=paused");
    } catch (e) { await logFail("x-error", req, { err: String(e?.message || e).slice(0, 160) }); return bounce(res, "/deepfield?auth=error"); }
  }

  // ---- LOGIN: redirect to X consent --------------------------------------
  if (action === "login") {
    if (!X_LOGIN()) return bounce(res, "/deepfield?auth=xoff");   // X app unavailable → the invite-code screen
    const { verifier, challenge } = makePkce(), state = randomState();
    setCookie(res, serializeCookie(OAUTH, signSession({ v: verifier, st: state }, SECRET(), 600), { maxAge: 600 }));
    const a = new URL("https://twitter.com/i/oauth2/authorize");
    a.searchParams.set("response_type", "code");
    a.searchParams.set("client_id", CID());
    a.searchParams.set("redirect_uri", REDIRECT());
    a.searchParams.set("scope", "users.read tweet.read");
    a.searchParams.set("state", state);
    a.searchParams.set("code_challenge", challenge);
    a.searchParams.set("code_challenge_method", "S256");
    res.setHeader("Location", a.toString()); return res.status(302).end();
  }

  // ---- DATA WALL: serve a members-only feed from the PRIVATE store ---------
  // The granular feeds are pushed to KV by the crons (scripts/push-private-feed.mjs) instead of being
  // committed to the public repo — so they are NOT on raw.githubusercontent. Only a logged-in MEMBER
  // gets them here. Repo (code) stays public; the members' DATA is genuinely private.
  if (action === "data") {
    const name = q.get("f");
    if (!PRIVATE_FEEDS.has(name)) return send(res, 400, { ok: false, err: "unknown feed" });
    const s = sessionOf(req);
    // OPEN BETA: logged in = member (ignore stale invite-era member:false); only an explicit ban blocks.
    let member = !!s;
    if (member && kvConnected()) { try { const u = await getJSON("auth:user:" + s.uid); if (u && u.banned) member = false; } catch { /* trust token */ } }
    if (s && (isOwnerHandle(s.un) || s.own)) member = true;   // owner always gets the private feeds
    if (!member) return send(res, 403, { ok: false, err: "members only" });
    if (!kvConnected()) return send(res, 503, { ok: false, err: "store not connected" });
    const raw = await cmd("GET", "feed:" + name);
    if (raw == null) return send(res, 404, { ok: false, err: "feed not published yet" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).send(raw);
  }

  // ---- ME: who is this browser --------------------------------------------
  if (action === "me") {
    const s = sessionOf(req);
    if (!s) return send(res, 200, { loggedIn: false, xLogin: X_LOGIN() });
    // OPEN BETA: logged in = member. Only an explicit ban (banned:true in KV) revokes it — a stale
    // member:false from the invite-code era is IGNORED, so real users are no longer wrongly paused. This
    // also UPGRADES an old paused cookie (mem:false) back to member on the next load, no re-login needed.
    let member = true, avatar = s.pfp || "", fav = null;
    if (kvConnected()) { try {
      const u = await touchVisit(s.uid, req); if (u) { if (u.banned) member = false; if (!avatar && u.pfp) avatar = u.pfp; }
      const f = await getJSON("auth:fav:" + s.uid); if (Array.isArray(f)) fav = f;
    } catch { /* trust token */ } }
    if (member !== !!s.mem) setCookie(res, serializeCookie(SESS, signSession({ uid: s.uid, un: s.un, mem: member, pfp: s.pfp }, SECRET()), { maxAge: 30 * 86400 }));
    // owner = the project account(s): full access to every chart, past every gate (see App.jsx ReleaseGate).
    return send(res, 200, { loggedIn: true, username: s.un, member, avatar, fav, owner: isOwnerHandle(s.un) || !!s.own, via: s.via || "x", xLogin: X_LOGIN() });
  }

  if (action === "logout") { setCookie(res, serializeCookie(SESS, "", { maxAge: 0 })); return send(res, 200, { ok: true }); }

  // ---- POST actions -------------------------------------------------------
  if (req.method === "POST") {
    const bd = typeof req.body === "object" && req.body ? req.body : await readBody(req);
    if (action === "redeem") {
      const s = sessionOf(req);
      if (!s) return send(res, 401, { ok: false, err: "not logged in" });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const h = hashCode(bd.code);
      const inv = await getJSON("auth:invite:" + h);
      if (!inv) return send(res, 200, { ok: false, err: "invalid code" });
      if (inv.used && inv.by && inv.by !== s.uid) return send(res, 200, { ok: false, err: "code already used" });
      await setJSON("auth:invite:" + h, { ...inv, used: true, by: s.uid, at: new Date().toISOString() });
      const u = (await getJSON("auth:user:" + s.uid)) || { uid: s.uid, un: s.un, joined: new Date().toISOString() };
      await setJSON("auth:user:" + s.uid, { ...u, member: true, code: h });
      await cmd("SADD", "auth:members", s.uid);
      setCookie(res, serializeCookie(SESS, signSession({ uid: s.uid, un: s.un, mem: true }, SECRET()), { maxAge: 30 * 86400 }));
      return send(res, 200, { ok: true, member: true });
    }
    if (action === "fav") {                        // member: save their pinned charts (per-account, KV)
      const s = sessionOf(req);
      if (!s) return send(res, 401, { ok: false, err: "not logged in" });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      // Sanitise: a bounded list of short id strings — never trust the client array shape/size.
      const fav = (Array.isArray(bd.fav) ? bd.fav : []).filter(x => typeof x === "string" && x.length <= 40).slice(0, 60);
      await setJSON("auth:fav:" + s.uid, fav);
      return send(res, 200, { ok: true, fav });
    }
    if (action === "seed") {                       // owner: load invite codes (hashes only)
      if (!safeEq(bd.pw || "", process.env.CONTROL_PASSWORD || "\0")) return send(res, 403, { ok: false });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const codes = Array.isArray(bd.codes) ? bd.codes : [];
      let n = 0;
      for (const c of codes) { const h = hashCode(c); if (!h) continue; const ex = await getJSON("auth:invite:" + h); await setJSON("auth:invite:" + h, ex || { used: false, note: bd.note || "", at: new Date().toISOString() }); n++; }
      return send(res, 200, { ok: true, seeded: n });
    }
    if (action === "code") {                       // INVITE-CODE SIGN-IN (no X)
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const rl = "auth:rl:" + ipHash(req);
      const n = await cmd("INCR", rl); if (n === 1) await cmd("EXPIRE", rl, "3600");
      if (n > 15) { await logFail("code-ratelimit", req); return send(res, 429, { ok: false, err: "Too many tries. Try again in an hour." }); }
      const h = hashCode(bd.code);
      const inv = bd.code ? await getJSON("auth:invite:" + h) : null;
      if (!inv || inv.revoked) { await logFail(inv ? "code-revoked" : "code-wrong", req); return send(res, 200, { ok: false, err: inv ? "This code was switched off." : "That code isn't valid." }); }
      const uid = "c_" + h.slice(0, 16), now = new Date().toISOString();
      const ex = await getJSON("auth:user:" + uid);
      if (ex?.banned) { await logFail("code-banned", req); return send(res, 200, { ok: false, err: "This code was switched off." }); }
      const un = inv.label || "guest-" + h.slice(0, 4);
      await setJSON("auth:user:" + uid, { uid, un, via: "code", code: h, owner: !!inv.owner, member: true, banned: false,
        firstSeen: ex?.firstSeen || now, lastSeen: now, logins: (ex?.logins || 0) + 1, visits: (ex?.visits || 0) + 1,
        country: countryOf(req) || ex?.country || "", joined: ex?.joined || now });
      await cmd("SADD", "auth:members", uid);
      await setJSON("auth:invite:" + h, { ...inv, used: true, by: uid, usedAt: inv.usedAt || now, lastAt: now });
      setCookie(res, serializeCookie(SESS, signSession({ uid, un, mem: true, own: !!inv.owner, via: "code" }, SECRET()), { maxAge: 30 * 86400 }));
      return send(res, 200, { ok: true, member: true, username: un });
    }
    if (action === "invite") {                     // owner: mint a code for one person (shown ONCE)
      if (!safeEq(bd.pw || "", process.env.CONTROL_PASSWORD || "\0")) return send(res, 403, { ok: false });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const label = cleanLabel(bd.label);
      if (!label) return send(res, 200, { ok: false, err: "give it a name — who is this code for?" });
      const code = makeInviteCode(), h = hashCode(code);
      await setJSON("auth:invite:" + h, { label, owner: !!bd.owner, at: new Date().toISOString(), used: false });
      await cmd("SADD", "auth:invites", h);
      return send(res, 200, { ok: true, code, label });
    }
    if (action === "invites") {                    // owner: every code, who it's for, used or not
      if (!safeEq(bd.pw || "", process.env.CONTROL_PASSWORD || "\0")) return send(res, 403, { ok: false });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const hs = (await cmd("SMEMBERS", "auth:invites")) || [], out = [];
      for (const h of hs) {
        const inv = await getJSON("auth:invite:" + h); if (!inv) continue;
        const u = inv.by ? await getJSON("auth:user:" + inv.by) : null;
        out.push({ h: h.slice(0, 12), label: inv.label || "", owner: !!inv.owner, at: inv.at, used: !!inv.used, usedAt: inv.usedAt || null,
          lastSeen: u?.lastSeen || inv.lastAt || null, visits: u?.visits || 0, revoked: !!inv.revoked });
      }
      out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return send(res, 200, { ok: true, invites: out });
    }
    if (action === "revoke") {                     // owner: switch a code off (its member loses access)
      if (!safeEq(bd.pw || "", process.env.CONTROL_PASSWORD || "\0")) return send(res, 403, { ok: false });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const pre = String(bd.h || "").toLowerCase();
      const h = pre.length >= 8 ? ((await cmd("SMEMBERS", "auth:invites")) || []).find(x => x.startsWith(pre)) : null;
      if (!h) return send(res, 200, { ok: false, err: "no such code" });
      const inv = await getJSON("auth:invite:" + h);
      await setJSON("auth:invite:" + h, { ...inv, revoked: true, revokedAt: new Date().toISOString() });
      const uid = "c_" + h.slice(0, 16), u = await getJSON("auth:user:" + uid);
      if (u) await setJSON("auth:user:" + uid, { ...u, banned: true, member: false });
      return send(res, 200, { ok: true });
    }
    if (action === "members") {                    // owner: list who's in
      if (!safeEq(bd.pw || "", process.env.CONTROL_PASSWORD || "\0")) return send(res, 403, { ok: false });
      if (!kvConnected()) return send(res, 200, { ok: false, err: "store not connected" });
      const ids = (await cmd("SMEMBERS", "auth:members")) || [];
      const out = [];
      for (const id of ids) { const u = await getJSON("auth:user:" + id); if (u) out.push({ username: u.un, pfp: u.pfp || "", firstSeen: u.firstSeen || u.joined, lastSeen: u.lastSeen || u.joined, logins: u.logins || 1, visits: u.visits || 0, via: u.via || "x", country: u.country || "", member: !u.banned }); }
      out.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)) || (b.logins - a.logins));
      const fails = ((await cmd("LRANGE", "auth:fails", "0", "49")) || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
      return send(res, 200, { ok: true, members: out, fails, xLogin: X_LOGIN() });
    }
  }
  return send(res, 400, { ok: false, err: "unknown action" });
}

function bounce(res, to) { res.setHeader("Location", to); return res.status(302).end(); }
async function readBody(req) {
  try { const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { return {}; }
}
