# BoardReplayLab

Local replay capture and format conversion tools for Splendor experiments.

This repository currently supports:

- Board Game Arena Splendor base-game replay capture.
- BGA capture -> ZephyrLabs Gem Table replay JSON.
- ZephyrLabs Gem Table replay JSON -> DinoBoard Splendor 2P observation wire JSON.
- Framed DinoBoard Splendor 2P replay JSON -> ZephyrLabs Gem Table replay shell.

Related projects:

- ZephyrLabs Gem Table: the personal-homepage Splendor table and replay viewer.
- DinoBoard: https://github.com/Haro-stack/DinoBoard

## Quick Start

Install dependencies:

```bash
npm install
npx playwright install chromium
```

Run syntax checks and bridge tests:

```bash
npm run check
```

## Capture BGA Replays

Capture a BGA replay in a local browser. The crawler opens the official review
page, enters the player replay page, waits for browser-visible
`gameui.gamedatas`, and exports the replay capture.

```bash
node scripts/bga-splendor-replay-crawler.mjs --table 854928957 --manual --wait-ms 300000
```

Convert the raw capture into Gem Table replay JSON:

```bash
node scripts/convert-splendor-capture.mjs --in bga-replays/bga-table-854928957-replay.json
```

Output files:

- Raw BGA browser capture: `bga-replays/bga-table-<tableId>-replay.json`
- Gem Table import file: `gemtable-replays/gemtable-bga-table-<tableId>-replay.json`

## Login Options

Manual login is the safest local mode. The crawler opens the official BGA review
page and waits while you sign in:

```bash
node scripts/bga-splendor-replay-crawler.mjs --table 854928957 --manual
```

For headless use, provide credentials through environment variables:

```powershell
$env:BGA_USERNAME="your-bga-username"
$env:BGA_PASSWORD="your-bga-password"
$env:BGA_WRITE_COOKIE_FILE=".bga-cookie-header"
node scripts/bga-splendor-replay-crawler.mjs --table 854928957 --headless
```

Then reuse the captured cookie:

```powershell
$env:BGA_COOKIE_FILE=".bga-cookie-header"
node scripts/bga-splendor-replay-crawler.mjs --table 854928957 --headless
```

Do not commit cookies, credentials, `.env` files, or raw private replay captures.

## Convert Gem Table and DinoBoard

Convert a Gem Table replay into DinoBoard Splendor 2P observation wire JSON:

```bash
node scripts/convert-dinoboard-splendor.mjs \
  --direction gemtable-to-dinoboard \
  --in gemtable-replays/gemtable-bga-table-854928957-replay.json \
  --ai-seat 1
```

Convert a framed DinoBoard replay into a Gem Table-compatible replay shell:

```bash
node scripts/convert-dinoboard-splendor.mjs \
  --direction dinoboard-to-gemtable \
  --in dinoboard-replays/framed-replay.json
```

The DinoBoard bridge is also exposed as an npm script:

```bash
npm run convert:dinoboard -- --direction gemtable-to-dinoboard --in gemtable-replays/example.json
npm run convert:dinoboard -- --direction dinoboard-to-gemtable --in dinoboard-replays/framed-replay.json
```

## Format Overview

### BGA Browser Capture

Raw BGA capture files use:

```json
{
  "schema": "zephyrlabs-bga-replay-crawler-v1",
  "table_id": "854928957",
  "snapshots": [],
  "responses": [],
  "compatibility": {}
}
```

Important fields:

- `snapshots[].gameui.gamedatas`: browser-visible initial state, including
  players, bank, market rows, card database, noble database, and expansion flags.
- `responses[].parsed_json.data.logs`: BGA archive notifications grouped by
  `move_id`.
- `compatibility`: crawler-side hints about unsupported expansions or variants.

This is not a private BGA protocol clone. It captures data visible to the
browser replay page and then normalizes it.

### ZephyrLabs Gem Table Schema

Gem Table replay files use:

```json
{
  "schema": "zephyrlabs-gemtable-bga-v1",
  "gamedatas": {
    "source_state": {}
  },
  "moves": []
}
```

Important fields:

- `gamedatas.source_state`: full initial Gem Table state.
- `moves[].type`: action type such as `takeTokens`, `buyMarket`,
  `reserveMarket`, `reserveDeck`, `buyReserved`, `discardToken`, or
  `chooseNoble`.
- `moves[].args`: action payload, including card ids, token costs, reserve
  metadata, and noble metadata when present.
- `moves[].state_after.source_state`: full state snapshot after the move.

The complete `source_state` snapshots are what make replay stepping, jumping,
and continue-from-replay possible.

