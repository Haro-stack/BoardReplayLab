import {
  GEMTABLE_EXPANSION_SCHEMA,
  MARKET_AREA_IDS,
  ORIENT_EXPANSION
} from "./gemtable-expansion-schema.mjs";

const GEMTABLE_SCHEMA = "zephyrlabs-gemtable-bga-v1";
const DINOBOARD_SCHEMA = "dinoboard-splendor2p-wire-v1";
const DINOBOARD_EXPANSION_SCHEMA = "dinoboard-splendor-wire-v2";
const DINOBOARD_EXPANSION_PUBLIC_SNAPSHOT_SCHEMA = "dinoboard-splendor-public-snapshot-v2";
const DINOBOARD_MODULE_MASK_BITS = Object.freeze({
  base: 1,
  orient: 2,
  cities: 4,
  trading: 8,
  strongholds: 16,
  silk_road: 32
});
const COLORS = ["white", "blue", "green", "red", "black"];
const ALL_TOKENS = COLORS.concat(["gold"]);
const TOKEN_INDEX = Object.fromEntries(ALL_TOKENS.map((color, index) => [color, index]));
const TWO_COLOR_COMBOS = [
  ["white", "blue"], ["white", "green"], ["white", "red"], ["white", "black"],
  ["blue", "green"], ["blue", "red"], ["blue", "black"],
  ["green", "red"], ["green", "black"],
  ["red", "black"]
];
const THREE_COLOR_COMBOS = [
  ["white", "blue", "green"], ["white", "blue", "red"], ["white", "blue", "black"],
  ["white", "green", "red"], ["white", "green", "black"], ["white", "red", "black"],
  ["blue", "green", "red"], ["blue", "green", "black"], ["blue", "red", "black"],
  ["green", "red", "black"]
];

