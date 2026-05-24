import assertModule from "assert";

import {
  activeExpansionFlags,
  convertBgaCaptureToGemTableReplay,
  expansionLabelFor,
  isActiveExpansionValue
} from "../scripts/convert-splendor-capture.mjs";

const assert = assertModule.strict;

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

function activePayload(extraGamedatas) {
  return {
    schema: "zephyrlabs-bga-replay-crawler-v1",
    table_id: "fixture-expansion",
    snapshots: [
      {
        gameui: {
          gamedatas: Object.assign({
            market: {},
            carddb: {}
          }, extraGamedatas)
        }
      }
    ],
    responses: []
  };
}

function strongholdsCapture() {
  return {
    schema: "zephyrlabs-bga-replay-crawler-v1",
    table_id: "fixture-strongholds",
    snapshots: [
      {
        gameui: {
          gamedatas: {
            expansion_strongholds: "1",
            players: {
              p1: { id: "p1", name: "Alice" },
              p2: { id: "p2", name: "Bob" }
            },
            market: {
              pool: { C: 4, S: 4, E: 4, R: 4, O: 4, G: 5 },
              row_1: {
                count: 36,
                cards: {
                  0: { id: "32", type: "32", type_arg: "0", location: "market_1", location_arg: 0 }
                }
              },
              row_2: { count: 0, cards: {} },
              row_3: { count: 0, cards: {} },
              nobles: {},
              strongholds: {
                p1: {
                  1: { id: "1", type: "p1", type_arg: "1", location: "draw", location_arg: "0" }
                },
                p2: {
                  2: { id: "2", type: "p2", type_arg: "1", location: "draw", location_arg: "0" }
                }
              }
            },
            carddb: {
              32: { lvl: 1, type: 0, points: 0, cost: "SSS" }
            },
            nobledb: {}
          }
        }
      }
    ],
    responses: [
      {
        parsed_json: {
          data: {
            players: [
              { id: "p1", name: "Alice" },
              { id: "p2", name: "Bob" }
            ],
            logs: [
              {
                move_id: "1",
                data: [
                  {
                    type: "moveStronghold",
                    args: {
                      player_id: "p1",
                      player_name: "Alice",
                      strongholdsDestination: "32",
                      strongholdsId: "1"
                    }
                  }
                ]
              },
              {
                move_id: "2",
                data: [
                  {
                    type: "moveStronghold",
                    args: {
                      player_id: "p2",
                      player_name: "Bob",
                      strongholdsDestination: "draw",
                      strongholdsId: "1"
                    }
                  }
                ]
              }
            ]
          }
        }
      }
    ]
  };
}

function repeatedStrongholdDestinationCapture() {
  const capture = strongholdsCapture();
  capture.table_id = "fixture-stronghold-repeat";
  capture.snapshots[0].gameui.gamedatas.market.strongholds.p1[3] = {
    id: "3",
    type: "p1",
    type_arg: "2",
    location: "draw",
    location_arg: "0"
  };
  capture.responses[0].parsed_json.data.logs = [
    {
      move_id: "1",
      data: [
        {
          type: "moveStronghold",
          args: {
            player_id: "p1",
            player_name: "Alice",
            strongholdsDestination: "32",
            strongholdsId: "1"
          }
        }
      ]
    },
    {
      move_id: "2",
      data: [
        {
          type: "moveStronghold",
          args: {
            player_id: "p1",
            player_name: "Alice",
            strongholdsDestination: "32",
            strongholdsId: "1"
          }
        }
      ]
    }
  ];
  return capture;
}

