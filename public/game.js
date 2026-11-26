// Huddle Peak shared simulation. Runs in the browser (local play / rendering / prediction) and in Node (online server).
(function (root) {
'use strict';
const TS = 10, VW = 320, VH = 180, ROWS = 18, STEP = 1 / 120;
const G = 900, JUMP = 244, SPEED = 78, MAXFALL = 320, SPRING = 400, ROPE = 56, CRATE_SPEED = 24, BELT = 40, RAFT = 40;
const PW = 10, PH = 14;
const THEMES = ['Snowpeak', 'Autumn Woods', 'Crystal Caves', 'Sky Ruins', 'Ember Forge'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const ov = (a, b) => a.x < b.x + b.w - 1e-6 && a.x + a.w > b.x + 1e-6 && a.y < b.y + b.h - 1e-6 && a.y + a.h > b.y + 1e-6;
const MAXP = 8;
const SH = n => n >= 3 ? 5 : 4; // wall height that needs everyone stacked: 2 players reach 4 tiles, 3 players reach 5

// ---------- level builder ----------
function B(w, rows) {
  rows = rows || ROWS;
  const g = []; for (let y = 0; y < rows; y++) g.push(new Array(w).fill('.'));
  const L = { w, rows, g, ents: [], hints: [], flags: {} };
  L.f = (x0, y0, x1, y1, ch) => { ch = ch || '#'; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < rows && x >= 0 && x < w) g[y][x] = ch; return L; };
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

const LEVELS = [
 // ===== World 1: Snowpeak =====
 { name: 'Stack up', goal: 'Stand on friends to reach high places', build(n) {
   const s = SH(n), U = 15 - s, L = B(60); L.gr(0, 16, 15).gr(17, 59, U).st(17 - (s - 1), 15, s - 1, 'a').f(30, U - s, 35, U - s);
   S0(L, 3); L.e({ t: 'lever', x: 21, floor: U, sig: 'a' }).e({ t: 'key', x: 32, floor: U - s }).e({ t: 'door', x: 52, floor: U });
   return L.h(8, 9, stackHint(s), 'a').h(21, U - 3.5, 'Pull the lever for the others', 'a').h(32, U - s - 2.5, 'Stack again for the key', 'key').h(53, U - 4.5, 'Everyone press down at the door', 'win'); } },
 { name: 'Heavy lifting', goal: 'Push together, then climb together', build(n) {
   const hw = n >= 3 ? 7 : 6, T = 15 - hw, L = B(78);
   L.gr(0, 77, 15).f(30, 0, 30, 8).f(30, 9, 30, 14, 'A').gr(46, 77, T).f(44, 11, 44, 12, 'b').f(45, T + 1, 45, 12, 'b');
   S0(L, 2); L.e({ t: 'crate', x: 8, floor: 15, w: 3, h: 2, need: 'all' }).e({ t: 'plate', x: 27, floor: 15, sig: 'a' })
    .e({ t: 'crate', x: 35, floor: 15, w: 3, h: 2, need: 2 }).e({ t: 'lever', x: 50, floor: T, sig: 'b' }).e({ t: 'key', x: 62, floor: T }).e({ t: 'door', x: 70, floor: T });
   return L.h(10, 9, 'Everyone has to push this one', 'x:20').h(28, 7, 'Park it on the plate', 'x:31').h(40, 6, 'Crate against the wall, then stack on it', 'b'); } },
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
   const L = B(64); L.gr(0, 11, 12).gr(16, 21, 12).gr(26, 63, 8).st(19, 12, 3, 'a').f(40, 4, 46, 4);
   S0(L, 0, 12); L.e({ t: 'crate', x: 6, floor: 12, w: 3, h: 2, need: n >= 3 ? 2 : 1, wt: 3 })
    .e({ t: 'bal', ax: 12, ay: 12, bx: 22, by: 12, w: 4, unit: 20, max: 40 }).e({ t: 'lever', x: 30, floor: 8, sig: 'a' })
    .e({ t: 'key', x: 43, floor: 4 }).e({ t: 'door', x: 56, floor: 8 });
   return L.h(8, 6, 'Crates are heavy. Put weight on the left', 'x:26').h(31, 4.5, 'Pull it for whoever is left behind', 'a').h(43, 1.5, 'Stack for the key', 'key'); } },
 { name: 'Springtime', goal: 'Springs, crumbling ground and a lid', build(n) {
   const L = B(100); L.gr(0, 24, 15).f(12, 14, 12, 14, 'o').gr(14, 24, 7).gr(25, 44, 16).spk(25, 44, 15)
    .f(25, 7, 27, 7, '%').f(31, 7, 33, 7, '%').f(37, 7, 39, 7, '%').f(43, 7, 44, 7, '%').gr(45, 99, 15).f(60, 14, 60, 14, 'o')
    .f(55, 9, 58, 9).f(59, 9, 61, 9, 'A').gr(62, 99, 6).f(76, 2, 81, 2);
   S0(L, 2); L.e({ t: 'plate', x: 47, floor: 15, sig: 'a' }).e({ t: 'lever', x: 67, floor: 6, sig: 'a' })
    .e({ t: 'key', x: 78, floor: 2 }).e({ t: 'door', x: 92, floor: 6 });
   return L.h(10, 9, 'Bounce!', 'x:14').h(34, 3.5, 'It crumbles. Keep moving!', 'x:45').h(52, 7, 'Hold the plate to open the lid', 'a').h(68, 2.5, 'Pull it to open the lid for good', 'a'); } },
 { name: 'Head count', goal: 'Platforms that need an exact number of riders', build(n) {
   const a = exactN(n), L = B(90); L.gr(0, 13, 15).gr(18, 35, 9).gr(36, 55, 17).spk(36, 55, 16).gr(56, 89, 9).f(66, 9, 70, 17, '.').f(71, 3, 80, 8);
   S0(L, 2); L.e({ t: 'lift', x: 14, y: 15, w: 4, x2: 14, y2: 9, need: a, exact: true, spd: 30 })
    .e({ t: 'lift', x: 36, y: 9, w: 3, x2: 53, y2: 9, need: 1, exact: true, spd: 32 })
    .e({ t: 'lift', x: 66, y: 9, w: 5, x2: 66, y2: 3, need: 'all', exact: true, spd: 30 })
    .e({ t: 'key', x: 75, floor: 3 }).e({ t: 'door', x: 84, floor: 9 });
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
   const s = SH(n), L = B(64, 34);
   L.gr(0, 63, 32).f(22, 32, 24, 33, '.').f(40, 32, 52, 33, '.').spk(40, 52, 33)
    .f(13, 29, 17, 29, '-').f(8, 26, 12, 26, '-').f(13, 23, 17, 23, '-').f(1, 23 - s, 11, 23 - s)
    .f(25, 10, 36, 10).f(27, 26, 34, 26).f(27, 27, 27, 31, 'A').f(34, 27, 34, 31, 'A')
    .f(60, 31, 60, 31, 'o').f(50, 23, 57, 23).f(44, 23 - s, 49, 23 - s);
   S0(L, 3, 32);
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
 { name: 'Short leash', goal: 'Roped together, and a red light', build(n) {
   const s = SH(n), U = 15 - s, L = B(96); L.flags.rope = true; L.flags.light = { g: 3.8, y: 1.0, r: 2.2 };
   L.gr(0, 95, 15).pit(16, 19, 15, 2).f(26, 13, 27, 14).pit(34, 37, 15, 2).st(46 - (s - 1), 15, s - 1, 'a').gr(46, 95, U).pit(58, 61, U, 2).f(70, U - s, 74, U - s);
   S0(L, 2); L.e({ t: 'light', x: 9, floor: 15 }).e({ t: 'light', x: 40, floor: 15 }).e({ t: 'light', x: 66, floor: U })
    .e({ t: 'lever', x: 50, floor: U, sig: 'a' }).e({ t: 'key', x: 72, floor: U - s }).e({ t: 'door', x: 88, floor: U });
   return L.h(12, 8, 'Rope AND red light. Good luck', 'x:20'); } },
 // ===== World 4: Sky Ruins =====
 { name: 'Moving day', goal: 'Ride the moving platforms', build(n) {
   const L = B(110); L.gr(0, 15, 15).gr(16, 61, 17).spk(16, 61, 16).gr(62, 109, 6).f(86, 2, 96, 2);
   S0(L, 2); L.e({ t: 'lift', x: 16, y: 15, w: 5, x2: 28, y2: 15, need: 0, spd: 30 })
    .e({ t: 'lift', x: 34, y: 15, w: 5, x2: 34, y2: 7, need: 'all', spd: 32 }).e({ t: 'lift', x: 40, y: 7, w: 5, x2: 56, y2: 7, need: 0, spd: 32 })
    .e({ t: 'saw', x: 72, y: 5, x2: 84, y2: 5, spd: 0.9 }).e({ t: 'key', x: 91, floor: 2 }).e({ t: 'door', x: 102, floor: 6 });
   return L.h(8, 9, 'Hop on and ride', 'x:30').h(36, 10, 'This one needs everybody', 'x:40').h(91, 0.6, 'Stack for the key', 'key'); } },
 { name: 'Updraft', goal: 'Fans blow you up. Hold the plate to power them', build(n) {
   const L = B(100); L.gr(0, 15, 15).gr(16, 30, 6).gr(31, 46, 17).spk(31, 46, 16).gr(47, 70, 6).gr(71, 99, 10);
   S0(L, 2); L.e({ t: 'fan', x: 14, floor: 15, h: 12 }).e({ t: 'fan', x: 32, floor: 17, w: 4, h: 14, sig: 'a' }).e({ t: 'fan', x: 38, floor: 17, w: 4, h: 14, sig: 'a' }).e({ t: 'fan', x: 43, floor: 17, w: 4, h: 14, sig: 'a' })
    .e({ t: 'plate', x: 26, floor: 6, sig: 'a' }).e({ t: 'plate', x: 48, floor: 6, sig: 'a' }).e({ t: 'fan', x: 58, floor: 6, h: 5, sig: 'b' }).e({ t: 'plate', x: 66, floor: 6, sig: 'b' })
    .e({ t: 'key', x: 59, floor: 3 }).e({ t: 'door', x: 92, floor: 10 });
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
 { name: 'Heavy duty', goal: 'Some crates need everyone', build(n) {
   const hw = n >= 3 ? 7 : 6, T = 15 - hw, L = B(100);
   L.gr(0, 99, 15).f(14, 0, 44, 10).f(36, 15, 38, 16, '.').f(66, 0, 66, 8).f(66, 9, 66, 14, 'A').gr(80, 99, T).f(78, 11, 78, 12, 'b').f(79, T + 1, 79, 12, 'b');
   S0(L, 2); L.e({ t: 'crate', x: 18, floor: 15, w: 3, h: 4, need: 'all' }).e({ t: 'crate', x: 50, floor: 15, w: 3, h: 2, need: 'all' })
    .e({ t: 'plate', x: 64, floor: 15, sig: 'a' }).e({ t: 'crate', x: 70, floor: 15, w: 3, h: 2, need: 2 }).e({ t: 'lever', x: 83, floor: T, sig: 'b' })
    .e({ t: 'key', x: 89, floor: T }).e({ t: 'door', x: 94, floor: T });
   return L.h(10, 8, 'This one needs EVERYONE pushing', 'x:40').h(58, 8, 'Crate on the plate', 'x:67').h(74, 5, 'Crate on the wall, then stack', 'b'); } },
 { name: 'Storm chase', goal: "The screen won't wait for you", build(n) {
   const s = SH(n), U = 15 - s, L = B(150); L.flags.scroll = 26;
   L.gr(0, 149, 15).pit(20, 23, 15, 2).f(30, 13, 31, 14).f(40, 15, 49, 16, '.').spk(40, 49, 16).f(40, 13, 49, 13, '%').f(60, 14, 60, 14, 'o').gr(62, 80, 7)
    .pit(88, 91, 15, 2).st(104 - (s - 1), 15, s - 1, 'a').gr(104, 149, U);
   S0(L, 4); L.e({ t: 'key', x: 70, floor: 7 }).e({ t: 'lever', x: 108, floor: U, sig: 'a' }).e({ t: 'saw', x: 118, y: U - 4, x2: 118, y2: U - 0.8, spd: 1.8 }).e({ t: 'door', x: 140, floor: U });
   return L.h(16, 7, "Keep up! Don't get squashed", 'x:30').h(98, 7, 'Quick, stack!', 'a'); } },
 // ===== World 5: Ember Forge =====
 { name: 'Row together', goal: 'The raft only moves when everyone pushes the same way', build(n) {
   const s = SH(n), L = B(120); L.gr(0, 9, 15).lava(10, 55).gr(56, 66, 15).f(59, 15 - s, 63, 15 - s).lava(67, 105).gr(106, 119, 15);
   S0(L, 2); L.e({ t: 'raft', x: 10, y: 15, w: raftW(n), x2: 56 - raftW(n) }).e({ t: 'saw', x: 25, y: 9.5, x2: 25, y2: 14.6, spd: 1.3 }).e({ t: 'saw', x: 40, y: 9.5, x2: 40, y2: 14.6, spd: 1.0 })
    .e({ t: 'key', x: 61, floor: 15 - s }).e({ t: 'raft', x: 67, y: 15, w: raftW(n), x2: 106 - raftW(n) }).e({ t: 'saw', x: 80, y: 9.5, x2: 80, y2: 14.6, spd: 1.5 }).e({ t: 'saw', x: 92, y: 9.5, x2: 92, y2: 14.6, spd: 1.1 })
    .e({ t: 'door', x: 112, floor: 15 });
   return L.h(10, 9, 'Everyone aboard, then all push the same way', 'x:30').h(24, 6, 'Stop for the saws!', 'x:48').h(61, 15 - s - 3.5, 'Stack for the key', 'key'); } },
 { name: 'Conveyor', goal: 'Belts keep moving. So should you', build(n) {
   const s = SH(n), U = 15 - s, L = B(110);
   L.gr(0, 109, 15).f(10, 15, 30, 15, '>').pit(31, 33, 15, 2).f(36, 15, 56, 15, '<').f(58, 15, 70, 15, '<').f(74, 0, 74, 8).f(74, 9, 74, 14, 'A')
    .f(80, 15, 95, 15, '>').st(96 - (s - 1), 15, s - 1, 'b').gr(96, 109, U).f(100, U - s, 104, U - s);
   S0(L, 2); L.e({ t: 'plate', x: 64, floor: 15, sig: 'a' }).e({ t: 'plate', x: 78, floor: 15, sig: 'a' }).e({ t: 'lever', x: 99, floor: U, sig: 'b' })
    .e({ t: 'key', x: 102, floor: U - s }).e({ t: 'door', x: 106, floor: U });
   return L.h(14, 8, "Don't stand still on the belts", 'x:34').h(64, 8.5, 'Keep walking to stay on the plate', 'x:75').h(88, 7, 'The belt pins you to the wall. Stack!', 'b'); } },
 { name: 'Crushers', goal: 'Watch the rhythm, then run', build(n) {
   const s = SH(n), L = B(110); L.gr(0, 109, 15).f(14, 0, 60, 5).gr(70, 109, 8).f(86, 8 - s, 92, 8 - s);
   S0(L, 2); [20, 30, 40, 50].forEach((x, i) => L.e({ t: 'crush', x, y: 6, w: 3, h: 3, drop: 6, period: 3.0, off: i * 0.75, sig: 'a' }));
   L.e({ t: 'plate', x: 57, floor: 15, sig: 'a' }).e({ t: 'crush', x: 64, y: 7, w: 4, h: 2, drop: 6, period: 4.2, off: 0 })
    .e({ t: 'key', x: 89, floor: 8 - s }).e({ t: 'door', x: 102, floor: 8 });
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
 { name: 'The peak', goal: 'The final climb', build(n) {
   const s = SH(n), L = B(140); L.gr(0, 9, 15).lava(10, 39)
    .f(10, 14, 13, 14, ']').f(16, 13, 19, 13, '[').f(22, 12, 25, 12, ']').f(28, 13, 31, 13, '[').f(34, 14, 37, 14, ']')
    .gr(40, 49, 15).gr(54, 79, 8).f(58, 0, 74, 3).lava(80, 115).gr(116, 139, 15).f(124, 15 - s, 128, 15 - s);
   S0(L, 2); L.e({ t: 'lift', x: 50, y: 15, w: 4, x2: 50, y2: 8, need: exactN(n), exact: true, spd: 32 })
    .e({ t: 'crush', x: 62, y: 4, w: 3, h: 2, drop: 2, period: 2.6, off: 0 }).e({ t: 'crush', x: 69, y: 4, w: 3, h: 2, drop: 2, period: 2.6, off: 1.3 })
    .e({ t: 'raft', x: 80, y: 15, w: raftW(n), x2: 116 - raftW(n) }).e({ t: 'saw', x: 95, y: 9.5, x2: 95, y2: 14.6, spd: 1.2 })
    .e({ t: 'key', x: 126, floor: 15 - s }).e({ t: 'door', x: 134, floor: 15 });
   return L.h(6, 8, 'Jump together!', 'x:20').h(51, 9.5, 'Exactly ' + exactN(n) + ' riders', 'x:54').h(82, 5, 'Drop onto the raft', 'x:116').h(126, 15 - s - 3.5, 'Stack for the key', 'key'); } },
];
LEVELS.forEach((L, i) => { L.theme = Math.floor(i / 5); });

// ---------- game ----------
function createGame(li, n) {
  const g = { li, players: [], fx: [], S: null, noWalls: false };
  compile(g, Math.max(2, Math.min(MAXP, n || 2)));
  reset(g, false);
  return g;
}
function compile(g, n) {
  const def = LEVELS[g.li], L = def.build(n);
  Object.assign(g, { n, name: def.name, goal: def.goal, theme: def.theme, W: L.w, H: L.rows, LW: L.w * TS, LH: L.rows * TS, grid: L.g, hints: L.hints, flags: L.flags });
  g.zMin = g.flags.scroll ? 1 : Math.max(0.5, VW / g.LW);
  g.spawn = L.ents.find(e => e.t === 'spawn');
  const kd = L.ents.find(e => e.t === 'key'); g.keyHome = { x: kd.x * TS + 5, y: kd.floor * TS - 9 };
  const dd = L.ents.find(e => e.t === 'door'); g.door = { x: dd.x * TS, y: dd.floor * TS - 22, w: 20, h: 22 };
  const E = t => L.ents.filter(e => e.t === t);
  g.plateDefs = E('plate').map(e => ({ x: e.x * TS, y: e.floor * TS, w: 20, sig: e.sig, color: e.color == null ? -1 : e.color, timer: e.timer || 0, and: !!e.and }));
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
  const letters = new Set();
  g.sigTiles = {}; g.crumbTiles = []; g.flipTiles = [];
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.w; x++) {
    const c = L.g[y][x];
    if (/[a-eA-E]/.test(c)) { const l = c.toLowerCase(); letters.add(l); (g.sigTiles[l] = g.sigTiles[l] || []).push({ x, y, up: c !== l }); }
    if (c === '%') g.crumbTiles.push(y * L.w + x);
    if (c === '[' || c === ']') g.flipTiles.push(y * L.w + x);
  }
  g.plateDefs.forEach(p => letters.add(p.sig)); g.leverDefs.forEach(p => letters.add(p.sig));
  g.fanDefs.forEach(f => f.sig && letters.add(f.sig)); g.crushDefs.forEach(c => c.sig && letters.add(c.sig));
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
  const S = g.S = { t: keep ? o.t : 0, deaths: keep ? o.deaths : 0, restartT: 0, culprit: -1, cause: '', lastCause: keep ? o.lastCause : '', won: false, winT: 0,
    cam: 0, camY: 0, zoom: 1, wl: -1e5, wr: 1e5, scroll: 0,
    sig: {}, plates: g.plateDefs.map(() => 0), levers: g.leverDefs.map(() => 0), crates: [], lifts: [], bals: [], bridges: [], crumb: {}, rafts: [], crush: [],
    torches: g.torchDefs.map(() => 0), flip: 0, flipCd: 0, ghost: {}, light: { ph: 0, t: 0 }, key: { x: g.keyHome.x, y: g.keyHome.y, carrier: -1, used: false }, door: { open: false, t: 0 } };
  for (const l of g.letters) S.sig[l] = { on: false, latched: false, tmr: 0, gate: true, open: 0, show: 0 };
  g.crateDefs.forEach(d => S.crates.push({ x: d.x, y: d.y, w: d.w, h: d.h, vx: 0, vy: 0, dx: 0, pushN: 0, needN: 1, isCrate: true }));
  g.liftDefs.forEach(d => S.lifts.push({ x: d.x, y: d.y, w: d.w, h: 6, u: 0, dir: 1, pause: 0, hold: 0, dx: 0, dy: 0, r: 0, needN: 0, isLift: true }));
  g.balDefs.forEach(d => S.bals.push({ o: 0, wa: 0, wb: 0, pans: [{ x: d.ax, y: d.ay, w: d.w, h: 6, dx: 0, dy: 0, isPan: true }, { x: d.bx, y: d.by, w: d.w, h: 6, dx: 0, dy: 0, isPan: true }] }));
  g.bridgeDefs.forEach(d => S.bridges.push({ x: d.x, y: d.y, w: d.w, h: 4, st: 0, tmr: 0, vy: 0, dx: 0, dy: 0, n: 0, isBridge: true }));
  g.raftDefs.forEach(d => S.rafts.push({ x: d.x, y: d.y, w: d.w, h: 6, dx: 0, dy: 0, mv: 0, n: 0, isRaft: true }));
  g.crushDefs.forEach(d => S.crush.push({ x: d.x, y: d.y, w: d.w, h: d.h, dx: 0, dy: 0, ct: 0, isCrush: true }));
  g.crumbTiles.forEach(i => S.crumb[i] = [0, 0]);
  g.crateOn = S.crates.map(() => null);
  g.players.forEach(p => { Object.assign(p, { vx: 0, vy: 0, dead: 99, inside: false, on: null, grounded: false, dx: 0, squash: 0, coyote: 0, buffer: 0, row: 0 }); });
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
  const p = { slot, x: 0, y: 0, w: PW, h: PH, vx: 0, vy: 0, face: 1, grounded: false, coyote: 0, buffer: 0, on: null, dx: 0, cut: false, squash: 0, dead: 0, inside: false, anim: 0, row: 0, q: 0, m: 0, blinkT: 2 + Math.random() * 3, isPlayer: true, input: { x: 0, jump: false, jumpP: false, downP: false } };
  place(g, p); g.players.push(p); g.players.sort((a, b) => a.slot - b.slot);
  if (!adapt(g)) fx(g, 'join', p.x + 5, p.y + 7, slot);
  return p;
}
function removePlayer(g, slot) {
  const i = g.players.findIndex(p => p.slot === slot); if (i < 0) return;
  if (g.S.key.carrier === slot) g.S.key.carrier = -1;
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
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of act) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + p.w); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + p.h); }
  const zt = clamp(Math.min(VW / (x1 - x0 + 110), VH / (y1 - y0 + 80)), g.zMin, 1);
  S.zoom = snap ? zt : (zt < S.zoom ? approach(S.zoom, zt, dt * 2.2) : approach(S.zoom, zt, dt * 0.5));
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
  for (const b of S.bals) for (const pn of b.pans) if (pn !== e && ov(e, pn)) out.push(pn);
  for (const b of S.bridges) if (b.st < 2 && b !== e && ov(e, b)) out.push(b);
  for (const p of g.players) if (p !== e && alive(p) && ov(e, p)) out.push(p);
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
const PLAT = r => r.isPlayer || r.isCrate || r.isLift || r.isPan || r.isBridge || r.isRaft || r.isCrush;

// ---------- death / restart ----------
function kill(g, p, cause) {
  const S = g.S; if (!alive(p) || S.restartT > 0 || S.won) return;
  p.dead = 99; S.restartT = 1.2; S.deaths++; S.culprit = p.slot; S.cause = cause || 'oops'; S.lastCause = S.cause + '@' + Math.round(p.x) + ',' + Math.round(p.y) + '#' + p.slot;
  if (S.key.carrier === p.slot) S.key.carrier = -1;
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
  updCrates(g, dt);
  [...g.players].sort((a, b) => b.y - a.y).forEach(p => updPlayer(g, p, dt));
  if (g.flags.rope) rope(g);
  updCrumbs(g, dt);
  for (const k in S.ghost) { const tx = k % g.W, ty = Math.floor(k / g.W), r = { x: tx * TS, y: ty * TS, w: TS, h: TS }; if (!g.players.some(p => alive(p) && ov(p, r)) && !S.crates.some(c => ov(c, r))) delete S.ghost[k]; }
  g.torchDefs.forEach((t, i) => { if (!S.torches[i] && act.some(p => Math.abs(p.x + 5 - t.x) < 10 && p.y + p.h > t.y - 24 && p.y < t.y)) { S.torches[i] = 1; fx(g, 'torch', t.x, t.y - 16); } });
  updKeyDoor(g, dt);
  for (const sd of g.sawDefs) { const s = sawPos(g, sd); for (const p of g.players) if (alive(p)) { const cx = clamp(s.x, p.x, p.x + p.w), cy = clamp(s.y, p.y, p.y + p.h); if ((cx - s.x) ** 2 + (cy - s.y) ** 2 < 30) kill(g, p, 'saw'); } }
  if (S.won) S.winT += dt;
}
function sawPos(g, sd) { const u = (1 - Math.cos(g.S.t * sd.spd)) / 2; return { x: sd.x + (sd.x2 - sd.x) * u, y: sd.y + (sd.y2 - sd.y) * u }; }
function crushTiming(d) { const dropT = d.drop / 320, waitB = 0.6, riseT = d.drop / 45, waitT = Math.max(0.3, d.period - dropT - waitB - riseT); return { dropT, waitB, riseT, waitT, total: waitT + dropT + waitB + riseT }; }
function crushPhase(g, i) { const d = g.crushDefs[i], c = g.S.crush[i], T = crushTiming(d); const ph = ((c.ct + d.off) % T.total + T.total) % T.total; return { ph, T, warn: ph > T.waitT - 0.45 && ph < T.waitT }; }

function pressing(g, pl) {
  const ents = [...g.players.filter(alive)];
  if (pl.color < 0) ents.push(...g.S.crates);
  return ents.some(e => (pl.color < 0 || e.slot === pl.color) && Math.abs(e.y + e.h - pl.y) < 1.5 && e.x < pl.x + pl.w && e.x + e.w > pl.x);
}
function updSignals(g, dt) {
  const S = g.S, live = g.players.filter(alive);
  const hold = {}, andAll = {}, andAny = {};
  g.plateDefs.forEach((pl, i) => {
    const on = pressing(g, pl); if (on && !S.plates[i]) fx(g, 'plate', pl.x + 10, pl.y, 1); if (!on && S.plates[i]) fx(g, 'plate', pl.x + 10, pl.y, 0);
    S.plates[i] = on ? 1 : 0; const sg = S.sig[pl.sig];
    if (pl.and) { andAny[pl.sig] = true; andAll[pl.sig] = (andAll[pl.sig] !== false) && on; }
    else if (pl.timer) { if (on) sg.tmr = pl.timer; }
    else if (on) hold[pl.sig] = true;
  });
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
function ridersOf(g, plat) { let n = 0; for (const p of g.players) if (alive(p) && p.on && baseOf(p) === plat) n++; return n; }
function nonRiderBlock(g, plat, nx, ny) {
  const r = { x: nx, y: ny, w: plat.w, h: plat.h };
  for (const p of g.players) if (alive(p) && p.on !== plat && ov(p, r)) return true;
  for (let i = 0; i < g.S.crates.length; i++) if (g.crateOn[i] !== plat && ov(g.S.crates[i], r)) return true;
  return false;
}
function aboardRaft(g, r) { return g.players.filter(p => alive(p) && p.x + p.w > r.x + 1 && p.x < r.x + r.w - 1 && p.y + p.h <= r.y + 0.6 && p.y + p.h >= r.y - 80); }
function updMovers(g, dt) {
  const S = g.S;
  S.lifts.forEach((l, i) => {
    const d = g.liftDefs[i], dist = Math.hypot(d.x2 - d.x, d.y2 - d.y) || 1, need = d.need === 0 ? 0 : needOf(g, d.need);
    l.r = ridersOf(g, l) + S.crates.filter((c, ci) => g.crateOn[ci] === l).length; l.needN = need;
    const u0 = l.u;
    if (need === 0) { if (l.pause > 0) l.pause -= dt; else { l.u += l.dir * d.spd / dist * dt; if (l.u >= 1 || l.u <= 0) { l.u = clamp(l.u, 0, 1); l.dir *= -1; l.pause = 0.7; } } }
    else { const go = d.exact ? l.r === need : l.r >= need; if (go) { l.u = approach(l.u, 1, d.spd / dist * dt); if (l.u >= 1) l.hold = 1.4; } else if (l.hold > 0 && l.u >= 1) l.hold -= dt; else l.u = approach(l.u, 0, d.spd / dist * dt); }
    const nx = d.x + (d.x2 - d.x) * l.u, ny = d.y + (d.y2 - d.y) * l.u;
    if (nonRiderBlock(g, l, nx, ny)) { l.u = u0; l.dx = l.dy = 0; return; }
    l.dx = nx - l.x; l.dy = ny - l.y; l.x = nx; l.y = ny;
  });
  S.rafts.forEach((r, i) => {
    const d = g.raftDefs[i], ab = aboardRaft(g, r), all = g.players.filter(alive).length; r.n = ab.length;
    let dir = 0; if (ab.length && ab.length === all) { const d0 = ab[0].input.x; if (d0 && ab.every(p => p.input.x === d0)) dir = d0; }
    const lo = Math.min(d.x, d.x2), hi = Math.max(d.x, d.x2);
    const nx = clamp(r.x + dir * RAFT * dt, lo, hi);
    r.dx = nx - r.x; r.mv = r.dx ? dir : 0; r.x = nx; r.dy = 0;
    for (const p of ab) { p.row = r.mv ? 0.25 : Math.max(0, p.row - dt); if (r.dx && p.on !== r) move(g, p, r.dx, 'x'); }
  });
  S.crush.forEach((c, i) => {
    const d = g.crushDefs[i], T = crushTiming(d); let ny;
    if (d.sig && S.sig[d.sig].on) ny = Math.max(d.y, c.y - 45 * dt);
    else { c.ct += dt; const { ph } = crushPhase(g, i); let u; if (ph < T.waitT) u = 0; else if (ph < T.waitT + T.dropT) u = (ph - T.waitT) / T.dropT; else if (ph < T.waitT + T.dropT + T.waitB) u = 1; else u = 1 - (ph - T.waitT - T.dropT - T.waitB) / T.riseT; ny = d.y + u * d.drop; }
    const r = { x: c.x, y: ny, w: c.w, h: c.h };
    for (const cr of S.crates) if (ov(cr, r) && ny > c.y) ny = Math.min(ny, cr.y - c.h);
    if (ny > c.y + 0.01) { r.y = ny; for (const p of g.players) if (alive(p) && p.on !== c && ov(p, r)) { if (p.grounded || p.y > c.y + c.h - 4) kill(g, p, 'crush'); else move(g, p, ny + c.h - p.y, 'y'); } if (ny - c.y > 1.5 && ny >= d.y + d.drop - 0.01 && c.y < d.y + d.drop - 0.01) fx(g, 'slam', c.x + c.w / 2, ny + c.h); }
    else if (ny < c.y - 0.01 && nonRiderBlock(g, c, c.x, ny)) ny = c.y;
    c.dy = ny - c.y; c.y = ny; c.dx = 0;
  });
  S.bals.forEach((b, i) => {
    const d = g.balDefs[i]; let wa = ridersOf(g, b.pans[0]), wb = ridersOf(g, b.pans[1]);
    S.crates.forEach((c, ci) => { if (g.crateOn[ci] === b.pans[0]) wa += g.crateDefs[ci].wt; if (g.crateOn[ci] === b.pans[1]) wb += g.crateDefs[ci].wt; });
    b.wa = wa; b.wb = wb;
    const o0 = b.o; b.o = approach(b.o, clamp((wa - wb) * d.unit, -d.max, d.max), 45 * dt);
    const ya = d.ay + b.o, yb = d.by - b.o;
    if (nonRiderBlock(g, b.pans[0], b.pans[0].x, ya) || nonRiderBlock(g, b.pans[1], b.pans[1].x, yb)) { b.o = o0; b.pans[0].dy = b.pans[1].dy = 0; return; }
    b.pans[0].dy = ya - b.pans[0].y; b.pans[1].dy = yb - b.pans[1].y; b.pans[0].y = ya; b.pans[1].y = yb;
  });
  S.bridges.forEach((b, i) => {
    const d = g.bridgeDefs[i]; b.n = ridersOf(g, b); b.dy = 0;
    if (b.st === 0 && b.n > d.max) { b.st = 1; b.tmr = 0.18; fx(g, 'crack', b.x + b.w / 2, b.y); }
    else if (b.st === 1) { b.tmr -= dt; if (b.tmr <= 0) { b.st = 2; b.tmr = 2.6; b.vy = 0; fx(g, 'break', b.x + b.w / 2, b.y); } }
    else if (b.st === 2) { b.vy += G * dt; b.y += b.vy * dt; b.tmr -= dt; if (b.tmr <= 0) { b.st = 0; b.y = d.y; } }
  });
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
    const gr = groundOf(g, c); g.crateOn[i] = gr.find(r => r.isLift || r.isPan || r.isBridge || r.isCrate || r.isRaft || r.isCrush) || null;
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
  g.noWalls = true;
  if (p.x < S.wl) { move(g, p, S.wl - p.x, 'x'); if (p.x < S.wl - 1 && g.flags.scroll) { g.noWalls = false; kill(g, p, 'squash'); return; } }
  if (p.x + p.w > S.wr) move(g, p, S.wr - p.x - p.w, 'x');
  g.noWalls = false;
  if (p.on && p.on.dx) move(g, p, p.on.dx, 'x');
  if (p.on && p.on.dy > 0) move(g, p, p.on.dy, 'y');
  const rowing = p.row > 0;
  const gr0 = p.grounded ? groundOf(g, p) : [];
  const onIce = gr0.length > 0 && gr0.every(r => r.ch === '=');
  const ix = rowing ? 0 : inp.x;
  p.vx = approach(p.vx, ix * SPEED, (p.grounded ? (onIce ? 140 : 1000) : 650) * dt); if (inp.x) p.face = inp.x;
  if (inp.jumpP) p.buffer = 0.12; else p.buffer -= dt;
  p.coyote = p.grounded ? 0.09 : p.coyote - dt;
  const loaded = g.players.some(o => o !== p && o.on === p && alive(o));
  if (p.buffer > 0 && p.coyote > 0 && loaded && inp.jumpP) { p.squash = 0.6; fx(g, 'strain', p.x + 5, p.y + 14, p.slot); }
  if (p.buffer > 0 && p.coyote > 0 && !loaded) { p.vy = -JUMP; p.buffer = 0; p.coyote = 0; p.grounded = false; p.cut = false; p.squash = -1; fx(g, 'jump', p.x + 5, p.y + 14, p.slot); flipToggle(g); }
  if (!inp.jump && p.vy < 0 && !p.cut) { p.vy *= 0.5; p.cut = true; }
  p.vy = Math.min(p.vy + G * dt, MAXFALL);
  for (const f of g.fanDefs) {
    if (f.sig && !S.sig[f.sig].on) continue;
    const top = f.y - f.h;
    if (p.x + p.w > f.x + 1 && p.x < f.x + f.w - 1 && p.y + p.h > top && p.y < f.y) { const str = 1500 * clamp((p.y + p.h - top) / 40, 0, 1); p.vy = Math.max(-150, p.vy - str * dt); p.cut = true; }
  }
  const hx = move(g, p, p.vx * dt, 'x'); if (hx && !hx.isCrate && !hx.isPlayer) p.vx = 0;
  const vyb = p.vy, wasG = p.grounded;
  const hy = move(g, p, p.vy * dt, 'y');
  if (hy) { if (vyb > 0 && hy.ch === 'o') { p.vy = -SPRING; p.cut = true; p.squash = -1; fx(g, 'spring', hy.x + 5, hy.y, p.slot); } else p.vy = 0; }
  const gr = groundOf(g, p);
  p.grounded = gr.length > 0 && p.vy >= 0;
  p.on = p.grounded ? (gr.find(PLAT) || null) : null;
  if (p.grounded) {
    const belt = beltOf(gr); if (belt) move(g, p, belt * dt, 'x');
    for (const r of gr) if (r.ch === '%') { const k = Math.floor(r.y / TS) * g.W + Math.floor(r.x / TS); if (S.crumb[k][0] === 0) { S.crumb[k] = [1, 0.6]; fx(g, 'crumble', r.x + 5, r.y); } }
  }
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
  const S = g.S, k = S.key, live = g.players.filter(alive);
  if (!k.used) {
    const car = g.players.find(p => p.slot === k.carrier);
    if (car && alive(car)) {
      const tx = car.x + 5, ty = car.y - 8; k.x += (tx - k.x) * Math.min(1, dt * 14); k.y += (ty - k.y) * Math.min(1, dt * 14);
      if (g.flags.pass && car.input.downP && !ov(car, g.door)) { const near = { x: car.x - 3, y: car.y - 3, w: car.w + 6, h: car.h + 6 }; const to = live.find(p => p !== car && ov(p, near)); if (to) { k.carrier = to.slot; fx(g, 'pass', to.x + 5, to.y, to.slot); } }
    } else { k.carrier = -1; k.x += (g.keyHome.x - k.x) * Math.min(1, dt * 4); k.y += (g.keyHome.y - k.y) * Math.min(1, dt * 4);
      const kb = { x: k.x - 7, y: k.y - 6, w: 14, h: 13 }; const c = live.find(p => ov(p, kb)); if (c) { k.carrier = c.slot; fx(g, 'key', k.x, k.y, c.slot); } }
    const c2 = g.players.find(p => p.slot === k.carrier);
    if (c2 && alive(c2) && ov(c2, g.door)) { k.used = true; k.carrier = -1; S.door.open = true; fx(g, 'door', g.door.x + 10, g.door.y + 8); if (g.flags.doorSig) S.sig[g.flags.doorSig].latched = true; }
  }
  if (S.door.open) { S.door.t = Math.min(1, S.door.t + dt * 3); for (const p of live) if (p.input.downP && ov(p, g.door)) { p.inside = true; fx(g, 'enter', g.door.x + 10, g.door.y + 12, p.slot); } }
  if (!S.won && g.players.length && g.players.every(p => p.inside)) { S.won = true; fx(g, 'win', S.cam + VW / 2, 60); }
}

// ---------- client-side prediction of one player (online play) ----------
// world: a game object whose S and other players come from the latest server snapshot.
function predictStep(world, p, dt) {
  const S = world.S;
  for (const l of S.lifts) { l.x += l.dx; l.y += l.dy; }
  for (const r of S.rafts) r.x += r.dx;
  for (const c of S.crush) c.y += c.dy;
  for (const b of S.bals) for (const pn of b.pans) pn.y += pn.dy;
  S.t += dt; if (S.flipCd > 0) S.flipCd -= dt;
  updPlayer(world, p, dt);
  p.input.jumpP = false; p.input.downP = false;
}

// ---------- networking helpers ----------
function snapshot(g) {
  return { li: g.li, n: g.n, S: g.S, P: g.players.map(p => ({ slot: p.slot, x: p.x, y: p.y, vx: p.vx, vy: p.vy, face: p.face, gr: p.grounded, sq: p.squash, an: p.anim, dead: p.dead, ins: p.inside, bl: p.blinkT, row: p.row, q: p.q, m: p.m, co: p.coyote, bu: p.buffer, cut: p.cut })), fx: g.fx.splice(0) };
}
const round2 = (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
function serialize(g) { return JSON.stringify(snapshot(g), round2); }
function applySnapshot(g, snap) {
  g.S = snap.S;
  const slots = new Set(snap.P.map(p => p.slot));
  g.players = g.players.filter(p => slots.has(p.slot));
  for (const q of snap.P) {
    let p = g.players.find(o => o.slot === q.slot);
    if (!p) { p = { slot: q.slot, w: PW, h: PH, isPlayer: true, input: { x: 0, jump: false, jumpP: false, downP: false } }; g.players.push(p); g.players.sort((a, b) => a.slot - b.slot); }
    Object.assign(p, { x: q.x, y: q.y, vx: q.vx, vy: q.vy, face: q.face, grounded: q.gr, squash: q.sq, anim: q.an, dead: q.dead, inside: q.ins, blinkT: q.bl, row: q.row || 0, q: q.q, m: q.m, coyote: q.co, buffer: q.bu, cut: q.cut, on: null });
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

const api = { MAXP, TS, VW, VH, ROWS, STEP, PW, PH, LEVELS, THEMES, createGame, compile, adapt, reset, step, camera, addPlayer, removePlayer, place, snapshot, serialize, applySnapshot, setInput, clearEdges, sawPos, crushPhase, tileRect, ov, needOf, predictStep, SH };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HP = api;
})(typeof window !== 'undefined' ? window : globalThis);
