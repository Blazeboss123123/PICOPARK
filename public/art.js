// Huddle Peak art: painted pixel backgrounds and terrain, built once per world/level.
(function () {
'use strict';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sst = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- colour ----------
const CC = new Map(), CR = new Map();
function pk(h) { if (typeof h === 'number') return h; let v = CC.get(h); if (v === undefined) { const n = parseInt(h.slice(1), 16); v = ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0; CC.set(h, v); } return v; }
function rgb(h) { let v = CR.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; CR.set(h, v); } return v; }
function mixh(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function mixu(a, b, t) { const ar = a & 255, ag = (a >>> 8) & 255, ab = (a >>> 16) & 255; return ((255 << 24) | (Math.round(ab + (((b >>> 16) & 255) - ab) * t) << 16) | (Math.round(ag + (((b >>> 8) & 255) - ag) * t) << 8) | Math.round(ar + ((b & 255) - ar) * t)) >>> 0; }
const RU = a => a.map(pk);
const hex = u => '#' + [u & 255, (u >>> 8) & 255, (u >>> 16) & 255].map(v => v.toString(16).padStart(2, '0')).join('');

// ---------- pixel buffer ----------
function PB(w, h, wrap) {
  const id = new ImageData(w, h), u = new Uint32Array(id.data.buffer);
  const ix = (a, b) => { a = Math.floor(a); b = Math.floor(b); if (wrap) a = ((a % w) + w) % w; return (a >= 0 && b >= 0 && a < w && b < h) ? b * w + a : -1; };
  return { w, h, id, u, ix,
    s(a, b, c) { const k = ix(a, b); if (k >= 0) u[k] = pk(c); },
    r(a, b, ww, hh, c) { const v = pk(c); for (let j = 0; j < hh; j++) for (let q = 0; q < ww; q++) { const k = ix(a + q, b + j); if (k >= 0) u[k] = v; } },
    b(a, b, c, al) { const k = ix(a, b); if (k < 0 || al <= 0) return; const C = pk(c), o = u[k]; if (al >= 1) { u[k] = C; return; } if (!(o >>> 24)) { u[k] = ((Math.round(al * 255) << 24) | (C & 0xffffff)) >>> 0; return; } u[k] = ((mixu(o, C, al) & 0xffffff) | (o & 0xff000000)) >>> 0; },
    g(a, b) { const k = ix(a, b); return k >= 0 ? u[k] : 0; },
    has(a, b) { const k = ix(a, b); return k >= 0 && (u[k] >>> 24) > 0; },
    cv() { const c = mk(w, h); c.getContext('2d').putImageData(id, 0, 0); return c; } };
}

// ---------- noise ----------
const h2 = (a, b) => { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const h1 = a => h2(a, 7331);
function vn(t) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; }
function fbm(t, o) { let s = 0, a = 1, n = 0, f = 1; for (let k = 0; k < (o || 4); k++) { s += vn(t * f + k * 31.7) * a; n += a; a *= .5; f *= 2.03; } return s / n; }
function vn2(a, b) { const ix = Math.floor(a), iy = Math.floor(b), fx = a - ix, fy = b - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), p = h2(ix, iy), q = h2(ix + 1, iy), r = h2(ix, iy + 1), s = h2(ix + 1, iy + 1); return p + (q - p) * ux + (r - p) * uy + (p - q - r + s) * ux * uy; }
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], bay = (a, b) => (BAY[(b & 3) * 4 + (a & 3)] + .5) / 16;
function rng(seed) { let s = (Math.imul(seed | 0, 2654435761) >>> 0) % 2147483646 + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// periodic (seamless) noise across a background strip
const TW = 1280, TH = 360;
function pv(x, cells, seed) { const u = x * cells / TW, i = Math.floor(u), f = u - i, w = f * f * (3 - 2 * f), i0 = ((i % cells) + cells) % cells, a = h2(i0, seed), b = h2((i0 + 1) % cells, seed); return a + (b - a) * w; }
function pf(x, cells, oct, seed) { let s = 0, a = 1, n = 0, c = cells; for (let k = 0; k < oct; k++) { s += pv(x, c, seed + k * 101) * a; n += a; a *= 0.5; c *= 2; } return s / n; }
function pv2(x, y, cells, seed) { const cs = TW / cells, u = x / cs, v = y / cs, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), i0 = ((i % cells) + cells) % cells, i1 = (i0 + 1) % cells, p = h2(i0, j * 977 + seed), q = h2(i1, j * 977 + seed), r = h2(i0, (j + 1) * 977 + seed), s = h2(i1, (j + 1) * 977 + seed); return p + (q - p) * ux + (r - p) * uy + (p - q - r + s) * ux * uy; }
function pf2(x, y, cells, oct, seed) { let s = 0, a = 1, n = 0, c = cells; for (let k = 0; k < oct; k++) { s += pv2(x, y, c, seed + k * 131) * a; n += a; a *= 0.5; c *= 2; } return s / n; }

// pick from a colour ramp with a narrow ordered-dither band between steps
function dp(R, v, X, Y, sh) { const n = R.length - 1; if (!(v > 0)) return R[0]; if (v >= n) return R[n]; const i = v | 0; let f = v - i; if (sh) f = clamp((f - 0.5) * sh + 0.5, 0, 1); return R[f > bay(X, Y) ? i + 1 : i]; }