const DINOBOARD_CARDS = [
  [1, 1, 0, [0, 0, 0, 0, 3]], [1, 1, 0, [1, 0, 0, 0, 2]], [1, 1, 0, [0, 0, 2, 0, 2]],
  [1, 1, 0, [1, 0, 2, 2, 0]], [1, 1, 0, [0, 1, 3, 1, 0]], [1, 1, 0, [1, 0, 1, 1, 1]],
  [1, 1, 0, [1, 0, 1, 2, 1]], [1, 1, 1, [0, 0, 0, 4, 0]], [1, 3, 0, [3, 0, 0, 0, 0]],
  [1, 3, 0, [0, 2, 1, 0, 0]], [1, 3, 0, [2, 0, 0, 2, 0]], [1, 3, 0, [2, 0, 1, 0, 2]],
  [1, 3, 0, [1, 0, 0, 1, 3]], [1, 3, 0, [1, 1, 1, 0, 1]], [1, 3, 0, [2, 1, 1, 0, 1]],
  [1, 3, 1, [4, 0, 0, 0, 0]], [1, 4, 0, [0, 0, 3, 0, 0]], [1, 4, 0, [0, 0, 2, 1, 0]],
  [1, 4, 0, [2, 0, 2, 0, 0]], [1, 4, 0, [2, 2, 0, 1, 0]], [1, 4, 0, [0, 0, 1, 3, 1]],
  [1, 4, 0, [1, 1, 1, 1, 0]], [1, 4, 0, [1, 2, 1, 1, 0]], [1, 4, 1, [0, 4, 0, 0, 0]],
  [1, 0, 0, [0, 3, 0, 0, 0]], [1, 0, 0, [0, 0, 0, 2, 1]], [1, 0, 0, [0, 2, 0, 0, 2]],
  [1, 0, 0, [0, 2, 2, 0, 1]], [1, 0, 0, [3, 1, 0, 0, 1]], [1, 0, 0, [0, 1, 1, 1, 1]],
  [1, 0, 0, [0, 1, 2, 1, 1]], [1, 0, 1, [0, 0, 4, 0, 0]], [1, 2, 0, [0, 0, 0, 3, 0]],
  [1, 2, 0, [2, 1, 0, 0, 0]], [1, 2, 0, [0, 2, 0, 2, 0]], [1, 2, 0, [0, 1, 0, 2, 2]],
  [1, 2, 0, [1, 3, 1, 0, 0]], [1, 2, 0, [1, 1, 0, 1, 1]], [1, 2, 0, [1, 1, 0, 1, 2]],
  [1, 2, 1, [0, 0, 0, 0, 4]], [2, 1, 1, [0, 2, 2, 3, 0]], [2, 1, 1, [0, 2, 3, 0, 3]],
  [2, 1, 2, [0, 5, 0, 0, 0]], [2, 1, 2, [5, 3, 0, 0, 0]], [2, 1, 2, [2, 0, 0, 1, 4]],
  [2, 1, 3, [0, 6, 0, 0, 0]], [2, 3, 1, [2, 0, 0, 2, 3]], [2, 3, 1, [0, 3, 0, 2, 3]],
  [2, 3, 2, [0, 0, 0, 0, 5]], [2, 3, 2, [3, 0, 0, 0, 5]], [2, 3, 2, [1, 4, 2, 0, 0]],
  [2, 3, 3, [0, 0, 0, 6, 0]], [2, 4, 1, [3, 2, 2, 0, 0]], [2, 4, 1, [3, 0, 3, 0, 2]],
  [2, 4, 2, [5, 0, 0, 0, 0]], [2, 4, 2, [0, 0, 5, 3, 0]], [2, 4, 2, [0, 1, 4, 2, 0]],
  [2, 4, 3, [0, 0, 0, 0, 6]], [2, 0, 1, [0, 0, 3, 2, 2]], [2, 0, 1, [2, 3, 0, 3, 0]],
  [2, 0, 2, [0, 0, 0, 5, 0]], [2, 0, 2, [0, 0, 0, 5, 3]], [2, 0, 2, [0, 0, 1, 4, 2]],
  [2, 0, 3, [6, 0, 0, 0, 0]], [2, 2, 1, [2, 3, 0, 0, 2]], [2, 2, 1, [3, 0, 2, 3, 0]],
  [2, 2, 2, [0, 0, 5, 0, 0]], [2, 2, 2, [0, 5, 3, 0, 0]], [2, 2, 2, [4, 2, 0, 0, 1]],
  [2, 2, 3, [0, 0, 6, 0, 0]], [3, 1, 3, [3, 0, 3, 3, 5]], [3, 1, 4, [7, 0, 0, 0, 0]],
  [3, 1, 4, [6, 3, 0, 0, 3]], [3, 1, 5, [7, 3, 0, 0, 0]], [3, 3, 3, [3, 5, 3, 0, 3]],
  [3, 3, 4, [0, 0, 7, 0, 0]], [3, 3, 4, [0, 3, 6, 3, 0]], [3, 3, 5, [0, 0, 7, 3, 0]],
  [3, 4, 3, [3, 3, 5, 3, 0]], [3, 4, 4, [0, 0, 0, 7, 0]], [3, 4, 4, [0, 0, 3, 6, 3]],
  [3, 4, 5, [0, 0, 0, 7, 3]], [3, 0, 3, [0, 3, 3, 5, 3]], [3, 0, 4, [0, 0, 0, 0, 7]],
  [3, 0, 4, [3, 0, 0, 3, 6]], [3, 0, 5, [3, 0, 0, 0, 7]], [3, 2, 3, [5, 3, 0, 3, 3]],
  [3, 2, 4, [0, 7, 0, 0, 0]], [3, 2, 4, [3, 6, 3, 0, 0]], [3, 2, 5, [0, 7, 3, 0, 0]]
];

const DINOBOARD_NOBLES = [
  [0, 0, 4, 4, 0], [0, 0, 0, 4, 4], [0, 4, 4, 0, 0], [4, 0, 0, 0, 4],
  [4, 4, 0, 0, 0], [3, 0, 0, 3, 3], [3, 3, 3, 0, 0], [0, 0, 3, 3, 3],
  [0, 3, 3, 3, 0], [3, 3, 0, 0, 3], [4, 0, 0, 4, 0], [0, 3, 3, 0, 3]
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function countObject(colors) {
  const out = {};
  COLORS.forEach((color) => {
    out[color] = Math.max(0, Number(colors && colors[color]) || 0);
  });
  return out;
}

function tokenArray(tokens) {
  return ALL_TOKENS.map((color) => Math.max(0, Number(tokens && tokens[color]) || 0));
}

function colorIndex(color) {
  const index = COLORS.indexOf(color);
  if (index < 0) throw new Error(`Unsupported Splendor color: ${color}`);
  return index;
}

function colorsFromCountObject(counts) {
  return COLORS.filter((color) => Number(counts && counts[color]) > 0);
}

function firstDefined() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== undefined && arguments[index] !== null) return arguments[index];
  }
  return undefined;
}

function toTier(value) {
  const tier = Number(value);
  if (tier >= 1 && tier <= 3) return tier;
  return 1;
}

