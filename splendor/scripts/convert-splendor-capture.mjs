#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { activeExpansionUnsupportedReason } from "../lib/gemtable-expansion-schema.mjs";

const { readFile, writeFile, mkdir } = fs.promises;

const RAW_SCHEMA = "zephyrlabs-bga-replay-crawler-v1";
const GEMTABLE_SCHEMA = "zephyrlabs-gemtable-bga-v1";
const BASE_RULESET_ID = "splendor-base";
const ORIENT_RULESET_ID = "splendor-base-orient";
const STRONGHOLDS_RULESET_ID = "splendor-base-strongholds";
const ORIENT_STRONGHOLDS_RULESET_ID = "splendor-base-orient-strongholds";
const BASE_MARKET_ID = "base";
const ORIENT_MARKET_ID = "orient";
const COLORS = ["white", "blue", "green", "red", "black"];
const ALL_TOKENS = COLORS.concat(["gold"]);
const MARKET_SLOT_COUNTS = { base: 4, orient: 2 };

function usage() {
  return [
    "Usage:",
    "  node splendor/scripts/convert-splendor-capture.mjs --in ./bga-replays/bga-table-854928957-replay.json [--out ./gemtable-replays]",
    "",
    "Notes:",
    "  - Converts BGA archive log captures into ZephyrLabs Gem Table replay JSON.",
    "  - Base-game Splendor plus active Orient and Strongholds captures are supported.",
    "  - Active Cities, Trading Posts, and Silk Road flags are rejected.",
    "  - Descriptive text such as a noble_desc mentioning Silk Road is ignored unless an active flag is true."
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: "", out: "gemtable-replays" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--in" || value === "-i") args.input = argv[++index] || "";
    else if (value === "--out" || value === "-o") args.out = argv[++index] || args.out;
    else if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    }
  }
  return args;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyCounts(includeGold) {
  const counts = {};
  COLORS.forEach((color) => {
    counts[color] = 0;
  });
  if (includeGold) counts.gold = 0;
  return counts;
}

function normalizeCost(cost) {
  const normalized = emptyCounts(false);
  COLORS.forEach((color) => {
    normalized[color] = Math.max(0, Number(cost && cost[color]) || 0);
  });
  return normalized;
}

const SOURCE_CARD_ROWS = {
  black: [
    [0, 0, 1, 1, 1, 1],
    [0, 0, 0, 1, 0, 2],
    [0, 0, 2, 0, 0, 2],
    [0, 1, 0, 3, 0, 1],
    [0, 0, 0, 0, 0, 3],
    [0, 0, 1, 1, 2, 1],
    [0, 0, 2, 1, 2, 0],
    [1, 0, 0, 0, 4, 0],
    [1, 0, 3, 0, 2, 2],
    [1, 2, 3, 0, 0, 3],
    [2, 0, 0, 2, 1, 4],
    [2, 0, 5, 0, 0, 0],
    [2, 0, 0, 3, 0, 5],
    [3, 6, 0, 0, 0, 0],
    [3, 0, 3, 3, 3, 5],
    [4, 0, 0, 7, 0, 0],
    [4, 3, 0, 6, 0, 3],
    [5, 3, 0, 7, 0, 0]
  ],
  blue: [
    [0, 2, 1, 0, 0, 0],
    [0, 1, 1, 2, 0, 1],
    [0, 1, 1, 1, 0, 1],
    [0, 0, 0, 1, 1, 3],
    [0, 3, 0, 0, 0, 0],
    [0, 0, 1, 2, 0, 2],
    [0, 2, 0, 0, 0, 2],
    [1, 0, 0, 4, 0, 0],
    [1, 0, 0, 3, 2, 2],
    [1, 3, 0, 0, 2, 3],
    [2, 0, 5, 0, 3, 0],
    [2, 0, 0, 0, 5, 0],
    [2, 4, 2, 1, 0, 0],
    [3, 0, 0, 0, 6, 0],
    [3, 5, 3, 3, 0, 3],
    [4, 0, 7, 0, 0, 0],
    [4, 3, 6, 0, 3, 0],
    [5, 0, 7, 0, 3, 0]
  ],
  green: [
    [0, 0, 2, 0, 1, 0],
    [0, 0, 0, 2, 2, 0],
    [0, 0, 1, 0, 3, 1],
    [0, 1, 1, 1, 1, 0],
    [0, 2, 1, 1, 1, 0],
    [0, 2, 0, 2, 1, 0],
    [0, 0, 0, 3, 0, 0],
    [1, 4, 0, 0, 0, 0],
    [1, 0, 3, 3, 0, 2],
    [1, 2, 2, 0, 3, 0],
    [2, 1, 4, 0, 2, 0],
    [2, 0, 0, 0, 0, 5],
    [2, 0, 0, 0, 5, 3],
    [3, 0, 0, 0, 0, 6],
    [3, 3, 5, 3, 3, 0],
    [4, 0, 3, 0, 6, 3],
    [4, 0, 0, 0, 7, 0],
    [5, 0, 0, 0, 7, 3]
  ],
  red: [
    [0, 0, 3, 0, 0, 0],
    [0, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 2, 1],
    [0, 2, 2, 0, 0, 1],
    [0, 1, 2, 0, 1, 1],
    [0, 1, 1, 0, 1, 1],
    [0, 0, 2, 2, 0, 0],
    [1, 0, 4, 0, 0, 0],
    [1, 3, 0, 2, 3, 0],
    [1, 3, 2, 2, 0, 0],
    [2, 0, 1, 0, 4, 2],
    [2, 5, 3, 0, 0, 0],
    [2, 5, 0, 0, 0, 0],
    [3, 0, 0, 6, 0, 0],
    [3, 3, 3, 0, 5, 3],
    [4, 0, 0, 0, 0, 7],
    [4, 0, 0, 3, 3, 6],
    [5, 0, 0, 3, 0, 7]
  ],
  white: [
    [0, 1, 0, 0, 2, 2],
    [0, 1, 0, 2, 0, 0],
    [0, 1, 0, 1, 1, 1],
    [0, 0, 0, 0, 3, 0],
    [0, 0, 0, 0, 2, 2],
    [0, 1, 0, 1, 1, 2],
    [0, 1, 3, 0, 1, 0],
    [1, 0, 0, 0, 0, 4],
    [1, 2, 0, 2, 0, 3],
    [1, 0, 2, 3, 3, 0],
    [2, 2, 0, 4, 0, 1],
    [2, 0, 0, 5, 0, 0],
    [2, 3, 0, 5, 0, 0],
    [3, 0, 6, 0, 0, 0],
    [3, 3, 0, 5, 3, 3],
    [4, 7, 0, 0, 0, 0],
    [4, 6, 3, 3, 0, 0],
    [5, 7, 3, 0, 0, 0]
  ]
};

function sourceRowTier(index) {
  if (index < 8) return 1;
  if (index < 14) return 2;
  return 3;
}

function sourceRowCost(row) {
  return normalizeCost({
    black: row[1],
    white: row[2],
    red: row[3],
    blue: row[4],
    green: row[5]
  });
}

function buildDevelopmentCards() {
  const cardsByTier = { 1: [], 2: [], 3: [] };
  const counters = { 1: 0, 2: 0, 3: 0 };
  ["black", "blue", "green", "red", "white"].forEach((color) => {
    SOURCE_CARD_ROWS[color].forEach((row, index) => {
      const tier = sourceRowTier(index);
      counters[tier] += 1;
      cardsByTier[tier].push({
        id: `t${tier}-${String(counters[tier]).padStart(2, "0")}`,
        tier,
        color,
        points: row[0],
        cost: sourceRowCost(row)
      });
    });
  });
  return cardsByTier;
}

const DEVELOPMENT_CARDS = buildDevelopmentCards();