// ---------- painting helpers ----------
function skyGrad(pb, stops) { const R = RU(stops.map(s => s[1])); for (let y = 0; y < pb.h; y++) { let i = 0; while (i < stops.length - 2 && y > stops[i + 1][0]) i++; const t = clamp((y - stops[i][0]) / (stops[i + 1][0] - stops[i][0]), 0, 1); for (let x = 0; x < pb.w; x++) pb.u[y * pb.w + x] = dp(R, i + t, x, y, 3); } }
function rings(pb, cx, cy, r0, r1, col, a, steps) { const C = pk(col); steps = steps || 5; for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d < r0 || d > r1) continue; const t = 1 - (d - r0) / (r1 - r0), q = Math.ceil(t * t * steps) / steps; pb.b(x, y, C, q * a); } }
function orb(pb, cx, cy, r, R, lx, ly) { R = RU(R); const N = R.length - 1; for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, d = dx * dx + dy * dy; if (d > 1) continue; const nz = Math.sqrt(1 - d), l = dx * lx + dy * ly + nz * 0.7; pb.s(x, y, dp(R, N * clamp(0.3 + l * 0.55, 0, 1), x, y, 2)); } }
// banked cumulus: posterised lobes (one tone each, lit rim toward the light, shadow rim away) over a domed body
function cloudBank(pb, cx, cy, w, h, R, lx, ly, seed, o) {
  o = o || {}; R = RU(R); const rnd = rng(seed), N = R.length - 1, L = Math.hypot(lx, ly) || 1, ex = lx / L, ey = ly / L;
  const env = t => Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1))), 0.6), topY = x => cy - h * env((x - (cx - w / 2)) / w) * (0.72 + 0.28 * pv(x, 48, seed));
  const base = x => cy + Math.round((pv(x, 24, seed + 3) - 0.5) * h * 0.22), put = (x, y, v) => { if (y > base(x)) return; let c = dp(R, v, x, y, 5); if (o.haze) c = mixu(c, o.haze, o.hazeA); pb.s(x, y, c); };
  const along = (x, y) => clamp(((x - cx) / (w * 0.5)) * ex + ((y - (cy - h * 0.45)) / (h * 0.55)) * ey, -1, 1);
  for (let x = Math.floor(cx - w * 0.46); x <= cx + w * 0.46; x++) { const ty = Math.round(topY(x) + h * 0.2); for (let y = ty; y <= cy + h * 0.12; y++) put(x, y, N * (0.32 + 0.22 * along(x, y))); }
  const Lb = [], n = Math.max(5, Math.round(w / (h * 0.26)));
  for (let i = 0; i < n; i++) { const t = (i + rnd() * 0.9) / n, xx = cx - w / 2 + t * w, r = h * (0.14 + 0.22 * env(t)) * (0.7 + rnd() * 0.6); if (r < 3) continue; Lb.push({ x: xx, y: topY(xx) + r * 0.85, r }); }
  for (let i = 0; i < n * 0.8; i++) { const t = 0.08 + rnd() * 0.84, xx = cx - w / 2 + t * w, r = h * (0.1 + 0.16 * env(t)) * (0.7 + rnd() * 0.5), ty = topY(xx) + r; if (r < 3 || ty > cy - r * 0.5) continue; Lb.push({ x: xx, y: ty + rnd() * (cy - ty - r * 0.4), r }); }
  Lb.sort((a, b) => a.y - b.y);
  for (const c of Lb) { const r = c.r, vb = N * clamp(0.4 + 0.36 * along(c.x, c.y) + (rnd() - 0.5) * 0.12, 0.12, 0.86); for (let y = Math.floor(c.y - r); y <= c.y + r; y++) { if (y > cy) continue; for (let x = Math.floor(c.x - r); x <= c.x + r; x++) { const dx = (x + 0.5 - c.x) / r, dy = (y + 0.5 - c.y) / r, d = dx * dx + dy * dy; if (d > 1) continue; const l = dx * ex + dy * ey; let v = vb + l * 0.5; if (d > 1 - 2.4 / r) v = l > 0.15 ? vb + 1.2 : l < -0.25 ? vb - 0.9 : v; put(x, y, v); } } }
}
// mountain range: facets follow ridges that descend from the peaks
function range(pb, o) {
  const W = pb.w, Hh = pb.h, R = RU(o.R), SR = o.snowR && RU(o.snowR), hz = o.haze && pk(o.haze), prof = new Float32Array(W);
  for (let x = 0; x < W; x++) { let n = pf(x, o.cells, 5, o.seed); if (o.sharp) { const r = 1 - Math.abs(2 * n - 1); n = Math.pow(r, 1.5) * 0.75 + n * 0.25; } prof[x] = o.base - o.amp * n; }
  const rads = [3, 8, 18, 40, 80], BL = rads.map(rd => { const out = new Float32Array(W); let s = 0; for (let k = -rd; k <= rd; k++) s += prof[((k % W) + W) % W]; for (let x = 0; x < W; x++) { out[x] = s / (2 * rd + 1); s += prof[(x + rd + 1) % W] - prof[((x - rd) % W + W) % W]; } return out; });
  const slope = (B, x) => (B[(x + 4) % W] - B[(x + W - 4) % W]) / 8, N = R.length - 1, mid = N / 2;
  for (let x = 0; x < W; x++) {
    const top = Math.max(0, Math.ceil(prof[x])), sd = SR ? (o.snowLine - prof[x]) * 0.6 + (pf(x, o.cells * 5, 2, o.seed + 5) - 0.5) * 12 : -1;
    for (let y = top; y < Hh; y++) {
      const dep = y - prof[x], li = clamp(Math.log2(1 + dep / 5), 0, rads.length - 1.001), l0 = li | 0, lf = li - l0;
      const wob = (pv2(x, y * 1.6, o.cells * 4, o.seed + 9) - 0.5) * 16 * Math.min(1, dep / 20), xw = ((Math.round(x + wob) % W) + W) % W;
      const s = slope(BL[l0], xw) * (1 - lf) + slope(BL[l0 + 1], xw) * lf, lit = clamp(-s * o.sun * 5, -1, 1);
      const gul = pf2(x, y * 0.45, o.cells * 6, 3, o.seed + 3) - 0.5;
      let v = mid + lit * mid * 0.75 + gul * 1.1; if (dep < 1.2) v += lit > -0.2 ? 1.2 : 0.4;
      let c = (SR && dep < sd) ? dp(SR, (SR.length - 1) / 2 + lit * 1.6 + gul * 0.8 + (dep < 1.2 ? 1 : 0), x, y, 2.4) : dp(R, v, x, y, 2.4);
      if (hz) { const a = clamp((y - o.hazeTop) / (o.hazeBot - o.hazeTop), 0, 1) * o.hazeA, q = Math.floor(a * 4 + bay(x, y)) / 4; if (q > 0) c = mixu(c, hz, q); }
      pb.u[y * W + x] = c;
    }
  }
  return prof;
}
// a filled hill whose surface is lit along its top edge
function hill(pb, prof, R, sun, haze, hazeA) { R = RU(R); const N = R.length - 1, hz = haze && pk(haze); for (let x = 0; x < pb.w; x++) { const t = Math.ceil(prof[x]), s = (prof[(x + 3) % pb.w] - prof[(x + pb.w - 3) % pb.w]) / 6, lit = clamp(-s * sun * 4, -1, 1); for (let y = Math.max(0, t); y < pb.h; y++) { const dep = y - prof[x]; let v = N * 0.45 + lit * 0.8 - Math.min(1.6, dep / 30) + (dep < 2 ? 1.3 : 0) + (pv2(x, y, 40, 77) - 0.5) * 0.8; let c = dp(R, v, x, y, 2.2); if (hz) c = mixu(c, hz, hazeA * clamp(dep / 40, 0.3, 1)); pb.u[y * pb.w + x] = c; } } }
function pine(pb, cx, gy, h, R, sun, snow) {
  cx = Math.round(cx); gy = Math.round(gy); R = RU(R); snow = snow && RU(snow); const N = R.length - 1, tiers = Math.max(3, Math.round(h / 9)), th = Math.max(2, Math.round(h * 0.1));
  for (let j = -2; j < th; j++) { pb.s(cx, gy - j, R[0]); pb.s(cx - 1, gy - j, R[0]); }
  for (let j = 0; j < h; j++) {
    const y = gy - th - j, tp = j / h * tiers, tf = tp - Math.floor(tp), mw = (1 - j / h) * h * 0.3 + 0.8, w = mw * (1 - tf * 0.5);
    for (let q = -Math.ceil(w); q <= Math.ceil(w); q++) {
      const aq = Math.abs(q); if (aq > w + (h2(cx * 7 + q, y) < 0.35 ? 0.7 : 0)) continue;
      const lit = -q / Math.max(1, w) * sun; let c = dp(R, N * 0.45 + lit * N * 0.35 - (tf > 0.78 ? 0.9 : 0) + (h2(cx + q, y) - 0.5) * 0.6, cx + q, y, 2);
      if (snow && ((tf < 0.22 && aq < w * 0.9) || (aq >= w - 1 && tf < 0.6)) && h2(q + cx * 3, y * 5) < 0.75) c = dp(snow, (snow.length - 1) * (0.5 + lit * 0.5), cx + q, y, 2);
      pb.s(cx + q, y, c);
    }
  }
  pb.s(cx, gy - th - h, R[1]);
}
function canopy(pb, cx, cy, r, R, lx, ly, seed, o) {
  o = o || {}; R = RU(R); const rnd = rng(seed), C = [{ x: cx, y: cy, r }], k = 4 + (rnd() * 4 | 0), N = R.length - 1;
  for (let i = 0; i < k; i++) { const a = rnd() * Math.PI * 2, d = r * (0.4 + rnd() * 0.35); C.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.7 - r * 0.1, r: r * (0.42 + rnd() * 0.3) }); }
  C.sort((a, b) => a.y - b.y); const L = Math.hypot(lx, ly, 0.8);
  for (const c of C) for (let y = Math.floor(c.y - c.r); y <= c.y + c.r; y++) for (let x = Math.floor(c.x - c.r); x <= c.x + c.r; x++) {
    const dx = (x + 0.5 - c.x) / c.r, dy = (y + 0.5 - c.y) / c.r, d = dx * dx + dy * dy; if (d > 1) continue; if (d > 0.72 && h2(x * 3, y * 7 + seed) < 0.38) continue;
    const nz = Math.sqrt(1 - d), l = (dx * lx + dy * ly + nz * 0.8) / L; let v = N * clamp(0.14 + 0.7 * (l * 0.5 + 0.5) + (cy - y) / r * 0.12, 0, 1) + (h2(x >> 1, (y >> 1) + seed) - 0.5) * 1.1;
    let col = dp(R, v, x, y, 2.4); if (o.haze) col = mixu(col, o.haze, o.hazeA); pb.s(x, y, col);
  }
}
function rays(pb, x0, y0, ang0, len, n, col, a, seed, spread, angS) { const C = pk(col), rnd = rng(seed); for (let i = 0; i < n; i++) { const ang = ang0 + (rnd() - 0.5) * (angS || 0), sa = Math.sin(ang), ca = Math.cos(ang), off = (rnd() - 0.5) * spread, wd = 3 + rnd() * 12, al = a * (0.4 + rnd() * 0.6); for (let t = 0; t < len; t++) { const cx = x0 + off + t * sa, y = Math.round(y0 + t * ca), fa = al * (1 - t / len) * Math.min(1, t / 20); for (let q = -wd; q <= wd; q++) { const A = fa * (1 - Math.abs(q) / wd), X = Math.round(cx + q); if (A * 3 > bay(X, y)) pb.b(X, y, C, 0.2); } } } }
function fog(pb, y0, y1, col, a, seed) { const C = pk(col); for (let y = Math.max(0, y0); y < Math.min(pb.h, y1); y++) { const t = (y - y0) / (y1 - y0); for (let x = 0; x < pb.w; x++) { const n = pf(x + y * 2.3, 10, 2, seed) - 0.5, A = clamp((t + n * 0.5) * a, 0, 1), q = Math.floor(A * 4 + bay(x, y)) / 4; if (q <= 0) continue; const k = y * pb.w + x, o = pb.u[k]; if ((o >>> 24) === 255) pb.u[k] = mixu(o, C, q); else { const oa = (o >>> 24) / 255, na = oa + q * (1 - oa); pb.u[k] = ((Math.round(na * 255) << 24) | ((oa > 0 ? mixu(o, C, q) : C) & 0xffffff)) >>> 0; } } } }
// tapered spike (stalactite when dir=1 hangs down, stalagmite when dir=-1)
function spire(pb, cx, y0, len, wd, R, dir, sun, rim) { R = RU(R); const N = R.length - 1; for (let j = 0; j < len; j++) { const t = j / len, w = wd * (1 - t) * (0.85 + 0.15 * Math.sin(j * 0.4 + cx)), y = y0 + j * dir; for (let q = -Math.ceil(w); q <= Math.ceil(w); q++) { if (Math.abs(q) > w) continue; const lit = -q / Math.max(1, w) * sun; let c = dp(R, N * 0.4 + lit * N * 0.35, cx + q, y, 2); if (rim && lit > 0.75) c = pk(rim); pb.s(cx + q, y, c); } } }
function shard(pb, cx, gy, h, w, lean, C) { // crystal: C = [light, mid, dark, tip]
  for (let j = 0; j < h; j++) { const t = j / h, ww = w * (t < 0.75 ? 1 : (1 - t) / 0.25), x0 = cx + lean * j; for (let q = -Math.ceil(ww); q <= Math.ceil(ww); q++) { if (Math.abs(q) > ww) continue; const c = q < -ww * 0.35 ? C[0] : q > ww * 0.35 ? C[2] : C[1]; pb.s(Math.round(x0 + q), gy - j, c); } }
  pb.s(Math.round(cx + lean * h), gy - h, C[3]);
}

