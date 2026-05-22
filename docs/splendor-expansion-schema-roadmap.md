# Splendor Expansion Schema and Converter Roadmap

This document defines the BoardReplayLab work required before ZephyrLabs Gem
Table can safely import, replay, and export Splendor expansion data.

Supported repositories:

- Gem Table frontend: `fffire-oss/Personal-homepage`
- BoardReplayLab converters: `Haro-stack/BoardReplayLab`
- DinoBoard reference: `Haro-stack/DinoBoard`

Target modules:

- Silk Road: Cities + Trading Posts.
- The Sun Never Sets: Orient + Strongholds.

## Ground Rules

- Do not commit directly to `main`.
- Every slice uses a branch, a focused commit, and a draft PR.
- Every slice has a linked issue with acceptance criteria.
- Final merge remains manual.
- Converter behavior must be fixture-driven before the frontend imports active
  expansion captures.

## Current Converter State

BoardReplayLab currently has:

- `zephyrlabs-bga-replay-crawler-v1`: browser-visible BGA capture.
- `zephyrlabs-gemtable-bga-v1`: base Gem Table replay.
- `dinoboard-splendor2p-wire-v1`: base 2P DinoBoard observation wire data.

Current limitations:

- Active BGA expansion flags are rejected.
- BGA converter and frontend converter are duplicated.
- DinoBoard v1 snapshot assumes base 2P Splendor:
  - `tableau: 3 x 4`
  - `reserved: 2 x 3`
  - `nobles: 3`
  - fixed action ids `0..69`
- DinoBoard reverse conversion requires framed replay input and cannot rebuild
  a full Gem Table state from `action_history` alone.

## Proposed Schema Direction

Do not overload the current v1 schema. Add a versioned v2 contract:

```json
{
  "schema": "zephyrlabs-gemtable-splendor-v2",
  "ruleset": {
    "game": "splendor",
    "rules_version": "2025",
    "module_set": "base",
    "modules": {
      "cities": false,
      "trading_posts": false,
      "orient": false,
      "strongholds": false
    }
  },
  "gamedatas": {
    "source_state": {}
  },
  "moves": []
}
```

Recommended state additions:

- `objectives.cities[]`: city tiles, requirements, claim metadata.
- `trading_posts.board[]`: post definitions, requirements, effects.
- `players[].trading_posts[]`: owned post ids.
- `market_slots[]`: stable slot references for base and Orient markets.
- `decks.base[tier]` and `decks.orient[tier]`.
- `cards[].set`: `base`, `orient`, or other future set id.
- `cards[].ability`: structured Orient ability metadata.
- `strongholds.positions[]`: player marker positions by market slot ref.
- `pending_effect`: post-action choice state for Orient, Trading Posts, and
  Strongholds.
- `events[]`: animation-friendly normalized events.

## BGA Capture Requirements

Before active import is enabled, capture and store representative fixtures for:

- Base game.
- Cities only.
- Trading Posts only.
- Silk Road combined.
- Orient only.
- Strongholds only.
- The Sun Never Sets combined.

Each fixture should include:

- raw crawler JSON
- reduced anonymized fixture JSON
- expected compatibility detection
- expected normalized Gem Table replay fragment

The converter must distinguish:

- inactive expansion fields such as `isCitiesActivate: false`
- descriptive text such as "Silk Road" in a tile name
- real active expansion flags such as `isCitiesActivate: true`

## Converter Small Slices

### Slice A: Base Fixture Contract

Goal: make current base conversion testable.

Scope:

- Add minimal fixture helpers.
- Add one BGA base replay fixture or reduced fixture.
- Assert buy, reserve, take, return, noble claim, and game end moves.
- Assert frontend-compatible Gem Table replay fields.

Acceptance criteria:

- `npm run check` runs fixture tests.
- Converter output contains stable `market_index`, `reserved_index`, and
  `noble_slot` where possible.
- `takeTokens` uses a consistent count-object representation or a documented
  adapter.

### Slice B: Shared Compatibility Detection

Goal: make expansion detection explicit and non-lossy.

Scope:

- Keep disabled flags accepted.
- Return structured active module detection:
  `cities`, `trading_posts`, `orient`, `strongholds`, `silk_road`,
  `sun_never_sets`.
- Add clear rejection messages while v2 is not implemented.

Acceptance criteria:

- Active expansion fixtures fail with exact module reasons.
- Inactive fields and descriptive names do not fail.

### Slice C: Gem Table v2 Shell

Goal: introduce `zephyrlabs-gemtable-splendor-v2` without enabling gameplay.

Scope:

- Add ruleset metadata.
- Add v1 -> v2 adapter for base games.
- Add v2 -> v1 fallback only for pure base games.
- Document compatibility with the Personal-homepage frontend.

Acceptance criteria:

- Base v1 and v2 replay fixtures convert consistently.
- Active expansion data can be represented in schema without being playable.

### Slice D: Cities Converter

Goal: convert BGA Cities state and logs into Gem Table v2.

Scope:

- Parse city tiles from BGA gamedatas.
- Replace nobles with cities in objectives.
- Convert city claim/end-game notifications.
- Preserve city claim events for replay animation.

Acceptance criteria:

- Cities fixture imports into v2.
- Output has city requirements, claim metadata, and end trigger.
- Unsupported mixed effects are rejected clearly.

### Slice E: Trading Posts Converter

Goal: convert BGA Trading Posts state and power triggers.

Scope:

- Parse trading post board and player ownership.
- Normalize post unlock notifications.
- Normalize extra-token and reserve-choice effects.
- Add effect events for animation.

Acceptance criteria:

- Trading Posts fixture produces stable ownership and event stream.
- Silk Road combined fixtures preserve Cities + Trading Posts ordering.

### Slice F: Orient Converter

Goal: support Orient market/decks and card metadata.

Scope:

- Parse base and Orient market slots.
- Add Orient card catalog mapping.
- Normalize ability metadata.
- Convert visible market replacement events.

Acceptance criteria:

- Orient fixture preserves separate base and Orient slots.
- Ability data is structured even when specific ability execution remains
  frontend-unsupported.

### Slice G: Strongholds Converter

Goal: support stronghold positions and post-buy actions.

Scope:

- Parse stronghold supply and card positions.
- Normalize place, move, remove, and conquest events.
- Add market slot references that remain stable across card replacement.

Acceptance criteria:

- Strongholds fixture preserves marker ownership and positions.
- Event stream can drive frontend animation.

### Slice H: DinoBoard v2 Wire Contract

Goal: make DinoBoard data extensible beyond base 2P.

Scope:

- Add `dinoboard-splendor-wire-v2`.
- Replace fixed action ids with either:
  - versioned action catalog, or
  - per-frame `legal_actions[]` entries.
- Add module-aware snapshot fields:
  - `module_mask`
  - `market_slot_cards`
  - `market_slot_area`
  - `city_tiles`
  - `trading_posts`
  - `stronghold_counts`
  - `orient_effects`
  - `pending_effect`
- Preserve v1 for base 2P compatibility.

Acceptance criteria:

- Base 2P v1 output remains unchanged.
- v2 fixtures cover Cities, Trading Posts, Orient, and Strongholds state.
- Reverse conversion still rejects insufficient `action_history` inputs.

## Test Matrix

Each converter slice should include:

- syntax check
- reduced raw BGA fixture
- normalized Gem Table golden output
- replay round-trip where possible
- DinoBoard output shape test when relevant
- rejection tests for unsupported or incomplete inputs

Do not rely on production BGA calls in normal tests. Network crawling is manual
fixture collection, not CI validation.