const ORIENT_CARDDB_ROWS = [
  [201, 11, 5, 0, "CCCRR", 1, 0, 0, ""],
  [202, 11, 5, 0, "RRRSS", 1, 0, 0, ""],
  [203, 11, 5, 0, "SSSEE", 1, 0, 0, ""],
  [204, 11, 5, 0, "EEEOO", 1, 0, 0, ""],
  [205, 11, 5, 0, "OOOCC", 1, 0, 0, ""],
  [206, 11, 6, 0, "RRR", 0, 0, 0, ""],
  [207, 11, 6, 0, "EEE", 0, 0, 0, ""],
  [208, 11, 6, 0, "SSS", 0, 0, 0, ""],
  [209, 11, 6, 0, "CCC", 0, 0, 0, ""],
  [210, 11, 6, 0, "OOO", 0, 0, 0, ""],
  [211, 12, 0, 1, "RRRREEE", 0, 0, 2, ""],
  [212, 12, 1, 1, "OOOORRR", 0, 0, 2, ""],
  [213, 12, 2, 1, "CCCCOOO", 0, 0, 2, ""],
  [214, 12, 3, 1, "SSSSCCC", 0, 0, 2, ""],
  [215, 12, 4, 1, "EEEESSS", 0, 0, 2, ""],
  [216, 12, 5, 1, "RRRREEEC", 1, 1, 0, ""],
  [217, 12, 5, 1, "SSSSOOOR", 1, 1, 0, ""],
  [218, 12, 5, 1, "OOOORRRE", 1, 1, 0, ""],
  [219, 12, 5, 1, "EEEECCCS", 1, 1, 0, ""],
  [220, 12, 5, 1, "CCCCSSSO", 1, 1, 0, ""],
  [221, 13, 4, 3, "", 0, 0, 1, "SS"],
  [222, 13, 2, 3, "", 0, 0, 1, "OO"],
  [223, 13, 3, 3, "", 0, 0, 1, "CC"],
  [224, 13, 0, 3, "", 0, 0, 1, "EE"],
  [225, 13, 1, 3, "", 0, 0, 1, "RR"],
  [226, 13, 0, 1, "SSSSSSEEER", 0, 2, 1, ""],
  [227, 13, 1, 1, "EEEEEERRRO", 0, 2, 1, ""],
  [228, 13, 2, 1, "RRRRRROOOC", 0, 2, 1, ""],
  [229, 13, 3, 1, "OOOOOOCCCS", 0, 2, 1, ""],
  [230, 13, 4, 1, "CCCCCCSSSE", 0, 2, 1, ""]
];

function bgaCodeCost(value) {
  const counts = emptyCounts(false);
  String(value || "").split("").forEach((code) => {
    const color = bgaGemColor(code);
    if (color && COLORS.includes(color)) counts[color] += 1;
  });
  return counts;
}

function orientAbilitiesForRow(row, color, costCardColor) {
  const abilities = [];
  if (row.symbolCopy) abilities.push({ effect: "copy_bonus", timing: "on_acquire", status: "implemented", requires_choice: true });
  if (row.type === 6) abilities.push({ effect: "virtual_gold_2", timing: "future_payment", status: "implemented", virtual_gold: 2 });
  if (row.nbBonus === 2) abilities.push({ effect: "double_bonus", timing: "on_acquire", status: "implemented", bonus_color: color, bonus_count: 2 });
  if (row.symbolTake) abilities.push({ effect: "take_level_free", timing: "on_acquire", status: "implemented", free_tier: row.symbolTake, requires_choice: true });
  if (costCardColor) abilities.push({ effect: "discard_cards_cost", timing: "on_buy", status: "implemented", color: costCardColor, count: 2 });
  return abilities;
}

function buildOrientCards() {
  const cardsById = new Map();
  ORIENT_CARDDB_ROWS.forEach((raw) => {
    const row = { id: raw[0], lvl: raw[1], type: raw[2], points: raw[3], cost: raw[4], symbolCopy: raw[5], symbolTake: raw[6], nbBonus: raw[7], costCard: raw[8] };
    const tier = row.lvl - 10;
    const color = bgaOrientCardColor(row.type);
    const costCard = bgaCodeCost(row.costCard);
    const costCardColor = COLORS.find((entry) => costCard[entry] > 0) || "";
    const orientBonus = emptyCounts(false);
    if (row.type >= 0 && row.type <= 4 && row.nbBonus > 0) orientBonus[color] = row.nbBonus;
    cardsById.set(String(row.id), {
      id: `orient-${row.id}`,
      bga_id: String(row.id),
      tier,
      color,
      printed_color: row.type >= 0 && row.type <= 4 ? color : null,
      points: row.points,
      cost: bgaCodeCost(row.cost),
      module: ORIENT_MARKET_ID,
      bga_carddb: row,
      orient_effective: { bonus: orientBonus, virtual_gold: row.type === 6, virtual_gold_value: row.type === 6 ? 2 : 0 },
      orient_cost_card: costCardColor ? { color: costCardColor, count: costCard[costCardColor] || 2 } : null,
      abilities: orientAbilitiesForRow(row, color, costCardColor)
    });
  });
  return cardsById;
}

const ORIENT_CARDS_BY_BGA_ID = buildOrientCards();

function tokenCountForPlayers(playerCount) {
  if (playerCount === 2) return 4;
  if (playerCount === 3) return 5;
  return 7;
}

function scoreFor(player) {
  return player.purchased.reduce((sum, card) => sum + (Number(card.points) || 0), 0) +
    player.nobles.reduce((sum, noble) => sum + (Number(noble.points) || 0), 0);
}

function cardBonusCounts(card) {
  const bonuses = emptyCounts(false);
  if (!card) return bonuses;
  if (card.module === ORIENT_MARKET_ID && card.orient_effective && card.orient_effective.bonus) {
    COLORS.forEach((color) => {
      bonuses[color] = Math.max(0, Number(card.orient_effective.bonus[color]) || 0);
    });
    return bonuses;
  }
  if (COLORS.includes(card.color)) bonuses[card.color] = 1;
  return bonuses;
}

function applyCardBonuses(player, card) {
  const bonuses = cardBonusCounts(card);
  COLORS.forEach((color) => {
    player.bonuses[color] += bonuses[color] || 0;
  });
}

function gameStateTextFor(game) {
  if (game.gameOver) return "Game finished";
  return "BGA replay import";
}

function createRuleset(options = {}) {
  const orient = typeof options === "object" ? !!options.orient : !!options;
  const strongholds = typeof options === "object" ? !!options.strongholds : false;
  const nameParts = ["Splendor base"];
  if (orient) nameParts.push("Orient");
  if (strongholds) nameParts.push("Strongholds");
  return {
    id: orient && strongholds ? ORIENT_STRONGHOLDS_RULESET_ID : orient ? ORIENT_RULESET_ID : strongholds ? STRONGHOLDS_RULESET_ID : BASE_RULESET_ID,
    name: nameParts.join(" + "),
    modules: {
      cities: false,
      trading_posts: false,
      orient: !!orient,
      strongholds: !!strongholds
    }
  };
}

function createModuleState(ruleset) {
  const orient = !!(ruleset && ruleset.modules && ruleset.modules.orient);
  const strongholds = !!(ruleset && ruleset.modules && ruleset.modules.strongholds);
  return {
    orient: {
      enabled: orient,
      status: orient ? "supported" : "disabled",
      catalog_schema: "zephyrlabs-gemtable-orient-bga-carddb-v1",
      card_count: ORIENT_CARDS_BY_BGA_ID.size,
      market_slot_count: 2
    },
    strongholds: {
      enabled: strongholds,
      status: strongholds ? "supported" : "disabled",
      tokens_per_player: 3,
      event_schema: "zephyrlabs-gemtable-move-event-v1"
    }
  };
}

function marketSlotIdFor(marketId, tier, index) {
  return `${marketId}:t${tier}:s${index}`;
}

function createMarketSlots() {
  const groups = {};
  [BASE_MARKET_ID, ORIENT_MARKET_ID].forEach((marketId) => {
    groups[marketId] = { 1: [], 2: [], 3: [] };
    [1, 2, 3].forEach((tier) => {
      for (let index = 0; index < MARKET_SLOT_COUNTS[marketId]; index += 1) {
        groups[marketId][tier].push(marketSlotIdFor(marketId, tier, index));
      }
    });
  });
  return groups;
}

function marketSlotId(game, marketId, tier, index) {
  const group = game && game.market_slots && game.market_slots[marketId] && game.market_slots[marketId][tier];
  return group && group[index] || marketSlotIdFor(marketId, tier, index);
}