function orientFreeCardCapture() {
  return {
    schema: "zephyrlabs-bga-replay-crawler-v1",
    table_id: "fixture-orient-free",
    snapshots: [
      {
        gameui: {
          gamedatas: {
            expansion_orient: "1",
            players: {
              p1: { id: "p1", name: "Alice" },
              p2: { id: "p2", name: "Bob" }
            },
            market: {
              pool: { C: 4, S: 4, E: 4, R: 4, O: 4, G: 5 },
              row_1: {
                count: 35,
                cards: {
                  0: { id: "32", type: "32", type_arg: "0", location: "market_1", location_arg: 0 }
                }
              },
              row_2: { count: 0, cards: {} },
              row_3: { count: 0, cards: {} },
              orient_row_1: { count: 0, cards: {} },
              orient_row_2: {
                count: 1,
                cards: {
                  0: { id: "216", type: "216", type_arg: "0", location: "orient_2", location_arg: 0 }
                }
              },
              orient_row_3: { count: 0, cards: {} },
              nobles: {}
            },
            carddb: {
              32: { lvl: 1, type: 0, points: 0, cost: "SSS" },
              33: { lvl: 1, type: 1, points: 0, cost: "EEE" },
              211: { lvl: 12, type: 0, points: 1, cost: "RRRREEE" },
              216: { lvl: 12, type: 5, points: 1, cost: "RRRREEEC", symbolCopy: 1, symbolTake: 1 }
            },
            nobledb: {}
          }
        }
      }
    ],
    responses: [
      {
        parsed_json: {
          data: {
            players: [
              { id: "p1", name: "Alice" },
              { id: "p2", name: "Bob" }
            ],
            logs: [
              {
                move_id: "1",
                data: [
                  {
                    type: "buyCard",
                    args: {
                      player_id: "p1",
                      player_name: "Alice",
                      card: { id: "216", type: "216", location: "orient_2", location_arg: 0 }
                    }
                  },
                  {
                    type: "buyCard",
                    args: {
                      player_id: "p1",
                      player_name: "Alice",
                      card: { id: "32", type: "32", location: "market_1", location_arg: 0 }
                    }
                  },
                  {
                    type: "revealCard",
                    args: {
                      card: { id: "211", type: "211", location: "orient_2", location_arg: 0 }
                    }
                  },
                  {
                    type: "revealCard",
                    args: {
                      card: { id: "33", type: "33", location: "market_1", location_arg: 0 }
                    }
                  }
                ]
              }
            ]
          }
        }
      }
    ]
  };
}

test("recognizes known Splendor expansion labels from BGA-like keys", () => {
  assert.equal(expansionLabelFor("isCitiesActivate"), "Cities");
  assert.equal(expansionLabelFor("expansion_orient"), "Orient");
  assert.equal(expansionLabelFor("trading_posts"), "Trading");
  assert.equal(expansionLabelFor("strongholds_enabled"), "Strongholds");
  assert.equal(expansionLabelFor("silkRoad"), "Silk Road");
  assert.equal(expansionLabelFor("noble_desc"), "");
});

test("treats only explicit enabled values as active expansion flags", () => {
  [true, 1, "true", "1", "yes", "on", "enabled", "active"].forEach((value) => {
    assert.equal(isActiveExpansionValue(value), true, `${String(value)} should be active`);
  });
  [false, 0, "0", "2", "false", "off", "disabled", "", null, undefined].forEach((value) => {
    assert.equal(isActiveExpansionValue(value), false, `${String(value)} should be inactive`);
  });
});

test("does not reject inactive extension fields or descriptive rule text", () => {
  const flags = activeExpansionFlags(activePayload({
    isCitiesActivate: false,
    expansion_orient: "0",
    isStrongholdsActivate: 0,
    silkRoad: "2",
    market: {
      nobles: [
        {
          noble_desc: "Tile from The Silk Road expansion, but this text does not enable the module."
        }
      ]
    }
  }));
  assert.deepEqual(flags, []);
});

test("detects active Cities, Orient, Trading, Strongholds, and Silk Road flags", () => {
  const flags = activeExpansionFlags(activePayload({
    isCitiesActivate: true,
    expansion_orient: "active",
    trading_posts: "enabled",
    isStrongholdsActivate: 1,
    silkRoad: "yes"
  }));
  const labels = flags.map((entry) => entry.label).sort();
  assert.deepEqual(labels, ["Cities", "Orient", "Silk Road", "Strongholds", "Trading"]);
  assert.ok(flags.some((entry) => entry.path.endsWith("isCitiesActivate")));
  assert.ok(flags.some((entry) => entry.path.endsWith("expansion_orient")));
});

test("ignores prior compatibility reports while scanning raw payload data", () => {
  const flags = activeExpansionFlags({
    compatibility: {
      expansion_detection: {
        active: [{ label: "Cities", path: "compatibility fixture" }]
      }
    },
    snapshots: [
      {
        gameui: {
          gamedatas: {
            isCitiesActivate: false,
            market: {},
            carddb: {}
          }
        }
      }
    ]
  });
  assert.deepEqual(flags, []);
});

test("converter rejects active expansion captures before base-game conversion", () => {
  assert.throws(
    () => convertBgaCaptureToGemTableReplay(activePayload({ isCitiesActivate: true })),
    /Active expansion flag detected: Cities at snapshots\[0\]\.gameui\.gamedatas\.isCitiesActivate/
  );
});

