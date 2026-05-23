# BoardReplayLab

BoardReplayLab is a replay capture and conversion lab for board-game data
pipelines. The repository is organized by game/module so the project can grow
beyond one table implementation.

## Modules

- [`splendor/`](splendor/): BGA Splendor replay capture, ZephyrLabs Gem Table
  conversion, and DinoBoard bridge formats.

Future modules should live in their own top-level folders with the same shape:

- `scripts/` for capture and conversion CLIs.
- `lib/` for reusable schema and converter code.
- `test/` for fixtures and compatibility checks.
- `README.md` for game-specific setup, schema notes, and caveats.

## Quick Start

Install dependencies from the repository root:

```bash
npm install
npx playwright install chromium
```

Run the current validation suite:

```bash
npm run check
```

## Splendor Tooling

Use the Splendor module when exporting BGA replay data for Gem Table or when
building DinoBoard-compatible training data:

```bash
npm run crawl:splendor -- --table 854928957 --manual
npm run convert:splendor -- --in bga-replays/bga-table-854928957-replay.json
```

See [`splendor/README.md`](splendor/README.md) for login options, output files,
schema overviews, BGA compatibility notes, DinoBoard bridge details, and the
current expansion support matrix.