function compactSourceState(game) {
  return {
    schema: GEMTABLE_SCHEMA,
    ruleset: clone(game.ruleset || createRuleset()),
    module_state: clone(game.module_state || createModuleState(game.ruleset)),
    table_seed: game.table_seed,
    next_move_id: game.next_move_id,
    players: clone(game.players),
    bank: clone(game.bank),
    decks: clone(game.decks),
    market: clone(game.market),
    market_slots: clone(game.market_slots || createMarketSlots()),
    orient_decks: clone(game.orient_decks || { 1: [], 2: [], 3: [] }),
    orient_market: clone(game.orient_market || { 1: [], 2: [], 3: [] }),
    strongholds: clone(game.strongholds || { placements: {}, tokens: {} }),
    nobles: clone(game.nobles),
    current: game.current,
    round: game.round,
    log: Array.isArray(game.log) ? game.log.slice() : [],
    moves: [],
    initial_gamedatas: null,
    awaitingDiscard: false,
    awaitingNobleChoice: null,
    endTriggered: false,
    finalTurnsLeft: null,
    gameOver: !!game.gameOver,
    turnTransition: null,
    aiThinking: null,
    mode: "live"
  };
}

function toGamedatas(game, includeSourceState) {
  const players = {};
  game.players.forEach((player, index) => {
    players[player.id] = {
      id: player.id,
      no: index + 1,
      name: player.name,
      score: scoreFor(player),
      tokens: clone(player.tokens),
      bonuses: clone(player.bonuses),
      reserved: clone(player.reserved),
      purchased_count: player.purchased.length,
      purchased: clone(player.purchased),
      nobles: clone(player.nobles),
      ai: clone(player.ai || { enabled: false, mode: null, level: "balanced", available: false })
    };
  });
  const data = {
    schema: GEMTABLE_SCHEMA,
    table: {
      player_count: game.players.length,
      round: game.round,
      current_player_id: game.players[game.current] ? game.players[game.current].id : null,
      active_player_id: game.players[game.current] ? game.players[game.current].id : null,
      next_move_id: game.next_move_id,
      mode: "replay",
      ruleset_id: game.ruleset && game.ruleset.id || BASE_RULESET_ID
    },
    ruleset: clone(game.ruleset || createRuleset()),
    module_state: clone(game.module_state || createModuleState(game.ruleset)),
    gamestate: {
      name: game.gameOver ? "gameEnd" : "playerTurn",
      description: gameStateTextFor(game),
      active_player: game.players[game.current] ? game.players[game.current].id : null
    },
    players,
    playerorder: game.players.map((player) => player.id),
    bank: clone(game.bank),
    market: clone(game.market),
    market_slots: clone(game.market_slots || createMarketSlots()),
    orient_market: clone(game.orient_market || { 1: [], 2: [], 3: [] }),
    strongholds: clone(game.strongholds || { placements: {}, tokens: {} }),
    nobles: clone(game.nobles),
    decks_remaining: { 1: game.decks[1].length, 2: game.decks[2].length, 3: game.decks[3].length },
    orient_decks_remaining: {
      1: game.orient_decks && game.orient_decks[1] ? game.orient_decks[1].length : 0,
      2: game.orient_decks && game.orient_decks[2] ? game.orient_decks[2].length : 0,
      3: game.orient_decks && game.orient_decks[3] ? game.orient_decks[3].length : 0
    },
    awaiting: { discard: false, noble_choice: null },
    end: { triggered: false, final_turns_left: null, game_over: !!game.gameOver },
    log: game.log.slice()
  };
  if (includeSourceState) data.source_state = compactSourceState(game);
  return data;
}

function extractBgaReplayData(payload) {
  if (payload && payload.data && Array.isArray(payload.data.logs)) return payload.data;
  const responses = payload && Array.isArray(payload.responses) ? payload.responses : [];
  for (const response of responses) {
    const parsed = response && response.parsed_json;
    if (parsed && parsed.data && Array.isArray(parsed.data.logs)) return parsed.data;
  }
  return null;
}

function extractBgaInitialGamedatas(payload) {
  const snapshots = payload && Array.isArray(payload.snapshots) ? payload.snapshots : [];
  for (const snapshot of snapshots) {
    const gamedatas = snapshot && snapshot.gameui && snapshot.gameui.gamedatas;
    if (gamedatas && gamedatas.market && gamedatas.carddb) return gamedatas;
  }
  return null;
}

export function expansionLabelFor(value) {
  const text = String(value || "");
  const patterns = [
    { label: "Silk Road", re: /silk[_\-\s]?road|silkroad/i },
    { label: "Cities", re: /cities|city/i },
    { label: "Orient", re: /orient/i },
    { label: "Trading", re: /trading/i },
    { label: "Strongholds", re: /stronghold/i },
    { label: "Expansion", re: /expansion|extension/i }
  ];
  const match = patterns.find((entry) => entry.re.test(text));
  return match ? match.label : "";
}

export function isActiveExpansionValue(value) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return /^(true|1|yes|on|enabled|active)$/i.test(value.trim());
  return false;
}

export function isInactiveExpansionValue(value) {
  if (value === false || value === null) return true;
  if (typeof value === "number") return value === 0 || value === 2;
  if (typeof value === "string") return /^(false|0|2|no|off|disabled|inactive|)$/i.test(value.trim());
  return false;
}

export function activeExpansionFlags(payload) {
  const active = [];
  function push(entry) {
    if (!active.some((item) => item.path === entry.path && item.label === entry.label)) active.push(entry);
  }
  function walk(value, pathName) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.slice(0, 1000).forEach((item, index) => walk(item, `${pathName}[${index}]`));
      return;
    }
    Object.keys(value).forEach((key) => {
      const child = value[key];
      const path = pathName ? `${pathName}.${key}` : key;
      if (path === "compatibility" || path.startsWith("compatibility.")) return;
      const label = expansionLabelFor(key);
      if (label && (typeof child !== "object" || child === null) && isActiveExpansionValue(child)) {
        push({ label, path, value: child });
      }
      walk(child, path);
    });
  }
  walk(payload, "");
  return active;
}

export function activeExpansionUnsupportedReasons(payload) {
  const reasons = [];
  function push(flag) {
    if (/orient|strongholds?/i.test(String(flag && flag.label || ""))) return;
    const reason = activeExpansionUnsupportedReason(flag);
    if (!reasons.some((entry) => entry.code === reason.code && entry.label === reason.label && entry.path === reason.path)) {
      reasons.push(reason);
    }
  }
  activeExpansionFlags(payload).forEach(push);
  const reported = payload && payload.compatibility && payload.compatibility.expansion_detection &&
    Array.isArray(payload.compatibility.expansion_detection.active)
    ? payload.compatibility.expansion_detection.active
    : [];
  reported.forEach((entry) => {
    push({
      label: entry && entry.label || "Expansion",
      path: entry && entry.path || "unknown path",
      value: entry && entry.value
    });
  });
  return reasons;
}

function bgaInitialGamedatasOrientActive(gamedatas) {
  if (!gamedatas || !gamedatas.market) return false;
  const flag = gamedatas.expansion_orient;
  const flagActive = isActiveExpansionValue(flag);
  return flagActive || [1, 2, 3].some((tier) => {
    const row = gamedatas.market[`orient_row_${tier}`];
    return !!(row && bgaObjectValues(row.cards).length);
  });
}

function bgaInitialGamedatasStrongholdsActive(gamedatas) {
  if (!gamedatas || !gamedatas.market) return false;
  const flag = gamedatas.expansion_strongholds;
  if (isActiveExpansionValue(flag)) return true;
  if (isInactiveExpansionValue(flag)) return false;
  return Object.keys(gamedatas.market.strongholds || {}).length > 0;
}

function bgaGemColor(code) {
  return {
    C: "white",
    S: "blue",
    E: "green",
    R: "red",
    O: "black",
    G: "gold"
  }[String(code || "").trim().toUpperCase()] || "";
}

function bgaCardTypeColor(type) {
  return ["white", "blue", "green", "red", "black"][Number(type)] || "";
}

function bgaOrientCardColor(type) {
  return bgaCardTypeColor(type) || (Number(type) === 5 ? "wild" : "gold");
}

function bgaRawCardTypeId(card, fallback) {
  if (card && card.type !== undefined && card.type !== null && card.type !== "") return card.type;
  if (card && card.id !== undefined && card.id !== null && card.id !== "") return card.id;
  return fallback !== undefined && fallback !== null ? fallback : "";
}