function toSlotIndex(value) {
  const index = Number(value);
  if (Number.isInteger(index) && index >= 0) return index;
  return 0;
}

function comboIndex(combos, colors) {
  const sorted = colors.slice().sort((a, b) => COLORS.indexOf(a) - COLORS.indexOf(b));
  const key = sorted.join("|");
  const index = combos.findIndex((combo) => combo.join("|") === key);
  if (index < 0) throw new Error(`Unsupported token combination: ${key}`);
  return index;
}

function cardSignature(tier, color, points, cost) {
  return `${tier}|${colorIndex(color)}|${points}|${COLORS.map((c) => Number(cost && cost[c]) || 0).join(",")}`;
}

function dinoboardCardSignature(entry) {
  const [tier, bonus, points, cost] = entry;
  return `${tier}|${bonus}|${points}|${cost.join(",")}`;
}

function buildCardMaps() {
  const bySignature = new Map();
  const byDinoId = new Map();
  DINOBOARD_CARDS.forEach((entry, index) => {
    const cardId = index;
    bySignature.set(dinoboardCardSignature(entry), cardId);
    const [tier, bonus, points, cost] = entry;
    byDinoId.set(cardId, {
      id: `dinoboard-${cardId}`,
      tier,
      color: COLORS[bonus],
      points,
      cost: Object.fromEntries(COLORS.map((color, i) => [color, cost[i]]))
    });
  });
  return { bySignature, byDinoId };
}

const CARD_MAPS = buildCardMaps();

export function gemTableCardToDinoId(card) {
  if (!card) return -1;
  if (Number.isInteger(card.dinoboard_id)) return card.dinoboard_id;
  const signature = cardSignature(card.tier, card.color, Number(card.points) || 0, card.cost || {});
  const id = CARD_MAPS.bySignature.get(signature);
  if (id === undefined) throw new Error(`Cannot map Gem Table card to DinoBoard catalog: ${card.id || signature}`);
  return id;
}

export function dinoCardToGemTable(cardId) {
  if (!Number.isInteger(Number(cardId)) || Number(cardId) < 0) return null;
  const card = CARD_MAPS.byDinoId.get(Number(cardId));
  if (!card) throw new Error(`Unknown DinoBoard card id: ${cardId}`);
  return clone(card);
}

function nobleId(noble) {
  if (!noble) return -1;
  if (Number.isInteger(noble.dinoboard_id)) return noble.dinoboard_id;
  const requirements = noble.requirements || noble.cost || {};
  const signature = COLORS.map((color) => Number(requirements[color]) || 0).join(",");
  const index = DINOBOARD_NOBLES.findIndex((entry) => entry.join(",") === signature);
  if (index < 0) throw new Error(`Cannot map noble to DinoBoard catalog: ${noble.id || signature}`);
  return index;
}

function playerScore(player) {
  return Number(player.score) || (player.purchased || []).reduce((sum, card) => sum + (Number(card.points) || 0), 0) +
    (player.nobles || []).reduce((sum, noble) => sum + (Number(noble.points) || 0), 0);
}

export function encodeGemTableMoveAction(move) {
  const args = move.args || {};
  if (move.type === "buyMarket") return Number(args.tier - 1) * 4 + Number(firstDefined(args.market_index, args.index, 0));
  if (move.type === "reserveMarket") return 12 + Number(args.tier - 1) * 4 + Number(firstDefined(args.market_index, args.index, 0));
  if (move.type === "reserveDeck") return 24 + Number(args.tier - 1);
  if (move.type === "buyReserved") return 27 + Number(firstDefined(args.reserved_index, args.index, 0));
  if (move.type === "chooseNoble") return 60 + Number(firstDefined(args.noble_slot, args.index, 0));
  if (move.type === "returnToken" || move.type === "discard") {
    const token = args.color || args.token;
    if (!Object.prototype.hasOwnProperty.call(TOKEN_INDEX, token)) throw new Error(`Unsupported return token: ${token}`);
    return 63 + TOKEN_INDEX[token];
  }
  if (move.type === "pass") return 69;
  if (move.type === "takeTokens") {
    const counts = countObject(args.colors || args.tokens || {});
    const colors = colorsFromCountObject(counts);
    if (colors.length === 3 && colors.every((color) => counts[color] === 1)) return 30 + comboIndex(THREE_COLOR_COMBOS, colors);
    if (colors.length === 2 && colors.every((color) => counts[color] === 1)) return 40 + comboIndex(TWO_COLOR_COMBOS, colors);
    if (colors.length === 1 && counts[colors[0]] === 1) return 50 + colorIndex(colors[0]);
    if (colors.length === 1 && counts[colors[0]] === 2) return 55 + colorIndex(colors[0]);
  }
  throw new Error(`Unsupported Gem Table move for DinoBoard action mapping: ${move.type}`);
}

