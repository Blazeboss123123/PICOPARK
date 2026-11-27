// Huddle Peak shared simulation. Runs in the browser (local play / rendering / prediction) and in Node (online server).
(function (root) {
'use strict';
const TS = 10, VW = 320, VH = 180, ROWS = 18, STEP = 1 / 120;
const G = 900, JUMP = 244, SPEED = 78, MAXFALL = 320, SPRING = 400, ROPE = 56, CRATE_SPEED = 24, BELT = 40, RAFT = 40;
const PW = 10, PH = 14, JUMP_RISE = 38; // a normal jump peaks about 33 units up
const THEMES = ['Snowpeak', 'Autumn Woods', 'Crystal Caves', 'Sky Ruins', 'Ember Forge', 'Frostbite Summit', 'Haunted Hollow', 'Glimmer Depths', 'Thunder Spires', 'Molten Core'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const ov = (a, b) => a.x < b.x + b.w - 1e-6 && a.x + a.w > b.x + 1e-6 && a.y < b.y + b.h - 1e-6 && a.y + a.h > b.y + 1e-6;
const MAXP = 8, SEQ_GAP = 1.25, SLIME_BOUNCE = 330, KEYRUN = 96, LEAN = 22, LEANMAX = 56, FUSE = 2.6;
const CANNON_FAR = [300, -280], CANNON_NEAR = [-25, -380]; // numbered switches: seconds allowed between presses
const SH = n => n >= 3 ? 5 : 4; // wall height that needs everyone stacked: 2 players reach 4 tiles, 3 players reach 5

// ---------- level builder ----------
function B(w, rows) {
  rows = rows || ROWS;
  const g = []; for (let y = 0; y < rows; y++) g.push(new Array(w).fill('.'));
  const L = { w, rows, g, ents: [], hints: [], flags: {} };
  L.f = (x0, y0, x1, y1, ch) => { ch = ch || '#'; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < rows && x >= 0 && x < L.w) g[y][x] = ch; return L; };
  L.gr = (x0, x1, top) => L.f(x0, top, x1, rows - 1, '#');
  L.pit = (x0, x1, floor, depth) => { L.f(x0, floor, x1, floor + depth - 1, '.'); L.f(x0, floor + depth - 1, x1, floor + depth - 1, '^'); return L; };
  L.spk = (x0, x1, row) => L.f(x0, row, x1, row, '^');
  L.st = (x, floor, n, ch) => { for (let i = 0; i < n; i++) L.f(x + i, floor - 1 - i, x + i, floor - 1, ch); return L; };
  L.e = o => { L.ents.push(o); return L; };
  L.h = (x, y, t, hide) => { L.hints.push({ x, y, t, hide: hide || null }); return L; };
  L.lava = (x0, x1) => L.f(x0, 0, x1, rows - 1, '.').gr(x0, x1, rows - 1).spk(x0, x1, rows - 2);
  return L;
}
const S0 = (L, x, floor) => L.e({ t: 'spawn', x, floor: floor || 15 });
const exactN = n => n <= 3 ? 2 : n <= 5 ? 3 : 4; // riders for 'exact' lifts
const raftW = n => Math.max(6, n);
const stackHint = (s) => s > 4 ? 'Too high! Stack three high' : 'Too high? Stand on a friend!';

// ---------- teamwork rooms, added before a level's exit; each returns the x where it ends ----------
// Held gate: a button on each side holds it open. Someone waits so the others can cross, then gets let through.
function roomGate(L, x, F, sig) {
  (L.rooms = L.rooms || []).push({ t: 'gate', x, F, sig });
  L.f(x + 5, 0, x + 5, F - 7).f(x + 5, F - 6, x + 5, F - 1, sig.toUpperCase());
  L.e({ t: 'plate', x: x + 1, floor: F, sig }).e({ t: 'plate', x: x + 8, floor: F, sig });
  L.h(x + 5, F - 8, 'Hold the gate for each other', 'x:' + (x + 11));
  return x + 12;
}
// Douse the fire: a fire wall you can't jump. The button that puts it out is on a ledge you need a boost to reach;
// a second button past the fire lets the team bring the ledge-holder across.
function roomFire(L, x, F, s, sig) {
  s = Math.min(s, F - 2);
  (L.rooms = L.rooms || []).push({ t: 'fire', x, F, sig, s });
  L.f(x + 1, F - s, x + 4, F - s);
  L.e({ t: 'plate', x: x + 2, floor: F - s, sig });
  L.f(x + 8, 0, x + 8, F - 7).e({ t: 'fire', x: x + 8, floor: F, h: Math.min(6, F), sig });
  L.e({ t: 'plate', x: x + 11, floor: F, sig });
  L.h(x + 5, F - s - 3, 'The fire goes out while someone holds the button', 'x:' + (x + 14));
  return x + 14;
}
// Numbered switches (one per player, up to 4), far apart: press them in order, each within a second or so of the last.
// Nobody can run between them in time, so everyone takes a switch and you count it out.
function roomOrder(L, x, F, n, sig) {
  const k = Math.min(Math.max(n, 2), 4), gap = 14;
  (L.rooms = L.rooms || []).push({ t: 'order', x, F, sig, k, gap });
  for (let i = 0; i < k; i++) L.e({ t: 'plate', x: x + 1 + i * gap, floor: F, sig, seq: i + 1 });
  const gx = x + 4 + (k - 1) * gap;
  L.f(gx, 0, gx, F - 7).f(gx, Math.max(0, F - 6), gx, F - 1, sig.toUpperCase());
  L.h(x + 1 + (k - 1) * gap / 2, F - 6, 'Press 1' + (k > 2 ? ', 2, 3' : ', 2') + (k > 3 ? ', 4' : '') + ' in order. Too far apart to run!', sig);
  return gx + 2;
}
// Keep moving: a bridge over spikes that only holds while someone runs on a treadmill. A second treadmill on the
// far side lets the last runner across.
function roomRun(L, x, F, sig) {
  (L.rooms = L.rooms || []).push({ t: 'run', x, F, sig });
  L.e({ t: 'plate', x: x + 1, floor: F, sig, run: -1 });
  L.f(x + 6, F, x + 11, F + 1, '.').f(x + 6, F + 1, x + 11, F + 1, '^').f(x + 6, F, x + 11, F, sig);
  L.e({ t: 'plate', x: x + 13, floor: F, sig, run: -1 });
  L.h(x + 8, F - 5, 'The bridge only holds while someone runs left on a treadmill', 'x:' + (x + 17));
  return x + 17;
}
// Crate bridge: a gap too wide to jump; everyone pushes the big crate in to fill it.
function roomCrate(L, x, F) {
  (L.rooms = L.rooms || []).push({ t: 'crate', x, F });
  L.e({ t: 'crate', x: x + 2, floor: F, w: 5, h: 2, need: 'all' });
  L.f(x + 12, F, x + 16, F + 1, '.').f(x + 12, F + 1, x + 16, F + 1, '^');
  L.h(x + 9, F - 5, 'Too wide to jump. Everyone push the crate in!', 'x:' + (x + 18));
  return x + 19;
}
// Everyone's buttons at once: one sits on a pillar that needs a boost, the rest are spread along the floor.
function roomButtons(L, x, F, n, s, sig) {
  s = Math.min(s, F - 2); // leave headroom under the top of the level
  (L.rooms = L.rooms || []).push({ t: 'buttons', x, F, sig, s });
  L.f(x + 3, F - s, x + 6, F - 1);
  L.e({ t: 'plate', x: x + 4, floor: F - s, sig, and: true });
  for (let i = 1; i < n; i++) L.e({ t: 'plate', x: x + 6 + i * 3, floor: F, sig, and: true });
  const gx = x + 9 + (n - 1) * 3;
  L.f(gx, 0, gx, F - 7).f(gx, Math.max(0, F - 6), gx, F - 1, sig.toUpperCase());
  L.h(x + 5 + (n - 1) * 1.5, F - s - 4, n + ' buttons at once. One needs a boost', sig);
  return gx + 2;
}

// Squash the slime: a slime patrols a tunnel too low to jump it in. Push the crate through and flatten it.
function roomPin(L, x, F, n) {
  (L.rooms = L.rooms || []).push({ t: 'pin', x, F });
  L.e({ t: 'crate', x: x + 1, floor: F, w: 2, h: 2, need: n >= 3 ? 2 : 1 });
  L.f(x + 5, 0, x + 18, F - 3);
  L.e({ t: 'slime', x: x + 6, x2: x + 16.6, floor: F, spd: 24 });
  L.h(x + 3, F - 5, 'Too low to jump the slime. Squash it with the crate!', 'x:' + (x + 21));
  return x + 24;
}
// Bounce pad: a big slime patrols under a high ledge. Bounce off its head to reach the button that holds the gate;
// a button past the gate brings the bouncer through.
function roomSlime(L, x, F, sig) {
  const h = Math.min(7, F - 3);
  (L.rooms = L.rooms || []).push({ t: 'slime', x, F, sig, h });
  L.e({ t: 'slime', x: x + 2, x2: x + 7, floor: F, big: true, spd: 20 });
  L.f(x + 10, F - h, x + 13, F - h).e({ t: 'plate', x: x + 11, floor: F - h, sig });
  L.f(x + 15, 0, x + 15, F - 8).f(x + 15, Math.max(0, F - 7), x + 15, F - 1, sig.toUpperCase());
  L.e({ t: 'plate', x: x + 17, floor: F, sig });
  L.h(x + 6, F - h - 2, "Bounce off the slime's head to reach the button", 'x:' + (x + 20));
  return x + 20;
}
// Lean on me: a platform over lava drifts toward whichever side has more weight. Balance to stop before the fire.
function roomTilt(L, x, F, n) {
  const w = raftW(n), lw = 28;
  (L.rooms = L.rooms || []).push({ t: 'tilt', x, F, w, lw });
  L.lava(x + 2, x + 1 + lw);
  L.e({ t: 'tilt', x: x + 2, y: F, w, x2: x + 2 + lw - w });
  L.e({ t: 'fire', x: x + 2 + lw / 2, floor: F, h: Math.min(5, F - 1), period: 3.6, on: 0.45 });
  L.h(x + 7, F - 5, 'It drifts to the heavy side. Spread out to stop!', 'x:' + (x + lw + 4));
  return x + lw + 4;
}
// Pass it up: the floor steps up. Whoever holds a heavy key can't jump, so friends pass it up.
function roomUp(L, x, F, n) {
  const h = n >= 3 ? 2 : 1;
  (L.rooms = L.rooms || []).push({ t: 'up', x, F, h });
  L.f(x + 8, F - h, L.w - 1, F - 1);
  L.h(x + 7, F - h - 4, h > 1 ? 'Heavy key: pass it up a stack of friends' : 'Heavy key: pass it up to a friend', 'x:' + (x + 11));
  return { x: x + 10, F: F - h };
}

// ---------- rooms for worlds 6-10 ----------
// The key (or the second key) on a ledge that needs the whole team stacked.
function roomKey(L, x, F, n, t) {
  const s = Math.min(SH(n), F - 2), k2 = t === 'key2';
  (L.rooms = L.rooms || []).push({ t: k2 ? 'key2' : 'key', x, F, s });
  L.f(x + 2, F - s, x + 6, F - s).e({ t: k2 ? 'key2' : 'key', x: x + 4, floor: F - s });
  L.h(x + 4, F - s - 3, k2 ? 'Second key! Stack for it' : 'Stack for the key', k2 ? 'key2' : 'key');
  return x + 9;
}
// The key runs along open ground: two players trap it.
function roomRunKey(L, x, F) {
  (L.rooms = L.rooms || []).push({ t: 'runkey', x, F });
  L.e({ t: 'key', x: x + 10, floor: F, run: [x + 2, x + 18] }).h(x + 10, F - 5, 'The key runs! Trap it between two of you', 'key');
  return x + 21;
}
// Seesaw catapult: someone jumps from the pillar onto one end, launching whoever stands on the other end up the cliff.
// They pull the lever up there and a staircase appears for everyone else. The floor carries on up the cliff.
function roomSeesaw(L, x, F, n, sig) {
  (L.rooms = L.rooms || []).push({ t: 'seesaw', x, F, sig });
  L.f(x + 1, F - 2, x + 1, F - 1).f(x + 2, F - 4, x + 3, F - 1).e({ t: 'seesaw', x: x + 4, floor: F });
  L.f(x + 11, F - 8, L.w - 1, F - 1).e({ t: 'lever', x: x + 13, floor: F - 8, sig });
  [5, 6, 7, 7, 7, 7, 7].forEach((h, i) => L.f(x + 4 + i, F - h, x + 4 + i, F - 1, sig)); // stairs from the pillar up to the cliff
  L.h(x + 6, F - 6, 'Jump from the pillar onto one end to launch whoever stands on the other', sig);
  return { x: x + 16, F: F - 8 };
}
// A lift up a cliff that only moves with everyone aboard.
function roomLift(L, x, F, n, h) {
  h = h || 6; const lw = Math.max(5, n + 1);
  (L.rooms = L.rooms || []).push({ t: 'lift', x, F, h, lw });
  L.f(x + 1, F, x + lw, F + 1, '.').f(x + 1, F + 1, x + lw, F + 1, '^');
  L.e({ t: 'lift', x: x + 1, y: F, w: lw, x2: x + 1, y2: F - h, need: 'all', spd: 34 });
  L.f(x + lw + 1, F - h, L.w - 1, F - 1).h(x + 1 + lw / 2, F - 4, 'Everyone on the lift!', 'x:' + (x + lw + 3));
  return { x: x + lw + 4, F: F - h };
}
// A wall the whole team stacks to climb; the first one up pulls the lever for stairs.
function roomClimb(L, x, F, n, sig) {
  const s = Math.min(SH(n), F - 3);
  (L.rooms = L.rooms || []).push({ t: 'climb', x, F, s, sig });
  L.f(x + 4, F - s, L.w - 1, F - 1).st(x + 5 - s, F, s - 1, sig).e({ t: 'lever', x: x + 6, floor: F - s, sig });
  L.h(x + 2, F - s - 2, stackHint(s), sig);
  return { x: x + 9, F: F - s };
}
// Melting ice: floes over spikes melt faster the more people stand on them. Spread out and keep moving.
function roomMelt(L, x, F) {
  (L.rooms = L.rooms || []).push({ t: 'melt', x, F });
  L.f(x + 2, F, x + 19, F + 2, '.').f(x + 2, F + 2, x + 19, F + 2, '^');
  for (const k of [3, 7, 11, 15]) L.e({ t: 'melt', x: x + k, floor: F, w: 2 });
  L.h(x + 10, F - 5, 'Ice melts under weight. Spread out and keep moving!', 'x:' + (x + 21));
  return x + 22;
}
// Searchlight: anyone moving in the beam is caught. Freeze, or hide under the awnings.
function roomSearch(L, x, F) {
  (L.rooms = L.rooms || []).push({ t: 'search', x, F });
  L.f(x + 9, F - 3, x + 11, F - 3).f(x + 19, F - 3, x + 21, F - 3);
  L.e({ t: 'search', x: x + 1, x2: x + 30, floor: F, spd: 36 });
  L.h(x + 5, F - 6, "Freeze when the light is on you, or hide under cover", 'x:' + (x + 31));
  return x + 31;
}
// Bomb relay: the fuse is too short to carry the bomb to the cracked wall alone. Pass it along the line.
function roomBomb(L, x, F) {
  (L.rooms = L.rooms || []).push({ t: 'bomb', x, F });
  L.e({ t: 'bombs', x: x + 1, floor: F }).f(x + 12, F - 1, x + 12, F - 1).f(x + 22, F - 1, x + 22, F - 1);
  L.f(x + 32, 0, x + 33, F - 4).f(x + 32, F - 3, x + 33, F - 1, '&');
  L.h(x + 7, F - 5, 'Short fuse! Pass the bomb along (down next to a friend)', 'x:' + (x + 34));
  return x + 35;
}
// Cannon: down to climb in. Someone holds the button to aim it across the pit; the lever over there locks the aim.
function roomCannon(L, x, F, n, sig) {
  (L.rooms = L.rooms || []).push({ t: 'cannon', x, F, sig });
  L.e({ t: 'plate', x, floor: F, sig }).e({ t: 'cannon', x: x + 3, floor: F, sig });
  L.f(x + 6, F, x + 20, F + 2, '.').f(x + 6, F + 2, x + 20, F + 2, '^').e({ t: 'lever', x: x + 24, floor: F, sig });
  L.h(x + 3, F - 5, 'Hold the button to aim. Press down in the cannon to fire!', 'x:' + (x + 22)).h(x + 24, F - 3, 'Lock the aim for the last one', sig);
  return x + 27;
}
const ROOM = {
  gate: (L, x, F, n, a) => roomGate(L, x, F, a), crate: (L, x, F) => roomCrate(L, x, F), buttons: (L, x, F, n, a) => roomButtons(L, x, F, n, SH(n), a),
  fire: (L, x, F, n, a) => roomFire(L, x, F, SH(n), a), order: (L, x, F, n, a) => roomOrder(L, x, F, n, a), run: (L, x, F, n, a) => roomRun(L, x, F, a),
  pin: (L, x, F, n) => roomPin(L, x, F, n), slime: (L, x, F, n, a) => roomSlime(L, x, F, a), tilt: (L, x, F, n) => roomTilt(L, x, F, n), up: (L, x, F, n) => roomUp(L, x, F, n),
  key: (L, x, F, n) => roomKey(L, x, F, n), key2: (L, x, F, n) => roomKey(L, x, F, n, 'key2'), runkey: (L, x, F) => roomRunKey(L, x, F),
  seesaw: roomSeesaw, lift: roomLift, climb: roomClimb, melt: (L, x, F) => roomMelt(L, x, F), search: (L, x, F) => roomSearch(L, x, F), bomb: (L, x, F) => roomBomb(L, x, F), cannon: roomCannon };
const RISE = { seesaw: () => 8, lift: (n, a) => a || 6, climb: n => SH(n), up: n => n >= 3 ? 2 : 1 };
// Build a level as a run of rooms along the ground. Rooms that climb raise the floor for the rest of the level.
function chain(n, rooms, o) {
  o = o || {};
  const rise = rooms.reduce((a, r) => a + (RISE[r[0]] ? RISE[r[0]](n, r[1]) : 0), 0), rows = Math.max(ROWS, rise + 16), F0 = rows - 3;
  const L = B(rooms.length * 40 + 60, rows); L.gr(0, L.w - 1, F0); S0(L, 2, F0);
  let x = 10, F = F0;
  for (const r of rooms) { const res = ROOM[r[0]](L, x, F, n, r[1]); if (typeof res === 'object') { x = res.x + 1; F = res.F; } else x = res + 1; }
  L.e({ t: 'door', x: x + 3, floor: F });
  const W = x + 12; for (const row of L.g) row.length = W; L.w = W;
  Object.assign(L.flags, o.flags || {});
  const floorAt = c => { for (let y = 1; y < rows; y++) if (L.g[y][c] === '#' && L.g[y - 1][c] === '.') return y; return -1; };
  if (o.dark) for (let c = 4; c < W - 2; c += 11) { const f = floorAt(c); if (f > 0) L.e({ t: 'torch', x: c, floor: f }); }
  if (o.light) { L.flags.light = { g: 3.6, y: 1.0, r: 2.2 }; for (let c = 6; c < W - 4; c += 40) { const f = floorAt(c); if (f > 0) L.e({ t: 'light', x: c, floor: f }); } }
  if (o.rise) L.flags.rise = { delay: o.rise.delay || 8, spd: o.rise.spd || 2, from: rows * TS, top: (F + 1) * TS };
  for (const [hx, hy, t] of o.hints || []) L.h(hx, hy, t, 'x:' + (hx + 12));
  return L;
}

// Add teamwork rooms before a level's exit: the level gets wider, the ground at the door's height carries on, and the door moves to the end.
const RW = { gate: () => 12, crate: () => 20, buttons: n => 12 + (n - 1) * 3, fire: () => 15, order: n => 7 + (Math.min(Math.max(n, 2), 4) - 1) * 14, run: () => 18, pin: () => 25, slime: () => 21, tilt: () => 33, up: () => 11 };
function extendEnd(L, n, rooms) {
  const d = L.ents.find(e => e.t === 'door'), x0 = d.x, s = SH(n); let F = d.floor;
  let w = 0; for (const r of rooms) w += RW[r[0]](n);
  const add = w + 10, W0 = L.w;
  for (let y = 0; y < L.rows; y++) for (let k = 0; k < add; k++) L.g[y].push('.');
  L.w = W0 + add;
  for (let x = x0; x < L.w; x++) for (let y = 0; y < L.rows; y++) L.g[y][x] = y < F ? '.' : '#';
  let x = x0 + 1;
  for (const [t, sig] of rooms) {
    if (t === 'up') { const r = roomUp(L, x, F, n); x = r.x + 1; F = r.F; continue; }
    x = (t === 'gate' ? roomGate(L, x, F, sig) : t === 'crate' ? roomCrate(L, x, F) : t === 'buttons' ? roomButtons(L, x, F, n, s, sig) : t === 'order' ? roomOrder(L, x, F, n, sig)
      : t === 'run' ? roomRun(L, x, F, sig) : t === 'pin' ? roomPin(L, x, F, n) : t === 'slime' ? roomSlime(L, x, F, sig) : t === 'tilt' ? roomTilt(L, x, F, n) : roomFire(L, x, F, s, sig)) + 1;
  }
  d.x = x + 3; d.floor = F;
  L.hints = L.hints.filter(h => h.hide !== 'win' || h.x < x0 - 2);
  return L;
}

const LEVELS = [
 // ===== World 1: Snowpeak =====
 { name: 'Stack up', goal: 'Stand on friends to reach high places', build(n) {
   const s = SH(n), U = 15 - s, L = B(84); L.gr(0, 16, 15).gr(17, 83, U).st(17 - (s - 1), 15, s - 1, 'a').f(30, U - s, 35, U - s);
   S0(L, 3); L.e({ t: 'lever', x: 21, floor: U, sig: 'a' }).e({ t: 'key', x: 32, floor: U - s }).e({ t: 'door', x: 74, floor: U }); roomGate(L, 44, U, 'b');
   return L.h(8, 9, stackHint(s), 'a').h(21, U - 3.5, 'Pull the lever for the others', 'a').h(32, U - s - 2.5, 'Stack again for the key', 'key').h(75, U - 4.5, 'Everyone press down at the door', 'win'); } },
 { name: 'Heavy lifting', goal: 'Push together, climb together, then corner the key', build(n) {
   const hw = n >= 3 ? 7 : 6, T = 15 - hw, L = B(78);
   L.gr(0, 77, 15).f(30, 0, 30, 8).f(30, 9, 30, 14, 'A').gr(46, 77, T).f(44, 11, 44, 12, 'b').f(45, T + 1, 45, 12, 'b');
   S0(L, 2); L.e({ t: 'crate', x: 8, floor: 15, w: 3, h: 2, need: 'all' }).e({ t: 'plate', x: 27, floor: 15, sig: 'a' })
    .e({ t: 'crate', x: 35, floor: 15, w: 3, h: 2, need: 2 }).e({ t: 'lever', x: 50, floor: T, sig: 'b' }).e({ t: 'key', x: 62, floor: T, run: [53, 68] }).e({ t: 'door', x: 70, floor: T });
   return L.h(61, T - 4, 'The key runs away! Trap it between two of you', 'key').h(10, 9, 'Everyone has to push this one', 'x:20').h(28, 7, 'Park it on the plate', 'x:31').h(40, 6, 'Crate against the wall, then stack on it', 'b'); } },
 { name: 'Hold the door', goal: 'Plates, a timer and a button for everyone', build(n) {
   const s = SH(n), L = B(104);
   L.gr(0, 103, 15).f(16, 0, 16, 8).f(16, 9, 16, 14, 'A').gr(26, 31, 15 - s).f(46, 0, 46, 8).f(46, 9, 46, 14, 'B').gr(88, 103, 9);
   for (let i = 0; i < 6; i++) L.f(82 + i, 14 - i, 82 + i, 14, 'c');
   S0(L, 2); L.e({ t: 'plate', x: 8, floor: 15, sig: 'a' }).e({ t: 'plate', x: 20, floor: 15, sig: 'a' }).e({ t: 'plate', x: 28, floor: 15 - s, sig: 'b', timer: n >= 3 ? 6 : 5 });
   const sp = n > 4 ? 4 : 8; for (let i = 0; i < n; i++) L.e({ t: 'plate', x: 52 + i * sp, floor: 15, sig: 'c', and: true });
   L.e({ t: 'key', x: 94, floor: 9 }).e({ t: 'door', x: 98, floor: 9 });
   return L.h(11, 8, 'Hold it open for the others', 'x:22').h(28, 15 - s - 3, 'Timer up top. Boost someone, then run!', 'x:47').h(53 + (n - 1) * sp / 2, 9, n + ' buttons, all at once', 'c'); } },
 { name: 'Red light', goal: 'Freeze on red, or everyone restarts', build(n) {
   const s = SH(n), U = 15 - s, L = B(112); L.flags.light = { g: 3.4, y: 1.0, r: 2.4 };
   L.gr(0, 111, 15).pit(18, 21, 15, 2).f(30, 13, 31, 14).pit(40, 43, 15, 2).st(56 - (s - 1), 15, s - 1, 'a').gr(56, 89, U).pit(66, 69, U, 2).f(78, U - s, 83, U - s);
   S0(L, 2); L.e({ t: 'light', x: 8, floor: 15 }).e({ t: 'light', x: 48, floor: 15 }).e({ t: 'light', x: 92, floor: 15 })
    .e({ t: 'lever', x: 60, floor: U, sig: 'a' }).e({ t: 'key', x: 80, floor: U - s }).e({ t: 'door', x: 104, floor: 15 });
   return L.h(14, 8, "Don't touch anything on red!", 'x:24').h(50, 8, 'Stack between the reds', 'a'); } },
 { name: 'Thin ice', goal: 'Slippery floors and a sliding crate', build(n) {
   const s = SH(n), U = 15 - s, L = B(100);
   L.gr(0, 99, 15).f(8, 15, 29, 15, '=').pit(20, 23, 15, 2).f(30, 15, 46, 16, '.').gr(30, 46, 17).spk(30, 46, 16)
    .f(33, 14, 36, 17).f(33, 14, 36, 14, '=').f(40, 14, 43, 17).f(40, 14, 43, 14, '=').f(50, 15, 73, 15, '=').f(75, 0, 75, 8).f(75, 9, 75, 14, 'A')
    .f(76, 15, 83, 15, '=').st(84 - (s - 1), 15, s - 1, 'b').gr(84, 99, U).f(90, U - s, 94, U - s);
   S0(L, 2); L.e({ t: 'crate', x: 52, floor: 15, w: 3, h: 2, need: 'all' }).e({ t: 'plate', x: 72, floor: 15, sig: 'a' }).e({ t: 'lever', x: 88, floor: U, sig: 'b' })
    .e({ t: 'key', x: 92, floor: U - s }).e({ t: 'door', x: 96, floor: U });
   return L.h(12, 9, 'Ice is slippery. Ease off early!', 'x:28').h(38, 9, 'Small islands: stop fast', 'x:47').h(60, 9, 'Everyone shoves the crate', 'a').h(80, U - 4, 'Stack on the ice', 'b'); } },
 // ===== World 2: Autumn Woods =====
 { name: 'Tied together', goal: 'Everyone is roped together', build(n) {
   const s = SH(n), U = 15 - s, L = B(100); L.flags.rope = true;
   L.gr(0, 99, 15).pit(14, 17, 15, 2).st(28 - (s - 1), 15, s - 1, 'a').gr(28, 47, U).pit(34, 36, U, 2).f(48, 0, 75, 17, '.').gr(48, 75, 16).spk(48, 75, 15)
    .f(48, U, 51, U, '-').f(55, U, 58, U, '-').f(62, U, 65, U, '-').f(69, U, 72, U, '-').gr(76, 99, U).f(84, U - s, 88, U - s);
   S0(L, 2); L.e({ t: 'lever', x: 31, floor: U, sig: 'a' }).e({ t: 'key', x: 86, floor: U - s }).e({ t: 'door', x: 93, floor: U });
   return L.h(10, 9, 'The rope pulls everyone along', 'x:20').h(22, 7, stackHint(s), 'a').h(62, U - 3.5, 'Jump together!', 'x:76'); } },
 { name: 'All aboard', goal: 'Lifts only move when everyone rides', build(n) {
   const s = SH(n), L = B(104); L.gr(0, 13, 15).gr(19, 40, 8).gr(41, 62, 17).spk(41, 62, 16).gr(63, 75, 8).gr(76, 103, 15).f(84, 15 - s, 88, 15 - s);
   S0(L, 2); L.e({ t: 'lift', x: 14, y: 15, w: 5, x2: 14, y2: 8, need: 'all', spd: 34 })
    .e({ t: 'lift', x: 41, y: 8, w: 5, x2: 58, y2: 8, need: 'all', spd: 30 }).e({ t: 'key', x: 86, floor: 15 - s }).e({ t: 'door', x: 97, floor: 15 });
   return L.h(16, 9, 'Everyone on the lift!', 'x:20').h(44, 4, 'All aboard the ferry', 'x:63').h(86, 15 - s - 3.5, 'Stack up for the key', 'key'); } },
 { name: 'Balance', goal: 'Weigh down one side to lift the other', build(n) {
   const L = B(100); L.gr(0, 11, 12).gr(16, 21, 12).gr(26, 99, 8).st(19, 12, 3, 'a').f(40, 4, 46, 4);
   S0(L, 0, 12); L.e({ t: 'crate', x: 6, floor: 12, w: 3, h: 2, need: n >= 3 ? 2 : 1, wt: 3 })
    .e({ t: 'bal', ax: 12, ay: 12, bx: 22, by: 12, w: 4, unit: 20, max: 40 }).e({ t: 'lever', x: 30, floor: 8, sig: 'a' })
    .e({ t: 'key', x: 43, floor: 4 }).e({ t: 'door', x: 90, floor: 8 }); roomGate(L, roomCrate(L, 47, 8) + 2, 8, 'b');
   return L.h(8, 6, 'Crates are heavy. Put weight on the left', 'x:26').h(31, 4.5, 'Pull it for whoever is left behind', 'a').h(43, 1.5, 'Stack for the key', 'key'); } },
 { name: 'Springtime', goal: 'Springs, crumbling ground and a lid', build(n) {
   const L = B(140); L.gr(0, 24, 15).f(12, 14, 12, 14, 'o').gr(14, 24, 7).gr(25, 44, 16).spk(25, 44, 15)
    .f(25, 7, 27, 7, '%').f(31, 7, 33, 7, '%').f(37, 7, 39, 7, '%').f(43, 7, 44, 7, '%').gr(45, 99, 15).f(60, 14, 60, 14, 'o')
    .f(55, 9, 58, 9).f(59, 9, 61, 9, 'A').gr(62, 139, 6).f(76, 2, 81, 2);
   S0(L, 2); L.e({ t: 'plate', x: 47, floor: 15, sig: 'a' }).e({ t: 'lever', x: 67, floor: 6, sig: 'a' })
    .e({ t: 'key', x: 78, floor: 2 }); L.e({ t: 'door', x: roomButtons(L, 86, 6, n, SH(n), 'b') + 4, floor: 6 });
   return L.h(10, 9, 'Bounce!', 'x:14').h(34, 3.5, 'It crumbles. Keep moving!', 'x:45').h(52, 7, 'Hold the plate to open the lid', 'a').h(68, 2.5, 'Pull it to open the lid for good', 'a'); } },
 { name: 'Head count', goal: 'Platforms that need an exact number of riders', build(n) {
   const a = exactN(n), L = B(122); L.gr(0, 13, 15).gr(18, 35, 9).gr(36, 55, 17).spk(36, 55, 16).gr(56, 121, 9).f(66, 9, 70, 17, '.').f(71, 3, 80, 8);
   S0(L, 2); L.e({ t: 'lift', x: 14, y: 15, w: 4, x2: 14, y2: 9, need: a, exact: true, spd: 30 })
    .e({ t: 'lift', x: 36, y: 9, w: 3, x2: 53, y2: 9, need: 1, exact: true, spd: 32 })
    .e({ t: 'lift', x: 66, y: 9, w: 5, x2: 66, y2: 3, need: 'all', exact: true, spd: 30 })
    .e({ t: 'key', x: 75, floor: 3 }).e({ t: 'door', x: roomCrate(L, 88, 9) + 6, floor: 9 });
   return L.h(16, 9.5, 'Exactly ' + a + ' riders. No more, no less', 'x:18').h(45, 5, 'Only 1 at a time', 'x:56').h(68, 6, 'Everyone!', 'key'); } },
 // ===== World 3: Crystal Caves =====
 { name: 'Colour code', goal: 'Everyone has a job only they can do', build(n) {
   const X = n >= 5 ? 12 : 0, L = B(100 + X); L.gr(0, 99 + X, 15).f(18, 15, 22, 15, '1').f(18, 16, 22, 16, '.').f(30, 0, 30, 8).f(30, 9, 30, 14, 'A').f(42, 0, 42, 8).f(42, 9, 42, 14, 'B');
   if (n >= 3) L.f(50, 15, 54, 15, '3').f(50, 16, 54, 16, '.').f(60, 0, 60, 8).f(60, 9, 60, 14, 'C');
   if (n >= 4) L.f(64, 15, 68, 15, '4').f(64, 16, 68, 16, '.').f(72, 0, 72, 8).f(72, 9, 72, 14, 'D');
   L.f(78, 15, 82, 15, '2').f(78, 16, 82, 16, '.');
   S0(L, 2); L.e({ t: 'lever', x: 20, floor: 17, sig: 'a' }).e({ t: 'plate', x: 36, floor: 15, sig: 'b', color: 1 }).e({ t: 'plate', x: 45, floor: 15, sig: 'b', color: 0 });
   if (n >= 3) L.e({ t: 'lever', x: 52, floor: 17, sig: 'c' }); if (n >= 4) L.e({ t: 'lever', x: 66, floor: 17, sig: 'd' });
   L.e({ t: 'key', x: 80, floor: 17 }).e({ t: 'door', x: 92 + X, floor: 15 });
   if (n >= 5) { L.f(98, 0, 98, 8).f(98, 9, 98, 14, 'E'); for (let k = 4; k < n; k++) L.e({ t: 'plate', x: 85 + (k - 4) * 3, floor: 15, sig: 'e', color: k, and: true });
     L.h(90, 8.5, ['Purple', 'Green', 'Blue', 'White'].slice(0, n - 4).join(', ') + ': all on your colour', 'e'); }
   L.h(20, 9, 'Only orange can drop through orange glass', 'a').h(39, 7.5, 'Teal holds, then orange holds', 'x:47').h(80, 9, 'Only teal can reach the key', 'key');
   if (n >= 3) L.h(52, 9, 'Pink: your turn', 'c'); if (n >= 4) L.h(66, 9, 'Yellow: your turn', 'd');
   return L; } },
 { name: 'Lights out', goal: 'Light the torches to see the way', build(n) {
   const s = SH(n), U = 15 - s, L = B(110); L.flags.dark = true;
   L.gr(0, 109, 15).pit(14, 16, 15, 2).pit(24, 27, 15, 2).f(34, 13, 35, 14).pit(40, 43, 15, 2).st(50 - (s - 1), 15, s - 1, 'a').gr(50, 72, U).pit(62, 64, U, 2).f(66, U - s, 69, U - s)
    .pit(80, 83, 15, 2).f(95, 0, 95, 8).f(95, 9, 95, 14, 'B');
   S0(L, 2); [4, 20, 31, 45, 58, 76, 90, 101].forEach(x => L.e({ t: 'torch', x, floor: x >= 50 && x <= 72 ? U : 15 }));
   L.e({ t: 'lever', x: 56, floor: U, sig: 'a' }).e({ t: 'key', x: 67, floor: U - s }).e({ t: 'plate', x: 88, floor: 15, sig: 'b' }).e({ t: 'plate', x: 98, floor: 15, sig: 'b' })
    .e({ t: 'door', x: 104, floor: 15 });
   return L.h(9, 8, 'Touch torches to light them', 'x:22').h(44, 7, stackHint(s), 'a'); } },
 { name: 'Spread out', goal: 'Buttons all over the cavern, pressed at the same time', build(n) {
   const s = SH(n), L = B(64, 34); L.flags.dark = true;
   L.gr(0, 63, 32).f(22, 32, 24, 33, '.').f(40, 32, 52, 33, '.').spk(40, 52, 33)
    .f(13, 29, 17, 29, '-').f(8, 26, 12, 26, '-').f(13, 23, 17, 23, '-').f(1, 23 - s, 11, 23 - s)
    .f(25, 10, 36, 10).f(27, 26, 34, 26).f(27, 27, 27, 31, 'A').f(34, 27, 34, 31, 'A')
    .f(60, 31, 60, 31, 'o').f(50, 23, 57, 23).f(44, 23 - s, 49, 23 - s);
   S0(L, 3, 32); [[6, 32], [5, 23 - s], [16, 29], [33, 10], [38, 32], [47, 23 - s], [53, 23], [61, 32]].forEach(([x, f]) => L.e({ t: 'torch', x, floor: f }));
   const plates = [{ x: 3, floor: 23 - s }, { x: 56, floor: 32 }];
   if (n >= 3) plates.splice(1, 0, { x: 30, floor: 10 });
   if (n >= 4) plates.push({ x: 17, floor: 32 });
   if (n >= 5) plates.push({ x: 37, floor: 32 });
   if (n >= 6) plates.push({ x: 52, floor: 23 });
   if (n >= 7) plates.push({ x: 34, floor: 10 });
   if (n >= 8) plates.push({ x: 8, floor: 23 - s });
   plates.forEach(p => L.e({ t: 'plate', x: p.x, floor: p.floor, sig: 'a', and: true }));
   L.e({ t: 'lift', x: 22, y: 32, w: 3, x2: 22, y2: 10, need: 1, exact: true, spd: 40 }).e({ t: 'bridge', x: 40, y: 32, w: 13, max: 1 })
    .e({ t: 'key', x: 46, floor: 23 - s }).e({ t: 'door', x: 30, floor: 32 });
   return L.h(31, 22, n + ' buttons. Everyone on one at the same time!', 'a').h(8, 23 - s - 3, 'Stack to reach this one', 'a').h(46, 23 - s - 3, 'Key up here', 'key').h(23, 30, 'Lift: 1 rider', 'a'); } },
 { name: 'Flip-flop', goal: 'Red and blue swap every time anyone jumps', build(n) {
   const L = B(100); L.gr(0, 9, 15).gr(10, 49, 17).spk(10, 49, 16)
    .f(10, 14, 13, 14, ']').f(16, 14, 19, 14, '[').f(22, 13, 25, 13, ']').f(28, 12, 31, 12, '[').f(34, 12, 37, 12, ']').f(40, 13, 43, 13, '[').f(46, 14, 49, 14, ']')
    .gr(50, 99, 15).f(62, 0, 62, 8).f(62, 9, 62, 14, ']').f(66, 13, 67, 13, '[').f(69, 11, 70, 11, ']').f(72, 9, 76, 9);
   S0(L, 2); L.e({ t: 'key', x: 74, floor: 9 }).e({ t: 'door', x: 90, floor: 15 });
   return L.h(6, 8, 'Every jump flips the blocks. Jump together!', 'x:20').h(62, 6.5, 'Blue wall: get red in charge', 'x:63').h(70, 6, 'Nobody else jump while they climb!', 'key'); } },
 { name: 'Slime time', goal: 'Bounce on slimes, never touch their sides', build(n) {
   const L = B(136); L.gr(0, 135, 15);
   S0(L, 2); L.e({ t: 'slime', x: 13, x2: 19, floor: 15, spd: 22 }).e({ t: 'slime', x: 17, x2: 23.4, floor: 15, spd: 31 });
   let x = roomPin(L, 34, 15, n) + 1; x = roomSlime(L, x, 15, 'a') + 1;
   L.e({ t: 'slime', x: x + 4, x2: x + 12, floor: 15, spiky: true, spd: 18 }).e({ t: 'key', x: x + 24, floor: 15, run: [x + 17, x + 35] }).e({ t: 'door', x: x + 45, floor: 15 });
   return L.h(8, 8, 'Jump the slimes, or bounce off their heads', 'x:30').h(x + 8, 9, 'Spiky! It hurts from every side', 'x:' + (x + 15)).h(x + 25, 8, 'The key runs! Trap it between two of you', 'key'); } },
 // ===== World 4: Sky Ruins =====
 { name: 'Lean on me', goal: 'Platforms drift toward the heavier side', build(n) {
   const s = SH(n), w = raftW(n), L = B(150); L.gr(0, 9, 15).gr(40, 55, 15).gr(96, 149, 15).f(73, 15 - s, 78, 15 - s);
   S0(L, 2); L.e({ t: 'tilt', x: 10, y: 15, w, x2: 40 - w }).e({ t: 'slime', x: 44, x2: 52, floor: 15, spd: 26 })
    .e({ t: 'tilt', x: 56, y: 15, w, x2: 96 - w }).e({ t: 'key', x: 75, floor: 15 - s }).e({ t: 'door', x: 140, floor: 15 });
   return L.h(12, 8, 'Stand on the right to drift right. Spread out to stop', 'x:40').h(48, 9, 'Slime! Hop over it', 'x:56').h(75, 15 - s - 3, 'Stop under the key, then stack', 'key'); } },
 { name: 'Updraft', goal: 'Fans blow you up. Hold the plate to power them', build(n) {
   const L = B(120); L.gr(0, 15, 15).gr(16, 30, 6).gr(31, 46, 17).spk(31, 46, 16).gr(47, 70, 6).gr(71, 119, 10);
   S0(L, 2); L.e({ t: 'fan', x: 14, floor: 15, h: 12 }).e({ t: 'fan', x: 32, floor: 17, w: 4, h: 14, sig: 'a' }).e({ t: 'fan', x: 38, floor: 17, w: 4, h: 14, sig: 'a' }).e({ t: 'fan', x: 43, floor: 17, w: 4, h: 14, sig: 'a' })
    .e({ t: 'plate', x: 26, floor: 6, sig: 'a' }).e({ t: 'plate', x: 48, floor: 6, sig: 'a' }).e({ t: 'fan', x: 58, floor: 6, h: 5, sig: 'b' }).e({ t: 'plate', x: 66, floor: 6, sig: 'b' })
    .e({ t: 'key', x: 59, floor: 3 }).e({ t: 'door', x: roomGate(L, 82, 10, 'c') + 10, floor: 10 });
   return L.h(10, 8, 'Ride the wind', 'x:16').h(38, 3, 'Fans need someone on the plate', 'x:47').h(62, 1.2, 'This fan needs its own plate', 'key'); } },
 { name: 'Relay', goal: 'Pass the key between friends', build(n) {
   const L = B(80); L.flags.pass = true; L.flags.doorSig = 'a';
   L.gr(0, 79, 15).f(10, 15, 14, 15, '1').f(10, 16, 14, 16, '.').st(44, 15, 7, n >= 3 ? 'b' : '#').f(51, 8, 63, 8).f(56, 8, 58, 8, 'A').f(51, 9, 51, 14).f(63, 9, 63, 14, '2');
   if (n >= 3) L.f(24, 15, 28, 15, '3').f(24, 16, 28, 16, '.');
   if (n >= 4) L.f(32, 15, 36, 15, '4').f(32, 16, 36, 16, '.').f(40, 0, 40, 8).f(40, 9, 40, 14, 'C');
   S0(L, 2); L.e({ t: 'key', x: 12, floor: 17 }).e({ t: 'door', x: 56, floor: 15 });
   if (n >= 3) L.e({ t: 'lever', x: 26, floor: 17, sig: 'b' }); if (n >= 4) L.e({ t: 'lever', x: 34, floor: 17, sig: 'c' });
   L.h(12, 9, 'Only orange fits through here', 'key').h(18, 6, 'Pass the key: touch a friend and press down', 'x:64').h(66, 5, 'Teal: take it round the back', 'a');
   if (n >= 3) L.h(26, 9.5, 'Pink builds the stairs', 'b'); if (n >= 4) L.h(34, 6.5, 'Yellow opens the way', 'c');
   return L; } },
 { name: 'Heavy duty', goal: "Crates that need everyone, and a key too heavy to jump with", build(n) {
   const hw = n >= 3 ? 7 : 6, T = 15 - hw, L = B(100); L.flags.heavy = true; L.flags.pass = true;
   L.gr(0, 99, 15).f(14, 0, 44, 10).f(36, 15, 38, 16, '.').f(66, 0, 66, 8).f(66, 9, 66, 14, 'A').gr(80, 99, T).f(78, 11, 78, 12, 'b').f(79, T + 1, 79, 12, 'b');
   S0(L, 2); L.e({ t: 'crate', x: 18, floor: 15, w: 3, h: 4, need: 'all' }).e({ t: 'crate', x: 50, floor: 15, w: 3, h: 2, need: 'all' })
    .e({ t: 'plate', x: 64, floor: 15, sig: 'a' }).e({ t: 'crate', x: 70, floor: 15, w: 3, h: 2, need: 2 }).e({ t: 'lever', x: 83, floor: T, sig: 'b' })
    .e({ t: 'key', x: 89, floor: T }).e({ t: 'door', x: 94, floor: T });
   return L.h(10, 8, 'This one needs EVERYONE pushing', 'x:40').h(58, 8, 'Crate on the plate', 'x:67').h(74, 5, 'Crate on the wall, then stack', 'b').h(89, T - 3.5, "Heavy key: you can't jump with it", 'win'); } },
 { name: 'Storm chase', goal: "The screen won't wait for you", build(n) {
   const s = SH(n), U = 15 - s, L = B(150); L.flags.scroll = 26;
   L.gr(0, 149, 15).pit(20, 23, 15, 2).f(30, 13, 31, 14).f(40, 15, 49, 16, '.').spk(40, 49, 16).f(40, 13, 49, 13, '%').f(60, 14, 60, 14, 'o').gr(62, 80, 7)
    .pit(88, 91, 15, 2).st(104 - (s - 1), 15, s - 1, 'a').gr(104, 149, U);
   S0(L, 4); L.e({ t: 'key', x: 72, floor: 7, run: [63, 79] }).e({ t: 'lever', x: 108, floor: U, sig: 'a' }).e({ t: 'saw', x: 118, y: U - 4, x2: 118, y2: U - 0.8, spd: 1.8 }).e({ t: 'door', x: 140, floor: U });
   return L.h(68, 3, 'Catch the key! From both sides', 'key').h(16, 7, "Keep up! Don't get squashed", 'x:30').h(98, 7, 'Quick, stack!', 'a'); } },
 // ===== World 5: Ember Forge =====
 { name: 'Row together', goal: 'The raft only moves when everyone pushes the same way', build(n) {
   const s = SH(n), L = B(120); L.gr(0, 9, 15).lava(10, 55).gr(56, 66, 15).f(59, 15 - s, 63, 15 - s).lava(67, 105).gr(106, 119, 15);
   S0(L, 2); L.e({ t: 'raft', x: 10, y: 15, w: raftW(n), x2: 56 - raftW(n) }).e({ t: 'saw', x: 25, y: 9.5, x2: 25, y2: 14.6, spd: 1.3 }).e({ t: 'saw', x: 40, y: 9.5, x2: 40, y2: 14.6, spd: 1.0 })
    .e({ t: 'key', x: 61, floor: 15 - s }).e({ t: 'raft', x: 67, y: 15, w: raftW(n), x2: 106 - raftW(n) }).e({ t: 'saw', x: 80, y: 9.5, x2: 80, y2: 14.6, spd: 1.5 }).e({ t: 'saw', x: 92, y: 9.5, x2: 92, y2: 14.6, spd: 1.1 })
    .e({ t: 'door', x: 112, floor: 15 });
   return L.h(10, 9, 'Everyone aboard, then all push the same way', 'x:30').h(24, 6, 'Stop for the saws!', 'x:48').h(61, 15 - s - 3.5, 'Stack for the key', 'key'); } },
 { name: 'Conveyor', goal: 'Belts keep moving. So should you', build(n) {
   const s = SH(n), U = 15 - s, L = B(140);
   L.gr(0, 139, 15).f(10, 15, 30, 15, '>').pit(31, 33, 15, 2).f(36, 15, 56, 15, '<').f(58, 15, 70, 15, '<').f(74, 0, 74, 8).f(74, 9, 74, 14, 'A')
    .f(80, 15, 95, 15, '>').st(96 - (s - 1), 15, s - 1, 'b').gr(96, 139, U).f(100, U - s, 104, U - s);
   S0(L, 2); L.e({ t: 'plate', x: 64, floor: 15, sig: 'a' }).e({ t: 'plate', x: 78, floor: 15, sig: 'a' }).e({ t: 'lever', x: 99, floor: U, sig: 'b' })
    .e({ t: 'key', x: 102, floor: U - s }).e({ t: 'door', x: roomCrate(L, 107, U) + 6, floor: U });
   return L.h(14, 8, "Don't stand still on the belts", 'x:34').h(64, 8.5, 'Keep walking to stay on the plate', 'x:75').h(88, 7, 'The belt pins you to the wall. Stack!', 'b'); } },
 { name: 'Crushers', goal: 'Watch the rhythm, then run', build(n) {
   const s = SH(n), L = B(140); L.gr(0, 139, 15).f(14, 0, 60, 5).gr(70, 139, 8).f(86, 8 - s, 92, 8 - s);
   S0(L, 2); [20, 30, 40, 50].forEach((x, i) => L.e({ t: 'crush', x, y: 6, w: 3, h: 3, drop: 6, period: 3.0, off: i * 0.75, sig: 'a' }));
   L.e({ t: 'plate', x: 57, floor: 15, sig: 'a' }).e({ t: 'crush', x: 64, y: 7, w: 4, h: 2, drop: 6, period: 4.2, off: 0 })
    .e({ t: 'key', x: 89, floor: 8 - s }); L.e({ t: 'door', x: roomButtons(L, 95, 8, n, s, 'b') + 5, floor: 8 });
   return L.h(8, 8, 'Wait for it… then go!', 'x:20').h(57, 10.5, 'Hold it to stop the crushers for the others', 'x:62').h(66, 3.5, 'Ride one up', 'x:70').h(89, 8 - s - 3, 'Stack for the key', 'key'); } },
 { name: 'The climb', goal: 'A tower, floor by floor', build(n) {
   const s = SH(n), T2 = 30 - s, T3 = T2 - 8, T4 = T3 - 8, L = B(40, 42);
   L.gr(0, 39, 40).f(34, 40, 38, 41, '.').f(1, 32, 33, 32).f(1, 30, 6, 31).f(5, 28, 5, 29, 'a').f(6, T2 + 1, 6, 29, 'a').f(7, T2, 38, T2)
    .f(8, T2 - 7, 14, T2 - 7).f(8, T2 - 6, 8, T2 - 3).f(14, T2 - 6, 14, T2 - 3).f(9, T2 - 3, 13, T2 - 3, '1')
    .f(34, T2 - 3, 37, T2 - 3, '-').f(34, T2 - 6, 37, T2 - 6, '-').f(0, T3, 39, T3).f(34, T3, 37, T3, 'B')
    .f(26, T3 - s, 31, T3 - 1).f(7, T3 - 7, 7, T3 - 1, 'C').f(2, T3 - 3, 5, T3 - 3, '-').f(2, T3 - 6, 5, T3 - 6, '-').f(0, T4, 25, T4).f(14, T4 - s, 19, T4 - s);
   S0(L, 3, 40); L.e({ t: 'lift', x: 34, y: 40, w: 5, x2: 34, y2: 32, need: 'all', spd: 34 }).e({ t: 'lever', x: 11, floor: T2, sig: 'a' })
    .e({ t: 'saw', x: 17, y: T2 - 1, x2: 30, y2: T2 - 1, spd: 0.8 }).e({ t: 'lever', x: 11, floor: T2 - 3, sig: 'b' }).e({ t: 'plate', x: 28, floor: T3 - s, sig: 'c', timer: n >= 3 ? 6 : 5 })
    .e({ t: 'key', x: 16, floor: T4 - s }).e({ t: 'door', x: 3, floor: T4 });
   return L.h(20, 37, 'Everyone aboard', 'x:15').h(4, 27, stackHint(s), 'a').h(11, T2 - 8.3, 'Orange: jump up and pull', 'b').h(28, T3 - s - 3, 'Timer on top. Then run left!', 'c').h(16, T4 - s - 3, 'Stack for the key', 'key'); } },
 { name: 'The peak', goal: 'Everything you have learned, one last climb', build(n) {
   const s = SH(n), U = 15 - s, rw = raftW(n), L = B(210), o = 8; // o: extra space after the gate
   L.gr(0, 209, 15).gr(10, 25, U).st(10 - (s - 1), 15, s - 1, 'a')
    .f(71 + o, 15, 74 + o, 17, '.').gr(75 + o, 100 + o, 8).f(79 + o, 0, 95 + o, 3).lava(101 + o, 136 + o);
   S0(L, 2);
   L.e({ t: 'lever', x: 13, floor: U, sig: 'a' });
   roomCrate(L, 36, 15);
   roomGate(L, 57, 15, 'b');
   L.e({ t: 'lift', x: 71 + o, y: 15, w: 4, x2: 71 + o, y2: 8, need: exactN(n), exact: true, spd: 32 })
    .e({ t: 'crush', x: 83 + o, y: 4, w: 3, h: 2, drop: 2, period: 2.6, off: 0 }).e({ t: 'crush', x: 90 + o, y: 4, w: 3, h: 2, drop: 2, period: 2.6, off: 1.3 })
    .e({ t: 'raft', x: 101 + o, y: 15, w: rw, x2: 137 + o - rw }).e({ t: 'saw', x: 112 + o, y: 9.5, x2: 112 + o, y2: 14.6, spd: 1.2 }).e({ t: 'saw', x: 126 + o, y: 9.5, x2: 126 + o, y2: 14.6, spd: 1.5 });
   const end = roomButtons(L, 140 + o, 15, n, s, 'c');
   L.f(end + 6, 15 - s, end + 11, 15 - s);
   L.e({ t: 'key', x: end + 8, floor: 15 - s }).e({ t: 'door', x: end + 18, floor: 15 });
   return L.h(6, 8, stackHint(s), 'a').h(13, U - 3.5, 'Pull it for the others', 'a').h(72 + o, 5.5, 'Lift: exactly ' + exactN(n) + ' at a time', 'x:' + (76 + o))
    .h(87 + o, 1.6, 'Time the crushers', 'x:' + (100 + o)).h(112 + o, 5, 'Drop on, then all push the same way', 'x:' + (137 + o)).h(end + 8, 15 - s - 3, 'Stack for the key', 'key'); } },

 // ===== World 6: Frostbite Summit (seesaw catapults, melting ice) =====
 { name: 'Catapult', goal: 'Jump onto one end of the seesaw to launch a friend', build: n => chain(n, [['seesaw', 'a'], ['key'], ['gate', 'b']]) },
 { name: 'Melting point', goal: 'Ice melts under weight. Never crowd one floe', build: n => chain(n, [['melt'], ['key'], ['melt'], ['fire', 'a']]) },
 { name: 'See and saw', goal: 'Climb, launch, then cross the thaw', build: n => chain(n, [['climb', 'a'], ['seesaw', 'b'], ['melt'], ['key'], ['gate', 'c']]) },
 { name: 'Cold feet', goal: 'Slippery chases and thin floes', build: n => chain(n, [['melt'], ['seesaw', 'a'], ['runkey'], ['melt'], ['buttons', 'b']]) },
 { name: 'Frostbite', goal: 'Every trick on the summit', build: n => chain(n, [['seesaw', 'a'], ['melt'], ['pin'], ['key'], ['seesaw', 'b'], ['order', 'c']]) },
 // ===== World 7: Haunted Hollow (searchlights, twin keys) =====
 { name: 'Spotlight', goal: "Move in the light and you're caught", build: n => chain(n, [['search'], ['key'], ['search'], ['gate', 'a']]) },
 { name: 'Two of a kind', goal: 'Two keys, two carriers, one door', build: n => chain(n, [['key'], ['gate', 'a'], ['key2'], ['crate']]) },
 { name: 'Night watch', goal: 'Lights in the dark, and two keys', build: n => chain(n, [['search'], ['key'], ['slime', 'a'], ['key2'], ['search']], { dark: true }) },
 { name: 'Hide and seek', goal: 'Sneak past the lights, chase the key', build: n => chain(n, [['search'], ['pin'], ['search'], ['runkey'], ['fire', 'a']]) },
 { name: 'Haunted house', goal: 'Two keys behind the watchful lights', build: n => chain(n, [['key2'], ['search'], ['seesaw', 'a'], ['key'], ['search'], ['buttons', 'b']], { dark: true }) },
 // ===== World 8: Glimmer Depths (bomb relays) =====
 { name: 'Hot potato', goal: 'Pass the bomb before it blows', build: n => chain(n, [['bomb'], ['key'], ['gate', 'a']]) },
 { name: 'Blast zone', goal: 'Two walls, two relays', build: n => chain(n, [['crate'], ['bomb'], ['key'], ['bomb'], ['fire', 'a']]) },
 { name: 'Fuse box', goal: 'Count it out, then light it up', build: n => chain(n, [['order', 'a'], ['bomb'], ['runkey'], ['bomb']]) },
 { name: 'Deep charge', goal: 'Bombs in the dark', build: n => chain(n, [['bomb'], ['key'], ['search'], ['bomb'], ['gate', 'a']], { dark: true }) },
 { name: 'Chain reaction', goal: 'Blast, launch, and carry two keys home', build: n => chain(n, [['bomb'], ['key2'], ['seesaw', 'a'], ['bomb'], ['key'], ['gate', 'b']]) },
 // ===== World 9: Thunder Spires (cannons) =====
 { name: 'Fire away', goal: 'Someone aims, everyone flies', build: n => chain(n, [['cannon', 'a'], ['key'], ['gate', 'b']]) },
 { name: 'Aim for me', goal: 'Cannons and a searchlight', build: n => chain(n, [['cannon', 'a'], ['search'], ['key'], ['cannon', 'b']]) },
 { name: 'Sky cannon', goal: 'Lean across, then blast off', build: n => chain(n, [['tilt'], ['cannon', 'a'], ['key'], ['cannon', 'b']]) },
 { name: 'Storm front', goal: 'Cannons on a red light', build: n => chain(n, [['cannon', 'a'], ['key'], ['seesaw', 'b'], ['cannon', 'c']], { light: true }) },
 { name: 'Human cannonball', goal: 'Bombs, cannons and two keys', build: n => chain(n, [['bomb'], ['cannon', 'a'], ['key2'], ['cannon', 'b'], ['key'], ['melt']]) },
 // ===== World 10: Molten Core (rising lava) =====
 { name: 'Rising heat', goal: 'The lava is coming up. So are you', build: n => chain(n, [['climb', 'a'], ['key'], ['lift', 6], ['climb', 'b']], { rise: { delay: 11, spd: 1.6 } }) },
 { name: 'Hot seat', goal: 'Launch up before the lava does', build: n => chain(n, [['seesaw', 'a'], ['key'], ['climb', 'b'], ['lift', 6]], { rise: { delay: 11, spd: 1.8 } }) },
 { name: 'Magma chamber', goal: 'Fire across, ride up, keep climbing', build: n => chain(n, [['climb', 'a'], ['cannon', 'b'], ['lift', 6], ['key'], ['seesaw', 'c']], { rise: { delay: 11, spd: 1.8 } }) },
 { name: 'Meltdown', goal: 'Blast through while the floor floods', build: n => chain(n, [['lift', 5], ['bomb'], ['climb', 'a'], ['runkey'], ['seesaw', 'b']], { rise: { delay: 11, spd: 2 } }) },
 { name: 'The core', goal: 'One last climb out of the fire', build: n => chain(n, [['climb', 'a'], ['seesaw', 'b'], ['key2'], ['lift', 6], ['bomb'], ['key'], ['cannon', 'c'], ['climb', 'd']], { rise: { delay: 12, spd: 1.8 } }) },
];
LEVELS.forEach((L, i) => { L.world = Math.floor(i / 5); L.theme = L.world % 5; });
// Extra teamwork rooms added before each level's exit (rope levels get crates: a short rope can't stretch across a held gate).
const MORE = {
  0: () => [['fire', 'c']], 1: () => [['fire', 'c'], ['order', 'd']], 2: () => [['pin'], ['fire', 'd']], 3: () => [['slime', 'c'], ['fire', 'b']], 4: () => [['run', 'c'], ['fire', 'd']],
  5: () => [['pin']], 6: () => [['tilt'], ['fire', 'a']], 7: () => [['fire', 'c']], 8: () => [['pin'], ['fire', 'c']], 9: () => [['fire', 'a'], ['run', 'b']],
  10: () => [['pin']], 11: () => [['pin'], ['order', 'd'], ['fire', 'c']], 13: () => [['order', 'a'], ['fire', 'b']], 15: () => [['fire', 'b']],
  16: () => [['slime', 'e'], ['fire', 'd']], 18: () => [['fire', 'c'], ['run', 'd'], ['up']], 20: () => [['fire', 'a'], ['tilt']], 21: () => [['pin'], ['fire', 'c']], 22: () => [['fire', 'c']],
  24: () => [['slime', 'e'], ['fire', 'd']] };

// ---------- game ----------
function createGame(li, n) {
  const g = { li, players: [], fx: [], S: null, noWalls: false };
  compile(g, Math.max(2, Math.min(MAXP, n || 2)));
  reset(g, false);
  return g;
}
function compile(g, n) {
  const def = LEVELS[g.li], L = def.build(n); if (MORE[g.li]) extendEnd(L, n, MORE[g.li](n));
  Object.assign(g, { n, name: def.name, goal: def.goal, theme: def.theme, world: def.world, W: L.w, H: L.rows, LW: L.w * TS, LH: L.rows * TS, grid: L.g, hints: L.hints, flags: L.flags, rooms: L.rooms || [] });
  g.zMin = g.flags.scroll ? 1 : Math.max(0.5, VW / g.LW);
  g.spawn = L.ents.find(e => e.t === 'spawn');
  const kd = L.ents.find(e => e.t === 'key'); g.keyHome = { x: kd.x * TS + 5, y: kd.floor * TS - 9 };
  const dd = L.ents.find(e => e.t === 'door'); g.door = { x: dd.x * TS, y: dd.floor * TS - 22, w: 20, h: 22 };
  const E = t => L.ents.filter(e => e.t === t);
  g.plateDefs = E('plate').map(e => ({ x: e.x * TS, y: e.floor * TS, w: 20, sig: e.sig, color: e.color == null ? -1 : e.color, timer: e.timer || 0, and: !!e.and, seq: e.seq || 0, run: e.run || 0 }));
  g.leverDefs = E('lever').map(e => ({ x: e.x * TS + 1, y: e.floor * TS - 10, w: 8, h: 10, sig: e.sig }));
  g.crateDefs = E('crate').map(e => ({ x: e.x * TS, y: e.floor * TS - e.h * TS, w: e.w * TS, h: e.h * TS, need: e.need, wt: e.wt || 2 }));
  g.liftDefs = E('lift').map(e => ({ x: e.x * TS, y: e.y * TS, x2: e.x2 * TS, y2: e.y2 * TS, w: e.w * TS, need: e.need, spd: e.spd, exact: !!e.exact }));
  g.balDefs = E('bal').map(e => ({ ax: e.ax * TS, ay: e.ay * TS, bx: e.bx * TS, by: e.by * TS, w: e.w * TS, unit: e.unit, max: e.max }));
  g.bridgeDefs = E('bridge').map(e => ({ x: e.x * TS, y: e.y * TS, w: e.w * TS, max: e.max }));
  g.sawDefs = E('saw').map(e => ({ x: e.x * TS + 5, y: e.y * TS + 5, x2: e.x2 * TS + 5, y2: e.y2 * TS + 5, spd: e.spd }));
  g.lights = E('light').map(e => ({ x: e.x * TS, y: e.floor * TS }));
  g.raftDefs = E('raft').map(e => ({ x: e.x * TS, y: e.y * TS, w: e.w * TS, x2: e.x2 * TS }));
  g.fanDefs = E('fan').map(e => ({ x: e.x * TS, y: e.floor * TS, w: (e.w || 2) * TS, h: e.h * TS, sig: e.sig || null }));
  g.crushDefs = E('crush').map(e => ({ x: e.x * TS, y: e.y * TS, w: e.w * TS, h: e.h * TS, drop: e.drop * TS, period: e.period, off: e.off || 0, sig: e.sig || null }));
  g.torchDefs = E('torch').map(e => ({ x: e.x * TS + 5, y: e.floor * TS }));
  g.slimeDefs = E('slime').map(e => ({ x: e.x * TS, x2: e.x2 * TS, y: e.floor * TS, big: !!e.big, spiky: !!e.spiky, spd: e.spd || 22 }));
  g.tiltDefs = E('tilt').map(e => ({ x: e.x * TS, y: e.y * TS, w: e.w * TS, x2: e.x2 * TS }));
  g.keyRun = kd.run ? { lo: kd.run[0] * TS + 5, hi: kd.run[1] * TS + 5 } : null;
  g.seeDefs = E('seesaw').map(e => ({ x: e.x * TS, y: e.floor * TS - 6 }));
  g.meltDefs = E('melt').map(e => ({ x: e.x * TS, y: e.floor * TS, w: (e.w || 2) * TS }));
  g.searchDefs = E('search').map(e => ({ x: e.x * TS, x2: e.x2 * TS, y: e.floor * TS, w: 30, spd: e.spd || 36, off: e.off || 0 }));
  g.bombDefs = E('bombs').map(e => ({ x: e.x * TS, y: e.floor * TS - 16, w: 18, h: 16 }));
  g.cannonDefs = E('cannon').map(e => ({ x: e.x * TS, y: e.floor * TS - 16, w: 20, h: 16, sig: e.sig || null }));
  const k2 = L.ents.find(e => e.t === 'key2'); g.key2Home = k2 ? { x: k2.x * TS + 5, y: k2.floor * TS - 9 } : null;
  g.fireDefs = E('fire').map(e => ({ x: e.x * TS, y: (e.floor - e.h) * TS, w: (e.w || 1) * TS, h: e.h * TS, sig: e.sig || null, period: e.period || 0, on: e.on || 0.5, off: e.off || 0 }));
  const letters = new Set();
  g.sigTiles = {}; g.crumbTiles = []; g.flipTiles = [];
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.w; x++) {
    const c = L.g[y][x];
    if (/[a-eA-E]/.test(c)) { const l = c.toLowerCase(); letters.add(l); (g.sigTiles[l] = g.sigTiles[l] || []).push({ x, y, up: c !== l }); }
    if (c === '%') g.crumbTiles.push(y * L.w + x);
    if (c === '[' || c === ']') g.flipTiles.push(y * L.w + x);
  }
  g.plateDefs.forEach(p => letters.add(p.sig)); g.leverDefs.forEach(p => letters.add(p.sig));
  g.fanDefs.forEach(f => f.sig && letters.add(f.sig)); g.cannonDefs.forEach(c => c.sig && letters.add(c.sig)); g.fireDefs.forEach(f => f.sig && letters.add(f.sig)); g.crushDefs.forEach(c => c.sig && letters.add(c.sig));
  if (g.flags.doorSig) letters.add(g.flags.doorSig);
  g.letters = [...letters];
}
// Rebuild the level for the current number of players (puzzles scale with team size).
function adapt(g) {
  const n = Math.max(2, Math.min(MAXP, g.players.length));
  if (n === g.n) return false;
  compile(g, n); reset(g, true); fx(g, 'adapt', 0, 0, n);
  return true;
}

function reset(g, keep) {
  const o = g.S;
  const S = g.S = { t: keep ? o.t : 0, deaths: keep ? o.deaths : 0, dc: keep && o.dc ? o.dc : {}, restartT: 0, culprit: -1, cause: '', lastCause: keep ? o.lastCause : '', won: false, winT: 0,
    cam: 0, camY: 0, zoom: 1, wl: -1e5, wr: 1e5, scroll: 0,
    sig: {}, plates: g.plateDefs.map(() => 0), levers: g.leverDefs.map(() => 0), crates: [], lifts: [], bals: [], bridges: [], crumb: {}, rafts: [], crush: [],
    torches: g.torchDefs.map(() => 0), seq: {}, flip: 0, flipCd: 0, ghost: {}, light: { ph: 0, t: 0 }, key: { x: g.keyHome.x, y: g.keyHome.y, carrier: -1, used: false, hx: g.keyHome.x, hop: 0, hf: 0, ht: 0, trap: 0 }, door: { open: false, t: 0 },
    slimes: g.slimeDefs.map(d => { const w = d.big ? 22 : 12, h = d.big ? 16 : 9; return { x: d.x, y: d.y - h, w, h, dir: 1, vx: 0, sq: 0, dead: 0, big: d.big ? 1 : 0, spiky: d.spiky ? 1 : 0 }; }),
    tilts: g.tiltDefs.map(d => ({ x: d.x, y: d.y, w: d.w, h: 6, v: 0, dx: 0, dy: 0, n: 0, lean: 0, idle: 0, isTilt: true })),
    sees: g.seeDefs.flatMap((d, i) => [{ x: d.x, y: d.y, w: 30, h: 6, dx: 0, dy: 0, pair: i * 2 + 1, kick: 0, isSee: true }, { x: d.x + 40, y: d.y, w: 30, h: 6, dx: 0, dy: 0, pair: i * 2, kick: 0, isSee: true }]),
    melts: g.meltDefs.map(d => ({ x: d.x, y: d.y, w: d.w, h: 8, dx: 0, dy: 0, hp: 1, st: 0, tmr: 0, isMelt: true })),
    bombs: g.bombDefs.map(d => ({ x: d.x + 9, y: d.y + 4, carrier: -1, fuse: 0, from: -1 })), blast: {},
    key2: g.key2Home ? { x: g.key2Home.x, y: g.key2Home.y, carrier: -1, used: false } : null,
    lava: g.flags.rise ? g.flags.rise.from : 0 };
  for (const l of g.letters) S.sig[l] = { on: false, latched: false, tmr: 0, gate: true, open: 0, show: 0 };
  g.crateDefs.forEach(d => S.crates.push({ x: d.x, y: d.y, w: d.w, h: d.h, vx: 0, vy: 0, dx: 0, pushN: 0, needN: 1, isCrate: true }));
  g.liftDefs.forEach(d => S.lifts.push({ x: d.x, y: d.y, w: d.w, h: 6, u: 0, dir: 1, pause: 0, hold: 0, dx: 0, dy: 0, r: 0, needN: 0, isLift: true }));
  g.balDefs.forEach(d => S.bals.push({ o: 0, wa: 0, wb: 0, pans: [{ x: d.ax, y: d.ay, w: d.w, h: 6, dx: 0, dy: 0, isPan: true }, { x: d.bx, y: d.by, w: d.w, h: 6, dx: 0, dy: 0, isPan: true }] }));
  g.bridgeDefs.forEach(d => S.bridges.push({ x: d.x, y: d.y, w: d.w, h: 4, st: 0, tmr: 0, vy: 0, dx: 0, dy: 0, n: 0, isBridge: true }));
  g.raftDefs.forEach(d => S.rafts.push({ x: d.x, y: d.y, w: d.w, h: 6, dx: 0, dy: 0, mv: 0, n: 0, push: 0, isRaft: true }));
  g.crushDefs.forEach(d => S.crush.push({ x: d.x, y: d.y, w: d.w, h: d.h, dx: 0, dy: 0, ct: 0, isCrush: true }));
  g.crumbTiles.forEach(i => S.crumb[i] = [0, 0]);
  g.crateOn = S.crates.map(() => null);
  g.players.forEach(p => { Object.assign(p, { vx: 0, vy: 0, dead: 99, inside: false, on: null, grounded: false, dx: 0, squash: 0, coyote: 0, buffer: 0, row: 0, cn: -1, ct: 0, fly: 0 }); });
  // line up on the start ground; anyone who doesn't fit stands on a friend's head
  g.players.forEach(p => { const y0 = g.spawn.floor * TS - PH; let done = false;
    for (let i = 0; i < 20 && !done; i++) { p.x = g.spawn.x * TS + i * 12; p.y = y0; done = free(g, p) && groundOf(g, p).length > 0; }
    if (!done) for (const q of g.players) { if (q === p || q.dead) continue; p.x = q.x; p.y = q.y - PH - 0.5; if (free(g, p)) { done = true; break; } }
    if (!done) { p.x = g.spawn.x * TS; p.y = y0; }
    p.dead = 0; });
  camera(g, 0, true);
}

function fx(g, k, x, y, a) { g.fx.push([k, Math.round(x), Math.round(y), a == null ? -1 : a]); }
const alive = p => !p.dead && !p.inside;
function needOf(g, n) { const all = Math.max(1, g.players.length); if (n === 'all') return all; if (n === 'all-1') return Math.max(1, all - 1); return n; }

function addPlayer(g, slot) {
  if (g.players.some(p => p.slot === slot)) return null;
  const p = { slot, cn: -1, ct: 0, fly: 0, x: 0, y: 0, w: PW, h: PH, vx: 0, vy: 0, face: 1, grounded: false, coyote: 0, buffer: 0, on: null, dx: 0, cut: false, squash: 0, dead: 0, inside: false, anim: 0, row: 0, q: 0, m: 0, blinkT: 2 + Math.random() * 3, isPlayer: true, input: { x: 0, jump: false, jumpP: false, downP: false } };
  place(g, p); g.players.push(p); g.players.sort((a, b) => a.slot - b.slot);
  if (!adapt(g)) fx(g, 'join', p.x + 5, p.y + 7, slot);
  return p;
}
function removePlayer(g, slot) {
  const i = g.players.findIndex(p => p.slot === slot); if (i < 0) return;
  if (g.S.key.carrier === slot) g.S.key.carrier = -1; if (g.S.key2 && g.S.key2.carrier === slot) g.S.key2.carrier = -1;
  g.players.splice(i, 1);
  adapt(g);
}
function place(g, p) {
  const S = g.S, hosts = g.players.filter(o => o !== p && alive(o));
  const c = [], sx = g.spawn.x * TS, line = []; for (let i = 0; i < 8; i++) line.push([sx + i * 12, g.spawn.floor * TS - PH]);
  if (sx >= S.cam - 5 && sx <= S.cam + VW / S.zoom - 60) c.push(...line);
  hosts.forEach(o => c.push([o.x, o.y - PH - 1], [o.x - 12, o.y], [o.x + 12, o.y]));
  c.push(...line);
  let pick = null; for (const [a, b] of c) { p.x = a; p.y = b; if (free(g, p)) { if (groundOf(g, p).length) { pick = [a, b]; break; } if (!pick) pick = [a, b]; } }
  if (pick) { p.x = pick[0]; p.y = pick[1]; }
  p.vx = p.vy = 0; p.dead = 0; p.on = null; p.inside = false;
}

// ---------- camera: follows everyone, zooms out as the team spreads out ----------
function camera(g, dt, snap) {
  const S = g.S;
  if (g.flags.scroll) {
    if (g.players.length && S.t > 2 && !S.won && dt) S.scroll = Math.min(S.scroll + g.flags.scroll * dt, g.LW - VW);
    S.cam = S.scroll; S.zoom = 1; S.camY = g.LH - VH; S.wl = S.cam; S.wr = S.cam + VW; return;
  }
  const act = g.players.filter(alive);
  if (!act.length) { if (snap) { S.cam = clamp(g.spawn.x * TS - 40, 0, Math.max(0, g.LW - VW)); S.camY = clamp(g.spawn.floor * TS - VH + 30, 0, Math.max(0, g.LH - VH)); } return; }
  // Frame where people stand, not where they jump: an ordinary jump never moves or zooms the camera.
  const gy = S.camGY || (S.camGY = {});
  for (const k in gy) if (!act.some(p => p.slot === +k)) delete gy[k];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of act) {
    if (p.grounded || snap || gy[p.slot] == null) gy[p.slot] = p.y;
    const base = gy[p.slot], fy = p.y > base ? p.y : p.y < base - JUMP_RISE ? p.y + JUMP_RISE : base;
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + p.w); y0 = Math.min(y0, fy); y1 = Math.max(y1, fy + p.h);
  }
  // A few fixed zoom steps. Zoom out at once when needed; zoom back in only after there's been spare room for a while.
  const zt = clamp(Math.min(VW / (x1 - x0 + 110), VH / (y1 - y0 + 80)), g.zMin, 1);
  const ZL = g.zMin >= 0.97 ? [1] : [1, 0.8, 0.64, 0.5].filter(z => z > g.zMin + 0.04).concat([g.zMin]);
  let ti = ZL.findIndex(z => z <= zt + 1e-6); if (ti < 0) ti = ZL.length - 1;
  if (snap || S.zl == null || S.zl >= ZL.length) { S.zl = ti; S.zHold = 0; }
  else if (ti > S.zl) { S.zl = ti; S.zHold = 0; }
  else if (ti < S.zl && ZL[S.zl - 1] <= zt * 0.88) { S.zHold = (S.zHold || 0) + dt; if (S.zHold > 1.2) { S.zl--; S.zHold = 0; } }
  else S.zHold = 0;
  const zg = ZL[S.zl];
  S.zoom = snap ? zg : approach(S.zoom, zg, dt * (zg < S.zoom ? 1.6 : 0.6));
  const vw = VW / S.zoom, vh = VH / S.zoom, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  S.cam = clamp(cx - vw / 2, 0, Math.max(0, g.LW - vw));
  S.camY = g.LH >= vh ? clamp(cy - vh / 2 - 10, 0, g.LH - vh) : g.LH - vh;
  const half = VW / g.zMin / 2; S.wl = cx - half; S.wr = cx + half;
}