function bgaCostToCounts(value) {
  const counts = emptyCounts(false);
  if (!value) return counts;
  if (typeof value === "string") {
    value.split("").forEach((code) => {
      const color = bgaGemColor(code);
      if (COLORS.includes(color)) counts[color] += 1;
    });
    return counts;
  }
  if (typeof value === "object") {
    Object.keys(value).forEach((code) => {
      const color = bgaGemColor(code) || (COLORS.includes(code) ? code : "");
      if (COLORS.includes(color)) counts[color] += Math.max(0, Number(value[code]) || 0);
    });
  }
  return counts;
}

function bgaPoolToBank(pool) {
  const bank = emptyCounts(true);
  Object.keys(pool || {}).forEach((code) => {
    const color = bgaGemColor(code) || (ALL_TOKENS.includes(code) ? code : "");
    if (ALL_TOKENS.includes(color)) bank[color] = Math.max(0, Number(pool[code]) || 0);
  });
  return bank;
}

function bgaObjectValues(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).map((key) => value[key]);
}

function bgaCostMatchesLocal(a, b) {
  return COLORS.every((color) => (Number(a && a[color]) || 0) === (Number(b && b[color]) || 0));
}

function bgaLocalCardMatch(tier, color, points, cost) {
  const cards = DEVELOPMENT_CARDS[Math.max(1, Math.min(3, Number(tier) || 1))] || [];
  return cards.find((card) =>
    card.color === color &&
    Number(card.points) === Number(points || 0) &&
    bgaCostMatchesLocal(card.cost, cost)
  );
}

function bgaWithLocalCardId(card) {
  const local = bgaLocalCardMatch(card.tier, card.color, card.points, card.cost);
  if (!local) return card;
  const mapped = clone(local);
  mapped.bga_id = card.bga_id;
  mapped.bga_card_id = card.id;
  mapped.bga_original_id = card.bga_id;
  return mapped;
}

function bgaTierFromCard(card, args) {
  const location = String(card && card.location || "");
  const match = location.match(/(?:market|draw)_(\d+)/);
  if (match) return Math.max(1, Math.min(3, Number(match[1]) || 1));
  const drawpile = Number(args && args.drawpile);
  if (drawpile >= 1 && drawpile <= 3) return drawpile;
  const rank = String(args && args.rank || "");
  const circles = (rank.match(/[◯○]/g) || []).length;
  return circles >= 1 && circles <= 3 ? circles : 1;
}

function bgaCardId(card, fallback) {
  const raw = bgaRawCardTypeId(card, fallback);
  return `bga-${String(raw || "unknown")}`;
}

function bgaCoinsFromGap(items, sign) {
  const counts = emptyCounts(true);
  (items || []).forEach((item) => {
    if (!item || item.type !== "coins") return;
    const gap = item.args && item.args.gap || {};
    Object.keys(gap).forEach((code) => {
      const color = bgaGemColor(code);
      const amount = Number(gap[code]) || 0;
      if (!color || amount * sign <= 0) return;
      counts[color] += Math.abs(amount);
    });
  });
  return counts;
}

function bgaTokenListFromCounts(counts) {
  const colors = [];
  ALL_TOKENS.forEach((color) => {
    for (let index = 0; index < (Number(counts[color]) || 0); index += 1) colors.push(color);
  });
  return colors;
}

function bgaCardFromDb(raw, gamedatas, fallback) {
  const id = String(raw || fallback && fallback.id || "unknown");
  const db = gamedatas && gamedatas.carddb && gamedatas.carddb[id];
  let tier = Math.max(1, Math.min(3, Number(fallback && fallback.tier) || 1));
  let color = fallback && fallback.color || "gold";
  let points = Math.max(0, Number(fallback && fallback.points) || 0);
  let cost = normalizeCost({});
  if (db) {
    if (Number(db.lvl) >= 11 && Number(db.lvl) <= 13) {
      const orientCard = ORIENT_CARDS_BY_BGA_ID.get(id);
      if (orientCard) return clone(orientCard);
    }
    tier = Math.max(1, Math.min(3, Number(db.lvl) || tier));
    color = bgaCardTypeColor(db.type) || color;
    points = Math.max(0, Number(db.points) || 0);
    cost = bgaCostToCounts(db.cost);
  }
  return bgaWithLocalCardId({
    id: `bga-${id}`,
    bga_id: id,
    tier,
    color,
    points,
    cost
  });
}

function bgaCardFromNotification(item, groupItems, fallback, gamedatas) {
  const args = item && item.args || {};
  const card = args.card || fallback && fallback.card || {};
  const scoreItem = groupItems.find((entry) =>
    entry && entry.type === "updateScore" && String(entry.args && entry.args.player_id) === String(args.player_id || fallback && fallback.player_id)
  );
  const raw = bgaRawCardTypeId(card, fallback && fallback.id);
  return bgaCardFromDb(raw, gamedatas, {
    tier: bgaTierFromCard(card, args),
    color: bgaGemColor(args.gem_type) || fallback && fallback.color || "gold",
    points: Math.max(0, Number(scoreItem && scoreItem.args && scoreItem.args.amount_vp) || 0)
  });
}

function applyBgaCoinGaps(game, player, items) {
  (items || []).forEach((item) => {
    if (!item || item.type !== "coins") return;
    const gap = item.args && item.args.gap || {};
    Object.keys(gap).forEach((code) => {
      const color = bgaGemColor(code);
      const delta = Number(gap[code]) || 0;
      if (!color || !delta) return;
      player.tokens[color] = Math.max(0, (player.tokens[color] || 0) + delta);
      game.bank[color] = Math.max(0, (game.bank[color] || 0) - delta);
    });
  });
}

function buildBgaPlayerList(data, gamedatas) {
  const players = Array.isArray(data && data.players) ? data.players.slice(0, 4) : [];
  const byId = {};
  players.forEach((player) => {
    byId[String(player.id)] = true;
  });
  const gdPlayers = gamedatas && gamedatas.players && typeof gamedatas.players === "object" ? gamedatas.players : {};
  bgaObjectValues(gdPlayers).forEach((player) => {
    const id = player && (player.id || player.player_id);
    if (!id || byId[String(id)]) return;
    byId[String(id)] = true;
    players.push({ id, name: player.name || `BGA Player ${players.length + 1}` });
  });
  (data && data.logs || []).forEach((packet) => {
    (packet.data || []).forEach((entry) => {
      const args = entry.args || {};
      const id = args.player_id;
      if (!id || byId[String(id)]) return;
      byId[String(id)] = true;
      players.push({ id, name: args.player_name || `BGA Player ${players.length + 1}` });
    });
  });
  return players.slice(0, 4);
}

function bgaDeckPlaceholders(tier, count) {
  const cards = [];
  for (let index = 0; index < Math.max(0, Number(count) || 0); index += 1) {
    cards.push({
      id: `bga-hidden-t${tier}-${index}`,
      bga_id: "",
      tier,
      color: "gold",
      points: 0,
      cost: normalizeCost({}),
      hidden: true
    });
  }
  return cards;
}

function bgaNobleFromDb(raw, gamedatas, fallback) {
  const id = String(raw || fallback && fallback.id || "unknown");
  const db = gamedatas && gamedatas.nobledb && gamedatas.nobledb[id];
  return {
    id: `bga-noble-${id}`,
    bga_id: id,
    name: String(db && db.name || fallback && fallback.name || "BGA noble"),
    points: Math.max(0, Number(db && db.points || fallback && fallback.points || 3) || 3),
    req: bgaCostToCounts(db && db.cost || fallback && fallback.req)
  };
}

function ensureStrongholds(game) {
  if (!game.strongholds || typeof game.strongholds !== "object") game.strongholds = { placements: {}, tokens: {} };
  if (!game.strongholds.placements || typeof game.strongholds.placements !== "object") game.strongholds.placements = {};
  if (!game.strongholds.tokens || typeof game.strongholds.tokens !== "object") game.strongholds.tokens = {};
  return game.strongholds;
}

function playerIndexForBgaId(game, bgaPlayerId) {
  const index = game.players.findIndex((player) => String(player.bga_id || "") === String(bgaPlayerId || ""));
  return index >= 0 ? index : 0;
}

