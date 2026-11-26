// Huddle Peak online server. No dependencies: plain Node http + a tiny WebSocket implementation.
// Run: node server.js   (PORT env var is respected, e.g. on Render)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const HP = require('./public/game.js');
const PORT = process.env.PORT || 3000;
const LAG = +process.env.LAG_MS || 0; // testing only: simulate network delay each way
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---------- minimal WebSocket (RFC 6455, text frames) ----------
function wsAccept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.url || '').split('?')[0] !== '/ws') { socket.destroy(); return null; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  socket.setNoDelay(true);
  const ws = { socket, open: true, onmessage: null, onclose: null, buf: Buffer.alloc(0) };
  ws.send = (str) => {
    if (!ws.open) return;
    const data = Buffer.from(str), len = data.length; let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x81;
    try { socket.write(Buffer.concat([head, data])); } catch (e) { close(); }
  };
  const ctrl = (op, payload) => { const p = payload || Buffer.alloc(0); try { socket.write(Buffer.concat([Buffer.from([0x80 | op, p.length]), p])); } catch (e) {} };
  ws.ping = () => ctrl(0x9);
  function close() { if (!ws.open) return; ws.open = false; try { ctrl(0x8); socket.end(); } catch (e) {} if (ws.onclose) ws.onclose(); }
  ws.close = close;
  let frag = [];
  socket.on('data', chunk => {
    ws.buf = Buffer.concat([ws.buf, chunk]);
    while (ws.buf.length >= 2) {
      const b0 = ws.buf[0], b1 = ws.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (ws.buf.length < 4) return; len = ws.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (ws.buf.length < 10) return; len = Number(ws.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { close(); return; }
      const mOff = off; if (masked) off += 4;
      if (ws.buf.length < off + len) return;
      let payload = ws.buf.slice(off, off + len);
      if (masked) { const m = ws.buf.slice(mOff, mOff + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      ws.buf = ws.buf.slice(off + len);
      if (op === 0x8) { close(); return; }
      if (op === 0x9) { ctrl(0xA, payload); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x0) { frag.push(payload); if (fin) { const text = Buffer.concat(frag).toString('utf8'); frag = []; if (ws.onmessage) ws.onmessage(text); } }
    }
  });
  socket.on('close', close); socket.on('error', close); socket.on('end', close);
  return ws;
}

// ---------- rooms ----------
const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() { let c; do { c = ''; for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (rooms.has(c)); return c; }
const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || 'Climber';

function roomMsg(room, c) {
  return JSON.stringify({ t: 'room', code: room.code, you: c.slot, host: room.host, state: room.state, level: room.level, done: [...room.done],
    players: [...room.clients].map(k => ({ slot: k.slot, name: k.name, host: k.slot === room.host })).sort((a, b) => a.slot - b.slot) });
}
function broadcastRoom(room) { for (const c of room.clients) c.ws.send(roomMsg(room, c)); }
function startLevel(room, li) {
  li = Math.max(0, Math.min(HP.LEVELS.length - 1, li | 0));
  room.level = li; room.state = 'play'; room.game = HP.createGame(li, room.clients.size); room.wonSent = false;
  for (const c of [...room.clients].sort((a, b) => a.slot - b.slot)) HP.addPlayer(room.game, c.slot);
  room.game.fx.length = 0;
  broadcastRoom(room);
}
function toLobby(room) { room.state = 'lobby'; room.game = null; broadcastRoom(room); }
function leave(c) {
  const room = c.room; if (!room) return; c.room = null;
  room.clients.delete(c);
  if (room.game) HP.removePlayer(room.game, c.slot);
  if (!room.clients.size) { rooms.delete(room.code); return; }
  if (room.host === c.slot) room.host = Math.min(...[...room.clients].map(k => k.slot));
  broadcastRoom(room);
}
function join(c, room, name) {
  if (room.clients.size >= HP.MAXP) return c.ws.send(JSON.stringify({ t: 'err', msg: 'That room is full (' + HP.MAXP + ' players max)' }));
  const used = new Set([...room.clients].map(k => k.slot));
  c.slot = [...Array(HP.MAXP).keys()].find(s => !used.has(s)); c.name = clean(name); c.room = room; room.clients.add(c);
  if (room.host == null) room.host = c.slot;
  if (room.game) HP.addPlayer(room.game, c.slot);
  broadcastRoom(room);
}

server.on('upgrade', (req, socket) => {
  const ws = wsAccept(req, socket); if (!ws) return;
  if (LAG) { const raw = ws.send; ws.send = (str) => setTimeout(() => raw(str), LAG); }
  const c = { ws, room: null, slot: -1, name: '', lastMsg: Date.now(), n: 0, win: Date.now() };
  ws.onmessage = (text) => { if (LAG) return void setTimeout(() => handle(text), LAG); handle(text); };
  const handle = (text) => {
    // simple flood guard: max 120 messages per second
    const now = Date.now(); if (now - c.win > 1000) { c.win = now; c.n = 0; } if (++c.n > 120) return;
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = c.room, isHost = room && room.host === c.slot;
    switch (m.t) {
      case 'create': if (room) return; { const r = { code: newCode(), clients: new Set(), host: null, state: 'lobby', level: 0, done: new Set(), game: null, tick: 0 }; rooms.set(r.code, r); join(c, r, m.name); } break;
      case 'join': { if (room) return; const r = rooms.get(String(m.code || '').toUpperCase()); if (!r) return ws.send(JSON.stringify({ t: 'err', msg: 'No room with that code' })); join(c, r, m.name); } break;
      case 'pick': if (isHost && room.state === 'lobby') { room.level = Math.max(0, Math.min(HP.LEVELS.length - 1, m.level | 0)); broadcastRoom(room); } break;
      case 'start': if (isHost) startLevel(room, m.level); break;
      case 'restart': if (isHost && room.game) startLevel(room, room.level); break;
      case 'lobby': if (isHost) toLobby(room); break;
      case 'in': if (room && room.game) HP.setInput(room.game, c.slot, Math.max(-1, Math.min(1, m.x | 0)), !!m.j, !!m.d, m.q | 0); break;
      case 'emote': if (room && Date.now() - (c.lastEmote || 0) > 350) { c.lastEmote = Date.now(); const out = JSON.stringify({ t: 'emote', slot: c.slot, i: Math.max(0, Math.min(15, m.i | 0)) }); for (const k of room.clients) k.ws.send(out); } break;
      case 'ping': ws.send(JSON.stringify({ t: 'pong', c: m.c })); break;
      case 'leave': leave(c); break;
    }
  };
  ws.onclose = () => leave(c);
});

// ---------- simulation loop ----------
const TICK = 1000 / 60;
let lastT = Date.now(), acc = 0;
setInterval(() => {
  const now = Date.now(); acc += Math.min(250, now - lastT); lastT = now;
  let steps = 0;
  while (acc >= TICK) { acc -= TICK; steps++; }
  if (!steps) return;
  for (const room of rooms.values()) {
    if (room.state !== 'play' || !room.game) continue;
    const g = room.game;
    for (let s = 0; s < steps * 2; s++) { HP.step(g, HP.STEP); HP.clearEdges(g); }
    if (g.S.won && !room.wonSent) { room.wonSent = true; room.done.add(room.level); }
    room.tick += steps;
    if (room.tick >= 2) { room.tick = 0; const msg = '{"t":"s","d":' + HP.packSnap(g) + '}'; for (const c of room.clients) c.ws.send(msg); }
  }
}, TICK / 2);
setInterval(() => { for (const room of rooms.values()) for (const c of room.clients) c.ws.ping(); }, 20000);

server.listen(PORT, () => console.log('Huddle Peak server on http://localhost:' + PORT));