// ---------- collision ----------
function tileRect(g, tx, ty, e, ax, d) {
  if (tx < 0 || tx >= g.W || ty < 0) return { x: tx * TS, y: ty * TS, w: TS, h: TS };
  if (ty >= g.H) return null;
  const c = g.grid[ty][tx];
  if (c === '.' || c === '^') return null;
  const R = { x: tx * TS, y: ty * TS, w: TS, h: TS, ch: c };
  if (c === '#' || c === 'o' || c === '=' || c === '<' || c === '>') return R;
  if (c === '%') return g.S.crumb[ty * g.W + tx][0] < 2 ? R : null;
  if (c === '&') return g.S.blast[ty * g.W + tx] ? null : R;
  if (c === '[' || c === ']') return ((c === '[') === (g.S.flip === 0) && !g.S.ghost[ty * g.W + tx]) ? R : null;
  if (c === '-') return (ax === 'y' && d > 0 && e.y + e.h - d <= ty * TS + 0.01) ? { x: tx * TS, y: ty * TS, w: TS, h: 4, ch: c } : null;
  if (c >= '1' && c <= '4') return (e.isPlayer && e.slot === c.charCodeAt(0) - 49) ? null : R;
  if (c >= 'a' && c <= 'e') return g.S.sig[c].on ? R : null;
  if (c >= 'A' && c <= 'E') return (g.S.sig[c.toLowerCase()].gate || e.isCrate) ? R : null;
  return null;
}
function camWalls(g) { const S = g.S; return [{ x: S.wl - 20, y: -4000, w: 20, h: 8000 }, { x: S.wr, y: -4000, w: 20, h: 8000 }]; }
function solids(g, e, ax, d) {
  const out = [], S = g.S;
  const x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - 1e-4) / TS), y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - 1e-4) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const r = tileRect(g, tx, ty, e, ax, d); if (r) out.push(r); }
  for (const c of S.crates) if (c !== e && ov(e, c)) out.push(c);
  for (const l of S.lifts) if (l !== e && ov(e, l)) out.push(l);
  for (const l of S.rafts) if (l !== e && ov(e, l)) out.push(l);
  for (const l of S.crush) if (l !== e && ov(e, l)) out.push(l);
  for (const l of S.tilts) if (l !== e && ov(e, l)) out.push(l);
  for (const l of S.sees) if (l !== e && ov(e, l)) out.push(l);
  for (const l of S.melts) if (l.st === 0 && l !== e && ov(e, l)) out.push(l);
  for (const b of S.bals) for (const pn of b.pans) if (pn !== e && ov(e, pn)) out.push(pn);
  for (const b of S.bridges) if (b.st < 2 && b !== e && ov(e, b)) out.push(b);
  for (const p of g.players) if (p !== e && alive(p) && p.cn < 0 && ov(e, p)) out.push(p);
  if (e.isPlayer && !g.noWalls) for (const w of camWalls(g)) if (ov(e, w)) out.push(w);
  return out;
}
function move(g, e, d, ax) {
  if (!d) return null; e[ax] += d; let hit = null;
  for (const r of solids(g, e, ax, d)) {
    if (!ov(e, r)) continue;
    if (ax === 'y' && d < 0 && r.isPlayer && r.on === e) { move(g, r, (e.y - r.h) - r.y, 'y'); r.vy = Math.min(r.vy, e.vy || 0); if (!ov(e, r)) continue; }
    if (ax === 'x') e.x = d > 0 ? r.x - e.w : r.x + r.w; else e.y = d > 0 ? r.y - e.h : r.y + r.h;
    hit = r;
  }
  return hit;
}
function free(g, e) { return solids(g, e, 'y', 0).filter(r => r.ch !== '-' && ov(e, r)).length === 0; }
function groundOf(g, e) { e.y += 1; const s = solids(g, e, 'y', 1).filter(r => ov(e, r)); e.y -= 1; return s; }
const PLAT = r => r.isPlayer || r.isCrate || r.isLift || r.isPan || r.isBridge || r.isRaft || r.isCrush || r.isTilt || r.isSee || r.isMelt;