function marketSlotForBgaCardId(game, bgaCardId) {
  const id = String(bgaCardId || "");
  for (const marketId of [BASE_MARKET_ID, ORIENT_MARKET_ID]) {
    const market = marketId === ORIENT_MARKET_ID ? game.orient_market : game.market;
    for (const tier of [1, 2, 3]) {
      const cards = market && market[tier] || [];
      const index = cards.findIndex((card) => card && String(card.bga_id || "") === id);
      if (index >= 0) {
        return {
          marketId,
          tier,
          index,
          slotId: marketSlotId(game, marketId, tier, index),
          card: cards[index]
        };
      }
    }
  }
  return null;
}

function strongholdPlacementCountForPlayer(game, playerIndex) {
  const strongholds = ensureStrongholds(game);
  return Object.keys(strongholds.placements).reduce((count, slotId) => {
    const holders = strongholds.placements[slotId];
    if (!Array.isArray(holders)) return count;
    return count + holders.filter((entry) => Number(entry) === Number(playerIndex)).length;
  }, 0);
}

function drawStrongholdTokenForPlayer(game, playerIndex, excludeTokenId) {
  const strongholds = ensureStrongholds(game);
  const exclude = String(excludeTokenId || "");
  const tokenIds = Object.keys(strongholds.tokens).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  for (const tokenId of tokenIds) {
    if (tokenId === exclude) continue;
    const token = strongholds.tokens[tokenId];
    if (!token || Number(token.player_index) !== Number(playerIndex)) continue;
    if (token.slot_id) continue;
    if (token.location && token.location !== "draw") continue;
    return token;
  }
  return null;
}

function synthesizeStrongholdToken(game, template) {
  const strongholds = ensureStrongholds(game);
  const playerIndex = Number(template && template.player_index) || 0;
  let suffix = 1;
  let tokenId = `synthetic:${playerIndex}:${suffix}`;
  while (strongholds.tokens[tokenId]) {
    suffix += 1;
    tokenId = `synthetic:${playerIndex}:${suffix}`;
  }
  const token = Object.assign({}, template || {}, {
    id: tokenId,
    bga_id: tokenId,
    player_index: playerIndex,
    bga_player_id: template && template.bga_player_id || "",
    player_id: template && template.player_id || (game.players[playerIndex] ? game.players[playerIndex].id : ""),
    token_number: suffix,
    location: "draw",
    slot_id: null,
    card_bga_id: ""
  });
  strongholds.tokens[tokenId] = token;
  return token;
}

function tokenForRepeatedStrongholdDestination(game, token, destinationSlotId) {
  if (!token || !destinationSlotId || token.slot_id !== destinationSlotId) return token;
  const playerIndex = Number(token.player_index);
  if (!Number.isInteger(playerIndex)) return token;
  if (strongholdPlacementCountForPlayer(game, playerIndex) >= 3) return token;
  return drawStrongholdTokenForPlayer(game, playerIndex, token.id) || synthesizeStrongholdToken(game, token);
}

function removeStrongholdTokenFromSlot(game, tokenId) {
  const strongholds = ensureStrongholds(game);
  const token = strongholds.tokens[String(tokenId)];
  const playerIndex = token ? Number(token.player_index) : null;
  const slotIds = token && token.slot_id ? [token.slot_id] : Object.keys(strongholds.placements);
  for (const slotId of slotIds) {
    const holders = strongholds.placements[slotId];
    if (!Array.isArray(holders)) continue;
    const index = Number.isInteger(playerIndex)
      ? holders.findIndex((entry) => Number(entry) === playerIndex)
      : holders.length - 1;
    if (index >= 0) {
      holders.splice(index, 1);
      if (!holders.length) delete strongholds.placements[slotId];
      break;
    }
  }
  if (token) {
    token.location = "draw";
    token.slot_id = null;
    token.card_bga_id = "";
  }
}

function registerBgaStrongholdToken(game, rawToken, fallbackBgaPlayerId) {
  const strongholds = ensureStrongholds(game);
  const tokenId = String(rawToken && rawToken.id || "");
  if (!tokenId) return null;
  const bgaPlayerId = String(rawToken && rawToken.type || fallbackBgaPlayerId || "");
  const playerIndex = playerIndexForBgaId(game, bgaPlayerId);
  const token = Object.assign(strongholds.tokens[tokenId] || {}, {
    id: tokenId,
    bga_id: tokenId,
    bga_player_id: bgaPlayerId,
    player_id: game.players[playerIndex] ? game.players[playerIndex].id : "",
    player_index: playerIndex,
    token_number: Number(rawToken && rawToken.type_arg) || 0,
    location: String(rawToken && rawToken.location || "draw"),
    slot_id: strongholds.tokens[tokenId] && strongholds.tokens[tokenId].slot_id || null,
    card_bga_id: strongholds.tokens[tokenId] && strongholds.tokens[tokenId].card_bga_id || ""
  });
  strongholds.tokens[tokenId] = token;
  return token;
}

function placeStrongholdTokenOnBgaCard(game, tokenId, destinationBgaId) {
  const strongholds = ensureStrongholds(game);
  const token = strongholds.tokens[String(tokenId)];
  if (!token) return null;
  const destination = marketSlotForBgaCardId(game, destinationBgaId);
  if (token.slot_id) removeStrongholdTokenFromSlot(game, tokenId);
  token.location = String(destinationBgaId || "");
  token.card_bga_id = String(destinationBgaId || "");
  if (!destination) {
    token.slot_id = null;
    return null;
  }
  token.slot_id = destination.slotId;
  if (!Array.isArray(strongholds.placements[destination.slotId])) strongholds.placements[destination.slotId] = [];
  strongholds.placements[destination.slotId].push(Number(token.player_index));
  return destination;
}

function applyBgaStrongholdEvent(game, item, playerLookup) {
  if (!item || !item.args) return null;
  const args = item.args;
  const actor = playerLookup[String(args.player_id || "")] || game.players[0];
  const actorIndex = Math.max(0, game.players.indexOf(actor));
  let tokenId = String(args.strongholdsId || "");
  const rawToken = args.stronghold || args.strongholds || { id: tokenId, type: args.player_id, location: args.strongholdsDestination };
  let token = ensureStrongholds(game).tokens[tokenId] || registerBgaStrongholdToken(game, rawToken, args.player_id);
  if (!token) return null;
  let fromSlotId = token.slot_id || null;
  const destination = String(args.strongholdsDestination || "draw");
  if (!destination || destination === "draw") {
    removeStrongholdTokenFromSlot(game, tokenId);
    return {
      type: "remove",
      token_id: tokenId,
      actor_index: actorIndex,
      player_index: Number(token.player_index),
      from_slot_id: fromSlotId,
      slot_id: fromSlotId,
      removed_player_index: Number(token.player_index),
      destination: "draw"
    };
  }
  const destinationSlot = marketSlotForBgaCardId(game, destination);
  if (destinationSlot && fromSlotId === destinationSlot.slotId) {
    token = tokenForRepeatedStrongholdDestination(game, token, destinationSlot.slotId);
    tokenId = String(token.id);
    fromSlotId = token.slot_id || null;
  }
  const target = placeStrongholdTokenOnBgaCard(game, tokenId, destination);
  token = ensureStrongholds(game).tokens[tokenId];
  return {
    type: fromSlotId ? "move" : "place",
    token_id: tokenId,
    actor_index: actorIndex,
    player_index: Number(token.player_index),
    from_slot_id: fromSlotId,
    slot_id: target ? target.slotId : null,
    card_id: target && target.card ? target.card.id : "",
    card_bga_id: destination,
    market_id: target ? target.marketId : "",
    tier: target ? target.tier : null,
    index: target ? target.index : null,
    destination
  };
}

function applyBgaStrongholdBuyReturn(game, item, playerLookup) {
  if (!item || !item.args) return [];
  const args = item.args;
  const actor = playerLookup[String(args.player_id || "")] || game.players[0];
  const actorIndex = Math.max(0, game.players.indexOf(actor));
  const returned = [];
  bgaObjectValues(args.strongholdsIdList).forEach((rawToken) => {
    const token = registerBgaStrongholdToken(game, rawToken, rawToken && rawToken.type || args.player_id);
    if (!token) return;
    const fromSlotId = token.slot_id || marketSlotForBgaCardId(game, rawToken && rawToken.location) && marketSlotForBgaCardId(game, rawToken && rawToken.location).slotId || null;
    if (fromSlotId && !token.slot_id) token.slot_id = fromSlotId;
    removeStrongholdTokenFromSlot(game, token.id);
    returned.push({
      type: "return",
      token_id: token.id,
      actor_index: actorIndex,
      player_index: Number(token.player_index),
      from_slot_id: fromSlotId,
      slot_id: fromSlotId,
      card_bga_id: String(args.card_id || rawToken && rawToken.location || ""),
      destination: "draw"
    });
  });
  return returned;
}

