# Huddle Peak

A co-op pixel platformer for 2–8 players. You stack on each other, push crates together, hold doors and carry a key to the exit, and if anyone dies, everyone restarts.

It has 50 levels across 10 worlds, local play (up to 4 people on one keyboard plus up to 4 gamepads) and online rooms of up to 8 with a lobby.

| World | Levels |
|---|---|
| 1. Snowpeak | Stack up · Heavy lifting · Hold the door · Red light · Thin ice |
| 2. Autumn Woods | Tied together · All aboard · Balance · Springtime · Head count |
| 3. Crystal Caves | Colour code · Lights out · Spread out · Flip-flop · Short leash |
| 4. Sky Ruins | Moving day · Updraft · Relay · Heavy duty · Storm chase |
| 5. Ember Forge | Row together · Conveyor · Crushers · The climb · The peak |

## Teamwork that scales with the team

Every level is rebuilt for the number of players (2 to 8). If someone joins or leaves mid-level, the level restarts with the new layout:

- **Walls:** two players can stack 4 tiles high and three can stack 5, so walls and key shelves grow with the team.
- **Crates:** marked crates need everyone pushing.
- **Buttons:** "everyone on a button at once" doors get one button per player, spread across the level (eight far-apart buttons in Spread out with a full team).
- **Exact-count platforms:** the numbers change with the team size (2, 3 or 4 riders).
- **Lifts and rafts:** friends standing on a rider's head count as riders, so big teams can huddle onto a lift by stacking. Rafts get wider for teams over 6.
- **Colour roles:** pink and yellow get their own jobs when they're playing; with 5 to 8 players, purple, green, blue and white each have a colour button only they can press.
- **Spawning:** anyone who doesn't fit on the start ledge appears standing on a friend's head.

The camera follows everyone and zooms out as the team spreads, including on the tall levels (Spread out, The climb).

## Puzzle rooms

Most levels end with one or two teamwork rooms before the exit:

- **Held gate:** a button on each side; someone holds it so the others can cross, then gets let through.
- **Crate bridge:** a gap too wide to jump; everyone pushes the big crate in to fill it.
- **Everyone's buttons:** one per player, all at once; one is on a pillar that needs a boost.
- **Douse the fire:** a fire wall you can't jump; someone is boosted onto a ledge to hold the button that puts it out, and a button past the fire brings them across.
- **Numbered switches:** press 1, 2, 3, 4 in order with barely a second between presses. They're too far apart to run, so everyone takes one and you count it out.
- **Keep moving:** a bridge over spikes that only holds while someone runs left on a treadmill; a second treadmill on the far side brings the runner over.
- **Squash the slime:** a slime patrols a tunnel too low to jump it in, so the team pushes a crate through and flattens it.
- **Bounce pad:** a big slime walks under a high ledge. Bounce off its head to reach the button that holds the gate; a button past the gate lets the bouncer through.
- **Lean on me:** a platform over lava drifts toward whichever side has more weight. Spread out to stop it before the fire, then lean together to cross while it's out.
- **Pass it up:** with a heavy key the carrier can't jump, so the key goes up a stack of friends (press down next to one).

Spread out is now a dark cavern lit by torches.

## Enemies and keys

- **Slimes** patrol back and forth. Touching their side ends the run; landing on their head bounces you higher than any jump. Spiky purple slimes hurt from every side. Crates flatten them, and they freeze on red light.
- **Runaway key:** in some levels the key scampers away from you and hops over a lone chaser. Trap it between two players to grab it.
- **Heavy key:** in Heavy duty you can't jump while carrying it, and you walk slower. Pass it to friends to get it up steps.

New levels: **Slime time** (world 3) and **Lean on me** (world 4) replace Short leash and Moving day.

## Worlds 6 to 10

Fifty levels in ten worlds. The last five worlds each bring in mechanics of their own:

- **Frostbite Summit:** seesaw catapults (jump from the pillar onto one end to launch whoever stands on the other up a cliff) and melting ice floes (they melt faster the more people stand on them).
- **Haunted Hollow:** searchlights (anyone moving in the beam is caught; freeze, or hide under cover) and twin keys (the door needs two keys, carried by two different players).
- **Glimmer Depths:** bomb relays. The fuse is too short to carry a bomb to the cracked wall alone, so pass it down the line (press down next to a friend).
- **Thunder Spires:** cannons. Press down to climb in; someone holds the button to aim it across, and a lever on the far side locks the aim for the last one.
- **Molten Core:** rising lava. Climb, ride the lifts and launch each other up before it catches you.

These levels are built from rooms (`chain()` in `game.js`), and every room is checked at 2, 3, 5 and 8 players by `test/mech7.js`.

## Online lag

Your own climber is predicted on your machine, so it responds instantly. The server's answer corrects it smoothly, and other players are shown about 70 ms in the past so they move smoothly. To test with fake lag, run `LAG_MS=60 node server.js`, which adds 60 ms each way.

## Display

The game fills the whole browser window at any shape. Wider windows show a little more of the level to the sides; taller windows show more above and below. Press **F** for true fullscreen. The pixel art is scaled sharply, so it stays crisp when the camera zooms out. On a computer that draws in software instead of on the graphics card, the game automatically switches to a cheaper scaling mode to keep the frame rate up.

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

- `public/game.js` is the game simulation and all 50 levels. The server and the browser share it.
- `public/art.js` paints the pixel art in code: layered backgrounds for each world and the terrain for each level, built once and cached.
- `public/index.html` draws the live game full-window, and handles sound, menus, the lobby and input.
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