// ---------- death / restart ----------
function kill(g, p, cause) {
  const S = g.S; if (!alive(p) || S.restartT > 0 || S.won) return;
  p.dead = 99; S.restartT = 1.2; S.deaths++; S.dc[p.slot] = (S.dc[p.slot] || 0) + 1; S.culprit = p.slot; S.cause = cause || 'oops'; S.lastCause = S.cause + '@' + Math.round(p.x) + ',' + Math.round(p.y) + '#' + p.slot;
  if (S.key.carrier === p.slot) S.key.carrier = -1; if (S.key2 && S.key2.carrier === p.slot) S.key2.carrier = -1;
  for (const b of S.bombs) if (b.carrier === p.slot) b.carrier = -1;
  fx(g, 'die', p.x + 5, p.y + 7, p.slot);
}

// ---------- update ----------
function step(g, dt) {
  const S = g.S;
  if (g.fx.length > 400) g.fx.splice(0, g.fx.length - 400);
  for (const p of g.players) p.m++;
  if (S.restartT > 0) { S.restartT -= dt; if (g.players.length) S.t += dt; if (S.restartT <= 0) { reset(g, true); fx(g, 'restart', g.spawn.x * TS + 20, g.spawn.floor * TS - 7); } return; }
  if (g.players.length && !S.won) S.t += dt;
  camera(g, dt, false);
  const act = g.players.filter(alive);
  if (g.flags.light) {
    const Ld = g.flags.light, dur = [Ld.g, Ld.y, Ld.r][S.light.ph];
    S.light.t += dt; if (S.light.t >= dur) { S.light.t = 0; S.light.ph = (S.light.ph + 1) % 3; fx(g, 'light', S.cam + VW / 2, 20, S.light.ph); }
    if (S.light.ph === 2 && S.light.t > 0.12 && !S.won) for (const p of act) if (p.input.x !== 0 || p.input.jumpP) { kill(g, p, 'red'); break; }
  }
  if (S.flipCd > 0) S.flipCd -= dt;
  updSignals(g, dt);
  updMovers(g, dt);
  updSlimes(g, dt);
  updCrates(g, dt);
  [...g.players].sort((a, b) => b.y - a.y).forEach(p => updPlayer(g, p, dt));
  if (g.flags.rope) rope(g);
  updCrumbs(g, dt);
  for (const k in S.ghost) { const tx = k % g.W, ty = Math.floor(k / g.W), r = { x: tx * TS, y: ty * TS, w: TS, h: TS }; if (!g.players.some(p => alive(p) && ov(p, r)) && !S.crates.some(c => ov(c, r))) delete S.ghost[k]; }
  g.torchDefs.forEach((t, i) => { if (!S.torches[i] && act.some(p => Math.abs(p.x + 5 - t.x) < 10 && p.y + p.h > t.y - 24 && p.y < t.y)) { S.torches[i] = 1; fx(g, 'torch', t.x, t.y - 16); } });
  updKeyDoor(g, dt);
  updBombs(g, dt);
  for (let i = 0; i < g.searchDefs.length; i++) { const bx = searchX(g, i), d = g.searchDefs[i]; for (const p of g.players) if (alive(p) && p.cn < 0 && p.x + p.w > bx + 2 && p.x < bx + d.w - 2 && (Math.abs(p.vx) > 8 || !p.grounded) && !covered(g, p)) kill(g, p, 'spotted'); }
  if (g.flags.rise) { const R = g.flags.rise; if (S.t > R.delay && !S.won) S.lava = Math.max(R.top, S.lava - R.spd * dt); for (const p of g.players) if (alive(p) && p.y + p.h > S.lava + 3) kill(g, p, 'lava'); }
  for (let i = 0; i < g.fireDefs.length; i++) if (fireLit(g, i)) { const f = g.fireDefs[i], r = { x: f.x + 1, y: f.y + 2, w: f.w - 2, h: f.h - 2 }; for (const p of g.players) if (alive(p) && ov(p, r)) kill(g, p, 'fire'); }
  for (const sl of S.slimes) if (!sl.dead) { const h = slimeHurt(sl); for (const p of g.players) if (alive(p) && ov(p, h)) kill(g, p, 'slime'); }
  for (const sd of g.sawDefs) { const s = sawPos(g, sd); for (const p of g.players) if (alive(p)) { const cx = clamp(s.x, p.x, p.x + p.w), cy = clamp(s.y, p.y, p.y + p.h); if ((cx - s.x) ** 2 + (cy - s.y) ** 2 < 30) kill(g, p, 'saw'); } }
  if (S.won) S.winT += dt;
}
function sawPos(g, sd) { const u = (1 - Math.cos(g.S.t * sd.spd)) / 2; return { x: sd.x + (sd.x2 - sd.x) * u, y: sd.y + (sd.y2 - sd.y) * u }; }
function crushTiming(d) { const dropT = d.drop / 320, waitB = 0.6, riseT = d.drop / 45, waitT = Math.max(0.3, d.period - dropT - waitB - riseT); return { dropT, waitB, riseT, waitT, total: waitT + dropT + waitB + riseT }; }
function fireLit(g, i) { const f = g.fireDefs[i], S = g.S; if (f.sig) return !S.sig[f.sig].on; if (!f.period) return true; const ph = (((S.t + f.off) % f.period) + f.period) % f.period; return ph < f.period * f.on; }
function fireWarn(g, i) { const f = g.fireDefs[i]; if (f.sig || !f.period) return false; const ph = (((g.S.t + f.off) % f.period) + f.period) % f.period; return ph > f.period - 0.5; }
function crushNext(g, i, dt) { const S = g.S, c = S.crush[i], d = g.crushDefs[i], T = crushTiming(d); if (d.sig && S.sig[d.sig].on) return Math.max(d.y, c.y - 45 * dt);
  c.ct += dt; const { ph } = crushPhase(g, i); let u; if (ph < T.waitT) u = 0; else if (ph < T.waitT + T.dropT) u = (ph - T.waitT) / T.dropT; else if (ph < T.waitT + T.dropT + T.waitB) u = 1; else u = 1 - (ph - T.waitT - T.dropT - T.waitB) / T.riseT; return d.y + u * d.drop; }