function applyBgaStrongholdEvents(game, items, playerLookup) {
  const effects = [];
  (items || []).forEach((item) => {
    if (item && item.type === "buyCardMoveStronghold") {
      effects.push(...applyBgaStrongholdBuyReturn(game, item, playerLookup));
    } else if (item && item.type === "moveStronghold") {
      const effect = applyBgaStrongholdEvent(game, item, playerLookup);
      if (effect) effects.push(effect);
    }
  });
  return effects;
}

function initializeBgaStrongholds(game, gamedatas) {
  const strongholdsByPlayer = gamedatas && gamedatas.market && gamedatas.market.strongholds || {};
  Object.keys(strongholdsByPlayer).forEach((bgaPlayerId) => {
    const tokens = strongholdsByPlayer[bgaPlayerId] || {};
    bgaObjectValues(tokens).forEach((rawToken) => {
      const token = registerBgaStrongholdToken(game, rawToken, bgaPlayerId);
      if (token && token.location && token.location !== "draw") {
        placeStrongholdTokenOnBgaCard(game, token.id, token.location);
      }
    });
  });
}

function applyBgaInitialGamedatas(game, gamedatas) {
  if (!gamedatas || !gamedatas.market || !gamedatas.carddb) return false;
  const market = gamedatas.market || {};
  if (market.pool) game.bank = bgaPoolToBank(market.pool);
  const orientActive = bgaInitialGamedatasOrientActive(gamedatas);
  const strongholdsActive = bgaInitialGamedatasStrongholdsActive(gamedatas);
  if (orientActive || strongholdsActive) {
    game.ruleset = createRuleset({ orient: orientActive, strongholds: strongholdsActive });
    game.module_state = createModuleState(game.ruleset);
  }
  [1, 2, 3].forEach((tier) => {
    const row = market[`row_${tier}`] || {};
    game.market[tier] = bgaObjectValues(row.cards)
      .map((entry) => bgaCardFromDb(bgaRawCardTypeId(entry, entry && entry.type), gamedatas, { tier }))
      .filter((card) => card && card.bga_id && card.bga_id !== "unknown");
    game.decks[tier] = bgaDeckPlaceholders(tier, Number(row.count) || 0);
    if (orientActive) {
      const orientRow = market[`orient_row_${tier}`] || {};
      game.orient_market[tier] = bgaObjectValues(orientRow.cards)
        .map((entry) => bgaCardFromDb(bgaRawCardTypeId(entry, entry && entry.type), gamedatas, { tier }))
        .filter((card) => card && card.bga_id && card.bga_id !== "unknown");
      game.orient_decks[tier] = bgaDeckPlaceholders(tier, Number(orientRow.count) || 0).map((card) => {
        card.module = ORIENT_MARKET_ID;
        return card;
      });
    }
  });
  game.nobles = bgaObjectValues(market.nobles)
    .map((entry) => bgaNobleFromDb(bgaRawCardTypeId(entry, entry && entry.type), gamedatas, {}))
    .filter((noble) => noble && noble.bga_id && noble.bga_id !== "unknown");
  if (strongholdsActive) initializeBgaStrongholds(game, gamedatas);
  const activePlayer = gamedatas.gamestate && gamedatas.gamestate.active_player;
  if (activePlayer !== undefined && activePlayer !== null) {
    const activeIndex = game.players.findIndex((player) => String(player.bga_id || "") === String(activePlayer));
    if (activeIndex >= 0) game.current = activeIndex;
  }
  game.round = Math.max(1, Number(gamedatas.roundnumber) || game.round || 1);
  return true;
}

function decrementBgaDeck(game, tier, marketId) {
  const decks = marketId === ORIENT_MARKET_ID ? game.orient_decks : game.decks;
  if (decks && decks[tier] && decks[tier].length) decks[tier].pop();
}

function removeBgaMarketCard(game, card) {
  const tier = Math.max(1, Math.min(3, Number(card && card.tier) || 1));
  const marketId = card && card.module === ORIENT_MARKET_ID ? ORIENT_MARKET_ID : BASE_MARKET_ID;
  const market = marketId === ORIENT_MARKET_ID ? game.orient_market : game.market;
  const cards = market[tier] || [];
  const index = cards.findIndex((entry) =>
    entry && card && ((entry.bga_id && entry.bga_id === card.bga_id) || entry.id === card.id)
  );
  if (index >= 0) {
    cards[index] = null;
    return { tier, index, marketId };
  }
  return null;
}

function clearStrongholdsAtSlot(game, slotId) {
  if (!slotId) return [];
  const strongholds = ensureStrongholds(game);
  const holders = Array.isArray(strongholds.placements[slotId]) ? strongholds.placements[slotId].slice() : [];
  delete strongholds.placements[slotId];
  Object.keys(strongholds.tokens).forEach((tokenId) => {
    const token = strongholds.tokens[tokenId];
    if (token && token.slot_id === slotId) {
      token.location = "draw";
      token.slot_id = null;
      token.card_bga_id = "";
    }
  });
  return holders;
}

function bgaMarketRefFromCardLocation(card, fallbackTier) {
  const location = String(card && card.location || "");
  const match = location.match(/^(market|orient)_(\d+)$/i);
  const marketId = match && match[1].toLowerCase() === "orient" ? ORIENT_MARKET_ID : BASE_MARKET_ID;
  const tier = Math.max(1, Math.min(3, Number(match && match[2] || fallbackTier) || 1));
  const rawIndex = Number(card && card.location_arg);
  return {
    marketId,
    tier,
    index: Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : null
  };
}

function findBgaRevealCardItem(items, slot, usedRevealItems) {
  const reveals = (items || []).filter((entry) =>
    entry && entry.type === "revealCard" && entry.args && entry.args.card && !(usedRevealItems && usedRevealItems.has(entry))
  );
  if (!slot) return reveals[0] || null;
  return reveals.find((entry) => {
    const ref = bgaMarketRefFromCardLocation(entry.args.card, slot.tier);
    return ref.marketId === slot.marketId && ref.tier === slot.tier && ref.index === slot.index;
  }) || reveals.find((entry) => {
    const ref = bgaMarketRefFromCardLocation(entry.args.card, slot.tier);
    return ref.marketId === slot.marketId && ref.tier === slot.tier;
  }) || reveals[0] || null;
}

function revealBgaMarketCard(game, items, tier, gamedatas, slot, usedRevealItems) {
  const reveal = findBgaRevealCardItem(items, slot, usedRevealItems);
  if (!reveal) return null;
  if (usedRevealItems) usedRevealItems.add(reveal);
  const revealCard = bgaCardFromNotification(reveal, items || [], { tier }, gamedatas);
  if (!revealCard || !revealCard.bga_id || revealCard.bga_id === "unknown") return null;
  const targetTier = Math.max(1, Math.min(3, Number(revealCard.tier || tier) || 1));
  const targetMarketId = revealCard.module === ORIENT_MARKET_ID ? ORIENT_MARKET_ID : BASE_MARKET_ID;
  const targetMarket = targetMarketId === ORIENT_MARKET_ID ? game.orient_market : game.market;
  const exists = (targetMarket[targetTier] || []).some((entry) => entry && entry.bga_id === revealCard.bga_id);
  if (!exists) {
    if (slot && slot.marketId === targetMarketId && slot.tier === targetTier && Number.isInteger(slot.index) && targetMarket[targetTier]) {
      targetMarket[targetTier][slot.index] = revealCard;
    } else {
      const emptyIndex = (targetMarket[targetTier] || []).findIndex((entry) => !entry);
      if (emptyIndex >= 0) targetMarket[targetTier][emptyIndex] = revealCard;
      else targetMarket[targetTier].push(revealCard);
    }
  }
  decrementBgaDeck(game, targetTier, targetMarketId);
  return revealCard;
}