export function decodeDinoAction(actionId, snapshot = null) {
  const id = Number(actionId);
  if (id >= 0 && id <= 11) {
    const tier = Math.floor(id / 4) + 1;
    return { type: "buyMarket", args: { tier, market_index: id % 4 } };
  }
  if (id >= 12 && id <= 23) {
    const offset = id - 12;
    return { type: "reserveMarket", args: { tier: Math.floor(offset / 4) + 1, market_index: offset % 4 } };
  }
  if (id >= 24 && id <= 26) return { type: "reserveDeck", args: { tier: id - 23 } };
  if (id >= 27 && id <= 29) return { type: "buyReserved", args: { reserved_index: id - 27 } };
  if (id >= 30 && id <= 39) return { type: "takeTokens", args: { colors: Object.fromEntries(THREE_COLOR_COMBOS[id - 30].map((color) => [color, 1])) } };
  if (id >= 40 && id <= 49) return { type: "takeTokens", args: { colors: Object.fromEntries(TWO_COLOR_COMBOS[id - 40].map((color) => [color, 1])) } };
  if (id >= 50 && id <= 54) return { type: "takeTokens", args: { colors: { [COLORS[id - 50]]: 1 } } };
  if (id >= 55 && id <= 59) return { type: "takeTokens", args: { colors: { [COLORS[id - 55]]: 2 } } };
  if (id >= 60 && id <= 62) return { type: "chooseNoble", args: { noble_slot: id - 60, noble_id: snapshot && snapshot.nobles ? snapshot.nobles[id - 60] : id - 60 } };
  if (id >= 63 && id <= 68) return { type: "returnToken", args: { color: ALL_TOKENS[id - 63] } };
  if (id === 69) return { type: "pass", args: {} };
  throw new Error(`Unsupported DinoBoard action id for Splendor 2P: ${actionId}`);
}

function reservedVisibleCardId(card) {
  if (!card) return -1;
  if (card.reserved_public === false || card.reserved_from === "deck") return -1;
  return gemTableCardToDinoId(card);
}

function buildSnapshotFields(state) {
  if (!state || state.schema !== GEMTABLE_SCHEMA) throw new Error(`Expected Gem Table state schema ${GEMTABLE_SCHEMA}.`);
  if (!Array.isArray(state.players) || state.players.length !== 2) throw new Error("DinoBoard bridge v1 supports Splendor 2P only.");

  const market = state.market || {};
  const players = state.players;
  return {
    current_player: Math.max(0, Number(state.current) || 0),
    first_player: 0,
    plies: Math.max(0, Number(state.next_move_id || 1) - 1),
    final_round_remaining: state.finalTurnsLeft === null || state.finalTurnsLeft === undefined ? -1 : Number(state.finalTurnsLeft),
    stage: state.awaitingDiscard ? 1 : state.awaitingNobleChoice ? 2 : 0,
    pending_returns: state.awaitingDiscard ? 1 : 0,
    pending_nobles_size: state.awaitingNobleChoice ? 1 : 0,
    pending_noble_slots: [0, 0, 0],
    winner: Number.isInteger(state.winner) ? state.winner : -1,
    terminal: !!state.gameOver,
    shared_victory: false,
    nobles_size: Math.min(3, (state.nobles || []).length),
    scores: players.map(playerScore),
    bank: tokenArray(state.bank || {}),
    player_points: players.map(playerScore),
    player_cards_count: players.map((player) => (player.purchased || []).length),
    player_nobles_count: players.map((player) => (player.nobles || []).length),
    reserved_size: players.map((player) => (player.reserved || []).length),
    tableau_size: [1, 2, 3].map((tier) => (market[tier] || []).filter(Boolean).length),
    deck_sizes: [1, 2, 3].map((tier) => (state.decks && state.decks[tier] || []).length),
    nobles: [0, 1, 2].map((index) => nobleId((state.nobles || [])[index])),
    player_gems: players.map((player) => tokenArray(player.tokens || {})),
    player_bonuses: players.map((player) => COLORS.map((color) => Number(player.bonuses && player.bonuses[color]) || 0)),
    tableau: [1, 2, 3].map((tier) => [0, 1, 2, 3].map((index) => gemTableCardToDinoId((market[tier] || [])[index]))),
    reserved_visible: players.map((player) => [0, 1, 2].map((index) => reservedVisibleCardId((player.reserved || [])[index]) >= 0 ? 1 : 0)),
    reserved: players.map((player) => [0, 1, 2].map((index) => gemTableCardToDinoId((player.reserved || [])[index])))
  };
}