function crushPhase(g, i) { const d = g.crushDefs[i], c = g.S.crush[i], T = crushTiming(d); const ph = ((c.ct + d.off) % T.total + T.total) % T.total; return { ph, T, warn: ph > T.waitT - 0.45 && ph < T.waitT }; }

function pressing(g, pl) {
  const ents = g.players.filter(p => alive(p) && (!pl.run || p.input.x === pl.run));
  if (pl.color < 0 && !pl.run) ents.push(...g.S.crates);
  return ents.some(e => (pl.color < 0 || e.slot === pl.color) && Math.abs(e.y + e.h - pl.y) < 1.5 && e.x < pl.x + pl.w && e.x + e.w > pl.x);
}
function updSignals(g, dt) {
  const S = g.S, live = g.players.filter(alive);
  const hold = {}, andAll = {}, andAny = {};
  g.plateDefs.forEach((pl, i) => {
    const on = pressing(g, pl), was = S.plates[i]; if (on && !S.plates[i]) fx(g, 'plate', pl.x + 10, pl.y, 1); if (!on && S.plates[i]) fx(g, 'plate', pl.x + 10, pl.y, 0);
    S.plates[i] = on ? 1 : 0; const sg = S.sig[pl.sig];
    if (pl.seq) { const q = S.seq[pl.sig] || (S.seq[pl.sig] = { next: 1, t: 0 }); if (on && !was && !sg.latched) { if (pl.seq === q.next) { q.next++; q.t = SEQ_GAP; fx(g, 'seq', pl.x + 10, pl.y, pl.seq); if (q.next > g.plateDefs.filter(p => p.sig === pl.sig).length) { sg.latched = true; fx(g, 'latch', S.cam + VW / 2, 60); } } else if (pl.seq !== q.next - 1) { q.next = 1; q.t = 0; fx(g, 'seqbad', pl.x + 10, pl.y, 0); } } }
    else if (pl.and) { andAny[pl.sig] = true; andAll[pl.sig] = (andAll[pl.sig] !== false) && on; }
    else if (pl.timer) { if (on) sg.tmr = pl.timer; }
    else if (on) hold[pl.sig] = true;
  });
  for (const l in S.seq) { const q = S.seq[l]; if (q.t > 0) { q.t -= dt; if (q.t <= 0 && !S.sig[l].latched) { q.next = 1; fx(g, 'seqbad', 0, 0, 1); } } }
  for (const l in andAny) if (andAll[l] && !S.sig[l].latched) { S.sig[l].latched = true; fx(g, 'latch', S.cam + VW / 2, 60); }
  g.leverDefs.forEach((lv, i) => { if (!S.levers[i] && live.some(p => ov(p, lv))) { S.levers[i] = 1; S.sig[lv.sig].latched = true; fx(g, 'lever', lv.x + 4, lv.y); } });
  for (const l of g.letters) {
    const sg = S.sig[l]; sg.tmr = Math.max(0, sg.tmr - dt);
    const was = sg.on; sg.on = sg.latched || !!hold[l] || sg.tmr > 0;
    const tiles = g.sigTiles[l] || [];
    if (sg.on) sg.gate = false;
    else if (!sg.gate) { const blocked = tiles.some(t => t.up && [...live, ...S.crates].some(e => ov(e, { x: t.x * TS, y: t.y * TS, w: TS, h: TS }))); if (!blocked) sg.gate = true; }
    if (sg.on && !was) {
      fx(g, 'sigon', 0, 0, l.charCodeAt(0));
      for (const t of tiles) if (!t.up) { const r = { x: t.x * TS, y: t.y * TS, w: TS, h: TS }; for (const e of [...live, ...S.crates]) if (ov(e, r)) e.y = r.y - e.h; }
    }
    sg.open = approach(sg.open, sg.gate ? 0 : 1, dt * 4); sg.show = approach(sg.show, sg.on ? 1 : 0, dt * 3);
  }
}
function baseOf(p) { let o = p.on, k = 0; while (o && o.isPlayer && k++ < MAXP) { if (!alive(o)) return null; o = o.on; } return o; }
// A rising platform lifts everyone riding it (bottom of a stack first), so nobody sinks in and gets shoved sideways.
function carryUp(g, plat, dy) { if (!(dy < 0)) return; const rs = g.players.filter(p => alive(p) && p.on && baseOf(p) === plat).sort((a, b) => b.y - a.y); for (const p of rs) move(g, p, dy, 'y'); }
function ridersOf(g, plat) { let n = 0; for (const p of g.players) if (alive(p) && p.on && baseOf(p) === plat) n++; return n; }
function nonRiderBlock(g, plat, nx, ny) {
  const r = { x: nx, y: ny, w: plat.w, h: plat.h };
  for (const p of g.players) if (alive(p) && p.on !== plat && ov(p, r)) return true;
  for (let i = 0; i < g.S.crates.length; i++) if (g.crateOn[i] !== plat && ov(g.S.crates[i], r)) return true;
  return false;
}
function aboardRaft(g, r) { return g.players.filter(p => alive(p) && p.x + p.w / 2 > r.x && p.x + p.w / 2 < r.x + r.w && p.y + p.h <= r.y + 0.6 && p.y + p.h >= r.y - 80 && (!p.grounded || baseOf(p) === r)); }
function raftOf(p) { const b = p.on ? (p.on.isRaft ? p.on : p.on.isPlayer ? baseOf(p) : null) : null; return b && b.isRaft ? b : null; }
function updLifts(g, dt) {
  g.S.lifts.forEach((l, i) => { const S = g.S;
    const d = g.liftDefs[i], dist = Math.hypot(d.x2 - d.x, d.y2 - d.y) || 1, need = d.need === 0 ? 0 : needOf(g, d.need);
    l.r = ridersOf(g, l) + S.crates.filter((c, ci) => g.crateOn[ci] === l).length; l.needN = need;
    const u0 = l.u;
    if (need === 0) { if (l.pause > 0) l.pause -= dt; else { l.u += l.dir * d.spd / dist * dt; if (l.u >= 1 || l.u <= 0) { l.u = clamp(l.u, 0, 1); l.dir *= -1; l.pause = 0.7; } } }
    else { const go = d.exact ? l.r === need : l.r >= need; if (go) { l.u = approach(l.u, 1, d.spd / dist * dt); if (l.u >= 1) l.hold = 1.4; } else if (l.hold > 0 && l.u >= 1) l.hold -= dt; else if (l.u >= 1 && l.r > 0 && !d.exact) l.hold = 0; else l.u = approach(l.u, 0, d.spd / dist * dt); }
    const nx = d.x + (d.x2 - d.x) * l.u, ny = d.y + (d.y2 - d.y) * l.u;
    if (nonRiderBlock(g, l, nx, ny)) { l.u = u0; l.dx = l.dy = 0; return; }
    l.dx = nx - l.x; l.dy = ny - l.y; l.x = nx; l.y = ny; carryUp(g, l, l.dy);
  });
}
function updMovers(g, dt) {
  const S = g.S;
  updLifts(g, dt);
  updTilts(g, dt);
  updMelts(g, dt);
  for (const sp of S.sees) sp.kick = approach(sp.kick, 0, dt * 4);
  S.rafts.forEach((r, i) => {
    const d = g.raftDefs[i], ab = aboardRaft(g, r), all = g.players.filter(alive).length; r.n = ab.length;
    const nR = ab.filter(p => p.input.x > 0).length, nL = ab.filter(p => p.input.x < 0).length; r.push = Math.max(nR, nL);
    let dir = 0; if (ab.length && ab.length === all) { if (nR === all) dir = 1; else if (nL === all) dir = -1; }
    const lo = Math.min(d.x, d.x2), hi = Math.max(d.x, d.x2);
    const nx = clamp(r.x + dir * RAFT * dt, lo, hi);
    r.dx = nx - r.x; r.mv = r.dx ? dir : 0; r.x = nx; r.dy = 0;
    for (const p of ab) { p.row = r.mv ? 0.25 : Math.max(0, p.row - dt); if (r.dx && p.on !== r) move(g, p, r.dx, 'x'); }
  });
  S.crush.forEach((c, i) => {
    const d = g.crushDefs[i]; let ny = crushNext(g, i, dt);
    const r = { x: c.x, y: ny, w: c.w, h: c.h };
    for (const cr of S.crates) if (ov(cr, r) && ny > c.y) ny = Math.min(ny, cr.y - c.h);
    if (ny > c.y + 0.01) { r.y = ny; for (const p of g.players) if (alive(p) && p.on !== c && ov(p, r)) { if (p.grounded || p.y > c.y + c.h - 4) kill(g, p, 'crush'); else move(g, p, ny + c.h - p.y, 'y'); } if (ny - c.y > 1.5 && ny >= d.y + d.drop - 0.01 && c.y < d.y + d.drop - 0.01) fx(g, 'slam', c.x + c.w / 2, ny + c.h); }
    else if (ny < c.y - 0.01 && nonRiderBlock(g, c, c.x, ny)) ny = c.y;
    c.dy = ny - c.y; c.y = ny; c.dx = 0; carryUp(g, c, c.dy);
  });
  S.bals.forEach((b, i) => {
    const d = g.balDefs[i]; let wa = ridersOf(g, b.pans[0]), wb = ridersOf(g, b.pans[1]);
    S.crates.forEach((c, ci) => { if (g.crateOn[ci] === b.pans[0]) wa += g.crateDefs[ci].wt; if (g.crateOn[ci] === b.pans[1]) wb += g.crateDefs[ci].wt; });
    b.wa = wa; b.wb = wb;
    const o0 = b.o; b.o = approach(b.o, clamp((wa - wb) * d.unit, -d.max, d.max), 45 * dt);
    const ya = d.ay + b.o, yb = d.by - b.o;
    if (nonRiderBlock(g, b.pans[0], b.pans[0].x, ya) || nonRiderBlock(g, b.pans[1], b.pans[1].x, yb)) { b.o = o0; b.pans[0].dy = b.pans[1].dy = 0; return; }
    b.pans[0].dy = ya - b.pans[0].y; b.pans[1].dy = yb - b.pans[1].y; b.pans[0].y = ya; b.pans[1].y = yb; carryUp(g, b.pans[0], b.pans[0].dy); carryUp(g, b.pans[1], b.pans[1].dy);
  });
  S.bridges.forEach((b, i) => {
    const d = g.bridgeDefs[i]; b.n = ridersOf(g, b); b.dy = 0;
    if (b.st === 0 && b.n > d.max) { b.st = 1; b.tmr = 0.18; fx(g, 'crack', b.x + b.w / 2, b.y); }
    else if (b.st === 1) { b.tmr -= dt; if (b.tmr <= 0) { b.st = 2; b.tmr = 2.6; b.vy = 0; fx(g, 'break', b.x + b.w / 2, b.y); } }
    else if (b.st === 2) { b.vy += G * dt; b.y += b.vy * dt; b.tmr -= dt; if (b.tmr <= 0) { b.st = 0; b.y = d.y; } }
  });
}
// Melting ice floes: each rider wears them down; gone, they refreeze a few seconds later once nobody's in the way.
function updMelts(g, dt) {
  for (const m of g.S.melts) {
    if (m.st === 0) { const r = ridersOf(g, m); if (r) { m.hp -= 0.45 * r * dt; if (m.hp <= 0) { m.hp = 0; m.st = 1; m.tmr = 3; fx(g, 'melt', m.x + m.w / 2, m.y); } } }
    else { m.tmr -= dt; if (m.tmr <= 0 && !g.players.some(p => alive(p) && ov(p, m))) { m.st = 0; m.hp = 1; fx(g, 'freeze', m.x + m.w / 2, m.y); } }
  }
}
// Searchlights sweep back and forth across their stretch.
function searchX(g, i) { const d = g.searchDefs[i], span = d.x2 - d.w - d.x, per = 2 * span / d.spd, ph = (((g.S.t + d.off) % per) + per) % per; return d.x + (ph < per / 2 ? ph * d.spd : span - (ph - per / 2) * d.spd); }
// Something solid overhead keeps you out of the light.
function covered(g, p) { const tx = Math.floor((p.x + p.w / 2) / TS), y1 = Math.floor(p.y / TS) - 1; for (let ty = 0; ty <= y1; ty++) { const r = tileRect(g, tx, ty, p, 'y', 0); if (r && r.ch && r.ch !== '-') return true; } return false; }
// Bombs: down at the dispenser to take one. The fuse is short; down next to a friend passes it (and resets the fuse).
// Touch a cracked wall with it to blow the wall open.
function updBombs(g, dt) {
  const S = g.S, live = g.players.filter(alive);
  S.bombs.forEach((b, i) => {
    const d = g.bombDefs[i];
    if (b.carrier < 0) { b.x = d.x + 9; b.y = d.y + 4; const p = live.find(q => q.input.downP && q.cn < 0 && ov(q, d) && !S.bombs.some(o => o.carrier === q.slot)); if (p) { b.carrier = p.slot; b.fuse = FUSE; b.from = -1; p.input.downP = false; fx(g, 'fuse', b.x, b.y, p.slot); } return; }
    const car = g.players.find(p => p.slot === b.carrier); if (!car || !alive(car)) { b.carrier = -1; return; }
    b.x = car.x + 5; b.y = car.y - 6; b.fuse -= dt;
    if (b.fuse <= 0) { b.carrier = -1; fx(g, 'boom', car.x + 5, car.y + 7); kill(g, car, 'bomb'); return; }
    const reach = { x: car.x - 3, y: car.y - 3, w: car.w + 6, h: car.h + 6 };
    for (let ty = Math.floor(reach.y / TS); ty <= Math.floor((reach.y + reach.h) / TS); ty++) for (let tx = Math.floor(reach.x / TS); tx <= Math.floor((reach.x + reach.w) / TS); tx++)
      if (ty >= 0 && ty < g.H && tx >= 0 && tx < g.W && g.grid[ty][tx] === '&' && !S.blast[ty * g.W + tx]) { blast(g, tx, ty); b.carrier = -1; return; }
    if (car.input.downP) { const to = live.filter(p => p !== car && p.cn < 0 && ov(p, reach) && !S.bombs.some(o => o.carrier === p.slot)).sort((a, c) => (a.slot === b.from) - (c.slot === b.from))[0];
      if (to) { b.from = car.slot; b.carrier = to.slot; b.fuse = FUSE; car.input.downP = false; fx(g, 'pass', to.x + 5, to.y, to.slot); } }
  });
}
function blast(g, tx, ty) {
  const S = g.S; for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 3; x <= tx + 3; x++) if (y >= 0 && y < g.H && x >= 0 && x < g.W && g.grid[y][x] === '&') S.blast[y * g.W + x] = 1;
  fx(g, 'boom', tx * TS + 5, ty * TS + 5); S.blastN = (S.blastN || 0) + 1;
}
function slimeHurt(s) { return s.spiky ? { x: s.x + 1, y: s.y + 1, w: s.w - 2, h: s.h - 1 } : { x: s.x + 2, y: s.y + 4, w: s.w - 4, h: s.h - 4 }; }
// Slimes walk back and forth. They turn at the ends of their patrol and at crates, and stand still on red.
function updSlimes(g, dt) {
  const S = g.S, frozen = g.flags.light && S.light.ph === 2;
  S.slimes.forEach((sl, i) => {
    sl.sq = approach(sl.sq, 0, dt * 4); if (sl.dead || frozen) { sl.vx = 0; return; }
    const d = g.slimeDefs[i], lo = Math.min(d.x, d.x2), hi = Math.max(d.x, d.x2);
    let nx = sl.x + sl.dir * d.spd * dt; const r = { x: nx, y: sl.y, w: sl.w, h: sl.h };
    if (nx < lo || nx > hi || S.crates.some(c => ov(c, r))) { sl.dir *= -1; nx = clamp(sl.x, lo, hi); }
    sl.vx = (nx - sl.x) / dt; sl.x = nx;
  });
}
// Lean platforms drift toward the side with more weight on it. Left empty for a while, they drift home.
function updTilts(g, dt) {
  const S = g.S;
  S.tilts.forEach((t, i) => {
    const d = g.tiltDefs[i], mid = t.x + t.w / 2; let lean = 0, n = 0;
    for (const p of g.players) if (alive(p) && p.on && baseOf(p) === t) { const o = p.x + p.w / 2 - mid; n++; if (o > 4) lean++; else if (o < -4) lean--; }
    S.crates.forEach((c, ci) => { if (g.crateOn[ci] === t) { const o = c.x + c.w / 2 - mid; if (o > 4) lean += 2; else if (o < -4) lean -= 2; } });
    t.n = n; t.lean = lean; t.idle = n ? 0 : t.idle + dt;
    const lo = Math.min(d.x, d.x2), hi = Math.max(d.x, d.x2);
    const tv = n ? clamp(lean * LEAN, -LEANMAX, LEANMAX) : t.idle > 1.5 ? clamp((d.x - t.x) * 2, -20, 20) : 0;
    t.v = approach(t.v, tv, 150 * dt);
    let nx = clamp(t.x + t.v * dt, lo, hi); if ((nx <= lo && t.v < 0) || (nx >= hi && t.v > 0)) t.v = 0;
    if (nonRiderBlock(g, t, nx, t.y)) { nx = t.x; t.v = 0; }
    t.dx = nx - t.x; t.x = nx; t.dy = 0;
  });
}
// The runaway key: it scampers away from anyone close by, and hops over a lone chaser when cornered.
// With someone on each side it's trapped and can be grabbed.
function runKey(g, k, live, dt) {
  const R = g.keyRun, hy = g.keyHome.y, lo = g.flags.scroll ? Math.max(R.lo, g.S.scroll + 30) : R.lo, hi = R.hi;
  if (k.hop > 0) { k.hop = Math.max(0, k.hop - dt); const u = 1 - k.hop / 0.5; k.hx = k.hf + (k.ht - k.hf) * u; k.x = k.hx; k.y = hy - Math.sin(u * Math.PI) * 30; k.trap = 0; return; }
  let lt = null, rt = null;
  for (const p of live) { const dx = p.x + p.w / 2 - k.hx, dy = p.y + p.h / 2 - hy; if (Math.abs(dy) > 26 || Math.abs(dx) > 52) continue; if (dx < 0) { if (!lt || dx > lt.d) lt = { p, d: dx }; } else if (!rt || dx < rt.d) rt = { p, d: dx }; }
  k.trap = lt && rt ? 1 : 0;
  if (!k.trap && (lt || rt)) {
    const dir = lt ? 1 : -1; let nx = k.hx + dir * KEYRUN * dt;
    if (nx > hi || nx < lo) { nx = clamp(nx, lo, hi); const ch = (lt || rt).p; k.hop = 0.5; k.hf = nx; k.ht = clamp(ch.x + ch.w / 2 - dir * 60, lo, hi); fx(g, 'keyhop', nx, hy, 0); }
    k.hx = nx;
  } else if (!k.trap && (k.hx < lo || k.hx > hi)) k.hx = clamp(k.hx, lo, hi);
  k.x = k.hx + (k.trap ? Math.sin(g.S.t * 40) * 1.2 : 0); k.y = hy;
}
function pushers(g, c, dir) {
  const set = new Set(), fr = [c];
  while (fr.length) { const t = fr.pop(); for (const p of g.players) { if (set.has(p) || !alive(p) || p.input.x !== dir) continue; const touch = dir > 0 ? Math.abs(p.x + p.w - t.x) < 0.75 : Math.abs(p.x - (t.x + t.w)) < 0.75; if (touch && p.y < t.y + t.h - 1 && p.y + p.h > t.y + 1) { set.add(p); fr.push(p); } } }
  return set.size;
}
const beltOf = gr => { for (const r of gr) { if (r.ch === '>') return BELT; if (r.ch === '<') return -BELT; } return 0; };
function updCrates(g, dt) {
  const S = g.S;
  S.crates.forEach((c, i) => {
    const d = g.crateDefs[i], x0 = c.x, need = needOf(g, d.need), on = g.crateOn[i]; c.pushN = 0; c.needN = need;
    if (on && (on.dx || on.dy)) { move(g, c, on.dx, 'x'); if (on.dy) move(g, c, on.dy, 'y'); }
    const gr0 = groundOf(g, c), ice = gr0.length && gr0.every(r => r.ch === '='), belt = beltOf(gr0);
    let pushed = 0;
    for (const dir of [1, -1]) { const n = pushers(g, c, dir); c.pushN = Math.max(c.pushN, n); if (n >= need) pushed = dir; }
    if (pushed) { c.vx = ice ? approach(c.vx, pushed * 70, 60 * dt) : pushed * CRATE_SPEED; if (Math.random() < 0.05) fx(g, 'scrape', pushed > 0 ? c.x : c.x + c.w, c.y + c.h); }
    else c.vx = ice ? approach(c.vx, 0, 10 * dt) : 0;
    if (c.vx && move(g, c, c.vx * dt, 'x')) c.vx = 0;
    if (belt && gr0.length) move(g, c, belt * dt, 'x');
    const tx = Math.round(c.x / TS), by = Math.floor((c.y + c.h + 0.5) / TS), cols = Math.round(c.w / TS);
    if (Math.abs(c.x - tx * TS) < 4) { let empty = true; for (let k = 0; k < cols; k++) if (tileRect(g, tx + k, by, c, 'y', 1)) empty = false; if (empty) c.x = tx * TS; }
    c.vy = Math.min(c.vy + G * dt, MAXFALL); const v = c.vy;
    if (move(g, c, c.vy * dt, 'y')) { if (v > 140) fx(g, 'thud', c.x + c.w / 2, c.y + c.h); c.vy = 0; }
    const gr = groundOf(g, c); g.crateOn[i] = gr.find(r => r.isLift || r.isPan || r.isBridge || r.isCrate || r.isRaft || r.isCrush || r.isTilt || r.isSee || r.isMelt) || null;
    for (const sl of S.slimes) if (!sl.dead && ov(c, sl)) { sl.dead = 1; fx(g, 'squish', sl.x + sl.w / 2, sl.y + sl.h); }
    if (c.y > g.LH + 40) { c.x = d.x; c.y = d.y; c.vy = 0; c.vx = 0; }
    c.dx = c.x - x0;
  });
}
function flipToggle(g) {
  const S = g.S; if (!g.flipTiles.length || S.flipCd > 0) return;
  S.flipCd = 0.25; S.flip ^= 1; fx(g, 'flip', S.cam + VW / 2, 20, S.flip);
  const live = g.players.filter(alive);
  for (const k of g.flipTiles) { const tx = k % g.W, ty = Math.floor(k / g.W), c = g.grid[ty][tx]; if ((c === '[') !== (S.flip === 0)) continue; const r = { x: tx * TS, y: ty * TS, w: TS, h: TS }; if (live.some(p => ov(p, r)) || S.crates.some(e => ov(e, r))) S.ghost[k] = 1; }
}
function updPlayer(g, p, dt) {
  if (!alive(p)) return;
  const S = g.S, inp = p.input, xs = p.x;
  if (p.cn >= 0) { // inside a cannon: wait for the bang
    const c = g.cannonDefs[p.cn]; p.x = c.x + c.w / 2 - p.w / 2; p.y = c.y - p.h - 1; p.vx = p.vy = 0; p.ct -= dt; p.dx = 0;
    if (p.ct <= 0) { const far = !!(c.sig && S.sig[c.sig].on), v = far ? CANNON_FAR : CANNON_NEAR; p.cn = -1; p.vx = v[0]; p.vy = v[1]; p.fly = far ? 0.75 : 0.25; p.cut = true; p.grounded = false; p.on = null; fx(g, 'cannon', c.x + c.w / 2, c.y, p.slot); }
    return; }
  if (inp.downP && p.grounded) for (let i = 0; i < g.cannonDefs.length; i++) { const c = g.cannonDefs[i]; if (ov(p, { x: c.x, y: c.y - 4, w: c.w, h: c.h + 4 }) && !g.players.some(q => q.cn === i) && !S.bombs.some(b => b.carrier === p.slot)) { p.cn = i; p.ct = 0.45; inp.downP = false; fx(g, 'cannonin', c.x + c.w / 2, c.y, p.slot); return; } }
  g.noWalls = true;
  if (p.x < S.wl) { move(g, p, S.wl - p.x, 'x'); if (p.x < S.wl - 1 && g.flags.scroll) { g.noWalls = false; kill(g, p, 'squash'); return; } }
  if (p.x + p.w > S.wr) move(g, p, S.wr - p.x - p.w, 'x');
  g.noWalls = false;
  if (p.on && p.on.dx) move(g, p, p.on.dx, 'x');
  if (p.on && p.on.dy > 0) move(g, p, p.on.dy, 'y');
  const rowing = p.row > 0;
  const gr0 = p.grounded ? groundOf(g, p) : [];
  const onIce = gr0.length > 0 && gr0.every(r => r.ch === '=');
  const heavy = g.flags.heavy && S.key.carrier === p.slot && !S.key.used;
  const ix = rowing ? 0 : inp.x;
  if (p.fly > 0) { p.fly -= dt; if (p.grounded) p.fly = 0; } else p.vx = approach(p.vx, ix * SPEED * (heavy ? 0.65 : 1), (p.grounded ? (onIce ? 140 : 1000) : 650) * dt); if (inp.x) p.face = inp.x;
  if (inp.jumpP) p.buffer = 0.12; else p.buffer -= dt;
  p.coyote = p.grounded ? 0.09 : p.coyote - dt;
  const loaded = g.players.some(o => o !== p && o.on === p && alive(o));
  if (p.buffer > 0 && p.coyote > 0 && (loaded || heavy) && inp.jumpP) { p.squash = 0.6; fx(g, 'strain', p.x + 5, p.y + 14, p.slot); }
  if (p.buffer > 0 && p.coyote > 0 && !loaded && !heavy) { p.vy = -JUMP; p.buffer = 0; p.coyote = 0; p.grounded = false; p.cut = false; p.squash = -1; fx(g, 'jump', p.x + 5, p.y + 14, p.slot); flipToggle(g); }
  if (!inp.jump && p.vy < 0 && !p.cut) { p.vy *= 0.5; p.cut = true; }
  p.vy = Math.min(p.vy + G * dt, MAXFALL);
  for (const f of g.fanDefs) {
    if (f.sig && !S.sig[f.sig].on) continue;
    const top = f.y - f.h;
    if (p.x + p.w > f.x + 1 && p.x < f.x + f.w - 1 && p.y + p.h > top && p.y < f.y) { const str = 1500 * clamp((p.y + p.h - top) / 40, 0, 1); p.vy = Math.max(-150, p.vy - str * dt); p.cut = true; }
  }
  const xb = p.x, hx = move(g, p, p.vx * dt, 'x'); if (hx && !hx.isCrate && !hx.isPlayer) p.vx = 0;
  // treadmills: running the right way keeps you in place (and powers the bridge)
  if (p.grounded && inp.x) for (const pl of g.plateDefs) if (pl.run === inp.x && p.x + p.w > pl.x + 1 && p.x < pl.x + pl.w - 1 && Math.abs(p.y + p.h - pl.y) < 1.5) { move(g, p, xb - p.x, 'x'); p.anim += dt * 2; break; }
  const rb = raftOf(p);
  if (rb) { const d = g.raftDefs[S.rafts.indexOf(rb)], lo = Math.min(d.x, d.x2), hi = Math.max(d.x, d.x2);
    if (rb.x > lo + 0.5 && p.x < rb.x) { move(g, p, rb.x - p.x, 'x'); p.vx = Math.max(0, p.vx); }
    if (rb.x < hi - 0.5 && p.x + p.w > rb.x + rb.w) { move(g, p, rb.x + rb.w - p.w - p.x, 'x'); p.vx = Math.min(0, p.vx); } }
  const vyb = p.vy, wasG = p.grounded;
  const hy = move(g, p, p.vy * dt, 'y');
  let bounced = false;
  if (vyb > 0) for (const sl of S.slimes) if (!sl.dead && !sl.spiky && p.x + p.w > sl.x + 1 && p.x < sl.x + sl.w - 1) { const bot = p.y + p.h, prev = bot - vyb * dt; if (bot >= sl.y - 0.5 && prev <= sl.y + 3.5) { p.y = sl.y - p.h; p.vy = -(inp.jump ? SLIME_BOUNCE * 1.12 : SLIME_BOUNCE); p.cut = true; p.squash = -1; sl.sq = 1; bounced = true; fx(g, 'boing', sl.x + sl.w / 2, sl.y, p.slot); break; } }
  if (hy && !bounced) { if (vyb > 0 && hy.ch === 'o') { p.vy = -SPRING; p.cut = true; p.squash = -1; fx(g, 'spring', hy.x + 5, hy.y, p.slot); } else p.vy = 0; }
  const gr = groundOf(g, p);
  p.grounded = gr.length > 0 && p.vy >= 0;
  p.on = p.grounded ? (gr.find(PLAT) || null) : null;
  if (p.grounded) {
    const belt = beltOf(gr); if (belt) move(g, p, belt * dt, 'x');
    for (const r of gr) if (r.ch === '%') { const k = Math.floor(r.y / TS) * g.W + Math.floor(r.x / TS); if (S.crumb[k][0] === 0) { S.crumb[k] = [1, 0.6]; fx(g, 'crumble', r.x + 5, r.y); } }
  }
  if (p.grounded && !wasG && vyb > 160 && p.on && p.on.isSee) { // landed hard on a seesaw: launch whoever's on the other end
    const o = S.sees[p.on.pair]; let k = 0; p.on.kick = 1; o.kick = -1;
    for (const q of g.players) if (q !== p && alive(q) && q.on && baseOf(q) === o) { q.vy = -Math.min(560, vyb * 1.2); q.cut = true; q.grounded = false; q.on = null; q.y -= 0.5; k++; }
    if (k) fx(g, 'catapult', o.x + o.w / 2, o.y, p.slot); }
  if (p.grounded && !wasG && vyb > 90) { p.squash = Math.min(1, vyb / 260); fx(g, 'land', p.x + 5, p.y + 14, p.slot); }
  p.squash = approach(p.squash, 0, dt * 6);
  p.anim += dt * (Math.abs(p.vx) / SPEED + (rowing ? 1.2 : 0)); p.blinkT -= dt; if (p.blinkT < 0) p.blinkT = 2 + Math.random() * 3;
  p.dx = p.x - xs;
  const x0 = Math.floor(p.x / TS), x1 = Math.floor((p.x + p.w - 1e-4) / TS), y0 = Math.floor(p.y / TS), y1 = Math.floor((p.y + p.h - 1e-4) / TS);
  for (let ty = Math.max(0, y0); ty <= Math.min(g.H - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(g.W - 1, x1); tx++)
    if (g.grid[ty][tx] === '^' && ov(p, { x: tx * TS + 1, y: ty * TS + 4, w: 8, h: 6 })) { kill(g, p, g.theme === 4 ? 'lava' : 'spikes'); return; }
  if (p.y > g.LH + 20) kill(g, p, 'fall');
}
function rope(g) {
  const ch = g.players.filter(alive);
  for (let it = 0; it < 2; it++) for (let i = 0; i + 1 < ch.length; i++) {
    const a = ch[i], b = ch[i + 1]; let dx = (b.x - a.x), dy = (b.y - a.y); const d = Math.hypot(dx, dy); if (d <= ROPE || d < 1e-3) continue;
    const ex = d - ROPE; dx /= d; dy /= d;
    let wa = a.grounded ? 0.25 : 0.6, wb = b.grounded ? 0.25 : 0.6; const s = wa + wb; wa /= s; wb /= s;
    move(g, a, dx * ex * wa, 'x'); move(g, a, dy * ex * wa, 'y'); move(g, b, -dx * ex * wb, 'x'); move(g, b, -dy * ex * wb, 'y');
    const rv = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
    if (rv < 0) { a.vx += dx * rv * wa; a.vy += dy * rv * wa; b.vx -= dx * rv * wb; b.vy -= dy * rv * wb; }
  }
}
function updCrumbs(g, dt) {
  const S = g.S;
  for (const k in S.crumb) {
    const c = S.crumb[k]; if (c[0] === 0) continue; c[1] -= dt;
    if (c[0] === 1 && c[1] <= 0) { c[0] = 2; c[1] = 3; const tx = k % g.W, ty = Math.floor(k / g.W); fx(g, 'crumbfall', tx * TS + 5, ty * TS + 5); }
    else if (c[0] === 2 && c[1] <= 0) { const tx = k % g.W, ty = Math.floor(k / g.W), r = { x: tx * TS, y: ty * TS, w: TS, h: TS }; if (!g.players.some(p => alive(p) && ov(p, r)) && !S.crates.some(e => ov(e, r))) c[0] = 0; }
  }
}
function updKeyDoor(g, dt) {
  const S = g.S, live = g.players.filter(alive), keys = S.key2 ? [S.key, S.key2] : [S.key];
  keys.forEach((k, ki) => {
    if (k.used) return;
    const home = ki ? g.key2Home : g.keyHome, car = g.players.find(p => p.slot === k.carrier);
    if (car && alive(car)) {
      const tx = car.x + 5 + (ki ? 3 : 0), ty = car.y - 8 - (ki ? 4 : 0); k.x += (tx - k.x) * Math.min(1, dt * 14); k.y += (ty - k.y) * Math.min(1, dt * 14);
      if (g.flags.pass && car.input.downP && !ov(car, g.door)) { const near = { x: car.x - 3, y: car.y - 3, w: car.w + 6, h: car.h + 6 }; const to = live.filter(p => p !== car && ov(p, near) && !keys.some(o => o !== k && o.carrier === p.slot)).sort((a, b) => (a.slot === k.from) - (b.slot === k.from) || a.y - b.y)[0]; if (to) { k.from = car.slot; k.carrier = to.slot; fx(g, 'pass', to.x + 5, to.y, to.slot); } }
    } else {
      k.carrier = -1; if (!ki && g.keyRun) runKey(g, k, live, dt); else { k.x += (home.x - k.x) * Math.min(1, dt * 4); k.y += (home.y - k.y) * Math.min(1, dt * 4); }
      const kb = { x: k.x - 7, y: k.y - 6, w: 14, h: 13 }; const c = live.find(p => ov(p, kb) && p.cn < 0 && !keys.some(o => o !== k && o.carrier === p.slot)); if (c) { k.carrier = c.slot; fx(g, 'key', k.x, k.y, c.slot); }
    }
    const c2 = g.players.find(p => p.slot === k.carrier);
    if (c2 && alive(c2) && ov(c2, g.door)) { k.used = true; k.carrier = -1; fx(g, keys.every(o => o.used) ? 'door' : 'keyin', g.door.x + 10, g.door.y + 8); }
  });
  if (!S.door.open && keys.every(k => k.used)) { S.door.open = true; if (g.flags.doorSig) S.sig[g.flags.doorSig].latched = true; }
  if (S.door.open) { S.door.t = Math.min(1, S.door.t + dt * 3); for (const p of live) if (p.input.downP && ov(p, g.door)) { p.inside = true; fx(g, 'enter', g.door.x + 10, g.door.y + 12, p.slot); } }
  if (!S.won && g.players.length && g.players.every(p => p.inside)) { S.won = true; fx(g, 'win', S.cam + VW / 2, 60); }
}

// ---------- client-side prediction of one player (online play) ----------
// world: a game object whose S and other players come from the latest server snapshot.
function supportOf(g, p) { if (!alive(p)) return null; const gr = groundOf(g, p); return gr.find(PLAT) || null; }
function predictStep(world, p, dt) {
  const S = world.S;
  updLifts(world, dt);
  S.rafts.forEach((r, i) => { const d = world.raftDefs[i]; r.x = clamp(r.x + r.dx, Math.min(d.x, d.x2), Math.max(d.x, d.x2)); });
  (S.tilts || []).forEach((r, i) => { const d = world.tiltDefs[i]; r.x = clamp(r.x + r.dx, Math.min(d.x, d.x2), Math.max(d.x, d.x2)); });
  (S.slimes || []).forEach((sl, i) => { if (sl.dead) return; const d = world.slimeDefs[i]; sl.x = clamp(sl.x + sl.vx * dt, Math.min(d.x, d.x2), Math.max(d.x, d.x2)); });
  S.crush.forEach((c, i) => { let ny = crushNext(world, i, dt); if (ny < c.y - 0.01 && nonRiderBlock(world, c, c.x, ny)) ny = c.y; c.dy = ny - c.y; c.y = ny; carryUp(world, c, c.dy); });
  S.bals.forEach((b, bi) => { const d = world.balDefs[bi]; b.pans.forEach((pn, k) => { const y0 = k ? d.by : d.ay; pn.y = clamp(pn.y + pn.dy, y0 - d.max, y0 + d.max); }); });
  // friends aren't simulated here, but they still ride whatever they stand on
  for (const o of world.players) { if (o === p || !alive(o) || !o.on) continue; const b = baseOf(o); if (b && b !== p && (b.isLift || b.isCrush || b.isRaft || b.isPan || b.isTilt)) { o.x += b.dx || 0; if ((b.dy || 0) > 0 || b.isRaft) o.y += b.dy || 0; } }
  S.t += dt; if (S.flipCd > 0) S.flipCd -= dt;
  updPlayer(world, p, dt);
  p.input.jumpP = false; p.input.downP = false;
}

// ---------- networking helpers ----------
const PKEYS = ['slot', 'x', 'y', 'vx', 'vy', 'face', 'gr', 'sq', 'an', 'dead', 'ins', 'row', 'q', 'm', 'co', 'bu', 'cut', 'cn', 'ct', 'fl'];
function snapshot(g) {
  return { li: g.li, n: g.n, S: g.S, P: g.players.map(p => ({ slot: p.slot, x: p.x, y: p.y, vx: p.vx, vy: p.vy, face: p.face, gr: p.grounded, sq: p.squash, an: p.anim, dead: p.dead, ins: p.inside, row: p.row, q: p.q, m: p.m, co: p.coyote, bu: p.buffer, cut: p.cut, cn: p.cn == null ? -1 : p.cn, ct: p.ct || 0, fl: p.fly || 0 })), fx: g.fx.splice(0) };
}
// Network form: players as short arrays (booleans as 0/1), and no camera bookkeeping. About 40% smaller.
const SKIP = { camGY: 1, zl: 1, zHold: 1, lastCause: 1 };
function packSnap(g) { const sn = snapshot(g); return JSON.stringify({ li: sn.li, n: sn.n, S: sn.S, P: sn.P.map(p => PKEYS.map(k => typeof p[k] === 'boolean' ? +p[k] : p[k])), fx: sn.fx }, (k, v) => SKIP[k] ? undefined : typeof v === 'number' ? Math.round(v * 100) / 100 : v); }
function unpackSnap(d) { d.P = d.P.map(a => { const o = {}; PKEYS.forEach((k, i) => o[k] = (k === 'gr' || k === 'ins' || k === 'cut') ? !!a[i] : a[i]); o.bl = 3; return o; }); return d; }
const round2 = (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
function serialize(g) { return JSON.stringify(snapshot(g), round2); }
function applySnapshot(g, snap) {
  g.S = snap.S;
  const slots = new Set(snap.P.map(p => p.slot));
  g.players = g.players.filter(p => slots.has(p.slot));
  for (const q of snap.P) {
    let p = g.players.find(o => o.slot === q.slot);
    if (!p) { p = { slot: q.slot, w: PW, h: PH, isPlayer: true, input: { x: 0, jump: false, jumpP: false, downP: false } }; g.players.push(p); g.players.sort((a, b) => a.slot - b.slot); }
    if (q.bl == null || p.blinkT == null) p.blinkT = p.blinkT == null ? 2 + Math.random() * 3 : p.blinkT; Object.assign(p, { x: q.x, y: q.y, vx: q.vx, vy: q.vy, face: q.face, grounded: q.gr, squash: q.sq, anim: q.an, dead: q.dead, inside: q.ins, row: q.row || 0, q: q.q, m: q.m, coyote: q.co, buffer: q.bu, cut: q.cut, cn: q.cn == null ? -1 : q.cn, ct: q.ct || 0, fly: q.fl || 0, on: null });
  }
}
function setInput(g, slot, x, jump, down, q) {
  const p = g.players.find(o => o.slot === slot); if (!p) return;
  if (jump && !p.input.jump) p.input.jumpP = true;
  if (down && !p.input.down) p.input.downP = true;
  p.input.x = x; p.input.jump = jump; p.input.down = down;
  if (q != null && q !== p.q) { p.q = q; p.m = 0; }
}
function clearEdges(g) { for (const p of g.players) { p.input.jumpP = false; p.input.downP = false; } }

const api = { searchX, slimeHurt, fireLit, fireWarn, packSnap, unpackSnap, supportOf, MAXP, TS, VW, VH, ROWS, STEP, PW, PH, LEVELS, THEMES, createGame, compile, adapt, reset, step, camera, addPlayer, removePlayer, place, snapshot, serialize, applySnapshot, setInput, clearEdges, sawPos, crushPhase, tileRect, ov, needOf, predictStep, SH };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HP = api;
})(typeof window !== 'undefined' ? window : globalThis);