// ---------- backgrounds ----------
const BG = {};
function layer() { return PB(TW, TH, true); }
function buildBG(th) {
  if (BG[th]) return BG[th];
  const sky = PB(TW, TH, true), L = []; let weather = 'snow', vf = 0.5, top;
  const add = (pb, f) => L.push({ pb, f });
  if (th === 0) { // Snowpeak: twilight alpine
    const st = [[0, '#0c0a26'], [60, '#16123c'], [120, '#261c58'], [175, '#3c2672'], [220, '#5a3084'], [262, '#82398e'], [298, '#b04e8e'], [330, '#dc7488'], [360, '#f4a088']]; skyGrad(sky, st); top = st[0][1];
    let r = rng(11); for (let i = 0; i < 320; i++) { const x = r() * TW | 0, y = Math.pow(r(), 1.6) * 250 | 0, v = r(); sky.s(x, y, v > 0.92 ? '#ffffff' : v > 0.6 ? '#d0c6ff' : '#8a7ad0'); if (v > 0.985) { sky.s(x + 1, y, '#a898e8'); sky.s(x - 1, y, '#a898e8'); sky.s(x, y + 1, '#a898e8'); sky.s(x, y - 1, '#a898e8'); } }
    for (let x = 0; x < TW; x++) { const yb = 92 + pf(x, 5, 3, 21) * 56, hg = 34 + pf(x, 9, 2, 24) * 46, a = Math.pow(pf(x, 12, 3, 22), 1.3) * (0.72 + 0.28 * pv(x, 200, 23)); for (let y = Math.ceil(yb - hg); y <= yb + 1; y++) { const t = clamp((yb - y) / hg, 0, 1), A = a * Math.pow(1 - t, 1.2) * (t < 0.06 ? 1.4 : 1); if (!(A > 0.06)) continue; const q = Math.ceil(A * 4) / 4; sky.b(x, y, t < 0.12 ? '#a8ffd8' : t < 0.45 ? '#4ae0b8' : '#7a5ae8', q * 0.5); } }
    rings(sky, 470, 80, 16, 64, '#d8c8ff', 0.32, 6); orb(sky, 470, 80, 16, ['#9a8ac0', '#c4b6e0', '#e6dcf6', '#fffaf2'], 0.7, -0.4); [[-6, -4, 3], [5, 3, 4], [-2, 8, 2], [7, -7, 2]].forEach(([a, b, rr]) => orb(sky, 470 + a, 80 + b, rr, ['#a898c8', '#c8bce0'], -0.5, -0.5));
    const A = layer(); range(A, { base: 300, amp: 205, cells: 5, seed: 31, sharp: true, sun: 1, R: ['#2a2460', '#383076', '#4a408c', '#6252a4', '#806cbc'], snowR: ['#6e68ac', '#9890cc', '#c4b8e6', '#ecd6ee', '#fff2f4'], snowLine: 205, haze: '#b8709c', hazeTop: 190, hazeBot: 310, hazeA: 0.8 });
    cloudBank(A, 260, 240, 300, 24, ['#5a3a7a', '#7a4a88', '#9c5e96', '#c27a9e', '#e4a0aa'], -0.3, 1, 5); cloudBank(A, 900, 252, 340, 22, ['#5a3a7a', '#7a4a88', '#9c5e96', '#c27a9e', '#e4a0aa'], -0.3, 1, 6); add(A, 0.05);
    const B = layer(); range(B, { base: 326, amp: 130, cells: 9, seed: 41, sharp: true, sun: 1, R: ['#18143c', '#201a4c', '#2c2260', '#3c2e76', '#523e8e'], snowR: ['#565492', '#827eba', '#b0a8da', '#dacdee', '#f6ecfa'], snowLine: 250, haze: '#6e4a8e', hazeTop: 250, hazeBot: 340, hazeA: 0.7 }); fog(B, 296, 360, '#7a5294', 0.6, 3); add(B, 0.14);
    const C = layer(), hp = new Float32Array(TW); for (let x = 0; x < TW; x++) hp[x] = 336 - pf(x, 10, 3, 51) * 44; hill(C, hp, ['#22204e', '#2e2c66', '#42407e', '#5e5c9c', '#8482bc'], 1);
    r = rng(52); for (let x = 0; x < TW; x += 5 + r() * 9) pine(C, x, hp[x | 0] + 3, 16 + r() * 30, ['#0a0820', '#121030', '#1c1a44', '#282858'], 1, ['#7c7ab4', '#b4b0dc', '#e2dff6']); add(C, 0.3);
    const D = layer(); r = rng(61); for (let x = 30; x < TW; x += 120 + r() * 160) pine(D, x, 372, 80 + r() * 50, ['#06041a', '#0c0a24', '#141232', '#1c1a42'], 1, ['#3a3870', '#5a5890']); add(D, 0.5);
  } else if (th === 1) { // Autumn Woods: golden hour
    weather = 'leaves';
    const st = [[0, '#3e3c8a'], [55, '#5a4c9e'], [110, '#7e58aa'], [160, '#aa64aa'], [205, '#d6769e'], [245, '#f29090'], [285, '#ffae8a'], [325, '#ffcc8e'], [360, '#ffe2a2']]; skyGrad(sky, st); top = st[0][1];
    const SX = 400, SY = 262; rings(sky, SX, SY, 20, 110, '#ffe2a4', 0.45, 7);
    const CR_ = ['#4e4488', '#74509a', '#a25c9a', '#d07294', '#f29492', '#ffba9c', '#ffdab2', '#fff2d8'];
    [[110, 100, 280, 72], [560, 64, 320, 84], [330, 184, 210, 46], [760, 160, 230, 56], [1010, 96, 280, 70], [1180, 200, 200, 46]].forEach(([x, y, w, h], i) => cloudBank(sky, x, y, w, h, CR_, SX - x, SY - y, 70 + i));
    orb(sky, SX, SY, 20, ['#ffd890', '#ffeab4', '#fff8e0', '#ffffff'], 0, 0);
    const A = layer(); range(A, { base: 304, amp: 150, cells: 6, seed: 81, sharp: true, sun: -1, R: ['#4a3c80', '#5e4890', '#7854a0', '#9c64a4', '#c87ea0'], snowR: ['#8a74b0', '#b48cbc', '#e0aac0', '#ffd0c8', '#fff0e0'], snowLine: 180, haze: '#f0a0a0', hazeTop: 215, hazeBot: 310, hazeA: 0.85 }); fog(A, 268, 316, '#ffb4a0', 0.55, 4); add(A, 0.05);
    const B = layer(), hp = new Float32Array(TW); for (let x = 0; x < TW; x++) hp[x] = 322 - pf(x, 8, 3, 91) * 48; hill(B, hp, ['#5a3a6a', '#74466e', '#94566e', '#b86c6e', '#d88870'], -1, '#f4a898', 0.35);
    let r = rng(92); const HR = [['#6a3a62', '#8c4a60', '#b45e5e', '#d8785a', '#f09a64'], ['#7a4a5a', '#9c6058', '#c48050', '#e6a456', '#fcc870'], ['#5a3c64', '#7a4a66', '#a45a66', '#cc6e62', '#ec8c6a']];
    for (let x = 0; x < TW; x += 6 + r() * 8) { const rr = 6 + r() * 7; canopy(B, x, hp[x | 0] - rr * 0.4, rr, HR[r() * 3 | 0], 1, -0.6, 900 + x | 0, { haze: pk('#f4a898'), hazeA: 0.3 }); }
    fog(B, 312, 360, '#ffc4a0', 0.5, 5); add(B, 0.14);
    const C = layer(), cp = new Float32Array(TW); for (let x = 0; x < TW; x++) cp[x] = 356 - pf(x, 12, 3, 101) * 42;
    const VR = [['#4a1e2a', '#7a2e2a', '#b04a2a', '#e07432', '#ffa848', '#ffd476'], ['#3e1426', '#6a1e2a', '#9e2c2c', '#d24a34', '#f47a4a', '#ffb070'], ['#4e2a22', '#7e4826', '#b8742a', '#e8a434', '#ffd050', '#fff090'], ['#141e2a', '#1e3236', '#2a4a40', '#3e664a', '#5a8450', '#7aa058']];
    r = rng(102); for (let x = 0; x < TW; x += 14 + r() * 18) { const rr = 12 + r() * 13, gy = cp[x | 0]; C.r(x - 1, gy - rr, 3, rr + 30, '#2a1420'); C.r(x - 1, gy - rr, 1, rr + 30, '#4a2430'); canopy(C, x, gy - rr * 1.1, rr, VR[r() < 0.12 ? 3 : r() * 3 | 0], 1, -0.6, 1000 + x | 0); }
    hill(C, cp.map(v => v + 16), ['#3a1a2a', '#4e2430', '#683036', '#86403a', '#a4563e'], -1); add(C, 0.3);
  } else if (th === 2) { // Crystal Caves: bioluminescent
    weather = 'motes'; vf = 0;
    const st = [[0, '#020309'], [90, '#040a16'], [170, '#071626'], [240, '#0a2434'], [300, '#0d3040'], [360, '#0a2030']]; skyGrad(sky, st); top = st[0][1];
    rays(sky, 300, 0, -0.18, 360, 5, '#5ae8d0', 0.55, 7, 160); rays(sky, 900, 0, 0.12, 360, 4, '#7af0ff', 0.45, 8, 140);
    const A = layer(); let r = rng(111); const AR = ['#03070f', '#061019', '#0a1826', '#0e2232', '#133040'];
    for (let x = 0; x < TW; x++) { const t = 14 + pf(x, 10, 3, 112) * 46, b = 318 - pf(x, 8, 3, 113) * 60; for (let y = 0; y < t; y++) A.s(x, y, y > t - 2 ? AR[3] : AR[1]); for (let y = Math.floor(b); y < TH; y++) A.s(x, y, y < b + 2 ? AR[3] : AR[1]); }
    for (let i = 0; i < 26; i++) { const x = r() * TW; spire(A, x, 20 + pf(x, 10, 3, 112) * 40, 30 + r() * 110, 4 + r() * 12, AR, 1, 1, '#1e5a66'); }
    for (let i = 0; i < 20; i++) { const x = r() * TW; spire(A, x, 320 - pf(x, 8, 3, 113) * 60, 20 + r() * 90, 5 + r() * 14, AR, -1, 1, '#1e5a66'); }
    fog(A, 110, 300, '#0e3a48', 0.45, 9); add(A, 0.05);
    const B = layer(); r = rng(121); const GOLD = ['#2a1e14', '#5a4220', '#9a7230', '#d0a648', '#f6d470', '#fff6b0'], TEAL = ['#082a34', '#0e4a52', '#16766e', '#2aa890', '#64dcb8', '#c0fff0'];
    for (let i = 0; i < 11; i++) { const x = i * 116 + r() * 60, h = 90 + r() * 150, cw = 24 + r() * 40, gold = r() < 0.45, base = 372, bend = (r() - 0.5) * 50, capY = base - h; let px = x, py = base;
      for (let j = 0; j <= h; j++) { const t = j / h, xx = x + bend * t * t, w = 2 + (1 - t) * 3; for (let q = -w; q <= w; q++) B.s(xx + q, base - j, q < -w + 1.5 ? '#2a8a8a' : q > w - 1 ? '#040c12' : '#0a1c26'); px = xx; py = base - j; }
      const cx = px, CRm = RU(gold ? GOLD : TEAL); rings(B, cx, capY + 4, cw * 0.4, cw * 1.3, gold ? '#ffd870' : '#5affd0', 0.1, 3);
      for (let y = -10; y <= 3; y++) for (let x2 = -cw; x2 <= cw; x2++) { const e = (x2 * x2) / (cw * cw) + (y * y) / (y < 0 ? 100 : 9); if (e > 1) continue; if (y >= 0) { B.s(cx + x2, capY + y, y > 1 ? '#06141c' : (gold ? '#ffe890' : '#9affe0')); continue; } B.s(cx + x2, capY + y, dp(CRm, 5 * clamp(0.25 + (-x2 / cw) * 0.35 + (-y / 10) * 0.45, 0, 1) + (h2(x2 >> 1, y + i * 9) - 0.5) * 0.8, cx + x2, capY + y, 2.2)); }
    }
    fog(B, 240, 360, '#0c3a46', 0.55, 10); add(B, 0.14);
    const C = layer(); r = rng(131); const CYC = ['#d6ffff', '#6af0ff', '#1aa8d0', '#ffffff'], MAG = ['#ffd6ff', '#f070e8', '#a030a8', '#ffffff'];
    const fp = new Float32Array(TW); for (let x = 0; x < TW; x++) fp[x] = 350 - pf(x, 14, 3, 132) * 40; hill(C, fp, ['#02050b', '#050c16', '#0a1626', '#10243a', '#1a3a50'], 1);
    for (let i = 0; i < 16; i++) { const x = r() * TW, gy = fp[x | 0] + 4, mag = r() < 0.35, CC_ = mag ? MAG : CYC; const DC = CC_.map(c => hex(mixu(pk(c), pk('#0a2232'), 0.45))); rings(C, x, gy - 10, 4, 30, CC_[1], 0.12, 4); for (let k = 0; k < 3 + (r() * 3 | 0); k++) shard(C, x + (k - 2) * 4 + r() * 3, gy, 6 + r() * 16, 1.5 + r() * 1.5, (k - 2) * 0.12, DC); }
    for (let i = 0; i < 14; i++) { const x = r() * TW, len = 20 + r() * 90; let xx = x; for (let j = 0; j < len; j++) { xx += Math.sin(j * 0.15 + i) * 0.25; C.s(xx, j, j % 7 === 3 ? '#2a8a7a' : '#0e2a30'); } C.s(xx, len, '#9affd0'); C.s(xx, len + 1, '#5affb0'); }
    add(C, 0.3);
  } else if (th === 3) { // Sky Ruins: bright day
    weather = 'sparkle';
    const st = [[0, '#1a46b8'], [80, '#2860d0'], [150, '#3c80e6'], [215, '#5ea2f4'], [270, '#8cc4fa'], [320, '#bcdffd'], [360, '#e4f4ff']]; skyGrad(sky, st); top = st[0][1];
    rings(sky, 520, 62, 14, 70, '#fff8d8', 0.26, 5); orb(sky, 520, 62, 14, ['#fff0b0', '#fffad8', '#ffffff'], 0, 0);
    const CL = ['#5a78c0', '#7c96d2', '#a2b6e2', '#c8d8f0', '#e8f0fa', '#ffffff'];
    const A = layer(); [[120, 300, 360, 110], [520, 286, 300, 140], [880, 310, 380, 100], [1150, 296, 300, 120]].forEach(([x, y, w, h], i) => cloudBank(A, x, y, w, h, CL, 0.5, -0.8, 150 + i, { haze: pk('#a8d0f8'), hazeA: 0.4 }));
    for (let x = 0; x < TW; x++) for (let y = 300; y < TH; y++) A.s(x, y, dp(RU(['#8ab4e4', '#a2c6ee', '#bcd8f6']), 2 - (y - 300) / 40 + (pf(x, 20, 2, 151) - 0.5) * 1.5, x, y, 2));
    add(A, 0.04);
    const island = (pb, cx, cy, w, ruin, haze, hzA, seed) => { const r = rng(seed), rock = RU(['#4a2e34', '#6a4240', '#8c5c4c', '#b0785a', '#d09a6c', '#ecc48c']), grass = RU(['#2e6a3a', '#3e8a3a', '#62b042', '#94d050', '#d0f070']), H = pk(haze);
      const dep = []; for (let x = -w; x <= w; x++) dep.push(Math.round(Math.pow(1 - Math.abs(x / w), 0.8) * w * 0.85 * (0.75 + 0.25 * pv(cx + x, 60, seed)) + h2(x, seed) * 4));
      for (let x = -w; x <= w; x++) { const d = dep[x + w]; for (let y = 0; y < d; y++) { const strata = Math.floor((y + pv(cx + x, 40, seed + 1) * 6) / 6) % 2, lit = -x / w; let v = 3.2 + lit * 1.2 - y / d * 2 - strata * 0.6; let c = y < 3 ? dp(grass, 3.4 - y, cx + x, cy + y, 2) : dp(rock, v, cx + x, cy + y, 2.2); pb.s(cx + x, cy + y, mixu(c, H, hzA)); } if (h2(x, seed + 3) < 0.25) { const bl = 1 + (h2(x, seed + 4) * 3 | 0); for (let k = 1; k <= bl; k++) pb.s(cx + x, cy - k, mixu(grass[3], H, hzA)); } if (h2(x, seed + 5) < 0.12) { let xx = cx + x; const len = 6 + h2(x, seed + 6) * 22; for (let k = 0; k < len; k++) { xx += Math.sin(k * 0.4 + x) * 0.4; pb.s(xx, cy + d + k - 2, mixu(k % 4 ? '#3a6a3a' : '#5a9a4a', H, hzA)); } } }
      if (ruin) { const M = RU(['#7a7a94', '#a4a4b8', '#cfcedc', '#f4f2f8']); const cols = 2 + (r() * 3 | 0); for (let k = 0; k < cols; k++) { const px = cx - w * 0.6 + (k + 0.5) / cols * w * 1.2, hh = 14 + r() * 28 * (w / 70), broken = r() < 0.5; for (let y = 0; y < hh; y++) for (let q = -3; q <= 3; q++) { if (broken && y > hh - 4 && h2(q, y + k) < 0.5) continue; pb.s(px + q, cy - y, mixu(M[q < -1 ? 3 : q > 1 ? 0 : (q + 10) % 2 ? 2 : 1], H, hzA)); } if (!broken) for (let q = -5; q <= 5; q++) { pb.s(px + q, cy - hh, mixu(M[3], H, hzA)); pb.s(px + q, cy - hh - 1, mixu(M[2], H, hzA)); pb.s(px + q, cy - hh + 1, mixu(M[1], H, hzA)); } }
        if (cols >= 3 && r() < 0.7) { const hh = 26 * (w / 70) + 10, x0 = cx - w * 0.6 + 0.5 / cols * w * 1.2, x1 = cx - w * 0.6 + (cols - 0.5) / cols * w * 1.2; for (let x = x0; x <= x1; x++) for (let y = 0; y < 4; y++) pb.s(x, cy - hh - 6 - y, mixu(M[y === 3 ? 3 : y === 0 ? 0 : 2], H, hzA)); } }
      if (r() < 0.6) { const tx = cx + (r() - 0.5) * w; canopy(pb, tx, cy - 12 * (w / 70) - 4, 8 * (w / 70) + 4, ['#1e4a3a', '#2e6a3a', '#4a8e3e', '#74b448', '#a8d65a'], 0.5, -0.8, seed + 9, { haze: H, hazeA: hzA }); for (let y = 0; y < 10 * (w / 70) + 2; y++) pb.s(tx, cy - y, mixu(pk('#5a3a2a'), H, hzA)); }
      if (r() < 0.55) { const fx = cx + (r() < 0.5 ? -1 : 1) * w * (0.5 + r() * 0.3) | 0, top = cy + 1; for (let y = top; y < TH; y++) for (let q = 0; q < 5; q++) { const a = 1 - (y - top) / (TH - top); if (a <= 0) break; const c = ((y * 2 + q * 5 - 0) % 7 < 3) ? '#ffffff' : '#bfe6ff'; if (a > bay(fx + q, y) * 0.8) pb.s(fx + q, y, mixu(pk(c), H, hzA * 0.6)); } } };
    const B = layer(); let r = rng(161); for (let i = 0; i < 7; i++) island(B, i * 183 + r() * 80, 170 + r() * 90, 28 + r() * 24, r() < 0.7, '#9cc8f6', 0.55, 162 + i); add(B, 0.12);
    const C = layer(); r = rng(171); for (let i = 0; i < 4; i++) island(C, i * 320 + 80 + r() * 120, 150 + r() * 110, 54 + r() * 34, true, '#b4d8fa', 0.18, 172 + i); add(C, 0.25);
    const D = layer(); [[100, 380, 300, 60], [480, 388, 340, 52], [860, 378, 300, 64], [1200, 386, 260, 52]].forEach(([x, y, w, h], i) => cloudBank(D, x, y, w, h, CL, 0.5, -0.8, 180 + i, { haze: pk('#8ab4e4'), hazeA: 0.25 })); add(D, 0.45);
  } else { // Ember Forge: volcanic night
    weather = 'embers';
    const st = [[0, '#060208'], [80, '#10040c'], [150, '#1e0810'], [210, '#340c12'], [255, '#561412'], [295, '#882612'], [330, '#bc4214'], [360, '#e26a1c']]; skyGrad(sky, st); top = st[0][1];
    let r = rng(191); for (let i = 0; i < 200; i++) sky.s(r() * TW, r() * 240, r() < 0.3 ? '#ff8a4a' : '#4a1a1e');
    const SMK = ['#0c0609', '#160a0e', '#221014', '#321518', '#4c1c1a', '#76301e', '#b04e24'];
    const A = layer(); const VR = RU(['#12060a', '#1c0a0e', '#281014', '#36161a', '#4c1e1c', '#6e2a1e']);
    for (const vx of [380, 1020]) { const vw = 300, peak = 118; for (let x = -vw; x <= vw; x++) { const ax = Math.abs(x) / vw, t = peak + Math.pow(ax, 1.35) * 250 + (pv(vx + x, 90, 192) - 0.5) * 10 - (Math.abs(x) < 26 ? -6 : 0); for (let y = Math.max(0, Math.floor(t)); y < TH; y++) { const dep = y - t, lit = x < 0 ? -0.3 : 0.4; const c = dp(VR, 2.2 + lit * 1.4 - dep / 120 + (pf2(vx + x, y * 0.4, 60, 2, 193) - 0.5) * 1.6 + (dep < 1.5 ? 1.5 : 0), vx + x, y, 2.2); A.s(vx + x, y, c); } }
      rings(A, vx, peak + 4, 6, 70, '#ff7a2a', 0.5, 6);
      for (let k = 0; k < 6; k++) { let lx = vx + (k - 2.5) * 8, y = peak + 6; const len = 90 + r() * 170, bias = (k - 2.5) * 0.34 + (r() - 0.5) * 0.2; for (let s = 0; s < len; s++) { const surf = peak + Math.pow(Math.abs(lx - vx) / vw, 1.35) * 250; if (y < surf) y = surf; lx += bias + (h2(s * 7 + k * 31, vx) - 0.5) * 1.8; y += 1; const a = 1 - s / len; A.s(lx, y, a > 0.55 ? '#ffc040' : '#ff6a1a'); if (a > 0.25) A.s(lx + 1, y, a > 0.7 ? '#ffe890' : '#e0501a'); A.b(lx - 1, y, '#ff8a2a', 0.4 * a); A.b(lx + 2, y, '#ff8a2a', 0.3 * a); } }
      for (let k = 0; k < 7; k++) cloudBank(A, vx + k * 14 + Math.sin(k) * 10, peak - 10 - k * 22, 50 + k * 22, 26 + k * 4, SMK, 0, 1, 194 + k + vx); }
    add(A, 0.04);
    const B = layer(); [[200, 150, 300, 50], [640, 110, 360, 60], [1050, 170, 300, 50]].forEach(([x, y, w, h], i) => cloudBank(B, x, y, w, h, SMK, 0.1, 1, 201 + i)); add(B, 0.1);
    const C = layer(); const hp = range(C, { base: 330, amp: 130, cells: 10, seed: 211, sharp: true, sun: 1, R: ['#0c0406', '#14080a', '#1e0c0e', '#2a1214', '#3c1a18'], haze: '#5a1a12', hazeTop: 240, hazeBot: 360, hazeA: 0.55 });
    r = rng(212); for (let i = 0; i < 6; i++) { const x0 = r() * TW | 0; let lx = x0; for (let y = Math.round(hp[x0]) + 4; y < TH; y++) { lx += (h2(y, x0) - 0.5) * 1.2; C.s(lx, y, y % 6 ? '#e04a12' : '#ffb040'); C.s(lx + 1, y, '#a8300e'); } rings(C, x0, hp[x0] + 30, 2, 26, '#ff6a1a', 0.2, 4); }
    for (let x = 0; x < TW; x++) { const t = Math.round(hp[x]); if (hp[(x + 1) % TW] > hp[x]) C.s(x, t, '#8a2e16'); }
    add(C, 0.25);
    const D = layer(); r = rng(221); const FR = RU(['#050203', '#0a0506', '#120809', '#1a0c0c']);
    for (let x = 0; x < TW;) { const cw = 18 + (r() * 26 | 0), ht = 30 + (r() * 60 | 0) + Math.round(pf(x, 10, 3, 222) * 40); for (let q = 0; q < cw; q++) for (let y = TH - ht; y < TH; y++) D.s(x + q, y, dp(FR, q < 2 ? 3 : 1.4 - (y - (TH - ht)) / 100, x + q, y, 2)); if (r() < 0.6) { const sx = x + cw / 2 | 0, sh = 30 + r() * 40; for (let y = TH - ht - sh; y < TH - ht; y++) for (let q = -3; q <= 3; q++) D.s(sx + q, y, q === -3 ? FR[3] : FR[1]); cloudBank(D, sx + 10, TH - ht - sh - 8, 40, 18, SMK, 0, 1, 223 + x); }
      for (let wy = TH - ht + 8; wy < TH - 10; wy += 14) for (let wx = x + 4; wx < x + cw - 6; wx += 9) if (r() < 0.16) { D.r(wx, wy, 3, 5, '#c85a1e'); D.r(wx, wy, 3, 1, '#ffa040'); }
      x += cw + (r() * 40 | 0); }
    add(D, 0.45);
  }
  return BG[th] = { sky: sky.cv(), top, layers: L.map(l => ({ c: l.pb.cv(), f: l.f })), weather, vf };
}