const SCALAR_FIELDS = [
  "current_player", "first_player", "plies", "final_round_remaining", "stage",
  "pending_returns", "pending_nobles_size", "winner", "terminal",
  "shared_victory", "nobles_size"
];
const VECTOR_FIELDS = {
  pending_noble_slots: 3,
  scores: 2,
  bank: 6,
  player_points: 2,
  player_cards_count: 2,
  player_nobles_count: 2,
  reserved_size: 2,
  tableau_size: 3,
  deck_sizes: 3,
  nobles: 3
};
const MATRIX_FIELDS = {
  player_gems: [2, 6],
  player_bonuses: [2, 5],
  tableau: [3, 4],
  reserved_visible: [2, 3],
  reserved: [2, 3]
};

function visibleReservedSlice(fields, perspective) {
  const slice = [];
  for (let player = 0; player < 2; player += 1) {
    for (let slot = 0; slot < 3; slot += 1) {
      slice.push(player === perspective || fields.reserved_visible[player][slot] ? 1 : 0);
    }
  }
  return slice;
}

function addScalar(snapshot, name, value) {
  snapshot[name] = [[], value];
}

function addVector(snapshot, name, values) {
  snapshot[name] = [];
  values.forEach((value, index) => {
    snapshot[name].push([index], value);
  });
}

function addMatrix(snapshot, name, values, visibleSlice = null) {
  snapshot[name] = [];
  values.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const flatIndex = rowIndex * row.length + colIndex;
      if (visibleSlice && !visibleSlice[flatIndex]) return;
      snapshot[name].push([rowIndex, colIndex], value);
    });
  });
}

function ones(length) {
  return Array.from({ length }, () => 1);
}

export function buildPublicSnapshot(state, perspective = 1) {
  const fields = buildSnapshotFields(state);
  const reservedViz = visibleReservedSlice(fields, perspective);
  const snapshot = {};
  SCALAR_FIELDS.forEach((name) => addScalar(snapshot, name, fields[name]));
  Object.keys(VECTOR_FIELDS).forEach((name) => addVector(snapshot, name, fields[name]));
  Object.keys(MATRIX_FIELDS).forEach((name) => {
    addMatrix(snapshot, name, fields[name], name === "reserved" ? reservedViz : null);
  });
  snapshot.__viz__ = {};
  SCALAR_FIELDS.forEach((name) => {
    snapshot.__viz__[name] = [1];
  });
  Object.entries(VECTOR_FIELDS).forEach(([name, length]) => {
    snapshot.__viz__[name] = ones(length);
  });
  Object.entries(MATRIX_FIELDS).forEach(([name, shape]) => {
    snapshot.__viz__[name] = name === "reserved" ? reservedViz : ones(shape[0] * shape[1]);
  });
  return snapshot;
}

function sourceState(value) {
  if (!value || typeof value !== "object") return value;
  return value.source_state || value;
}

function expansionBaseState(state) {
  if (!state || typeof state !== "object") return null;
  if (state.schema === GEMTABLE_SCHEMA) return state;
  const candidates = [
    state.base_state,
    state.baseState,
    state.gamedatas && state.gamedatas.source_state,
    state.gamedatas,
    state.source_state
  ];
  return candidates.map(sourceState).find((candidate) => candidate && candidate.schema === GEMTABLE_SCHEMA) || null;
}

function baseMarketAreasFromV1(state) {
  const market = state.market || {};
  return {
    base: {
      id: MARKET_AREA_IDS.BASE,
      expansion: null,
      tiers: Object.fromEntries([1, 2, 3].map((tier) => [
        tier,
        (market[tier] || []).map((card, index) => {
          if (!card) return null;
          return Object.assign({}, card, {
            slot: {
              area: MARKET_AREA_IDS.BASE,
              expansion: null,
              tier,
              index,
              slot_id: `${MARKET_AREA_IDS.BASE}:t${tier}:s${index}`,
              card_id: String(card.id || ""),
              legacy_args: { tier, market_index: index }
            },
            ability: null
          });
        })
      ]))
    }
  };
}

