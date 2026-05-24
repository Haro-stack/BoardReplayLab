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

test("converter also rejects crawler compatibility active reports", () => {
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
    /Active expansion flag detected: Orient at snapshot\.gameui\.gamedatas\.expansion_orient/
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