function applyBgaRevealCards(game, items, gamedatas, usedRevealItems) {
  (items || []).forEach((entry) => {
    if (!entry || entry.type !== "revealCard" || !entry.args || !entry.args.card) return;
    if (usedRevealItems && usedRevealItems.has(entry)) return;
    const card = bgaCardFromNotification(entry, items || [], { card: entry.args.card }, gamedatas);
    if (!card || !card.bga_id || card.bga_id === "unknown") return;
    const targetTier = Math.max(1, Math.min(3, Number(card.tier) || 1));
    const targetMarketId = card.module === ORIENT_MARKET_ID ? ORIENT_MARKET_ID : BASE_MARKET_ID;
    const targetMarket = targetMarketId === ORIENT_MARKET_ID ? game.orient_market : game.market;
    const cards = targetMarket[targetTier] || [];
    if (cards.some((existing) => existing && existing.bga_id === card.bga_id)) return;
    const emptyIndex = cards.findIndex((existing) => !existing);
    const rawIndex = Number(entry.args.card.location_arg);
    if (emptyIndex >= 0) cards[emptyIndex] = card;
    else if (Number.isInteger(rawIndex) && rawIndex >= 0 && !cards[rawIndex]) cards[rawIndex] = card;
    else cards.push(card);
    targetMarket[targetTier] = cards;
    decrementBgaDeck(game, targetTier, targetMarketId);
    if (usedRevealItems) usedRevealItems.add(entry);
  });
}

function orientCardAbilities(card, effect) {
  return Array.isArray(card && card.abilities)
    ? card.abilities.filter((ability) => !effect || ability && ability.effect === effect)
    : [];
}

function orientFreeSourceCard(acquiredCards, tier) {
  for (let index = acquiredCards.length - 1; index >= 0; index -= 1) {
    const card = acquiredCards[index];
    if (orientCardAbilities(card, "take_level_free").some((ability) => Number(ability.free_tier) === Number(tier))) {
      return card;
    }
  }
  return acquiredCards[0] || null;
}

function acquireBgaBuyCard(game, player, buyItem, items, gamedatas, usedRevealItems) {
  const buyCard = bgaCardFromNotification(buyItem, items, { player_id: buyItem && buyItem.args && buyItem.args.player_id }, gamedatas);
  const fromHand = /hand/i.test(String(buyItem && buyItem.args && buyItem.args.card && buyItem.args.card.location || ""));
  let buySlot = null;
  let strongholdsReturned = [];
  if (fromHand) {
    const reservedIndex = player.reserved.findIndex((card) =>
      card.bga_id && card.bga_id === buyCard.bga_id || card.id === buyCard.id
    );
    if (reservedIndex >= 0) {
      buyCard.reserved_from = player.reserved[reservedIndex].reserved_from;
      player.reserved.splice(reservedIndex, 1);
    } else {
      buyCard.reserved_from = "deck";
    }
  } else {
    buySlot = removeBgaMarketCard(game, buyCard);
    if (buySlot) strongholdsReturned = clearStrongholdsAtSlot(game, marketSlotId(game, buySlot.marketId, buySlot.tier, buySlot.index));
    revealBgaMarketCard(game, items, buyCard.tier, gamedatas, buySlot, usedRevealItems);
  }
  applyCardBonuses(player, buyCard);
  player.purchased.push(buyCard);
  return {
    card: buyCard,
    fromHand,
    slot: buySlot,
    strongholdsReturned
  };
}

function groupBgaPacketsByMove(logs) {
  const groups = {};
  (logs || []).forEach((packet) => {
    const moveId = String(packet && packet.move_id || packet && packet.packet_id || "");
    if (!moveId) return;
    if (!groups[moveId]) groups[moveId] = { move_id: moveId, items: [] };
    groups[moveId].items = groups[moveId].items.concat(packet.data || []);
  });
  return Object.keys(groups)
    .sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
    .map((key) => groups[key]);
}

function createGameFromBgaPlayers(tableId, bgaPlayers, options = {}) {
  const tokenCount = tokenCountForPlayers(bgaPlayers.length);
  const ruleset = createRuleset({ orient: !!options.orient, strongholds: !!options.strongholds });
  const game = {
    schema: GEMTABLE_SCHEMA,
    created_at: new Date().toISOString(),
    mode: "live",
    playerCount: bgaPlayers.length,
    ruleset,
    module_state: createModuleState(ruleset),
    table_seed: 0,
    next_move_id: 1,
    players: bgaPlayers.map((player, index) => ({
      id: `p${index + 1}`,
      bga_id: String(player.id),
      name: String(player.name || `BGA Player ${index + 1}`).slice(0, 28),
      tokens: emptyCounts(true),
      bonuses: emptyCounts(false),
      reserved: [],
      purchased: [],
      nobles: [],
      ai: { enabled: false, mode: null, level: "balanced", available: false }
    })),
    bank: emptyCounts(true),
    decks: { 1: [], 2: [], 3: [] },
    market: { 1: [], 2: [], 3: [] },
    market_slots: createMarketSlots(),
    orient_decks: { 1: [], 2: [], 3: [] },
    orient_market: { 1: [], 2: [], 3: [] },
    strongholds: { placements: {}, tokens: {} },
    nobles: [],
    current: 0,
    round: 1,
    log: [`Imported BGA table ${tableId || "unknown"} archive log.`],
    moves: [],
    initial_gamedatas: null,
    gameOver: false
  };
  COLORS.forEach((color) => {
    game.bank[color] = tokenCount;
  });
  game.bank.gold = 5;
  return game;
}

function createBgaReplayTurnTracker(game) {
  return {
    round: Math.max(1, Number(game && game.round) || 1),
    lastPlayerIndex: null
  };
}

function syncBgaReplayTurnProgress(game, player, tracker) {
  if (!game || !player || !tracker) return;
  const playerIndex = game.players.indexOf(player);
  if (playerIndex < 0) return;
  if (tracker.lastPlayerIndex !== null && playerIndex !== tracker.lastPlayerIndex && playerIndex < tracker.lastPlayerIndex) {
    tracker.round += 1;
  }
  tracker.lastPlayerIndex = playerIndex;
  game.current = playerIndex;
  game.round = tracker.round;
}