function marketAreasForExpansionSnapshot(state) {
  if (state && state.schema === GEMTABLE_EXPANSION_SCHEMA && state.market_areas) return state.market_areas;
  const baseState = expansionBaseState(state);
  if (baseState) return baseMarketAreasFromV1(baseState);
  throw new Error(`Expected Gem Table state schema ${GEMTABLE_SCHEMA} or ${GEMTABLE_EXPANSION_SCHEMA}.`);
}

function normalizedSlot(card, area, tier, index) {
  const existing = card && card.slot || {};
  const slotArea = existing.area || area || MARKET_AREA_IDS.BASE;
  const slotTier = toTier(firstDefined(existing.tier, tier));
  const slotIndex = toSlotIndex(firstDefined(existing.index, existing.slot, existing.position, index));
  return {
    area: slotArea,
    expansion: firstDefined(existing.expansion, slotArea === MARKET_AREA_IDS.ORIENT ? ORIENT_EXPANSION : null),
    tier: slotTier,
    index: slotIndex,
    slot_id: existing.slot_id || `${slotArea}:t${slotTier}:s${slotIndex}`,
    card_id: String(firstDefined(existing.card_id, card && (card.bga_id || card.id), "")),
    legacy_args: existing.legacy_args === undefined
      ? (slotArea === MARKET_AREA_IDS.BASE ? { tier: slotTier, market_index: slotIndex } : null)
      : existing.legacy_args
  };
}

function safeDinoCatalogId(card, slot) {
  if (!card || slot.area !== MARKET_AREA_IDS.BASE) return null;
  try {
    return gemTableCardToDinoId(card);
  } catch (_error) {
    return null;
  }
}

function cardWireMetadata(card, slot) {
  if (!card) return null;
  const ability = card.ability || card.ability_metadata || null;
  return {
    id: String(firstDefined(card.id, card.bga_id, slot.card_id, "")),
    source_card_id: String(firstDefined(card.bga_id, slot.card_id, card.id, "")),
    dinoboard_catalog_id: safeDinoCatalogId(card, slot),
    tier: slot.tier,
    color: String(card.color || ""),
    points: Math.max(0, Number(card.points) || 0),
    cost: countObject(card.cost || {}),
    ability
  };
}

function slotLegacyActionId(kind, slot) {
  if (slot.area !== MARKET_AREA_IDS.BASE) return null;
  if (slot.tier < 1 || slot.tier > 3 || slot.index < 0 || slot.index > 3) return null;
  const type = kind === "buy" ? "buyMarket" : "reserveMarket";
  return encodeGemTableMoveAction({ type, args: { tier: slot.tier, market_index: slot.index } });
}

function slotAction(kind, slot) {
  const legacyActionId = slotLegacyActionId(kind, slot);
  const baseExecutable = Number.isInteger(legacyActionId);
  return {
    id: `${kind}:${slot.slot_id}`,
    kind,
    type: kind === "buy" ? "buy_market_slot" : "reserve_market_slot",
    target: {
      kind: "market_slot",
      slot_id: slot.slot_id,
      area: slot.area,
      tier: slot.tier,
      index: slot.index
    },
    status: baseExecutable ? "base_v1_candidate" : "pending_engine_support",
    executable: baseExecutable,
    legacy_action_id: legacyActionId,
    legacy_args: baseExecutable ? { tier: slot.tier, market_index: slot.index } : null
  };
}

function pendingAbility(card, slot) {
  const ability = card && (card.ability || card.ability_metadata);
  if (!ability) return null;
  return {
    id: `ability:${slot.slot_id}`,
    kind: "card_ability",
    slot_id: slot.slot_id,
    card_id: String(firstDefined(card.id, card.bga_id, slot.card_id, "")),
    ability_code: ability.code || "unknown_orient_ability",
    expansion: ability.expansion || slot.expansion,
    status: ability.support_status || "metadata_only",
    unsupported_reason: ability.unsupported_reason || null
  };
}

function expansionMarketSlots(state) {
  const areas = marketAreasForExpansionSnapshot(state);
  const slots = [];
  Object.keys(areas).sort().forEach((areaKey) => {
    const area = areas[areaKey] || {};
    const tiers = area.tiers || {};
    [1, 2, 3].forEach((tier) => {
      (tiers[tier] || tiers[String(tier)] || []).forEach((card, index) => {
        if (!card) return;
        const slot = normalizedSlot(card, area.id || areaKey, tier, index);
        const cardMetadata = cardWireMetadata(card, slot);
        const legal_actions = [slotAction("buy", slot), slotAction("reserve", slot)];
        slots.push({
          slot_id: slot.slot_id,
          area: slot.area,
          expansion: slot.expansion,
          tier: slot.tier,
          index: slot.index,
          card: cardMetadata,
          legal_actions,
          pending: [pendingAbility(card, slot)].filter(Boolean)
        });
      });
    });
  });
  return slots.sort((a, b) => a.slot_id.localeCompare(b.slot_id));
}

