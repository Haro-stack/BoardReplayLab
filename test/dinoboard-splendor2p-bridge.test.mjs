import assertModule from "assert";

import {
  DINOBOARD_MODULE_MASK_BITS,
  buildExpansionPublicSnapshot,
  buildPublicSnapshot,
  convertDinoBoardReplayToGemTable,
  convertGemTableReplayToDinoBoard,
  convertGemTableReplayToDinoBoardV2,
  decodeDinoAction,
  encodeGemTableMoveAction,
  gemTableCardToDinoId
} from "../lib/dinoboard-splendor2p-bridge.mjs";

const assert = assertModule.strict;

const blueStarter = {
  id: "fixture-blue-starter",
  tier: 1,
  color: "blue",
  points: 0,
  cost: { white: 0, blue: 0, green: 0, red: 0, black: 3 }
};
const redStarter = {
  id: "fixture-red-starter",
  tier: 1,
  color: "red",
  points: 0,
  cost: { white: 3, blue: 0, green: 0, red: 0, black: 0 }
};
const noble = {
  id: "fixture-noble",
  points: 3,
  requirements: { white: 0, blue: 0, green: 4, red: 4, black: 0 }
};

function player(id, extra = {}) {
  return Object.assign({
    id: String(id),
    name: `P${id}`,
    tokens: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
    bonuses: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
    reserved: [],
    purchased: [],
    nobles: []
  }, extra);
}

function state(overrides = {}) {
  return Object.assign({
    schema: "zephyrlabs-gemtable-bga-v1",
    next_move_id: 1,
    current: 0,
    bank: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 },
    decks: { 1: [], 2: [], 3: [] },
    market: { 1: [blueStarter, redStarter], 2: [], 3: [] },
    nobles: [noble],
    players: [player(0), player(1)],
    awaitingDiscard: false,
    awaitingNobleChoice: null,
    finalTurnsLeft: null,
    gameOver: false
  }, overrides);
}

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

test("maps Gem Table cards to DinoBoard's zero-based catalog", () => {
  assert.equal(gemTableCardToDinoId(blueStarter), 0);
});

test("encodes Splendor 2P action ranges", () => {
  assert.equal(encodeGemTableMoveAction({ type: "buyMarket", args: { tier: 1, market_index: 0 } }), 0);
  assert.equal(encodeGemTableMoveAction({ type: "buyMarket", args: { tier: 3, market_index: 3 } }), 11);
  assert.equal(encodeGemTableMoveAction({ type: "reserveMarket", args: { tier: 2, market_index: 1 } }), 17);
  assert.equal(encodeGemTableMoveAction({ type: "reserveDeck", args: { tier: 3 } }), 26);
  assert.equal(encodeGemTableMoveAction({ type: "buyReserved", args: { reserved_index: 2 } }), 29);
  assert.equal(encodeGemTableMoveAction({ type: "takeTokens", args: { colors: { white: 1, blue: 1, green: 1 } } }), 30);
  assert.equal(encodeGemTableMoveAction({ type: "takeTokens", args: { colors: { red: 1, black: 1 } } }), 49);
  assert.equal(encodeGemTableMoveAction({ type: "takeTokens", args: { colors: { red: 1 } } }), 53);
  assert.equal(encodeGemTableMoveAction({ type: "takeTokens", args: { colors: { black: 2 } } }), 59);
  assert.equal(encodeGemTableMoveAction({ type: "chooseNoble", args: { noble_slot: 2 } }), 62);
  assert.equal(encodeGemTableMoveAction({ type: "returnToken", args: { color: "gold" } }), 68);
  assert.equal(encodeGemTableMoveAction({ type: "pass", args: {} }), 69);
});

test("decodes DinoBoard actions into Gem Table intents", () => {
  assert.deepEqual(decodeDinoAction(0), { type: "buyMarket", args: { tier: 1, market_index: 0 } });
  assert.deepEqual(decodeDinoAction(17), { type: "reserveMarket", args: { tier: 2, market_index: 1 } });
  assert.deepEqual(decodeDinoAction(26), { type: "reserveDeck", args: { tier: 3 } });
  assert.deepEqual(decodeDinoAction(59), { type: "takeTokens", args: { colors: { black: 2 } } });
  assert.deepEqual(decodeDinoAction(68), { type: "returnToken", args: { color: "gold" } });
});

test("builds DinoBoard walker-style public snapshots with reserve visibility", () => {
  const hidden = Object.assign({}, blueStarter, { reserved_from: "deck", reserved_public: false });
  const visible = Object.assign({}, blueStarter, { reserved_from: "market", reserved_public: true });
  const snapshot = buildPublicSnapshot(state({
    players: [
      player(0, { reserved: [hidden, visible] }),
      player(1, { reserved: [hidden] })
    ]
  }), 1);

  assert.deepEqual(snapshot.current_player, [[], 0]);
  assert.deepEqual(snapshot.__viz__.reserved, [0, 1, 0, 1, 1, 1]);
  assert.deepEqual(snapshot.reserved, [[0, 1], 0, [1, 0], 0, [1, 1], -1, [1, 2], -1]);
  assert.equal(snapshot.__viz__.tableau.length, 12);
  assert.equal(snapshot.tableau.length, 24);
});