// ---------- terrain ----------
const PADX = 14, PADY = 6, T = 20;
const TP = [
  { R: ['#120e22', '#1c162e', '#262040', '#322a52', '#423868', '#564a80', '#6e629c', '#9088bc'], C: ['#4e5090', '#7a80b8', '#a8b2dc', '#d4def4', '#ffffff'], O: '#0a0716' },
  { R: ['#1a0c10', '#2a1416', '#3e1e1a', '#542a20', '#6e3a28', '#8a4e32', '#a8683e', '#c88a52'], C: ['#1e3a22', '#2e5a2a', '#4e8434', '#7cae3e', '#b4d454', '#e8f07a'], O: '#120608' },
  { R: ['#04080f', '#08101c', '#0e1828', '#142236', '#1c2e46', '#263c58', '#34506e', '#4a6a8c'], C: ['#0a3034', '#125248', '#1e7c66', '#36ac8a', '#72dcb4', '#c4fff0'], O: '#02040a' },
  { R: ['#2a1a1e', '#40282a', '#5a3a34', '#76503e', '#94684a', '#b28656', '#cca466', '#e6c482'], C: ['#24502e', '#327034', '#4c963c', '#78bc48', '#aedc5a', '#e4f68a'], O: '#1a0e12' },
  { R: ['#070405', '#0e080a', '#160d10', '#201418', '#2c1c20', '#3a262a', '#4c3436', '#664846'], C: ['#140c0e', '#24161a', '#3a2224', '#5a3026', '#ff7a2a', '#ffd070'], O: '#040203' }].map(p => ({ R: RU(p.R), C: RU(p.C), O: pk(p.O), Rh: p.R, Ch: p.C }));