test("converter rejects crawler compatibility active reports for unsupported modules", () => {
  assert.throws(
    () => convertBgaCaptureToGemTableReplay({
      compatibility: {
        expansion_detection: {
          active: [{ label: "Cities", path: "snapshot.gameui.gamedatas.isCitiesActivate" }]
        }
      },
      snapshots: [
        {
          gameui: {
            gamedatas: {
              market: {},
              carddb: {}
            }
          }
        }
      ],
      responses: []
    }),
    /Active expansion flag detected: Cities at snapshot\.gameui\.gamedatas\.isCitiesActivate/
  );
});

test("converter does not reject crawler compatibility reports when only Orient is active", () => {
  assert.throws(
    () => convertBgaCaptureToGemTableReplay({
      compatibility: {
        expansion_detection: {
          active: [{ label: "Orient", path: "snapshot.gameui.gamedatas.expansion_orient" }]
        }
      },
      snapshots: [
        {
          gameui: {
            gamedatas: {
              market: {},
              carddb: {}
            }
          }
        }
      ],
      responses: []
    }),
    /No BGA archive logs were found/
  );
});

test("converter does not reject crawler compatibility reports when only Strongholds is active", () => {
  assert.throws(
    () => convertBgaCaptureToGemTableReplay({
      compatibility: {
        expansion_detection: {
          active: [{ label: "Strongholds", path: "snapshot.gameui.gamedatas.expansion_strongholds" }]
        }
      },
      snapshots: [
        {
          gameui: {
            gamedatas: {
              market: {},
              carddb: {}
            }
          }
        }
      ],
      responses: []
    }),
    /No BGA archive logs were found/
  );
});

test("converter applies Strongholds placement and removal events to slot state", () => {
  const replay = convertBgaCaptureToGemTableReplay(strongholdsCapture());
  assert.equal(replay.gamedatas.ruleset.modules.strongholds, true);
  assert.equal(replay.gamedatas.module_state.strongholds.enabled, true);
  assert.deepEqual(replay.gamedatas.source_state.strongholds.placements, {});

  const placed = replay.moves[0].state_after.source_state.strongholds;
  assert.deepEqual(placed.placements["base:t1:s0"], [0]);
  assert.equal(placed.tokens["1"].slot_id, "base:t1:s0");
  assert.equal(replay.moves[0].type, "strongholdMove");
  assert.equal(replay.moves[0].args.stronghold_effects[0].type, "place");

  const removed = replay.moves[1].state_after.source_state.strongholds;
  assert.equal(removed.placements["base:t1:s0"], undefined);
  assert.equal(removed.tokens["1"].slot_id, null);
  assert.equal(replay.moves[1].args.stronghold_effects[0].type, "remove");
  assert.equal(replay.compatibility.strongholds_supported, true);
});

test("converter counts repeated Strongholds placements on the same destination", () => {
  const replay = convertBgaCaptureToGemTableReplay(repeatedStrongholdDestinationCapture());
  const repeated = replay.moves[1].state_after.source_state.strongholds;
  assert.deepEqual(repeated.placements["base:t1:s0"], [0, 0]);
  assert.equal(repeated.tokens["1"].slot_id, "base:t1:s0");
  assert.equal(repeated.tokens["3"].slot_id, "base:t1:s0");
  assert.equal(replay.moves[1].args.stronghold_effects[0].type, "place");
  assert.equal(replay.moves[1].args.stronghold_effects[0].token_id, "3");
});

test("converter records Orient free card acquisitions and matched refills", () => {
  const replay = convertBgaCaptureToGemTableReplay(orientFreeCardCapture());
  const move = replay.moves[0];
  const state = move.state_after.source_state;
  assert.equal(move.type, "buyMarket");
  assert.equal(move.args.card.bga_id, "216");
  assert.equal(move.args.orient_effects.length, 1);
  assert.equal(move.args.orient_effects[0].type, "free_card");
  assert.equal(move.args.orient_effects[0].card.bga_id, "32");
  assert.equal(move.args.orient_effects[0].market_slot_id, "base:t1:s0");
  assert.deepEqual(state.players[0].purchased.map((card) => card.bga_id), ["216", "32"]);
  assert.equal(state.market[1][0].bga_id, "33");
  assert.equal(state.orient_market[2][0].bga_id, "211");
  assert.equal(state.decks[1].length, 34);
  assert.equal(state.orient_decks[2].length, 0);
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
