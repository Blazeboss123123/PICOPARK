# Huddle Peak

A co-op pixel platformer for 2–4 players. You stack on each other, push crates together, hold doors and carry a key to the exit, and if anyone dies, everyone restarts.

It has 25 levels across 5 worlds, local play (shared keyboard or gamepads) and online rooms with a lobby.

| World | Levels |
|---|---|
| 1. Snowpeak | Stack up · Heavy lifting · Hold the door · Red light · Thin ice |
| 2. Autumn Woods | Tied together · All aboard · Balance · Springtime · Head count |
| 3. Crystal Caves | Colour code · Lights out · Spread out · Flip-flop · Short leash |
| 4. Sky Ruins | Moving day · Updraft · Relay · Heavy duty · Storm chase |
| 5. Ember Forge | Row together · Conveyor · Crushers · The climb · The peak |

## Teamwork that scales with the team

Every level is rebuilt for the number of players (2, 3 or 4). If someone joins or leaves mid-level, the level restarts with the new layout:

- **Walls:** two players can stack 4 tiles high and three can stack 5, so walls and key shelves grow with the team.
- **Crates:** marked crates need everyone pushing.
- **Buttons:** "everyone on a button at once" doors get one button per player, spread across the level.
- **Exact-count platforms:** the numbers change with the team size.
- **Colour roles:** pink and yellow get their own jobs when they're playing.

The camera follows everyone and zooms out as the team spreads, including on the tall levels (Spread out, The climb).

## Online lag

Your own climber is predicted on your machine, so it responds instantly. The server's answer corrects it smoothly, and other players are shown about 70 ms in the past so they move smoothly. To test with fake lag, run `LAG_MS=60 node server.js`, which adds 60 ms each way.

## Run it locally

```
node server.js
```

Open http://localhost:3000. You need Node 18 or newer, and there are no packages to install.

## Put it online (Render)

1. Push this folder to a GitHub repo.
2. On Render, choose **New → Web Service** and pick the repo.
3. Use these settings:
   - Runtime: **Node**
   - Build command: *(leave empty)*
   - Start command: `node server.js`
   - Instance type: Free is fine
4. Deploy, then share the `https://…onrender.com` link with friends.

On the free tier the server sleeps after about 15 minutes with no visitors, so the first load can take up to a minute while it wakes up.

## How online play works

- One player clicks **Play online → Create a room** and gets a 4-letter code.
- Friends open the same link, choose **Play online**, type the code and click **Join**.
- The host picks the level and starts it. During a game, the host can press Esc to restart the level or go back to the lobby.
- The server runs the game and sends everyone the result 30 times a second, so all players see the same thing.
- If the host leaves, the next player becomes host.

## Files

- `public/game.js` is the game simulation and all 25 levels. The server and the browser share it.
- `public/index.html` handles drawing (640×360 pixel art, generated in code), sound, menus, the lobby and input.
- `server.js` is the web server, the WebSocket code (hand-written, no packages) and the rooms.
- `test/` holds the automated puzzle, traversal and team-size checks. Run them with `npm test`.
- `build-standalone.js` builds a single offline HTML file in `dist/` (local play only).

## Adding a level

Levels live in the `LEVELS` array in `public/game.js`. Each one is built from the tile helpers there: ground, pits, stairs, plates, gates, crates, lifts and so on. Each tile is 10 px, the screen is 32 × 18 tiles, and the level is as wide as you set it.

Tile codes: `#` rock, `^` spikes or lava, `-` one-way plank, `=` ice, `<` `>` conveyor belts, `[` `]` red and blue flip blocks, `%` crumbling block, `o` spring, `1`–`4` walls only that player can pass, `a`–`e` blocks that appear when a signal turns on, and `A`–`E` gates that open when it does.

For reference:

- One player can jump about 3 tiles high.
- Two stacked players can reach 4 tiles high.
- A player can jump across a gap of up to 4 tiles.