const VO = { d1: 0, d2: 0, id: 0, fx: 0, fy: 0 };
function vor(X, Y, cw, ch, seed) { const gx = Math.floor(X / cw), gy = Math.floor(Y / ch); let d1 = 1e9, d2 = 1e9; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = gx + i, cy = gy + j, px = (cx + 0.15 + h2(cx, cy * 7 + seed) * 0.7) * cw, py = (cy + 0.15 + h2(cx * 3 + seed, cy) * 0.7) * ch, dx = (X - px) / cw, dy = (Y - py) / ch, d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; VO.id = h2(cx * 11 + seed, cy * 5); VO.fx = dx; VO.fy = dy; } else if (d < d2) d2 = d; } VO.d1 = Math.sqrt(d1); VO.d2 = Math.sqrt(d2); return VO; }
const M = { t: 0, m: 0, glow: 0 };
function mat(th, X, Y, deep) {
  M.t = 0; M.m = 0; M.glow = 0;
  if (th === 0) { const v = vor(X, Y, 15, 11, 3), e = v.d2 - v.d1; if (e < 0.09) { M.m = 1; return M; } const ep = 1 - clamp(e / 0.34, 0, 1), dir = -(v.fx * 0.6 + v.fy * 0.8) / (Math.hypot(v.fx, v.fy) + 0.01); M.t = (v.id - 0.5) * 1.3 + ep * dir * 1.3 + (h2(X, Y) < 0.012 ? 1 : 0); return M; }
  if (th === 1) { const n = vn2(X / 14, Y / 9); M.t = n > 0.62 ? 0.8 : n < 0.34 ? -0.8 : 0; const v = vor(X, Y, 17, 13, 5); if (v.id < 0.3 && v.d1 < 0.3) { const dir = -(v.fx * 0.6 + v.fy * 0.8) / (v.d1 + 0.01); M.t = 1.6 + (v.d1 > 0.22 ? dir * 0.9 : dir * 0.3); if (v.d1 > 0.27) M.m = 1; } if (Math.abs(vn2(X / 22, Y / 5) - 0.5) < 0.018) M.t = -1.6; if (h2(X, Y) < 0.02) M.t += 0.9; return M; }
  if (th === 2) { const s = Y / 7 + vn2(X / 30, Y / 30) * 3, b = Math.floor(s) % 3; M.t = [0, 0.7, -0.5][(b + 3) % 3]; if (Math.abs(vn2(X / 12, Y / 12) - 0.5) < 0.03) M.t = -1.8; if (!deep && h2(X >> 1, Y >> 1) < 0.005) M.glow = 1; return M; }
  if (th === 3) { const bw = 40, bh = 20, row = Math.floor(Y / bh), off = ((row % 2 + 2) % 2) * 20 + (h2(row, 3) * 6 | 0), lx = ((X + off) % bw + bw) % bw, ly = ((Y % bh) + bh) % bh, bid = h2(Math.floor((X + off) / bw), row); if (lx === 0 || ly === 0) { M.m = 1; return M; } M.t = (bid - 0.5) * 1.2; if (lx === 1 || ly === 1) M.t += 1; else if (lx === bw - 1 || ly === bh - 1) M.t -= 0.9; if (vn2(X / 7, Y / 7) < 0.16) M.t -= 0.5; if (bid > 0.82 && lx > 8 && lx < 32 && ly > 5 && ly < 15) { const mx = lx - 20, my = ly - 10; if ((Math.abs(Math.abs(mx) - 7) < 1 && Math.abs(my) < 4) || (Math.abs(my) === 4 && Math.abs(mx) < 8) || (mx === 0 && Math.abs(my) < 2)) M.t -= 1.2; } return M; }
  const cw = 12, col = Math.floor((X + vn2(Y / 40, 1) * 6) / cw), lx = ((Math.floor(X + vn2(Y / 40, 1) * 6) % cw) + cw) % cw, off = Math.floor(h2(col, 9) * 26), jy = ((Y + off) % 26 + 26) % 26; M.t = (h2(col, 3) - 0.5) * 1.2; if (lx === 0 || jy === 0) { M.m = 1; return M; } if (lx === 1 || jy === 1) M.t += 0.9; else if (lx === cw - 1) M.t -= 0.7; if (!deep && Math.abs(vn2(X / 26, Y / 26) - 0.5) < 0.006 && vn2(X / 70, Y / 70) > 0.55) M.glow = 1; return M;
}
// props standing on the ground (drawn before the terrain so the ground overlaps their base)
function prop(pb, th, cx, gy, seed, glow) {
  const r = h1(seed), r2 = h1(seed + 5);
  if (th === 0) { if (r < 0.55) pine(pb, cx, gy + 2, 26 + r2 * 34, ['#0c0a24', '#161436', '#22204c', '#302f64', '#40427c'], 1, ['#8a8ec4', '#c4c8ea', '#ffffff']);
    else if (r < 0.82) { canopy(pb, cx, gy - 5, 6 + r2 * 3, ['#2a2648', '#3e3864', '#565082', '#7068a0'], -0.7, -0.6, seed); for (let x = -7; x <= 7; x++) { const hh = Math.round(3 - Math.abs(x) * 0.35); for (let y = 0; y < hh; y++) pb.s(cx + x, gy - 9 - y + Math.round(Math.abs(x) * 0.4), y === hh - 1 ? '#ffffff' : '#dce4fa'); } }
    else { orb(pb, cx, gy - 6, 6, ['#9aa4d8', '#d4dcf4', '#ffffff'], -0.6, -0.6); orb(pb, cx, gy - 15, 4, ['#9aa4d8', '#d4dcf4', '#ffffff'], -0.6, -0.6); pb.s(cx - 1, gy - 16, '#160c2e'); pb.s(cx + 2, gy - 16, '#160c2e'); pb.r(cx + 1, gy - 14, 3, 1, '#ff8a3a'); pb.r(cx - 5, gy - 10, 10, 2, '#e8404a'); pb.r(cx + 2, gy - 9, 2, 4, '#e8404a'); } return; }
  if (th === 1) { if (r < 0.42) { const t = [['#4a1e2a', '#7a2e2a', '#b04a2a', '#e07432', '#ffa848', '#ffd476'], ['#3e1426', '#6a1e2a', '#9e2c2c', '#d24a34', '#f47a4a', '#ffb070'], ['#4e2a22', '#7e4826', '#b8742a', '#e8a434', '#ffd050', '#fff090']][r2 * 3 | 0], rr = 10 + r2 * 6; pb.r(cx - 2, gy - rr * 1.4, 4, rr * 1.4, '#3a2018'); pb.r(cx - 2, gy - rr * 1.4, 1, rr * 1.4, '#6a3a26'); canopy(pb, cx, gy - rr * 1.8, rr, t, -0.6, -0.7, seed); }
    else if (r < 0.7) canopy(pb, cx, gy - 4, 5 + r2 * 3, ['#3a1e1e', '#6a2e22', '#a8482a', '#e0703a', '#ffa050'], -0.6, -0.7, seed);
    else if (r < 0.88) { pb.r(cx - 1, gy - 6, 3, 6, '#f4e8d0'); pb.r(cx + 1, gy - 6, 1, 6, '#c8b898'); orb(pb, cx, gy - 7, 5, ['#8a1a1a', '#c8302a', '#ff5a4a', '#ff9a8a'], -0.6, -0.7); for (let y = gy - 7; y < gy - 3; y++) for (let x = cx - 5; x <= cx + 5; x++) if (y >= gy - 5) pb.s(x, y, 0); pb.s(cx - 2, gy - 10, '#ffffff'); pb.s(cx + 2, gy - 9, '#ffffff'); pb.s(cx, gy - 11, '#ffffff'); }
    else { for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.4; for (let s = 0; s < 9; s++) pb.s(cx + Math.round(Math.cos(a) * s), gy - 1 + Math.round(Math.sin(a) * s), s < 5 ? '#4a7a2e' : s < 8 ? '#7cae3e' : '#c8e070'); } } return; }
  if (th === 2) { if (r < 0.5) { const mag = r2 < 0.35, C = mag ? ['#ffd6ff', '#f070e8', '#a030a8', '#ffffff'] : ['#d6ffff', '#6af0ff', '#1aa8d0', '#ffffff']; for (let k = 0; k < 3 + (r2 * 3 | 0); k++) shard(pb, cx + (k - 1.5) * 4, gy, 8 + h1(seed + k) * 16, 1.5 + h1(seed + k + 9), (k - 1.5) * 0.15, C); glow.push({ x: cx, y: gy - 10, r: 46, c: mag ? '#f070e8' : '#5ae8ff', a: 0.5 }); }
    else if (r < 0.82) { for (let k = 0; k < 3; k++) { const mx = cx + (k - 1) * 6, hh = 4 + (k % 2) * 4 + r2 * 3; pb.r(mx, gy - hh, 1, hh, '#6ac0b0'); pb.r(mx + 1, gy - hh, 1, hh, '#2a6a64'); for (let x = -3; x <= 3; x++) for (let y = -2; y <= 0; y++) if (x * x / 9 + y * y / 4 <= 1) pb.s(mx + x, gy - hh + y, y === -2 || x < -1 ? '#b0fff0' : y === 0 ? '#1a8a7a' : '#5affd0'); } glow.push({ x: cx, y: gy - 8, r: 34, c: '#5affd0', a: 0.45 }); }
    else spire(pb, cx, gy, 16 + r2 * 10, 4, ['#08101c', '#142236', '#263c58', '#3e5a7a'], -1, 1); return; }
  if (th === 3) { if (r < 0.45) { const hh = 14 + r2 * 22, Mm = ['#6a6a86', '#9a9ab0', '#cac8d8', '#f2f0f6']; for (let y = 0; y < hh; y++) for (let q = -3; q <= 3; q++) pb.s(cx + q, gy - y, Mm[q <= -2 ? 3 : q >= 2 ? 0 : (q & 1) ? 2 : 1]); if (r2 < 0.5) { pb.r(cx - 5, gy - hh - 2, 11, 2, Mm[3]); pb.r(cx - 4, gy - hh, 9, 1, Mm[1]); } else { pb.s(cx - 3, gy - hh - 1, Mm[2]); pb.s(cx + 1, gy - hh - 2, Mm[2]); } pb.r(cx - 5, gy - 2, 11, 2, Mm[2]); pb.r(cx - 5, gy - 1, 11, 1, Mm[0]); }
    else if (r < 0.72) { pb.r(cx - 4, gy - 7, 9, 7, '#b0603a'); pb.r(cx - 4, gy - 7, 2, 7, '#d88a5a'); pb.r(cx + 3, gy - 7, 2, 7, '#7a3a26'); pb.r(cx - 5, gy - 8, 11, 2, '#e8a070'); canopy(pb, cx, gy - 12, 5, ['#1e4a2e', '#2e6a3a', '#4a8e3e', '#74b448', '#a8d65a'], -0.6, -0.7, seed); pb.s(cx - 2, gy - 14, '#ff6a8a'); pb.s(cx + 2, gy - 12, '#ffe040'); pb.s(cx, gy - 16, '#ffffff'); }
    else canopy(pb, cx, gy - 5, 6, ['#1e4a2e', '#2e6a3a', '#4a8e3e', '#74b448', '#a8d65a'], -0.6, -0.7, seed); return; }
  if (r < 0.45) canopy(pb, cx, gy - 3, 4 + r2 * 4, ['#0e080a', '#1e1418', '#2e2226', '#463438'], -0.6, -0.7, seed);
  else if (r < 0.75) { pb.r(cx - 1, gy - 22, 3, 22, '#1e1618'); pb.r(cx - 1, gy - 22, 1, 22, '#3a2e30'); pb.r(cx - 4, gy - 27, 9, 6, '#140e10'); pb.r(cx - 3, gy - 26, 7, 4, '#ff9a30'); pb.r(cx - 2, gy - 25, 5, 2, '#ffe080'); glow.push({ x: cx, y: gy - 24, r: 44, c: '#ff8a2a', a: 0.6 }); }
  else { pb.r(cx - 5, gy - 4, 11, 4, '#1e1618'); pb.r(cx - 4, gy - 5, 9, 2, '#ff6a1a'); pb.r(cx - 2, gy - 5, 4, 1, '#ffd070'); glow.push({ x: cx, y: gy - 5, r: 30, c: '#ff6a1a', a: 0.5 }); }
}
function spikesStatic(pb, th, X0, Y0) {
  if (th === 4) return;
  if (th === 2) { for (let s = 0; s < 3; s++) shard(pb, X0 + 4 + s * 6, Y0 + 19, 10 + h2(X0 + s, Y0) * 6, 2.4, 0, ['#ffd0fa', '#ff7af0', '#a83aa0', '#ffffff']); pb.r(X0, Y0 + 18, 20, 2, '#5a1a5a'); return; }
  pb.r(X0, Y0 + 15, 20, 5, th === 1 ? '#4a2a18' : th === 0 ? '#3a3a6a' : '#5a2a28'); pb.r(X0, Y0 + 15, 20, 1, th === 1 ? '#7a4a2a' : th === 0 ? '#6a6aa0' : '#8a4a3a');
  for (let s = 0; s < 3; s++) { const bx = X0 + 3 + s * 7; for (let k = 0; k < 13; k++) { const w = Math.round(k / 13 * 3.2); for (let q = -w; q <= w; q++) { let c; if (th === 1) c = k < 2 ? '#ffe0b0' : q < 0 ? '#c08850' : q > 0 ? '#6a4024' : '#9a6a3a'; else if (th === 0) c = k < 2 ? '#ffffff' : q < 0 ? '#e6f4ff' : q > 0 ? '#6a9ad0' : '#a8d4f4'; else c = k < 2 ? '#ff5a4a' : q < 0 ? '#d4d8e8' : q > 0 ? '#3e4260' : '#868ca8'; pb.s(bx + q, Y0 + 3 + k, c); } } }
}
function plankStatic(pb, th, X0, Y0) {
  const P = [['#5a4a6a', '#8a7aa0', '#2a2238'], ['#7a4a2a', '#b07a48', '#3a2214'], ['#2e5462', '#6ab0b4', '#10222a'], ['#c8b898', '#f2e8d0', '#7a6a58'], ['#3a3438', '#6a6268', '#141014']][th];
  pb.r(X0, Y0, 20, 7, P[0]); pb.r(X0, Y0, 20, 2, P[1]); pb.r(X0, Y0 + 6, 20, 1, P[2]); for (let k = 3; k < 20; k += 8) { pb.r(X0 + k, Y0 + 2, 1, 4, P[2]); pb.s(X0 + k + 1, Y0 + 3, P[1]); }
  if (th === 0) for (let x = 0; x < 20; x++) { pb.s(X0 + x, Y0 - 1, '#ffffff'); if (h2(X0 + x, Y0) < 0.6) pb.s(X0 + x, Y0 - 2, '#e6ecff'); }
  if (th === 1 || th === 3) for (let x = 0; x < 20; x += 2) if (h2(X0 + x, Y0) < 0.5) pb.s(X0 + x, Y0 - 1, '#7cae3e');
  if (th === 2) for (let x = 0; x < 20; x++) if (h2(X0 + x, Y0) < 0.5) pb.s(X0 + x, Y0 - 1, '#36ac8a');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 20; x++) pb.b(X0 + x, Y0 + 7 + y, '#000000', 0.22 * (1 - y / 4));
}
function iceStatic(pb, X0, Y0) { const R = RU(['#3a6aa8', '#5a94c8', '#86c0e8', '#b4e0fa', '#e2f6ff', '#ffffff']); for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { let v = 2.6 + ((x + y) % 14 < 2 ? 1.4 : 0) - y * 0.05; if (y < 2) v = 5 - y; if (x === 0) v = 1; if (x === 19 || y === 19) v = 0.6; if (h2(X0 + x, Y0 + y) < 0.02) v = 5; pb.s(X0 + x, Y0 + y, dp(R, v, X0 + x, Y0 + y, 2)); } }