test("converts Gem Table replay to DinoBoard observation wire data", () => {
  const before = state();
  const after = state({
    next_move_id: 2,
    current: 1,
    market: { 1: [redStarter], 2: [], 3: [] },
    players: [player(0, { purchased: [blueStarter] }), player(1)]
  });
  const replay = {
    schema: "zephyrlabs-gemtable-bga-v1",
    gamedatas: { schema: "zephyrlabs-gemtable-bga-v1", source_state: before },
    moves: [{
      move_id: 1,
      type: "buyMarket",
      player_id: "0",
      args: { tier: 1, market_index: 0, card: blueStarter },
      state_after: { schema: "zephyrlabs-gemtable-bga-v1", source_state: after }
    }]
  };
  const converted = convertGemTableReplayToDinoBoard(replay, { aiSeat: 1 });
  assert.equal(converted.schema, "dinoboard-splendor2p-wire-v1");
  assert.equal(converted.initial_observation.public_snapshot.__viz__.reserved.length, 6);
  assert.equal(converted.observations[0].action_id, 0);
  assert.ok(converted.observations[0].events.some((event) => event.kind === "deck_flip"));
});

test("v2 public snapshots preserve the existing base v1 sparse snapshot", () => {
  const baseState = state();
  const v1 = buildPublicSnapshot(baseState, 1);
  const v2 = buildExpansionPublicSnapshot(baseState, 1);

  assert.equal(v2.schema, "dinoboard-splendor-public-snapshot-v2");
  assert.equal(v2.base_wire_schema, "dinoboard-splendor2p-wire-v1");
  assert.equal(v2.module_mask, DINOBOARD_MODULE_MASK_BITS.base);
  assert.deepEqual(v2.base_v1_public_snapshot, v1);

  const baseSlot = v2.market_slots.find((slot) => slot.slot_id === "base:t1:s0");
  assert.equal(baseSlot.area, "base");
  assert.equal(baseSlot.card.dinoboard_catalog_id, 0);
  assert.deepEqual(baseSlot.legal_actions.map((action) => action.legacy_action_id), [0, 12]);
});

test("v2 public snapshots represent Orient slots without fake ability actions", () => {
  const orientCard = {
    id: "bga-201",
    bga_id: "201",
    tier: 1,
    color: "blue",
    points: 0,
    cost: { white: 2, blue: 0, green: 0, red: 0, black: 0 },
    slot: {
      area: "orient",
      expansion: "Orient",
      tier: 1,
      index: 0,
      slot_id: "orient:t1:s0",
      card_id: "201",
      legacy_args: null
    },
    ability: {
      expansion: "Orient",
      code: "reserve_noble",
      label: "reserve_noble",
      text: "Reserve an available noble tile.",
      support_status: "metadata_only",
      unsupported_reason: { code: "gemtable.orient.ability_metadata_only", label: "Orient" }
    }
  };
  const expansionState = {
    schema: "zephyrlabs-gemtable-bga-v2",
    base_schema: "zephyrlabs-gemtable-bga-v1",
    base_state: state(),
    expansion_status: {
      active: ["Orient"],
      live_import_supported: false,
      unsupported_reasons: [{ code: "bga.orient.live_import_unsupported", label: "Orient" }]
    },
    market_areas: {
      base: {
        id: "base",
        expansion: null,
        tiers: { 1: [blueStarter], 2: [], 3: [] }
      },
      orient: {
        id: "orient",
        expansion: "Orient",
        tiers: { 1: [orientCard], 2: [], 3: [] }
      }
    }
  };

  const snapshot = buildExpansionPublicSnapshot(expansionState, 1);
  assert.equal(snapshot.module_mask, DINOBOARD_MODULE_MASK_BITS.base | DINOBOARD_MODULE_MASK_BITS.orient);
  assert.deepEqual(snapshot.active_modules, ["base", "orient"]);

  const orientSlot = snapshot.market_slots.find((slot) => slot.slot_id === "orient:t1:s0");
  assert.equal(orientSlot.area, "orient");
  assert.equal(orientSlot.expansion, "Orient");
  assert.equal(orientSlot.card.ability.code, "reserve_noble");
  assert.deepEqual(orientSlot.legal_actions.map((action) => action.kind), ["buy", "reserve"]);
  assert.ok(orientSlot.legal_actions.every((action) => action.status === "pending_engine_support"));
  assert.ok(orientSlot.legal_actions.every((action) => action.executable === false));
  assert.ok(orientSlot.legal_actions.every((action) => action.legacy_action_id === null));
  assert.equal(snapshot.legal_actions.some((action) => action.kind === "card_ability"), false);
  assert.equal(snapshot.pending[0].kind, "card_ability");
  assert.equal(snapshot.pending[0].status, "metadata_only");
});

test("converts Gem Table replay to the v2 expansion-ready wire contract", () => {
  const before = state();
  const after = state({
    next_move_id: 2,
    current: 1,
    players: [player(0, { tokens: { white: 1, blue: 1, green: 1, red: 0, black: 0, gold: 0 } }), player(1)]
  });
  const replay = {
    schema: "zephyrlabs-gemtable-bga-v1",
    gamedatas: { schema: "zephyrlabs-gemtable-bga-v1", source_state: before },
    moves: [{
      move_id: 1,
      type: "takeTokens",
      player_id: "0",
      args: { colors: { white: 1, blue: 1, green: 1 } },
      state_after: { schema: "zephyrlabs-gemtable-bga-v1", source_state: after }
    }]
  };

  const converted = convertGemTableReplayToDinoBoardV2(replay, { aiSeat: 1 });
  assert.equal(converted.schema, "dinoboard-splendor-wire-v2");
  assert.equal(converted.initial_observation.public_snapshot.base_wire_schema, "dinoboard-splendor2p-wire-v1");
  assert.equal(converted.observations[0].action_id, 30);
  assert.equal(converted.observations[0].action.status, "base_v1_candidate");
});

test("rejects DinoBoard action-history-only conversion", () => {
  assert.throws(
    () => convertDinoBoardReplayToGemTable({ action_history: [1, 2, 3] }),
    /requires framed replay/
  );
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error && error.stack || error);
  }
}
if (failed) process.exit(1);