function moduleKeysForSnapshot(state, slots) {
  const modules = new Set(["base"]);
  slots.forEach((slot) => {
    if (slot.area === MARKET_AREA_IDS.ORIENT || slot.expansion === ORIENT_EXPANSION) modules.add("orient");
  });
  const active = state && state.expansion_status && Array.isArray(state.expansion_status.active)
    ? state.expansion_status.active
    : [];
  active.forEach((label) => {
    const key = String(label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (key && Object.prototype.hasOwnProperty.call(DINOBOARD_MODULE_MASK_BITS, key)) modules.add(key);
  });
  return Array.from(modules).sort((a, b) => DINOBOARD_MODULE_MASK_BITS[a] - DINOBOARD_MODULE_MASK_BITS[b]);
}

function moduleMask(modules) {
  return modules.reduce((mask, key) => mask | (DINOBOARD_MODULE_MASK_BITS[key] || 0), 0);
}

export function buildExpansionPublicSnapshot(state, perspective = 1) {
  const normalized = sourceState(state);
  const baseState = expansionBaseState(normalized);
  const market_slots = expansionMarketSlots(normalized);
  const modules = moduleKeysForSnapshot(normalized, market_slots);
  return {
    schema: DINOBOARD_EXPANSION_PUBLIC_SNAPSHOT_SCHEMA,
    base_wire_schema: DINOBOARD_SCHEMA,
    source_schema: normalized && normalized.schema || "",
    perspective,
    module_mask: moduleMask(modules),
    active_modules: modules,
    module_bits: DINOBOARD_MODULE_MASK_BITS,
    base_v1_public_snapshot: baseState ? buildPublicSnapshot(baseState, perspective) : null,
    market_slots,
    legal_actions: market_slots.flatMap((slot) => slot.legal_actions),
    pending: market_slots.flatMap((slot) => slot.pending)
  };
}

function buildEvents(beforeState, afterState, move, aiSeat) {
  const events = [];
  const before = beforeState ? buildSnapshotFields(beforeState) : null;
  const after = afterState ? buildSnapshotFields(afterState) : null;
  if (before && after) {
    after.tableau.forEach((row, tier) => {
      row.forEach((cardId, slot) => {
        if (cardId !== before.tableau[tier][slot]) {
          events.push({ kind: "deck_flip", payload: { tier, slot, card_id: cardId } });
        }
      });
    });
  }

  const actorIndex = (beforeState && beforeState.players || []).findIndex((player) => String(player.id) === String(move.player_id));
  if (move.type === "reserveDeck" && actorIndex === aiSeat) {
    const reserved = afterState.players[actorIndex].reserved || [];
    const card = reserved[reserved.length - 1];
    events.push({
      kind: "self_reserve_deck",
      payload: { player: actorIndex, slot: reserved.length - 1, card_id: gemTableCardToDinoId(card) }
    });
  }
  if (move.type === "buyReserved" && actorIndex !== aiSeat) {
    const index = Number(firstDefined((move.args || {}).reserved_index, (move.args || {}).index, 0));
    const beforeCard = beforeState.players[actorIndex].reserved[index];
    if (beforeCard && (beforeCard.reserved_public === false || beforeCard.reserved_from === "deck")) {
      const card = (move.args || {}).card || beforeCard;
      events.push({
        kind: "opp_buy_reserved_reveal",
        payload: { player: actorIndex, slot: index, card_id: gemTableCardToDinoId(card) }
      });
    }
  }
  return events;
}

export function convertGemTableReplayToDinoBoard(replay, options = {}) {
  if (!replay || replay.schema !== GEMTABLE_SCHEMA || !replay.gamedatas) {
    throw new Error(`Expected Gem Table replay schema ${GEMTABLE_SCHEMA}.`);
  }
  const initialState = replay.gamedatas.source_state || replay.gamedatas;
  const aiSeat = Number.isInteger(options.aiSeat) ? options.aiSeat : 1;
  const observations = [];
  let beforeState = initialState;

  (replay.moves || []).forEach((move) => {
    const afterState = move.state_after && (move.state_after.source_state || move.state_after);
    if (!afterState) throw new Error(`Move ${move.move_id || "?"} is missing state_after.source_state.`);
    observations.push({
      move_id: move.move_id,
      actor: (beforeState.players || []).findIndex((player) => String(player.id) === String(move.player_id)),
      action_id: encodeGemTableMoveAction(move),
      events: buildEvents(beforeState, afterState, move, aiSeat),
      public_snapshot: buildPublicSnapshot(afterState, aiSeat)
    });
    beforeState = afterState;
  });

  return {
    schema: DINOBOARD_SCHEMA,
    game_id: "splendor_2p",
    ai_seat: aiSeat,
    initial_observation: {
      public_snapshot: buildPublicSnapshot(initialState, aiSeat),
      tracker_init: {}
    },
    observations
  };
}

function tryEncodeGemTableMoveAction(move) {
  try {
    return encodeGemTableMoveAction(move);
  } catch (_error) {
    return null;
  }
}

function actorIndexForMove(state, move) {
  const baseState = expansionBaseState(state);
  const players = baseState && baseState.players || state && state.players || [];
  return players.findIndex((player) => String(player.id) === String(move.player_id));
}

export function convertGemTableReplayToDinoBoardV2(replay, options = {}) {
  if (!replay || !replay.gamedatas) {
    throw new Error(`Expected Gem Table replay with gamedatas for ${DINOBOARD_EXPANSION_SCHEMA}.`);
  }
  const initialState = sourceState(replay.gamedatas.source_state || replay.gamedatas);
  const aiSeat = Number.isInteger(options.aiSeat) ? options.aiSeat : 1;
  const observations = [];
  let beforeState = initialState;

  (replay.moves || []).forEach((move) => {
    const afterState = move.state_after && sourceState(move.state_after.source_state || move.state_after);
    if (!afterState) throw new Error(`Move ${move.move_id || "?"} is missing state_after.source_state.`);
    observations.push({
      move_id: move.move_id,
      actor: actorIndexForMove(beforeState, move),
      action_id: tryEncodeGemTableMoveAction(move),
      action: {
        type: move.type || "",
        args: clone(move.args || {}),
        status: tryEncodeGemTableMoveAction(move) === null ? "pending_engine_support" : "base_v1_candidate"
      },
      public_snapshot: buildExpansionPublicSnapshot(afterState, aiSeat)
    });
    beforeState = afterState;
  });

  return {
    schema: DINOBOARD_EXPANSION_SCHEMA,
    base_wire_schema: DINOBOARD_SCHEMA,
    game_id: "splendor",
    ai_seat: aiSeat,
    initial_observation: {
      public_snapshot: buildExpansionPublicSnapshot(initialState, aiSeat),
      tracker_init: {}
    },
    observations
  };
}

export function convertDinoBoardReplayToGemTable(payload) {
  if (!payload || !Array.isArray(payload.frames)) {
    throw new Error("DinoBoard -> Gem Table conversion requires framed replay input with `frames`; action_history alone is not enough.");
  }
  const moves = [];
  const first = payload.frames[0];
  if (!first || !first.public_snapshot) throw new Error("DinoBoard framed replay must include an initial public_snapshot.");
  for (let index = 1; index < payload.frames.length; index += 1) {
    const frame = payload.frames[index];
    const decoded = decodeDinoAction(frame.action_id, frame.public_snapshot);
    moves.push({
      move_id: frame.move_id || index,
      type: decoded.type,
      player_id: String(firstDefined(frame.actor, "")),
      args: decoded.args,
      notification: { type: decoded.type, log: "", args: decoded.args },
      state_after: {
        schema: GEMTABLE_SCHEMA,
        source_state: {
          schema: GEMTABLE_SCHEMA,
          dinoboard_public_snapshot: clone(frame.public_snapshot)
        }
      }
    });
  }
  return {
    schema: GEMTABLE_SCHEMA,
    next_move_id: moves.length + 1,
    gamedatas: {
      schema: GEMTABLE_SCHEMA,
      source_state: {
        schema: GEMTABLE_SCHEMA,
        dinoboard_public_snapshot: clone(first.public_snapshot)
      }
    },
    moves,
    source: "DinoBoard",
    source_schema: payload.schema || "dinoboard-framed-replay"
  };
}

export {
  DINOBOARD_EXPANSION_PUBLIC_SNAPSHOT_SCHEMA,
  DINOBOARD_EXPANSION_SCHEMA,
  DINOBOARD_MODULE_MASK_BITS,
  DINOBOARD_SCHEMA,
  GEMTABLE_SCHEMA,
  COLORS,
  ALL_TOKENS
};