const worldCache = {};
function buildWorld(g) {
  const ck = g.li + '-' + g.n; if (worldCache[ck]) return worldCache[ck];
  const th = g.theme, W = g.W, H = g.H, gr = g.grid, AW = (W + 2 * PADX) * T, AH = (H + 2 * PADY) * T, OX = PADX * T, OY = PADY * T, pb = PB(AW, AH), P = TP[th], glow = [];
  const rock = (tx, ty) => { if (tx < 0 || tx >= W) return true; if (ty < 0) return gr[0][tx] === '#'; if (ty >= H) return gr[H - 1][tx] === '#'; return gr[ty][tx] === '#'; };
  const cell = (tx, ty) => (tx < 0 || tx >= W || ty < 0 || ty >= H) ? (rock(tx, ty) ? '#' : '.') : gr[ty][tx];
  // props
  const avoid = new Set(), mark = (wx, r) => { const t = Math.floor(wx / 10); for (let k = -r; k <= r; k++) avoid.add(t + k); };
  mark(g.door.x + 10, 2); mark(g.keyHome.x, 1); g.plateDefs.forEach(p => mark(p.x + 10, 2)); g.leverDefs.forEach(p => mark(p.x, 1)); g.lights.forEach(p => mark(p.x, 1)); g.torchDefs.forEach(p => mark(p.x, 1)); g.fanDefs.forEach(f => { for (let k = 0; k < f.w / 10; k++) mark(f.x + k * 10, 1); }); g.liftDefs.forEach(l => { mark(l.x, 1); mark(l.x + l.w, 1); mark(l.x2, 1); mark(l.x2 + l.w, 1); }); g.crateDefs.forEach(c => { for (let k = 0; k <= c.w / 10; k++) mark(c.x + k * 10, 0); });
  for (let tx = 1; tx < W - 1; tx++) { if (avoid.has(tx)) continue; let ty = 0; while (ty < H && gr[ty][tx] !== '#') ty++; if (ty >= H || ty < 4) continue; let clear = true; for (let k = 1; k <= 3; k++) if (gr[ty - k][tx] !== '.') clear = false; if (!clear || h2(tx, g.li * 13) > 0.32) continue; prop(pb, th, OX + tx * T + 10, OY + ty * T, tx * 7 + g.li * 131, glow); }
  for (const gl of glow) { gl.x = (gl.x - OX) / 2; gl.y = (gl.y - OY) / 2; }
  // solid mask and distance fields
  const N = AW * AH, Ms = new Uint8Array(N);
  for (let ty = -PADY; ty < H + PADY; ty++) for (let tx = -PADX; tx < W + PADX; tx++) if (rock(tx, ty)) { const x0 = OX + tx * T, y0 = OY + ty * T; for (let y = y0; y < y0 + T; y++) Ms.fill(1, y * AW + x0, y * AW + x0 + T); }
  const D = new Uint16Array(N); for (let i = 0; i < N; i++) D[i] = Ms[i] ? 60000 : 0;
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { const i = y * AW + x; if (!Ms[i]) continue; let d = D[i]; if (x > 0 && D[i - 1] + 10 < d) d = D[i - 1] + 10; if (y > 0) { if (D[i - AW] + 10 < d) d = D[i - AW] + 10; if (x > 0 && D[i - AW - 1] + 14 < d) d = D[i - AW - 1] + 14; if (x < AW - 1 && D[i - AW + 1] + 14 < d) d = D[i - AW + 1] + 14; } D[i] = d; }
  for (let y = AH - 1; y >= 0; y--) for (let x = AW - 1; x >= 0; x--) { const i = y * AW + x; if (!Ms[i]) continue; let d = D[i]; if (x < AW - 1 && D[i + 1] + 10 < d) d = D[i + 1] + 10; if (y < AH - 1) { if (D[i + AW] + 10 < d) d = D[i + AW] + 10; if (x < AW - 1 && D[i + AW + 1] + 14 < d) d = D[i + AW + 1] + 14; if (x > 0 && D[i + AW - 1] + 14 < d) d = D[i + AW - 1] + 14; } D[i] = d; }
  const dU = new Uint8Array(N), dDn = new Uint8Array(N), dL = new Uint8Array(N), dR = new Uint8Array(N);
  for (let x = 0; x < AW; x++) { let r = 60; for (let y = 0; y < AH; y++) { const i = y * AW + x; r = Ms[i] ? Math.min(255, r + 1) : 0; dU[i] = r; } r = 60; for (let y = AH - 1; y >= 0; y--) { const i = y * AW + x; r = Ms[i] ? Math.min(255, r + 1) : 0; dDn[i] = r; } }
  for (let y = 0; y < AH; y++) { let r = 60; for (let x = 0; x < AW; x++) { const i = y * AW + x; r = Ms[i] ? Math.min(255, r + 1) : 0; dL[i] = r; } r = 60; for (let x = AW - 1; x >= 0; x--) { const i = y * AW + x; r = Ms[i] ? Math.min(255, r + 1) : 0; dR[i] = r; } }
  // rock body
  const R = P.R, b0 = th === 3 ? 4.6 : 4.3, DEEP = [3.1, 3, 2.8, 1.7, 2.6][th], glowC = th === 2 ? pk('#7af6ff') : pk('#ff7a2a'), glowH = th === 2 ? pk('#e0ffff') : pk('#ffd070');
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const i = y * AW + x; if (!Ms[i]) continue; const d = D[i] / 10;
    if (d < 1.5) { pb.u[i] = (dU[i] <= 1 || dL[i] <= 1) ? R[1] : P.O; continue; }
    const deepF = sst(4, 38, d), X = x - OX, Y = y - OY; mat(th, X, Y, d > 22 || d < 3);
    if (M.glow) { pb.u[i] = h2(X, Y + 1) < 0.5 ? glowH : glowC; if (h2(X, Y + 7) < 0.07) glow.push({ x: X / 2, y: Y / 2, r: 14, c: th === 2 ? '#5ae8ff' : '#ff6a1a', a: 0.35 }); continue; }
    let v = b0 + M.t * (1 - 0.55 * deepF) - deepF * DEEP;
    if (dU[i] <= 3) v += 1.4; else if (dL[i] <= 3) v += 1.0; if (dR[i] <= 3) v -= 0.9; if (dDn[i] <= 3) v -= 1.2;
    if (M.m) v -= 2 * (1 - 0.5 * deepF);
    pb.u[i] = dp(R, v, x, y, 7);
  }
  // top caps, hangings and static tiles
  const C = P.C, CN = C.length - 1, capT = [7, 5, 4, 5, 3][th];
  for (let ty = -PADY; ty < H + PADY; ty++) for (let tx = -PADX; tx < W + PADX; tx++) {
    if (!rock(tx, ty)) continue; const above = cell(tx, ty - 1);
    if (!rock(tx, ty - 1) && '=%[]<>'.indexOf(above) < 0) {
      const Y0 = OY + ty * T, lo = !rock(tx - 1, ty) && cell(tx - 1, ty) === '.', ro = !rock(tx + 1, ty) && cell(tx + 1, ty) === '.';
      for (let px = lo ? -3 : 0; px < (ro ? 23 : 20); px++) {
        const X = OX + tx * T + px; if (X < 0 || X >= AW) continue; const ov = px < 0 ? -px : px > 19 ? px - 19 : 0, seed = X * 3 + ty * 17;
        const bump = ov ? 0 : Math.round((th === 0 ? 1.2 : 0.6) + Math.sin(X * 0.23) * 1.1 + Math.sin(X * 0.071 + ty) * 1.2), thick = capT + (h2(X, ty) < 0.3 ? 1 : 0) - ov * 2 + (th === 0 && h2(X >> 1, ty) < 0.12 ? 3 : 0);
        if (thick <= 0) continue; const top = Y0 - Math.max(0, bump);
        for (let y = Math.max(0, top); y < Math.min(AH, Y0 + thick); y++) { const k = y - top, rel = k / (thick + bump); let v = CN - 0.4 - rel * (CN - 0.4) * 1.05 + (ov ? -0.6 : 0) + (px <= 1 && lo ? 0.5 : 0) + (px >= 18 && ro ? -0.6 : 0); if (k === 0) v = CN; if (th === 1 || th === 3) v += (h2(X >> 1, y) - 0.5) * 0.9; pb.u[y * AW + X] = dp(C, v, X, y, 2.4); }
        const sy = Y0 + thick; for (let k = 0; k < 2; k++) { const i = (sy + k) * AW + X; if (i < N && Ms[i]) pb.u[i] = mixu(pb.u[i], 0, 0.35 - k * 0.15); }
        if (ov) continue;
        if ((th === 1 || th === 3) && h2(seed, 1) < 0.35) { const bh = 1 + (h2(seed, 2) * 4 | 0); for (let k = 1; k <= bh; k++) pb.s(X, top - k, k === bh ? C[CN] : C[CN - 1]); }
        if (th === 1 && h2(seed, 3) < 0.05) { pb.s(X, top - 1, ['#e07432', '#d24a34', '#ffd050'][h2(seed, 4) * 3 | 0]); pb.s(X + 1, top - 1, '#b04a2a'); }
        if (th === 3 && h2(seed, 5) < 0.025 && px > 1 && px < 18) { const fc = ['#ffffff', '#ffe040', '#ff8ac0'][h2(seed, 6) * 3 | 0]; pb.s(X, top - 4, fc); pb.s(X - 1, top - 3, fc); pb.s(X + 1, top - 3, fc); pb.s(X, top - 3, '#ffd040'); pb.s(X, top - 2, '#4c963c'); pb.s(X, top - 1, '#4c963c'); }
        if (th === 0 && h2(seed, 7) < 0.04) pb.s(X, top, '#ffffff');
        if (th === 2 && h2(seed, 8) < 0.04) { pb.s(X, top - 1, '#b0fff0'); pb.s(X, top, '#5affd0'); if (h2(seed, 9) < 0.4) glow.push({ x: (X - OX) / 2, y: (top - OY) / 2, r: 12, c: '#5affd0', a: 0.4 }); }
        if (th === 4 && h2(seed, 10) < 0.08) { pb.s(X, top, h2(seed, 11) < 0.5 ? '#ff7a2a' : '#ffd070'); if (h2(seed, 12) < 0.3) glow.push({ x: (X - OX) / 2, y: (top - OY) / 2, r: 10, c: '#ff6a1a', a: 0.35 }); }
      }
    }
    const below = cell(tx, ty + 1);
    if (!rock(tx, ty + 1) && below === '.' && ty + 1 < H) {
      const Y0 = OY + (ty + 1) * T;
      for (let px = 0; px < 20; px++) { const X = OX + tx * T + px; for (let y = 0; y < 6; y++) pb.b(X, Y0 + y, '#000000', 0.26 * (1 - y / 6)); }
      for (let px = 1; px < 19; px += 2 + (h2(tx * 20 + px, ty) * 4 | 0)) {
        const X = OX + tx * T + px, Ln = 3 + (h2(X, ty * 7) * 11 | 0), s = h2(X, ty * 3);
        if (th === 0) { if (s < 0.6) for (let k = 0; k < Ln * 0.8; k++) { const w = k < Ln * 0.3 ? 1 : 0; for (let q = 0; q <= w; q++) pb.s(X + q, Y0 + k, q ? '#7aa8e0' : k > Ln * 0.6 ? '#b4e0fa' : '#e6f6ff'); } }
        else if (th === 1) { let wx = X; for (let k = 0; k < Ln; k++) { wx += Math.round(Math.sin(k * 0.7 + X) * 0.6); pb.s(wx, Y0 + k, k % 4 === 0 ? '#6a4428' : '#3e2418'); } if (s < 0.3) { pb.s(wx, Y0 + Ln, '#4e8434'); pb.s(wx + 1, Y0 + Ln, '#7cae3e'); } }
        else if (th === 2) { if (s < 0.55) { for (let k = 0; k < Ln; k++) pb.s(X, Y0 + k, k % 3 ? '#125248' : '#1e7c66'); pb.s(X, Y0 + Ln, '#b0fff0'); glow.push({ x: (X - OX) / 2, y: (Y0 + Ln - OY) / 2, r: 10, c: '#5affd0', a: 0.4 }); } }
        else if (th === 3) { let wx = X; for (let k = 0; k < Ln + 6; k++) { wx += Math.round(Math.sin(k * 0.5 + X) * 0.5); pb.s(wx, Y0 + k, '#327034'); if (k % 4 === 2) { pb.s(wx + 1, Y0 + k, '#78bc48'); pb.s(wx + 2, Y0 + k - 1, '#aedc5a'); } } }
        else { if (s < 0.35) { spire(pb, X, Y0, Math.min(Ln, 9), 2, ['#0e080a', '#201418', '#3a262a'], 1, 1); if (s < 0.12) { pb.s(X, Y0 + Math.min(Ln, 9), '#ff7a2a'); glow.push({ x: (X - OX) / 2, y: (Y0 + 9 - OY) / 2, r: 10, c: '#ff6a1a', a: 0.35 }); } } }
      }
    }
  }
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { const ch = gr[ty][tx], X0 = OX + tx * T, Y0 = OY + ty * T; if (ch === '^') { spikesStatic(pb, th, X0, Y0); if (th === 4) glow.push({ x: tx * 10 + 5, y: ty * 10 + 4, r: 34, c: '#ff5a10', a: 0.55 }); } else if (ch === '-') plankStatic(pb, th, X0, Y0); else if (ch === '=') iceStatic(pb, X0, Y0); }
  // soft glow layer (quarter resolution), added on top with screen blending
  let gc = null;
  if (glow.length) { gc = mk(Math.ceil(AW / 4), Math.ceil(AH / 4)); const gx = gc.getContext('2d'); gx.globalCompositeOperation = 'lighter';
    for (const gl of glow) { const cx = (gl.x * 2 + OX) / 4, cy = (gl.y * 2 + OY) / 4, rr = gl.r / 4, [r0, g0, b0_] = rgb(gl.c), gd = gx.createRadialGradient(cx, cy, 0, cx, cy, rr); gd.addColorStop(0, `rgba(${r0},${g0},${b0_},${gl.a})`); gd.addColorStop(0.45, `rgba(${r0},${g0},${b0_},${gl.a * 0.35})`); gd.addColorStop(1, `rgba(${r0},${g0},${b0_},0)`); gx.fillStyle = gd; gx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); } }
  return worldCache[ck] = { c: pb.cv(), glow: gc, ox: OX, oy: OY };
}

window.HPArt = { mk, clamp, pk, rgb, mixh, mixu, PB, h1, h2, vn, fbm, vn2, bay, rng, buildBG, buildWorld, TW, TH, PADX, PADY, TP };
})();