### DinoBoard Splendor 2P Wire Schema

The DinoBoard bridge targets the DinoBoard project at
https://github.com/Haro-stack/DinoBoard. The emitted schema is:

```json
{
  "schema": "dinoboard-splendor2p-wire-v1",
  "game_id": "splendor_2p",
  "ai_seat": 1,
  "initial_observation": {
    "public_snapshot": {},
    "tracker_init": {}
  },
  "observations": []
}
```

The public snapshot uses a sparse walker-style representation:

```json
{
  "current_player": [[], 0],
  "scores": [[0], 3, [1], 5],
  "tableau": [[0, 0], 12, [0, 1], 4],
  "__viz__": {
    "reserved": [1, 1, 0, 1, 0, 0]
  }
}
```

Field conventions:

- Color order is `white`, `blue`, `green`, `red`, `black`.
- Token order is `white`, `blue`, `green`, `red`, `black`, `gold`.
- Card ids are DinoBoard zero-based catalog ids.
- Noble ids are DinoBoard zero-based noble catalog ids.
- `__viz__` marks which sparse fields are visible to the selected AI seat.
- Opponent blind reserves are masked unless a replay event reveals them.

Action id ranges:

| Range | Meaning |
| --- | --- |
| `0..11` | Buy visible market card: 3 tiers x 4 slots |
| `12..23` | Reserve visible market card: 3 tiers x 4 slots |
| `24..26` | Reserve blind from deck: tier 1..3 |
| `27..29` | Buy reserved card slot 0..2 |
| `30..39` | Take 3 different non-gold tokens |
| `40..49` | Take 2 different non-gold tokens |
| `50..54` | Take 1 non-gold token |
| `55..59` | Take 2 matching non-gold tokens |
| `60..62` | Choose noble slot 0..2 |
| `63..68` | Return token, including gold |
| `69` | Pass |

## Conversion Compatibility

### BGA -> Gem Table

The converter:

- Builds the initial state from BGA `gameui.gamedatas`.
- Uses BGA card and noble databases to map market, noble, bank, and player
  state.
- Converts grouped archive notifications into Gem Table moves.
- Maps BGA card ids to local Gem Table card ids by tier, color, points, and
  cost signature when ids differ.
- Treats disabled expansion fields such as `isCitiesActivate: false` as normal
  base-game metadata.
- Rejects active unsupported expansions, such as `isCitiesActivate: true`.

Known limitation: BGA does not expose all hidden future deck order through the
public browser replay data. Imported replay playback is stable because each
move carries a `state_after` snapshot, but continuing play after the imported
BGA replay may use a regenerated hidden deck for unknown future cards.

### Gem Table -> DinoBoard

The bridge:

- Requires exactly two players.
- Reads Gem Table `source_state` snapshots from the initial state and each
  replay move.
- Converts cards and nobles to DinoBoard catalog ids by deterministic
  signatures.
- Emits public snapshots from the selected `ai_seat` perspective.
- Masks opponent blind reserves through `__viz__`.
- Emits helper events such as `deck_flip`, `self_reserve_deck`, and
  `opp_buy_reserved_reveal`.

This direction is intended for AI observation, evaluation, and replay analysis.
It is not a full DinoBoard engine replacement.

### DinoBoard -> Gem Table

This direction requires framed DinoBoard replay input:

```json
{
  "frames": [
    { "public_snapshot": {} },
    { "move_id": 1, "actor": 0, "action_id": 30, "public_snapshot": {} }
  ]
}
```

`action_history` alone is rejected because it does not contain enough state to
rebuild Gem Table snapshots, hidden reserve visibility, market cards, nobles,
or bank state.

## Compatibility Rules

The BGA converter is intentionally strict about active expansions:

- `isCitiesActivate: false`, `isCitiesLastTurn: false`, and similar disabled
  flags are ignored.
- Descriptive text such as a noble description mentioning "Silk Road" is treated
  as a reference, not an active expansion.
- A real active expansion flag such as `isCitiesActivate: true` is rejected with
  an explicit error because Gem Table currently supports only base-game
  Splendor replay import.

Table `854928957` has been audited as base-game compatible under these rules:
it contains inactive Cities fields and a Silk Road description reference, but no
active expansion flag.

## Scripts

```bash
npm run check
npm run crawl:splendor -- --table 854928957 --manual
npm run convert:splendor -- --in bga-replays/bga-table-854928957-replay.json
npm run convert:dinoboard -- --direction gemtable-to-dinoboard --in gemtable-replays/example.json
npm run convert:dinoboard -- --direction dinoboard-to-gemtable --in dinoboard-replays/framed-replay.json
```
