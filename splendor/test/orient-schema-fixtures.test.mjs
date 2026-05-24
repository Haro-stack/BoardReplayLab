import assertModule from "assert";

import {
  activeExpansionFlags,
  activeExpansionUnsupportedReasons,
  convertBgaCaptureToGemTableReplay
} from "../scripts/convert-splendor-capture.mjs";
import {
  GEMTABLE_EXPANSION_SCHEMA,
  MARKET_AREA_IDS,
  marketSlotIdentity,
  normalizeBgaGamedatasForGemTableV2
} from "../lib/gemtable-expansion-schema.mjs";

const assert = assertModule.strict;

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

function orientGamedatas() {
  return {
    expansion_orient: true,
    market: {
      row_1: {
        cards: {
          0: { id: "101", location: "market_1", location_arg: 0 }
        }
      },
      orient_row_1: {
        cards: {
          0: { id: "201", location: "orient_1", location_arg: 0 }
        }
      },
      orient_row_2: {
        cards: {
          0: { id: "202", location: "orient_2", location_arg: 1 }
        }
      }
    },
    carddb: {
      101: { lvl: 1, type: 0, points: 0, cost: "SSS" },
      201: {
        lvl: 11,
        type: 5,
        points: 0,
        cost: "CCCRR",
        symbolCopy: 1,
        symbolTake: 0,
        nbBonus: 0,
        costCard: ""
      },
      202: {
        lvl: 12,
        type: 0,
        points: 1,
        cost: "RRRREEE",
        symbolCopy: 0,
        symbolTake: 0,
        nbBonus: 2,
        costCard: ""
      }
    }
  };
}

function orientCapture() {
  return {
    schema: "zephyrlabs-bga-replay-crawler-v1",
    table_id: "fixture-orient",
    snapshots: [
      {
        gameui: {
          gamedatas: orientGamedatas()
        }
      }
    ],
    responses: []
  };
}

function orientReplayCaptureWithTier2Wild() {
  return {
    schema: "zephyrlabs-bga-replay-crawler-v1",
    table_id: "fixture-orient-wild",
    snapshots: [
      {
        gameui: {
          gamedatas: {
            expansion_orient: true,
            gamestate: { active_player: "p1" },
            market: {
              pool: { C: 4, S: 4, E: 4, R: 4, O: 4, G: 5 },
              row_1: { count: 0, cards: {} },
              row_2: { count: 0, cards: {} },
              row_3: { count: 0, cards: {} },
              orient_row_1: { count: 0, cards: {} },
              orient_row_2: { count: 0, cards: { 0: { id: "220", location: "orient_2", location_arg: 0 } } },
              orient_row_3: { count: 0, cards: {} }
            },
            carddb: {
              220: {
                lvl: 12,
                type: 5,
                points: 1,
                cost: "CCCCSSSO",
                symbolCopy: 1,
                symbolTake: 1,
                nbBonus: 0,
                costCard: ""
              }
            },
            players: {
              p1: { id: "p1", name: "Player 1" },
              p2: { id: "p2", name: "Player 2" }
            }
          }
        }
      }
    ],
    data: {
      players: [
        { id: "p1", name: "Player 1" },
        { id: "p2", name: "Player 2" }
      ],
      logs: [
        {
          move_id: "move-1",
          data: [
            { type: "coins", args: { player_id: "p1", gap: { C: 1 } } }
          ]
        }
      ]
    }
  };
}

test("detects active Orient captures without treating Orient as unsupported", () => {
  const flags = activeExpansionFlags(orientCapture());
  assert.deepEqual(flags.map((entry) => entry.label), ["Orient"]);

  const reasons = activeExpansionUnsupportedReasons(orientCapture());
  assert.deepEqual(reasons, []);

  assert.throws(
    () => convertBgaCaptureToGemTableReplay(orientCapture()),
    /No BGA archive logs were found/
  );
});

test("normalizes base and Orient market slots into Gem Table v2 fixture shape", () => {
  const normalized = normalizeBgaGamedatasForGemTableV2(orientGamedatas());
  assert.equal(normalized.schema, GEMTABLE_EXPANSION_SCHEMA);
  assert.deepEqual(normalized.expansion_status.active, ["Orient"]);
  assert.equal(normalized.expansion_status.live_import_supported, true);
  assert.deepEqual(normalized.expansion_status.unsupported_reasons, []);

  const baseCard = normalized.market_areas.base.tiers[1][0];
  assert.equal(baseCard.slot.area, MARKET_AREA_IDS.BASE);
  assert.equal(baseCard.slot.slot_id, "base:t1:s0");
  assert.deepEqual(baseCard.slot.legacy_args, { tier: 1, market_index: 0 });
  assert.equal(baseCard.ability, null);

  const orientCard = normalized.market_areas.orient.tiers[1][0];
  assert.equal(orientCard.slot.area, MARKET_AREA_IDS.ORIENT);
  assert.equal(orientCard.slot.slot_id, "orient:t1:s0");
  assert.equal(orientCard.slot.legacy_args, null);
  assert.equal(orientCard.color, "wild");
  assert.equal(orientCard.ability.code, "copy_bonus");
  assert.equal(orientCard.ability.support_status, "gemtable_supported");
  assert.equal(orientCard.ability.unsupported_reason, null);
  assert.deepEqual(orientCard.ability.effects.map((effect) => effect.effect), ["copy_bonus"]);
});

test("converts tier 2 Orient wildcard ability cards without gold color", () => {
  const replay = convertBgaCaptureToGemTableReplay(orientReplayCaptureWithTier2Wild());
  const card = replay.gamedatas.orient_market[2][0];
  assert.equal(card.bga_id, "220");
  assert.equal(card.id, "orient-220");
  assert.equal(card.color, "wild");
  assert.equal(card.printed_color, null);
  assert.deepEqual(card.abilities.map((ability) => ability.effect), ["copy_bonus", "take_level_free"]);
});

test("derives slot identity from explicit area or BGA-style location", () => {
  assert.deepEqual(
    marketSlotIdentity({ area: "base", tier: 2, index: 3, cardId: "17" }),
    {
      area: "base",
      expansion: null,
      tier: 2,
      index: 3,
      slot_id: "base:t2:s3",
      card_id: "17",
      legacy_args: { tier: 2, market_index: 3 }
    }
  );
  assert.deepEqual(
    marketSlotIdentity({ location: "orient_3", index: 1, cardId: "202" }),
    {
      area: "orient",
      expansion: "Orient",
      tier: 3,
      index: 1,
      slot_id: "orient:t3:s1",
      card_id: "202",
      legacy_args: null
    }
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
