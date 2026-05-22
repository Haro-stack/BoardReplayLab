# BoardReplayLab

Local tools for capturing Board Game Arena replay data and converting supported
captures into replay JSON that ZephyrLabs Gem Table can import.

This repository currently targets **Splendor base-game replays**.

## Quick Start

Install dependencies:

```bash
npm install
npx playwright install chromium
```

Capture a BGA replay in a local browser. The crawler first opens the official
review page, then enters the player replay page and waits for browser-visible
`gameui.gamedatas` before exporting:

```bash
node scripts/bga-splendor-replay-crawler.mjs --table 854928957 --manual --wait-ms 300000
```

Convert the capture into Gem Table replay JSON:

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

## Compatibility Rules

The converter is intentionally strict about active expansions:

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

## Conversion Notes

The converted file uses the same top-level schema as Gem Table export:

```json
{
  "schema": "zephyrlabs-gemtable-bga-v1",
  "gamedatas": {},
  "moves": []
}
```

This is a schema-compatible replay conversion, not an official BGA protocol
clone. The crawler uses browser-visible `gameui.gamedatas` for the initial
market, card database, nobles, and bank, then uses archive notifications to
advance the replay. Hidden future deck order is still private to BGA, so
continuing play after an imported BGA replay may not match BGA's hidden deck.

## Scripts

```bash
npm run check
npm run crawl:splendor -- --table 854928957 --manual
npm run convert:splendor -- --in bga-replays/bga-table-854928957-replay.json
```