function applyBgaMoveGroup(game, group, playerLookup, gamedatas) {
  const items = group.items || [];
  const publicReserve = items.find((entry) => entry.type === "reserveCard" && (entry.log || entry.args && entry.args.player_name));
  const privateReserve = items.find((entry) => entry.type === "reserveCard" && entry.args && entry.args.card);
  const buyItems = items.filter((entry) => entry.type === "buyCard");
  const buy = buyItems[0];
  const claim = items.find((entry) => entry.type === "claimNoble");
  const end = items.find((entry) => entry.type === "simpleNode" && /end of game/i.test(entry.log || ""));
  const coins = items.filter((entry) => entry.type === "coins");
  const strongholdPrimary = items.find((entry) => entry.type === "moveStronghold" || entry.type === "buyCardMoveStronghold");
  const primary = buy || publicReserve || privateReserve || claim || coins[0] || end || strongholdPrimary;
  if (!primary) return null;
  const primaryArgs = primary.args || {};
  let externalId = String(primaryArgs.player_id || "");
  if (!externalId && coins[0] && coins[0].args) externalId = String(coins[0].args.player_id || "");
  const player = playerLookup[externalId] || game.players[0];
  if (!player) return null;
  game.current = Math.max(0, game.players.indexOf(player));
  applyBgaCoinGaps(game, player, coins);
  const strongholdEffects = applyBgaStrongholdEvents(game, items, playerLookup);

  if (buy) {
    const usedRevealItems = new Set();
    const primaryPurchase = acquireBgaBuyCard(game, player, buy, items, gamedatas, usedRevealItems);
    const buyCard = primaryPurchase.card;
    const acquiredCards = [buyCard];
    const orientEffects = [];
    buyItems.slice(1).forEach((freeBuy) => {
      const freePurchase = acquireBgaBuyCard(game, player, freeBuy, items, gamedatas, usedRevealItems);
      const sourceCard = orientFreeSourceCard(acquiredCards, freePurchase.card.tier);
      acquiredCards.push(freePurchase.card);
      orientEffects.push({
        type: "free_card",
        source_card_id: sourceCard && sourceCard.id || buyCard.id,
        card_id: freePurchase.card.id,
        tier: freePurchase.card.tier,
        market_id: freePurchase.slot ? freePurchase.slot.marketId : freePurchase.card.module || BASE_MARKET_ID,
        market_slot_id: freePurchase.slot ? marketSlotId(game, freePurchase.slot.marketId, freePurchase.slot.tier, freePurchase.slot.index) : null,
        strongholds_returned: freePurchase.strongholdsReturned,
        card: clone(freePurchase.card)
      });
    });
    applyBgaRevealCards(game, items, gamedatas, usedRevealItems);
    const args = {
      card_id: buyCard.id,
      card: buyCard,
      tier: buyCard.tier,
      reserved_from: buyCard.reserved_from || "market",
      payment: { tokens: bgaCoinsFromGap(coins, -1), gold_as: emptyCounts(false) }
    };
    if (primaryPurchase.slot) {
      args.market_id = primaryPurchase.slot.marketId;
      args.market_index = primaryPurchase.slot.index;
      args.market_slot_id = marketSlotId(game, primaryPurchase.slot.marketId, primaryPurchase.slot.tier, primaryPurchase.slot.index);
    }
    if (primaryPurchase.strongholdsReturned.length) args.strongholds_returned = primaryPurchase.strongholdsReturned;
    if (strongholdEffects.length) args.stronghold_effects = strongholdEffects;
    if (orientEffects.length) args.orient_effects = orientEffects;
    return {
      type: primaryPurchase.fromHand ? "buyReserved" : "buyMarket",
      player,
      args
    };
  }

  if (publicReserve || privateReserve) {
    const reserveItem = publicReserve || privateReserve;
    const cardSource = privateReserve && privateReserve.args && privateReserve.args.card || reserveItem.args && reserveItem.args.card || {};
    const fromDeck = /^draw_/i.test(String(cardSource.location || "")) || !!(reserveItem.args && reserveItem.args.drawpile);
    const reserveCard = bgaCardFromNotification(reserveItem, items, { card: cardSource, id: bgaRawCardTypeId(cardSource, ""), player_id: externalId }, gamedatas);
    reserveCard.reserved_from = fromDeck ? "deck" : "market";
    reserveCard.reserved_public = !fromDeck;
    if (player.reserved.length < 3) player.reserved.push(reserveCard);
    if (fromDeck) {
      decrementBgaDeck(game, reserveCard.tier);
    } else {
      const reserveSlot = removeBgaMarketCard(game, reserveCard);
      if (reserveSlot) clearStrongholdsAtSlot(game, marketSlotId(game, reserveSlot.marketId, reserveSlot.tier, reserveSlot.index));
      const usedRevealItems = new Set();
      revealBgaMarketCard(game, items, reserveCard.tier, gamedatas, reserveSlot, usedRevealItems);
      applyBgaRevealCards(game, items, gamedatas, usedRevealItems);
    }
    if (fromDeck) applyBgaRevealCards(game, items, gamedatas);
    return {
      type: fromDeck ? "reserveDeck" : "reserveMarket",
      player,
      args: {
        card_id: reserveCard.id,
        card: reserveCard,
        tier: reserveCard.tier,
        took_gold: (bgaCoinsFromGap(coins, 1).gold || 0) > 0,
        stronghold_effects: strongholdEffects
      }
    };
  }

  if (claim) {
    const nobleRaw = bgaRawCardTypeId(claim.args && claim.args.card, group.move_id);
    let noble = bgaNobleFromDb(nobleRaw, gamedatas, { name: claim.args && claim.args.noble_desc || "BGA noble" });
    const nobleIndex = game.nobles.findIndex((entry) =>
      entry && ((entry.bga_id && entry.bga_id === noble.bga_id) || entry.id === noble.id)
    );
    if (nobleIndex >= 0) noble = game.nobles.splice(nobleIndex, 1)[0];
    player.nobles.push(noble);
    applyBgaRevealCards(game, items, gamedatas);
    return { type: "chooseNoble", player, args: { noble_id: noble.name } };
  }

  if (strongholdPrimary && strongholdEffects.length) {
    applyBgaRevealCards(game, items, gamedatas);
    return {
      type: "strongholdMove",
      player,
      args: {
        stronghold_effects: strongholdEffects
      }
    };
  }

  if (coins.length) {
    applyBgaRevealCards(game, items, gamedatas);
    return {
      type: "takeTokens",
      player,
      args: { colors: bgaTokenListFromCounts(bgaCoinsFromGap(coins, 1)) }
    };
  }

  if (end) {
    game.gameOver = true;
    applyBgaRevealCards(game, items, gamedatas);
    return { type: "gameEnd", player, args: {} };
  }
  return null;
}

export function convertBgaCaptureToGemTableReplay(payload) {
  const activeReasons = activeExpansionUnsupportedReasons(payload);
  if (activeReasons.length) {
    const details = activeReasons.map((entry) => `${entry.label || "Expansion"} at ${entry.path || "unknown path"}`).join("; ");
    throw new Error(`Active expansion flag detected: ${details}`);
  }
  const data = extractBgaReplayData(payload);
  if (!data) throw new Error("No BGA archive logs were found in the capture JSON.");
  const initialBgaGamedatas = extractBgaInitialGamedatas(payload);
  if (!initialBgaGamedatas) {
    throw new Error("No BGA initial gamedatas were found. Re-run the Splendor crawler with the latest BoardReplayLab tool so it enters the archive replay page before exporting.");
  }
  const bgaPlayers = buildBgaPlayerList(data, initialBgaGamedatas);
  if (bgaPlayers.length < 2) throw new Error("At least two BGA players are required for a Gem Table replay.");

  const orientActive = bgaInitialGamedatasOrientActive(initialBgaGamedatas);
  const strongholdsActive = bgaInitialGamedatasStrongholdsActive(initialBgaGamedatas);
  const game = createGameFromBgaPlayers(payload.table_id, bgaPlayers, { orient: orientActive, strongholds: strongholdsActive });
  const playerLookup = {};
  bgaPlayers.forEach((player, index) => {
    if (game.players[index]) playerLookup[String(player.id)] = game.players[index];
  });
  applyBgaInitialGamedatas(game, initialBgaGamedatas);
  game.initial_gamedatas = toGamedatas(game, true);
  const turnTracker = createBgaReplayTurnTracker(game);

  groupBgaPacketsByMove(data.logs).forEach((group) => {
    const converted = applyBgaMoveGroup(game, group, playerLookup, initialBgaGamedatas);
    if (!converted) return;
    const actor = converted.player;
    syncBgaReplayTurnProgress(game, actor, turnTracker);
    const move = {
      move_id: game.next_move_id,
      type: converted.type,
      player_id: actor.id,
      args: converted.args || {},
      notification: {
        type: converted.type,
        log: "",
        args: Object.assign({ player_id: actor.id, player_name: actor.name, bga_move_id: group.move_id }, converted.args || {})
      },
      state_after: toGamedatas(game, true)
    };
    game.log.unshift(`${actor.name} ${converted.type} (BGA move ${group.move_id}).`);
    game.moves.push(move);
    game.next_move_id += 1;
  });

  if (!game.moves.length) throw new Error("No supported Splendor actions were found in the BGA archive logs.");
  return {
    schema: GEMTABLE_SCHEMA,
    next_move_id: game.next_move_id,
    gamedatas: game.initial_gamedatas,
    moves: game.moves,
    source: "BoardReplayLab",
    source_schema: payload.schema || RAW_SCHEMA,
    bga_table_id: payload.table_id || "",
    compatibility: {
      base_game_only: !orientActive && !strongholdsActive,
      orient_supported: orientActive,
      strongholds_supported: strongholdsActive,
      active_expansion_flags: [],
      notes: [
        "The crawler exports browser-visible BGA gameui.gamedatas plus archive notifications.",
        "Inactive expansion references are ignored; active Orient and Strongholds are supported; other explicit active expansion flags are rejected.",
        "The output is ZephyrLabs Gem Table replay schema compatible, not an official BGA protocol clone."
      ]
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(usage());
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), args.input);
  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const replay = convertBgaCaptureToGemTableReplay(payload);
  const outputDir = path.resolve(process.cwd(), args.out);
  await mkdir(outputDir, { recursive: true });
  const tableId = String(replay.bga_table_id || path.basename(inputPath).replace(/\.[^.]+$/, ""));
  const outputPath = path.join(outputDir, `gemtable-bga-table-${tableId}-replay.json`);
  await writeFile(outputPath, JSON.stringify(replay), "utf8");
  console.log(`Saved ${outputPath}`);
  console.log(`Moves: ${replay.moves.length}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
